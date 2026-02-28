import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    return NextResponse.json({ user: session });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
