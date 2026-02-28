import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant";

export async function GET() {
  try {
    const tenant = await getTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Get tenant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
