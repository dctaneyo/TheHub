"use client";

import { useState, useEffect } from "react";
import { getDailyQuote } from "@/lib/motivational-quotes";
import { Sparkles } from "@/lib/icons";
import { motion } from "framer-motion";

export function MotivationalQuote() {
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  useEffect(() => {
    setQuote(getDailyQuote());
  }, []);

  if (!quote) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="mt-1 text-xs text-muted-foreground">— {quote.author}</p>
        </div>
      </div>
    </motion.div>
  );
}
