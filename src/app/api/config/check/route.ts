import { NextRequest, NextResponse } from "next/server";

const REQUIRED = ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "OPENAI_API_KEY"] as const;

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = Object.fromEntries(
    REQUIRED.map((key) => [key, !!process.env[key]])
  );

  const allPresent = Object.values(result).every(Boolean);
  return NextResponse.json({ ok: allPresent, secrets: result });
}
