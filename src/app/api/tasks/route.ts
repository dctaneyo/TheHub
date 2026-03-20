import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, apiError, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { v4 as uuid } from "uuid";
import { broadcastTaskUpdate } from "@/lib/socket-emit";
import { refreshTaskTimers } from "@/lib/task-notification-scheduler";
import { validate, createTaskSchema, updateTaskSchema } from "@/lib/validations";

// GET all tasks (ARL: all tasks; location: only tasks for their location)
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const tasks = db.select().from(schema.tasks).where(eq(schema.tasks.tenantId, session.tenantId)).all();
    if (session.userType === "location") {
      // Return only tasks that apply to this location
      const locationTasks = tasks.filter(
        (t) => !t.locationId || t.locationId === session.id
      );
      return apiSuccess({ tasks: locationTasks });
    }
    return apiSuccess({ tasks });
  } catch (error) {
    console.error("Get tasks error:", error);
    return ApiErrors.internal();
  }
}

// POST create new task (ARL or location)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    // ARL permission check
    if (session.userType === "arl") {
      const denied = await requirePermission(session, PERMISSIONS.TASKS_CREATE);
      if (denied) return denied;
    }

    const body = await req.json();
    const parsed = validate(createTaskSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const {
      title,
      description,
      type,
      priority,
      dueTime,
      dueDate,
      isRecurring,
      recurringType,
      recurringDays,
      biweeklyStart,
      locationId,
      points,
      allowEarlyComplete,
      showInToday,
      showIn7Day,
      showInCalendar,
    } = parsed.data;

    const now = new Date().toISOString();
    // Locations can only create tasks for themselves
    const resolvedLocationId = session.userType === "location" ? session.id : (locationId || null);

    const task = {
      id: uuid(),
      tenantId: session.tenantId,
      title,
      description: description || null,
      type,
      priority,
      dueTime,
      dueDate: dueDate || null,
      isRecurring,
      recurringType: recurringType || null,
      recurringDays: recurringDays ? (typeof recurringDays === "string" ? recurringDays : JSON.stringify(recurringDays)) : null,
      biweeklyStart: biweeklyStart || null,
      locationId: resolvedLocationId,
      isHidden: false,
      allowEarlyComplete,
      showInToday,
      showIn7Day,
      showInCalendar,
      createdBy: session.id,
      createdByType: session.userType,
      points: session.userType === "location" ? 0 : points,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.tasks).values(task).run();

    broadcastTaskUpdate(resolvedLocationId, session.tenantId);
    refreshTaskTimers();

    return apiSuccess({ task });
  } catch (error) {
    console.error("Create task error:", error);
    return ApiErrors.internal();
  }
}

// PUT update task (ARL only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }

    const denied = await requirePermission(session, PERMISSIONS.TASKS_EDIT);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(updateTaskSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { id, ...updates } = parsed.data;

    const existing = db.select().from(schema.tasks).where(and(eq(schema.tasks.id, id), eq(schema.tasks.tenantId, session.tenantId))).get();
    if (!existing) {
      return ApiErrors.notFound("Task");
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.dueTime !== undefined) updateData.dueTime = updates.dueTime;
    if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;
    if (updates.recurringType !== undefined) updateData.recurringType = updates.recurringType;
    if (updates.isRecurring !== undefined) updateData.isRecurring = updates.isRecurring;
    if (updates.recurringDays !== undefined) updateData.recurringDays = typeof updates.recurringDays === "string" ? updates.recurringDays : JSON.stringify(updates.recurringDays);
    if (updates.locationId !== undefined) updateData.locationId = updates.locationId;
    if (updates.isHidden !== undefined) updateData.isHidden = updates.isHidden;
    if (updates.allowEarlyComplete !== undefined) updateData.allowEarlyComplete = updates.allowEarlyComplete;
    if (updates.showInToday !== undefined) updateData.showInToday = updates.showInToday;
    if (updates.showIn7Day !== undefined) updateData.showIn7Day = updates.showIn7Day;
    if (updates.showInCalendar !== undefined) updateData.showInCalendar = updates.showInCalendar;
    if (updates.points !== undefined) updateData.points = updates.points;

    db.update(schema.tasks).set(updateData).where(eq(schema.tasks.id, id)).run();

    broadcastTaskUpdate(existing.locationId, session.tenantId);
    refreshTaskTimers();

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Update task error:", error);
    return ApiErrors.internal();
  }
}

// DELETE task (ARL: any task; location: only their own tasks)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return ApiErrors.badRequest("Task ID is required");

    const existing = db.select().from(schema.tasks).where(and(eq(schema.tasks.id, id), eq(schema.tasks.tenantId, session.tenantId))).get();
    if (!existing) return ApiErrors.notFound("Task");

    // ARL permission check
    if (session.userType === "arl") {
      const denied = await requirePermission(session, PERMISSIONS.TASKS_DELETE);
      if (denied) return denied;
    }

    // Locations can only delete tasks they created themselves
    if (session.userType === "location") {
      if (existing.createdByType !== "location" || existing.createdBy !== session.id) {
        return ApiErrors.forbidden("Cannot delete ARL-assigned tasks");
      }
    }

    db.delete(schema.tasks).where(eq(schema.tasks.id, id)).run();

    broadcastTaskUpdate(existing.locationId, session.tenantId);
    refreshTaskTimers();

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return ApiErrors.internal();
  }
}
