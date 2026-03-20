import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "location") {
      return ApiErrors.forbidden();
    }

    const completions = db
      .select({
        taskId: schema.taskCompletions.taskId,
        completedDate: schema.taskCompletions.completedDate,
      })
      .from(schema.taskCompletions)
      .where(eq(schema.taskCompletions.locationId, session.id))
      .all();

    return apiSuccess({ completions });
  } catch (error) {
    console.error("Get completions error:", error);
    return ApiErrors.internal();
  }
}
