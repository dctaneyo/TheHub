import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q")?.trim();
    const type = req.nextUrl.searchParams.get("type") || "all"; // all, tasks, messages, forms, locations
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20"), 50);

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], query: "" });
    }

    const searchTerm = `%${query}%`;
    const results: Array<{ type: string; id: string; title: string; subtitle: string; metadata?: any }> = [];

    // Search tasks
    if (type === "all" || type === "tasks") {
      try {
        const tasks = sqlite.prepare(`
          SELECT id, title, type, priority, due_time as dueTime
          FROM tasks
          WHERE title LIKE ? OR type LIKE ?
          ORDER BY created_at DESC
          LIMIT ?
        `).all(searchTerm, searchTerm, limit) as any[];

        tasks.forEach(t => results.push({
          type: "task",
          id: t.id,
          title: t.title,
          subtitle: `${t.type} • ${t.priority} priority • Due ${t.dueTime || "N/A"}`,
          metadata: { taskType: t.type, priority: t.priority },
        }));
      } catch {}
    }

    // Search messages
    if (type === "all" || type === "messages") {
      try {
        const messages = sqlite.prepare(`
          SELECT m.id, m.content, m.sender_name as senderName, m.created_at as createdAt,
                 c.name as conversationName
          FROM messages m
          LEFT JOIN conversations c ON c.id = m.conversation_id
          WHERE m.content LIKE ?
          ORDER BY m.created_at DESC
          LIMIT ?
        `).all(searchTerm, limit) as any[];

        messages.forEach(m => results.push({
          type: "message",
          id: m.id,
          title: m.content.length > 80 ? m.content.substring(0, 80) + "..." : m.content,
          subtitle: `${m.senderName} in ${m.conversationName || "Direct"} • ${m.createdAt?.split("T")[0] || ""}`,
          metadata: { senderName: m.senderName },
        }));
      } catch {}
    }

    // Search forms
    if (type === "all" || type === "forms") {
      try {
        const forms = sqlite.prepare(`
          SELECT id, name, category, description
          FROM forms
          WHERE name LIKE ? OR category LIKE ? OR description LIKE ?
          ORDER BY name ASC
          LIMIT ?
        `).all(searchTerm, searchTerm, searchTerm, limit) as any[];

        forms.forEach(f => results.push({
          type: "form",
          id: f.id,
          title: f.name,
          subtitle: `${f.category || "General"} • ${f.description || ""}`.trim(),
          metadata: { category: f.category },
        }));
      } catch {}
    }

    // Search locations
    if ((type === "all" || type === "locations") && session.userType === "arl") {
      try {
        const locations = sqlite.prepare(`
          SELECT id, name, store_number as storeNumber
          FROM locations
          WHERE name LIKE ? OR store_number LIKE ?
          ORDER BY name ASC
          LIMIT ?
        `).all(searchTerm, searchTerm, limit) as any[];

        locations.forEach(l => results.push({
          type: "location",
          id: l.id,
          title: l.name,
          subtitle: `Store #${l.storeNumber || "N/A"}`,
          metadata: { storeNumber: l.storeNumber },
        }));
      } catch {}
    }

    return NextResponse.json({
      results: results.slice(0, limit),
      query,
      total: results.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
