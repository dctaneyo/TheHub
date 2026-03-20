import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { broadcastPing } from "@/lib/socket-emit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden();
    }

    const { pendingId } = await req.json();
    if (!pendingId) {
      return ApiErrors.badRequest("pendingId required");
    }

    broadcastPing(pendingId);
    return apiSuccess({});
  } catch (error) {
    console.error("Ping error:", error);
    return ApiErrors.internal();
  }
}
