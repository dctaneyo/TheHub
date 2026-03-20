import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

function generateMeetingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET - List scheduled meetings
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") !== "false";

    let query = "SELECT * FROM scheduled_meetings";
    if (activeOnly) query += " WHERE is_active = 1";
    query += " ORDER BY scheduled_at ASC";

    const meetings = sqlite.prepare(query).all() as any[];
    return apiSuccess({ meetings });
  } catch (error) {
    console.error("Get meetings error:", error);
    return ApiErrors.internal();
  }
}

// POST - Create a scheduled meeting
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }
    const denied = await requirePermission(session, PERMISSIONS.MEETINGS_SCHEDULE);
    if (denied) return denied;

    const {
      title, description, password, scheduledAt,
      durationMinutes, isRecurring, recurringType,
      recurringDays, allowGuests,
    } = await req.json();

    if (!title || !scheduledAt) {
      return ApiErrors.badRequest("Title and scheduled time are required");
    }

    // Generate unique 6-char meeting code
    let meetingCode = generateMeetingCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = sqlite.prepare("SELECT id FROM scheduled_meetings WHERE meeting_code = ?").get(meetingCode);
      if (!existing) break;
      meetingCode = generateMeetingCode();
      attempts++;
    }

    const id = `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO scheduled_meetings (
        id, meeting_code, title, description, password, host_id, host_name,
        scheduled_at, duration_minutes, is_recurring, recurring_type,
        recurring_days, allow_guests, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id, meetingCode, title, description || null, password || null,
      session.id, session.name, scheduledAt,
      durationMinutes || 60, isRecurring ? 1 : 0,
      recurringType || null, recurringDays ? JSON.stringify(recurringDays) : null,
      allowGuests ? 1 : 0, now, now
    );

    const meeting = sqlite.prepare("SELECT * FROM scheduled_meetings WHERE id = ?").get(id);
    return apiSuccess({ meeting });
  } catch (error) {
    console.error("Create meeting error:", error);
    return ApiErrors.internal();
  }
}

// PATCH - Update a scheduled meeting
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }
    const denied = await requirePermission(session, PERMISSIONS.MEETINGS_EDIT);
    if (denied) return denied;

    const { id, ...updates } = await req.json();
    if (!id) {
      return ApiErrors.badRequest("Meeting ID required");
    }

    const meeting = sqlite.prepare("SELECT * FROM scheduled_meetings WHERE id = ?").get(id) as any;
    if (!meeting) {
      return ApiErrors.notFound("Meeting");
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push("title = ?"); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push("description = ?"); values.push(updates.description); }
    if (updates.password !== undefined) { fields.push("password = ?"); values.push(updates.password || null); }
    if (updates.scheduledAt !== undefined) { fields.push("scheduled_at = ?"); values.push(updates.scheduledAt); }
    if (updates.durationMinutes !== undefined) { fields.push("duration_minutes = ?"); values.push(updates.durationMinutes); }
    if (updates.isRecurring !== undefined) { fields.push("is_recurring = ?"); values.push(updates.isRecurring ? 1 : 0); }
    if (updates.recurringType !== undefined) { fields.push("recurring_type = ?"); values.push(updates.recurringType); }
    if (updates.recurringDays !== undefined) { fields.push("recurring_days = ?"); values.push(JSON.stringify(updates.recurringDays)); }
    if (updates.allowGuests !== undefined) { fields.push("allow_guests = ?"); values.push(updates.allowGuests ? 1 : 0); }
    if (updates.isActive !== undefined) { fields.push("is_active = ?"); values.push(updates.isActive ? 1 : 0); }

    if (fields.length === 0) {
      return ApiErrors.badRequest("No fields to update");
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    sqlite.prepare(`UPDATE scheduled_meetings SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    const updated = sqlite.prepare("SELECT * FROM scheduled_meetings WHERE id = ?").get(id);
    return apiSuccess({ meeting: updated });
  } catch (error) {
    console.error("Update meeting error:", error);
    return ApiErrors.internal();
  }
}

// DELETE - Delete a scheduled meeting
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }
    const denied = await requirePermission(session, PERMISSIONS.MEETINGS_DELETE);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return ApiErrors.badRequest("Meeting ID required");
    }

    sqlite.prepare("DELETE FROM scheduled_meetings WHERE id = ?").run(id);
    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Delete meeting error:", error);
    return ApiErrors.internal();
  }
}
