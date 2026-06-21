import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { token } = body;
  const adminToken = process.env.ADMIN_TOKEN;
  if (!token || !adminToken || token !== adminToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
