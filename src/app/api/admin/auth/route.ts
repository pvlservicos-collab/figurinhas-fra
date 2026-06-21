import { NextRequest, NextResponse } from "next/server";

const VALID_USERS = ["pedro", "vini", "tel"];
export const SESSION_COOKIE = "painel_sid";

const authAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + 5 * 60_000 });
    return true;
  }
  if (entry.count >= 8) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde 5 minutos." }, { status: 429 });
  }

  let body: { name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const name = String(body.name || "").trim().toLowerCase().slice(0, 32);
  if (!VALID_USERS.includes(name)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const adminToken = process.env.ADMIN_TOKEN || "";
  return NextResponse.json({ ok: true, user: name, token: adminToken });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
