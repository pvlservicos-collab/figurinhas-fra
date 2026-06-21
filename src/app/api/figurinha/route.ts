import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { getDb } from "@/lib/db";

export const maxDuration = 300;

// Tabela de crescimento — percentil 50 (altura cm, peso kg)
const growthChart: Record<number, { altura: number; peso: number }> = {
  0: { altura: 50, peso: 3 }, 1: { altura: 76, peso: 10 }, 2: { altura: 88, peso: 12 },
  3: { altura: 96, peso: 14 }, 4: { altura: 103, peso: 16 }, 5: { altura: 110, peso: 18 },
  6: { altura: 116, peso: 21 }, 7: { altura: 122, peso: 23 }, 8: { altura: 128, peso: 26 },
  9: { altura: 133, peso: 29 }, 10: { altura: 138, peso: 32 }, 11: { altura: 143, peso: 36 },
  12: { altura: 149, peso: 40 }, 13: { altura: 156, peso: 45 }, 14: { altura: 163, peso: 51 },
  15: { altura: 170, peso: 56 }, 16: { altura: 173, peso: 61 }, 17: { altura: 175, peso: 65 },
  18: { altura: 175, peso: 68 },
};

function getGrowthData(dataNascimento: string) {
  const birth = new Date(dataNascimento);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  if (age < 0) age = 0;
  const data = growthChart[Math.min(age, 18)] || growthChart[18];
  const alturaM = (data.altura / 100).toFixed(2).replace(".", ",");
  const birthDate = `${String(birth.getDate()).padStart(2, "0")}-${String(birth.getMonth() + 1).padStart(2, "0")}-${birth.getFullYear()}`;
  return { birthDate, altura: alturaM, peso: data.peso };
}

let cachedModeloBuffer: Buffer | null = null;

