import type { Server as SocketIOServer, Socket } from "socket.io";
import type { AuthPayload } from "../auth";
import { createNotification } from "../notifications";

/**
 * Register test notification handlers (ARL only).
 * These allow ARLs to send test notifications to locations for debugging.
 */
export function registerTestHandlers(io: SocketIOServer, socket: Socket, user: AuthPayload | null) {
  if (!user || user.userType !== "arl") return;

  socket.on("test:task_due_soon", (data: any) => {
    const { locationId, taskId, title, dueTime, points } = data;
    io.to(`location:${locationId}`).emit("task:due-soon", { taskId, title, dueTime, points });
  });

  socket.on("test:task_overdue", (data: any) => {
    const { locationId, taskId, title, dueTime, points } = data;
    io.to(`location:${locationId}`).emit("task:overdue", { taskId, title, dueTime, points });
  });

  socket.on("test:meeting_started", (data: any) => {
    const { meetingId, title, hostName, hostId } = data;
    const payload = { meetingId, title, hostName, hostId, hostSocketId: socket.id };
    io.to("locations").emit("meeting:started", payload);
    io.to("arls").emit("meeting:started", payload);
  });

  socket.on("test:meeting_ended", (data: any) => {
    const { meetingId, reason = "test" } = data;
    io.to("locations").emit("meeting:ended", { meetingId, reason });
    io.to("arls").emit("meeting:ended", { meetingId });
  });

  socket.on("test:broadcast_started", (data: any) => {
    const { broadcastId, arlName, title } = data;
    io.to("locations").emit("broadcast:started", { broadcastId, arlName, title });
    io.to("arls").emit("broadcast:started", { broadcastId, arlName, title });
  });

  socket.on("test:broadcast_ended", (data: any) => {
    const { broadcastId } = data;
    io.to("locations").emit("broadcast:ended", { broadcastId });
    io.to("arls").emit("broadcast:ended", { broadcastId });
  });

  socket.on("test:task_completed", (data: any) => {
    const { locationId, taskId, title, pointsEarned } = data;
    io.to(`location:${locationId}`).emit("task:completed", { taskId, title, pointsEarned });
  });

  socket.on("test:custom_notification", (data: any) => {
    const { locationId, title, message, priority = "medium" } = data;
    io.to(`location:${locationId}`).emit("custom:notification", { title, message, priority });
    createNotification({
      userId: locationId,
      userType: "location",
      type: "system_update",
      title,
      message,
      priority: priority as "low" | "normal" | "high" | "urgent",
    }).catch((err: Error) => console.error("Failed to create test notification:", err));
  });
}
