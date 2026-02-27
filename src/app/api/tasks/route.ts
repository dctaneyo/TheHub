import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastTaskUpdate } from "@/lib/socket-emit";

// GET all tasks (ARL: all tasks; location: only tasks for their location)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const tasks = db.select().from(schema.tasks).all();
    if (session.userType === "location") {
      // Return only tasks that apply to this location
      const locationTasks = tasks.filter(
        (t) => !t.locationId || t.locationId === session.id
      );
      return NextResponse.json({ tasks: locationTasks });
    }
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create new task (ARL or location)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const {
      title,
      description,
      type = "task",
      priority = "normal",
      dueTime,
      dueDate,
      isRecurring = false,
      recurringType,
      recurringDays,
      biweeklyStart,
      locationId,
      points = 10,
      allowEarlyComplete = false,
      showInToday = true,
      showIn7Day = true,
      showInCalendar = true,
    } = body;

    if (!title || !dueTime) {
      return NextResponse.json({ error: "Title and due time are required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    // Locations can only create tasks for themselves
    const resolvedLocationId = session.userType === "location" ? session.id : (locationId || null);

    const task = {
      id: uuid(),
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

    broadcastTaskUpdate(resolvedLocationId);

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT update task (ARL only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const existing = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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

    broadcastTaskUpdate(existing.locationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE task (ARL: any task; location: only their own tasks)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Task ID is required" }, { status: 400 });

    const existing = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get();
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Locations can only delete tasks they created themselves
    if (session.userType === "location") {
      if (existing.createdByType !== "location" || existing.createdBy !== session.id) {
        return NextResponse.json({ error: "Cannot delete ARL-assigned tasks" }, { status: 403 });
      }
    }

    db.delete(schema.tasks).where(eq(schema.tasks.id, id)).run();

    broadcastTaskUpdate(existing.locationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