async function getModeloComprimido(): Promise<Buffer> {
  if (cachedModeloBuffer) return cachedModeloBuffer;

  let rawBuffer: Buffer;
  try {
    const modeloPath = join(process.cwd(), "public", "modelo-figurinha.png");
    rawBuffer = readFileSync(modeloPath);
    console.log("modelo: carregado do filesystem");
  } catch (fsErr) {
    const host = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
    console.log(`modelo: filesystem falhou (${fsErr instanceof Error ? fsErr.message : fsErr}), buscando via HTTP de ${host}`);
    const res = await fetch(`${host}/modelo-figurinha.png`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar modelo-figurinha.png`);
    rawBuffer = Buffer.from(await res.arrayBuffer());
  }

  cachedModeloBuffer = await sharp(rawBuffer).resize(512).jpeg({ quality: 75 }).toBuffer();
  return cachedModeloBuffer;
}

function ms(start: number) { return `${Date.now() - start}ms`; }

// Rate limit simples em memória
const requestLog = new Map<string, number[]>();
function checkRateLimit(ip: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) || [];
  const recent = timestamps.filter(t => now - t < windowMs);
  if (recent.length >= maxRequests) return false;
  recent.push(now);
  requestLog.set(ip, recent);
  return true;
}

// Sanitizar input — só letras, números, espaços, acentos e hífens
function sanitizeInput(value: string, maxLen: number): string {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g, "").slice(0, maxLen).trim();
}

function getOpenAIKeys(): string[] {
  const keys: string[] = [];
  if (process.env.OPENAI_API_KEY)   keys.push(process.env.OPENAI_API_KEY);
  if (process.env.OPENAI_API_KEY2)  keys.push(process.env.OPENAI_API_KEY2);
  if (process.env.OPENAI_API_KEY_2) keys.push(process.env.OPENAI_API_KEY_2);
  if (process.env.OPENAI_API_KEY_3) keys.push(process.env.OPENAI_API_KEY_3);
  if (process.env.OPENAI_API_KEY_4) keys.push(process.env.OPENAI_API_KEY_4);
  return [...new Set(keys)]; // deduplica se OPENAI_API_KEY2 === OPENAI_API_KEY_2
}

// Rastreia gerações ativas por key — garante que requests simultâneos usem keys diferentes
const keyInFlight = new Map<number, number>();
let rrBase = 0;

function pickBestKey(total: number): number {
  let best = rrBase % total;
  let bestLoad = keyInFlight.get(best) ?? 0;
  for (let i = 1; i < total; i++) {
    const idx = (rrBase + i) % total;
    const load = keyInFlight.get(idx) ?? 0;
    if (load < bestLoad) { bestLoad = load; best = idx; }
  }
  rrBase = (rrBase + 1) % total;
  return best;
}

export async function POST(req: NextRequest) {
  const apiKeys = getOpenAIKeys();
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!checkRateLimit(ip, 5, 60000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  let body: { nome: string; dataNascimento: string; email: string; clube: string; jogadorFavorito: string; fotoBase64: string; errorTimestamp?: string; retryAttempt?: number; };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { nome, dataNascimento, email, clube, jogadorFavorito, fotoBase64, errorTimestamp } = body;
  if (!nome || !dataNascimento || !clube || !fotoBase64) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const nomeSafe  = sanitizeInput(nome, 50);
  const clubeSafe = sanitizeInput(clube, 50);
  const jogadorSafe = sanitizeInput(jogadorFavorito || "", 50);

  if (nomeSafe.length < 2 || clubeSafe.length < 2) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dataNascimento)) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  if (fotoBase64.length > 7_000_000) {
    return NextResponse.json({ error: "Imagem muito grande" }, { status: 400 });
  }

  let fotoBuffer: Buffer;
  try {
    fotoBuffer = Buffer.from(fotoBase64, "base64");
    if (fotoBuffer.length > 5_000_000) {
      return NextResponse.json({ error: "Imagem muito grande" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Imagem inválida" }, { status: 400 });
  }

  const t0 = Date.now();
  const sql = getDb();
  const emailSafe = email ? email.slice(0, 255).trim().toLowerCase() : null;

  // Se é retry após erro, buscar figurinha criada DEPOIS do timestamp de erro
  if (errorTimestamp && emailSafe) {
    try {
      const ts = new Date(errorTimestamp);
      if (!isNaN(ts.getTime())) {
        const existing = await sql`
          SELECT sticker_id, sticker_url FROM pedidos
          WHERE email = ${emailSafe}
            AND sticker_url IS NOT NULL
            AND created_at >= ${ts.toISOString()}
          ORDER BY created_at DESC LIMIT 1
        `;
        if (existing.length > 0) {
          try {
            const blobRes = await fetch(existing[0].sticker_url);
            const blobBuffer = Buffer.from(await blobRes.arrayBuffer());
            console.log(`Retry: figurinha pós-erro encontrada: ${existing[0].sticker_id}`);
            return NextResponse.json({
              imageBase64: blobBuffer.toString("base64"),
              mimeType: "image/png",
              stickerId: existing[0].sticker_id,
            });
          } catch {
            console.log("Retry: figurinha pós-erro não acessível, gerando nova...");
          }
        }
      }
    } catch (dbErr) {
      console.error("Erro na busca pós-erro:", dbErr);
    }
  }

  // Rascunho no DB + compressão da foto + carregamento do modelo — em paralelo
  const rascunhoPromise = emailSafe
    ? sql<{ id: number }[]>`
        INSERT INTO pedidos (nome, data_nascimento, clube, jogador_favorito, email, status)
        VALUES (${nomeSafe}, ${dataNascimento}, ${clubeSafe}, ${jogadorSafe}, ${emailSafe}, 'gerando')
        RETURNING id
      `.catch(() => null)
    : Promise.resolve(null);

  const fotoCompressPromise = sharp(fotoBuffer).resize(512).jpeg({ quality: 80 }).toBuffer()
    .catch(() => fotoBuffer);

  const [fotoBufferComprimido, modeloBuffer, rascunhoRows] = await Promise.all([
    fotoCompressPromise,
    getModeloComprimido(),
    rascunhoPromise,
  ]);

  const rascunhoId: number | null = Array.isArray(rascunhoRows) ? (rascunhoRows[0]?.id ?? null) : null;
  console.log(`pré-geração paralela: ${ms(t0)} | rascunhoId=${rascunhoId}`);

  const nomeUpper    = nomeSafe.toUpperCase();
  const clubeFormatted = clubeSafe.toUpperCase();
  const growthData   = getGrowthData(dataNascimento);
  const infoLine     = growthData.birthDate;

  const prompt = `You are given two images:
- Image 1: A photograph of a person (the SUBJECT). This person may be a child or an adult.
- Image 2: A collectible sports sticker card (the TEMPLATE).

TASK: Create a new version of the sticker card (Image 2) featuring the person from Image 1.

INSTRUCTIONS:

1. REMOVE the adult athlete from Image 2 entirely.

2. GENERATE a medium close-up portrait of the person from Image 1: from the chest up, facing forward, arms down. The person must wear the blue France 2026 national team jersey (dark blue, "Bleu de France" #002395) with the French Football Federation badge on the chest. IMPORTANT: the jersey and body must match the REAL proportions of the person from Image 1. If the subject is a child, draw a child-sized body with a child-sized jersey. If the subject is an adult, draw an adult-sized body. Do NOT put a child's head on an adult body.

3. The person's FACE must be identical to Image 1: same facial features, expression, hair, skin tone, eyes, smile. Do not alter the face in any way.

4. Place this portrait into the card, centered in the same area where the original athlete was.

5. Keep ALL other elements of Image 2 exactly as they are: turquoise background, green "26" graphic, all icons, emblems, flag, vertical text, logos, borders, card edges, bottom text area.

6. Update the text fields with the following data:
[NAME]: ${nomeUpper}
[INFO]: ${infoLine}
[CLUB]: ${clubeFormatted}

The result must look like a real printed collectible sticker card with a properly proportioned portrait of the person from Image 1.`;

  // Escolhe a key com menos gerações ativas
  const startIdx = pickBestKey(apiKeys.length);
  keyInFlight.set(startIdx, (keyInFlight.get(startIdx) ?? 0) + 1);
  console.log(`key escolhida: ${startIdx + 1} | in-flight: [${Array.from({length: apiKeys.length}, (_, i) => keyInFlight.get(i) ?? 0).join(",")}]`);

  try {
    let b64Result: string | null = null;
    let successKeyIdx = -1;
    const genStart = Date.now();
    let attempt = 0;
    const TIMEOUT_MS = 250_000;
    const deadKeys = new Set<number>();

    console.log(`API start — ${apiKeys.length} key(s), key ${startIdx + 1} primeiro | total até aqui: ${ms(t0)}`);

    while (!b64Result && (Date.now() - genStart) < TIMEOUT_MS) {
      const keyIdx = (startIdx + attempt) % apiKeys.length;

      if (deadKeys.has(keyIdx)) {
        if (deadKeys.size >= apiKeys.length) break;
        attempt++;
        continue;
      }

      const openai = new OpenAI({ apiKey: apiKeys[keyIdx] });
      try {
        const fotoFile   = await toFile(fotoBufferComprimido, "foto.jpg", { type: "image/jpeg" });
        const modeloFile = await toFile(modeloBuffer, "modelo.jpg", { type: "image/jpeg" });

        const response = await openai.images.edit({
          model: "gpt-image-2",
          image: [fotoFile, modeloFile],
          prompt,
          size: "768x1152",
        });
        const candidate = response.data?.[0]?.b64_json;
        if (candidate) {
          b64Result = candidate;
          successKeyIdx = keyIdx;
          console.log(`API ok — key ${keyIdx + 1}, tentativa ${attempt + 1} | API: ${ms(genStart)} | total: ${ms(t0)}`);
        }
      } catch (apiErr: unknown) {
        const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        const status = (apiErr as { status?: number }).status ?? 0;
        if (status === 401 || status === 403 || status === 402) {
          deadKeys.add(keyIdx);
          console.log(`Key ${keyIdx + 1} morta (${status}): ${errMsg.slice(0, 80)}`);
        } else if (status === 429) {
          console.log(`Key ${keyIdx + 1} rate-limited, aguardando 5s...`);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          console.log(`Key ${keyIdx + 1} tentativa ${attempt + 1} erro (${status}): ${errMsg.slice(0, 80)}`);
        }
      }
      attempt++;
    }

    const generationMs = Date.now() - genStart;

    if (!b64Result) {
      if (rascunhoId) {
        await sql`DELETE FROM pedidos WHERE id = ${rascunhoId}`.catch(() => {});
      }
      return NextResponse.json({ error: "Falha na geração" }, { status: 422 });
    }

    const stickerId    = randomUUID();
    const stickerBuffer = Buffer.from(b64Result, "base64");

    const createPreview = async (): Promise<Buffer | null> => {
      try {
        const watermarkSvg = Buffer.from(`<svg width="400" height="600"><defs><pattern id="wm" x="0" y="0" width="200" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><text x="100" y="40" font-family="Arial" font-size="22" fill="rgba(255,255,255,0.45)" font-weight="900" text-anchor="middle">PREVIEW</text><text x="10" y="70" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.3)">ma-vignette-copa2026</text></pattern></defs><rect width="100%" height="100%" fill="url(#wm)"/></svg>`);
        return await sharp(stickerBuffer)
          .resize(400)
          .composite([{ input: watermarkSvg, blend: "over" }])
          .jpeg({ quality: 60 })
          .toBuffer();
      } catch { return null; }
    };

    const tBlob = Date.now();
    const [blob, previewBuffer] = await Promise.all([
      put(`figurinhas/${stickerId}.png`, stickerBuffer, { access: "public", contentType: "image/png" }),
      createPreview(),
    ]);

    const previewBlob = previewBuffer
      ? await put(`previews/${stickerId}.jpg`, previewBuffer, { access: "public", contentType: "image/jpeg" }).catch(() => null)
      : null;

    console.log(`blob+preview: ${ms(tBlob)}`);
    const finalPreviewUrl = previewBlob?.url ?? blob.url;

    if (rascunhoId) {
      await sql`UPDATE pedidos SET
            sticker_id = ${stickerId}, sticker_url = ${blob.url}, preview_url = ${finalPreviewUrl},
            status = 'pendente', api_key_used = ${successKeyIdx + 1}, generation_ms = ${generationMs}
          WHERE id = ${rascunhoId}`
        .catch(e => console.error("DB update rascunho erro:", e));
    } else {
      await sql`INSERT INTO pedidos (nome, data_nascimento, clube, jogador_favorito, sticker_id, sticker_url, preview_url, email, status, api_key_used, generation_ms)
          VALUES (${nomeSafe}, ${dataNascimento}, ${clubeSafe}, ${jogadorSafe}, ${stickerId}, ${blob.url}, ${finalPreviewUrl}, ${emailSafe}, 'pendente', ${successKeyIdx + 1}, ${generationMs})`
        .catch(e => console.error("DB insert erro:", e));
    }

    console.log(`Figurinha salva: ${stickerId} | TOTAL: ${ms(t0)}`);
    return NextResponse.json({
      imageBase64: b64Result,
      mimeType: "image/png",
      stickerId,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("OUTER CATCH — erro na geração:", errMsg);
    return NextResponse.json({ error: "Erro na geração. Tente novamente." }, { status: 500 });
  } finally {
    keyInFlight.set(startIdx, Math.max(0, (keyInFlight.get(startIdx) ?? 1) - 1));
  }
}
