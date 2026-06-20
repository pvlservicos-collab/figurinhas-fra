import { NextRequest, NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/config";

export async function GET() {
  const config = await getConfig();
  return NextResponse.json(config);
}

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const adminToken = process.env.ADMIN_TOKEN;
  return !!(adminToken && token === adminToken);
}

export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const updated = await saveConfig(body as never);
  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
