import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// POST - Ask a question during broadcast
export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { broadcastId, question } = body;

    if (!broadcastId || !question) {
      return ApiErrors.badRequest("Missing required fields");
    }

    const questionId = uuidv4();
    await db.insert(schema.broadcastQuestions).values({
      id: questionId,
      broadcastId,
      askerType: session.userType,
      askerId: session.userId,
      askerName: session.name,
      question,
      isAnswered: false,
      upvotes: 0,
      createdAt: new Date().toISOString(),
    });

    return apiSuccess({ questionId });
  } catch (error) {
    console.error("Error asking question:", error);
    return ApiErrors.internal("Failed to ask question");
  }
}

// PATCH - Answer a question or upvote
export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { questionId, answer, upvote } = body;

    if (!questionId) {
      return ApiErrors.badRequest("Question ID required");
    }

    const updates: any = {};

    if (answer !== undefined) {
      // Only ARLs can answer
      if (session.userType !== "arl") {
        return ApiErrors.forbidden("Only ARLs can answer questions");
      }
      updates.answer = answer;
      updates.isAnswered = true;
      updates.answeredAt = new Date().toISOString();
    }

    if (upvote) {
      const question = await db.select().from(schema.broadcastQuestions)
        .where(eq(schema.broadcastQuestions.id, questionId))
        .limit(1);
      
      if (question.length > 0) {
        updates.upvotes = (question[0].upvotes || 0) + 1;
      }
    }

    await db.update(schema.broadcastQuestions)
      .set(updates)
      .where(eq(schema.broadcastQuestions.id, questionId));

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Error updating question:", error);
    return ApiErrors.internal("Failed to update question");
  }
}

// GET - Get questions for a broadcast
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get("broadcastId");

    if (!broadcastId) {
      return ApiErrors.badRequest("Broadcast ID required");
    }

    const questions = await db.select().from(schema.broadcastQuestions)
      .where(eq(schema.broadcastQuestions.broadcastId, broadcastId));

    return apiSuccess({ questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return ApiErrors.internal("Failed to fetch questions");
  }
}
