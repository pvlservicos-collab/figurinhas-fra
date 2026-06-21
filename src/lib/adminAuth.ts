import { NextRequest } from "next/server";

export const SESSION_COOKIE = "painel_session";
const VALID_USERS = ["pedro", "vini", "tel"];

export function validateAdminRequest(req: NextRequest): boolean {
  const secret = process.env.ADMIN_TOKEN;

  // Com ADMIN_TOKEN: verifica Bearer token
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth) {
      const token = auth.replace(/^Bearer\s+/i, "");
      if (token === secret) return true;
    }
    // Se tem ADMIN_TOKEN mas Bearer falhou → tenta cookie de sessão como fallback
  }

  // Fallback / sem ADMIN_TOKEN: verifica cookie de sessão com nome válido
  const cookie = req.cookies.get(SESSION_COOKIE);
  if (cookie && VALID_USERS.includes(cookie.value)) return true;

  return false;
}
