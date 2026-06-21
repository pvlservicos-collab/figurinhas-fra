import { NextRequest } from "next/server";

export const SESSION_COOKIE = "painel_sid";

function getSecret(): string {
  return process.env.ADMIN_TOKEN || "";
}

export function validateAdminRequest(req: NextRequest): boolean {
  const secret = getSecret();
  if (!secret) return false;

  // 1. Cookie (login via painel com nome)
  const cookie = req.cookies.get(SESSION_COOKIE);
  if (cookie && cookie.value === secret) return true;

  // 2. Bearer token (API calls diretas, /config, etc.)
  const auth = req.headers.get("authorization");
  if (auth) {
    const token = auth.replace(/^Bearer\s+/i, "");
    if (token === secret) return true;
  }

  return false;
}
