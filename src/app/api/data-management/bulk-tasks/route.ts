import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - ARL access required" }, { status: 401 });
    }

    const { action } = await request.json();

    let deleted = 0;

    if (action === "clear-completions-today") {
      const today = new Date().toISOString().split("T")[0];
      const r = sqlite.prepare(
        "DELETE FROM task_completions WHERE completed_date = ?"
      ).run(today);
      deleted = r.changes;
    } else if (action === "clear-completions-week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const r = sqlite.prepare(
        "DELETE FROM task_completions WHERE completed_date >= ?"
      ).run(weekAgo.toISOString().split("T")[0]);
      deleted = r.changes;
    } else if (action === "clear-all-completions") {
      const r = sqlite.prepare("DELETE FROM task_completions").run();
      deleted = r.changes;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted, action });
  } catch (error) {
    console.error("Bulk tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
