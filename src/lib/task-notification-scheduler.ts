import { db, schema } from "./db";
import { eq, and } from "drizzle-orm";
import { createNotification, createNotificationBulk } from "./notifications";

/**
 * Scheduled job to check for tasks that are due soon or overdue
 * Creates real-time notifications delivered via WebSocket
 * NO HTTP POLLING - purely event-driven via WebSocket
 */

interface TaskCheck {
  locationId: string;
  locationName: string;
  taskId: string;
  taskTitle: string;
  dueTime: string;
  dueDate: string | null;
  priority: string;
}

/**
 * Check for tasks due within the next 30 minutes
 * Sends real-time notifications via WebSocket
 */
export async function checkTasksDueSoon() {
  try {
    const now = new Date();
    const nowTime = now.toTimeString().slice(0, 5); // "HH:mm"
    const todayDate = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
    
    // Calculate 30 minutes from now
    const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);
    const laterTime = thirtyMinsLater.toTimeString().slice(0, 5);

    // Get all active locations
    const locations = db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).all();

    for (const location of locations) {
      // Find tasks for this location that are due in the next 30 minutes
      const tasks = db.select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.locationId, location.id),
            eq(schema.tasks.isHidden, false)
          )
        )
        .all();

      // Check which tasks are due soon
      for (const task of tasks) {
        const taskDueDate = task.dueDate || todayDate;
        
        // Only check tasks due today
        if (taskDueDate !== todayDate) continue;

        // Check if task is in the 30-minute window
        const taskDueTime = task.dueTime;
        if (taskDueTime >= nowTime && taskDueTime <= laterTime) {
          // Check if task is already completed today
          const completion = db.select()
            .from(schema.taskCompletions)
            .where(
              and(
                eq(schema.taskCompletions.taskId, task.id),
                eq(schema.taskCompletions.locationId, location.id),
                eq(schema.taskCompletions.completedDate, todayDate)
              )
            )
            .get();

          if (!completion) {
            // Create real-time notification - delivered via WebSocket
            await createNotification({
              userId: location.id,
              userType: "location",
              type: "task_due_soon",
              title: `Task due soon: ${task.title}`,
              message: `Due at ${task.dueTime} - Complete before time runs out!`,
              actionUrl: "/dashboard",
              actionLabel: "View Tasks",
              priority: "high",
              metadata: {
                taskId: task.id,
                taskTitle: task.title,
                dueTime: task.dueTime,
                taskPriority: task.priority,
              },
            });

            console.log(`📋 Created task_due_soon notification for ${location.name} - ${task.title}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking tasks due soon:", error);
  }
}

/**
 * Check for overdue tasks
 * Sends real-time notifications via WebSocket
 */
export async function checkOverdueTasks() {
  try {
    const now = new Date();
    const nowTime = now.toTimeString().slice(0, 5); // "HH:mm"
    const todayDate = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Get all active locations
    const locations = db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).all();

    for (const location of locations) {
      const tasks = db.select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.locationId, location.id),
            eq(schema.tasks.isHidden, false)
          )
        )
        .all();

      let overdueCount = 0;
      const overdueTasks: string[] = [];

      for (const task of tasks) {
        const taskDueDate = task.dueDate || todayDate;
        
        // Check if task is overdue (due date is today and due time has passed)
        if (taskDueDate === todayDate && task.dueTime < nowTime) {
          // Check if not completed
          const completion = db.select()
            .from(schema.taskCompletions)
            .where(
              and(
                eq(schema.taskCompletions.taskId, task.id),
                eq(schema.taskCompletions.locationId, location.id),
                eq(schema.taskCompletions.completedDate, todayDate)
              )
            )
            .get();

          if (!completion) {
            overdueCount++;
            overdueTasks.push(task.title);

            // Create individual overdue notification for location
            await createNotification({
              userId: location.id,
              userType: "location",
              type: "task_overdue",
              title: `OVERDUE: ${task.title}`,
              message: `Was due at ${task.dueTime} - Complete ASAP!`,
              actionUrl: "/dashboard",
              actionLabel: "Complete Now",
              priority: "urgent",
              metadata: {
                taskId: task.id,
                taskTitle: task.title,
                dueTime: task.dueTime,
                minutesOverdue: Math.floor((now.getTime() - new Date(`${todayDate}T${task.dueTime}`).getTime()) / 60000),
              },
            });
          }
        }
      }

      // Notify ARLs if location has overdue tasks
      if (overdueCount > 0) {
        const allArls = db.select().from(schema.arls).where(eq(schema.arls.isActive, true)).all();
        await createNotificationBulk(
          allArls.map(arl => arl.id),
          {
            userType: "arl",
            type: "task_overdue_location",
            title: `${location.name} has ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`,
            message: overdueTasks.slice(0, 3).join(", ") + (overdueCount > 3 ? ` and ${overdueCount - 3} more` : ''),
            actionUrl: "/arl?view=tasks",
            actionLabel: "View Tasks",
            priority: "high",
            metadata: {
              locationId: location.id,
              locationName: location.name,
              overdueCount,
              overdueTasks: overdueTasks.slice(0, 5),
            },
          }
        );

        console.log(`⚠️ Created task_overdue_location notification for ARLs - ${location.name} has ${overdueCount} overdue`);
      }
    }
  } catch (error) {
    console.error("Error checking overdue tasks:", error);
  }
}

/**
 * Main scheduler function - call this from server.ts
 * Runs every 5 minutes to check task status
 * All notifications delivered in real-time via WebSocket
 */
export function startTaskNotificationScheduler() {
  console.log("🔔 Task notification scheduler started (real-time WebSocket delivery)");

  // Run immediately on startup
  checkTasksDueSoon();
  checkOverdueTasks();

  // Run every 5 minutes
  setInterval(() => {
    checkTasksDueSoon();
    checkOverdueTasks();
  }, 5 * 60 * 1000); // 5 minutes
}
