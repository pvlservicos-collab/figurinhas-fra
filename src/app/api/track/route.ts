import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, step, email, nome, oferta } = body;
    if (!session_id || !step) return new NextResponse(null, { status: 204 });
    if (typeof session_id !== "string" || session_id.length > 64) return new NextResponse(null, { status: 204 });
    if (typeof step !== "string" || step.length > 32) return new NextResponse(null, { status: 204 });
    if (email && (typeof email !== "string" || email.length > 255)) return new NextResponse(null, { status: 204 });
    if (nome && (typeof nome !== "string" || nome.length > 80)) return new NextResponse(null, { status: 204 });
    const validOferta = (oferta === "a" || oferta === "segunda" || oferta === "pets") ? oferta : null;

    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255),
        nome VARCHAR(100),
        step VARCHAR(50) NOT NULL,
        cta_clicked BOOLEAN DEFAULT FALSE,
        obrigado BOOLEAN DEFAULT FALSE,
        oferta VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `.catch(() => {});
    await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS oferta VARCHAR(20)`.catch(() => {});

    const isCta = step === "checkout";
    const isObrigado = step === "obrigado";

    await sql`
      INSERT INTO sessions (session_id, step, email, nome, cta_clicked, obrigado, oferta, updated_at)
      VALUES (
        ${session_id}, ${step}, ${email || null}, ${nome || null},
        ${isCta}, ${isObrigado}, ${validOferta}, NOW()
      )
      ON CONFLICT (session_id) DO UPDATE SET
        step = EXCLUDED.step,
        email = COALESCE(EXCLUDED.email, sessions.email),
        nome = COALESCE(EXCLUDED.nome, sessions.nome),
        cta_clicked = sessions.cta_clicked OR ${isCta},
        obrigado = sessions.obrigado OR ${isObrigado},
        oferta = COALESCE(sessions.oferta, EXCLUDED.oferta),
        updated_at = NOW()
    `;
  } catch {
    // silencioso
  }
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(req: NextRequest) {
  try {
    const { session_id } = await req.json();
    if (!session_id) return new NextResponse(null, { status: 204 });
    const sql = getDb();
    await sql`DELETE FROM sessions WHERE session_id = ${session_id}`;
  } catch { /* ignora */ }
  return new NextResponse(null, { status: 204 });
}
