import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { getAuthSession } from "@/lib/api-helpers";
import { validate, setPatternSchema } from "@/lib/validations";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return ApiErrors.unauthorized();
    }

    const body = await req.json();
    const parsed = validate(setPatternSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }

    const { pattern } = parsed.data;
    const patternStr = pattern.join("");
    const patternHash = hashSync(patternStr, 10);

    if (session.userType === "location") {
      db.update(schema.locations)
        .set({ patternHash, updatedAt: new Date().toISOString() })
        .where(eq(schema.locations.id, session.id))
        .run();
    } else if (session.userType === "arl") {
      db.update(schema.arls)
        .set({ patternHash, updatedAt: new Date().toISOString() })
        .where(eq(schema.arls.id, session.id))
        .run();
    } else {
      return ApiErrors.forbidden("Only locations and ARLs can set patterns");
    }

    return apiSuccess({ patternSet: true });
  } catch (error) {
    console.error("Set pattern error:", error);
    return ApiErrors.internal();
  }
}
