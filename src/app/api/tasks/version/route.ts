import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();

    // Get the latest updatedAt from tasks table
    const latest = db
      .select({ updatedAt: schema.tasks.updatedAt })
      .from(schema.tasks)
      .orderBy(desc(schema.tasks.updatedAt))
      .limit(1)
      .get();

    // Also get latest completion timestamp
    const latestCompletion = db
      .select({ completedAt: schema.taskCompletions.completedAt })
      .from(schema.taskCompletions)
      .orderBy(desc(schema.taskCompletions.completedAt))
      .limit(1)
      .get();

    const taskVersion = latest?.updatedAt || "";
    const completionVersion = latestCompletion?.completedAt || "";
    const version = [taskVersion, completionVersion].sort().pop() || "";

    return apiSuccess({ version });
  } catch (error) {
    console.error("Task version error:", error);
    return ApiErrors.internal();
  }
}
