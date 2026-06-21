import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateAdminRequest } from "@/lib/adminAuth";

// Adapt to French market products — add real Cartpanda offer codes here as needed
const PRODUTOS: Record<string, string> = {
  "figurinha": "Vignette Personnalisée — PDF",
  "pacotinho": "Pacotinho Vignettes — PDF",
  "poster":    "Poster A4 — PDF",
};

export async function GET(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await sql`ALTER TABLE pedido_items ALTER COLUMN order_id TYPE TEXT USING order_id::TEXT`.catch(() => {});
  await sql`ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS telefone VARCHAR(30)`.catch(() => {});

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  try {
    const rows = await sql`
      SELECT
        pi.id,
        pi.order_id,
        pi.email,
        pi.telefone,
        pi.nome,
        pi.offer_name,
        pi.product_name,
        pi.offer_hash,
        pi.price,
        pi.status,
        pi.created_at,
        CASE WHEN pi.order_id LIKE 'manual_%' THEN true ELSE false END AS manual
      FROM pedido_items pi
      ${q ? sql`WHERE (
        pi.telefone ILIKE ${"%" + q + "%"}
        OR pi.nome ILIKE ${"%" + q + "%"}
        OR pi.offer_name ILIKE ${"%" + q + "%"}
        OR pi.email ILIKE ${"%" + q + "%"}
      )` : sql``}
      ORDER BY pi.created_at DESC
      LIMIT 500
    `;
    return NextResponse.json({ items: rows, produtos: PRODUTOS });
  } catch (err) {
    console.error("orderbumps GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  let body: { email?: string; offer_hash?: string; nome?: string; telefone?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const offerHash = (body.offer_hash || "").trim();
  const offerName = PRODUTOS[offerHash] || offerHash;
  if (!offerHash) {
    return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
  }

  const orderId = `manual_${Date.now()}`;
  const nome = (body.nome || "").trim() || null;
  const telefone = (body.telefone || "").replace(/\D/g, "") || null;

  try {
    await sql`
      INSERT INTO pedido_items
        (order_id, email, telefone, nome, item_type, offer_hash, offer_name, product_name, price, status, created_at)
      VALUES
        (${orderId}, ${email}, ${telefone}, ${nome}, 'product', ${offerHash}, ${offerName}, ${offerName}, 0, 'pago', NOW())
    `;
  } catch (err) {
    console.error("orderbumps POST insert error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, offerName });
}

export async function DELETE(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    await sql`DELETE FROM pedido_items WHERE id = ${Number(id)} AND order_id LIKE 'manual_%'`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[orderbumps DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
