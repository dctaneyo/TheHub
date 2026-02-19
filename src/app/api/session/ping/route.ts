import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { broadcastPing } from "@/lib/socket-emit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { pendingId } = await req.json();
    if (!pendingId) {
      return NextResponse.json({ error: "pendingId required" }, { status: 400 });
    }

    broadcastPing(pendingId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
