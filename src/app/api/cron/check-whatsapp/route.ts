import { NextResponse } from "next/server";

// WhatsApp removal: this cron is disabled. The funnel delivers via email.
export async function GET() {
  return NextResponse.json({ ok: true, message: "WhatsApp cron desativado — entrega por e-mail" });
}
