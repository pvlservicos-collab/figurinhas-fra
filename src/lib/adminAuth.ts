import { NextRequest } from "next/server";

export function validateAdminRequest(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "");
  const adminToken = process.env.ADMIN_TOKEN;
  return !!adminToken && token === adminToken;
}
