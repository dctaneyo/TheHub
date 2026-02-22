import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// POST - Ask a question during broadcast
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { broadcastId, question } = body;

    if (!broadcastId || !question) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    return NextResponse.json({ questionId });
  } catch (error) {
    console.error("Error asking question:", error);
    return NextResponse.json({ error: "Failed to ask question" }, { status: 500 });
  }
}

// PATCH - Answer a question or upvote
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { questionId, answer, upvote } = body;

    if (!questionId) {
      return NextResponse.json({ error: "Question ID required" }, { status: 400 });
    }

    const updates: any = {};

    if (answer !== undefined) {
      // Only ARLs can answer
      if (session.userType !== "arl") {
        return NextResponse.json({ error: "Only ARLs can answer questions" }, { status: 403 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

// GET - Get questions for a broadcast
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const broadcastId = searchParams.get("broadcastId");

    if (!broadcastId) {
      return NextResponse.json({ error: "Broadcast ID required" }, { status: 400 });
    }

    const questions = await db.select().from(schema.broadcastQuestions)
      .where(eq(schema.broadcastQuestions.broadcastId, broadcastId));

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}
