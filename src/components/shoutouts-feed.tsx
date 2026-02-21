"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/lib/socket-context";
import { Megaphone, Heart, ThumbsUp, Star, Sparkles } from "lucide-react";

interface Shoutout {
  id: string;
  from_user_name: string;
  to_location_name: string;
  message: string;
  created_at: string;
  reactions: Array<{ userId: string; userName: string; emoji: string; timestamp: string }>;
}

export function ShoutoutsFeed({ locationId }: { locationId?: string }) {
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [showAll, setShowAll] = useState(false);
  const { socket } = useSocket();

  const fetchShoutouts = useCallback(async () => {
    try {
      const url = locationId 
        ? `/api/shoutouts?locationId=${locationId}&limit=10`
        : `/api/shoutouts?limit=10`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setShoutouts(data.shoutouts);
      }
    } catch (err) {
      console.error("Failed to fetch shoutouts:", err);
    }
  }, [locationId]);

  useEffect(() => {
    fetchShoutouts();
  }, [fetchShoutouts]);

  useEffect(() => {
    if (!socket) return;

    const handleNewShoutout = (shoutout: Shoutout) => {
      setShoutouts(prev => [shoutout, ...prev].slice(0, 10));
    };

    const handleReaction = (data: { shoutoutId: string; reactions: any[] }) => {
      setShoutouts(prev => prev.map(s => 
        s.id === data.shoutoutId ? { ...s, reactions: data.reactions } : s
      ));
    };

    socket.on("shoutout:new", handleNewShoutout);
    socket.on("shoutout:reaction", handleReaction);

    return () => {
      socket.off("shoutout:new", handleNewShoutout);
      socket.off("shoutout:reaction", handleReaction);
    };
  }, [socket]);

  const addReaction = async (shoutoutId: string, emoji: string) => {
    try {
      await fetch("/api/shoutouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shoutoutId, emoji }),
      });
    } catch (err) {
      console.error("Failed to add reaction:", err);
    }
  };

  const displayShoutouts = showAll ? shoutouts : shoutouts.slice(0, 3);

  if (shoutouts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <Megaphone className="mx-auto h-12 w-12 text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-400">No shoutouts yet!</p>
        <p className="text-xs text-slate-300 mt-1">Be the first to give some praise! 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-purple-500" />
          <h3 className="text-sm font-bold text-slate-700">Recent Shoutouts</h3>
        </div>
        {shoutouts.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-semibold text-purple-500 hover:text-purple-600"
          >
            {showAll ? "Show Less" : `View All (${shoutouts.length})`}
          </button>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {displayShoutouts.map((shoutout, index) => (
          <motion.div
            key={shoutout.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-purple-500 p-2">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-purple-600 mb-1">
                  {shoutout.from_user_name} → {shoutout.to_location_name}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {shoutout.message}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => addReaction(shoutout.id, "❤️")}
                    className="rounded-full bg-white px-2 py-1 text-xs hover:bg-red-50 transition-colors"
                  >
                    ❤️
                  </button>
                  <button
                    onClick={() => addReaction(shoutout.id, "👏")}
                    className="rounded-full bg-white px-2 py-1 text-xs hover:bg-yellow-50 transition-colors"
                  >
                    👏
                  </button>
                  <button
                    onClick={() => addReaction(shoutout.id, "🔥")}
                    className="rounded-full bg-white px-2 py-1 text-xs hover:bg-orange-50 transition-colors"
                  >
                    🔥
                  </button>
                  <button
                    onClick={() => addReaction(shoutout.id, "⭐")}
                    className="rounded-full bg-white px-2 py-1 text-xs hover:bg-yellow-50 transition-colors"
                  >
                    ⭐
                  </button>
                  {shoutout.reactions.length > 0 && (
                    <div className="ml-auto flex items-center gap-1">
                      {shoutout.reactions.slice(0, 3).map((r, i) => (
                        <span key={i} className="text-sm">{r.emoji}</span>
                      ))}
                      {shoutout.reactions.length > 3 && (
                        <span className="text-xs text-slate-400">+{shoutout.reactions.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  {new Date(shoutout.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
