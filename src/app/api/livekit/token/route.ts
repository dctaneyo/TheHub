import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const { roomName, participantName, role, isGuest } = await req.json();
    if (!roomName || !participantName) {
      return ApiErrors.badRequest("Missing roomName or participantName");
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return ApiErrors.internal("LiveKit not configured");
    }

    let identity: string;
    let userType: string;

    if (isGuest) {
      // Guest user - generate temporary identity
      identity = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      userType = "guest";
    } else {
      // Regular authenticated user
      const session = await getAuthSession();
      if (!session) {
        return ApiErrors.unauthorized();
      }
      identity = session.id;
      userType = session.userType;
    }

    // Include metadata for participant identification
    const metadata = JSON.stringify({
      userType,
      role: role || "participant",
      handRaised: false,
    });

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      metadata,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return apiSuccess({ token, wsUrl });
  } catch (error) {
    console.error("LiveKit token error:", error);
    return ApiErrors.internal("Failed to generate token");
  }
}
