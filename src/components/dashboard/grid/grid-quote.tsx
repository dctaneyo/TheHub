"use client";

import { useState, useEffect } from "react";
import { getDailyQuote } from "@/lib/motivational-quotes";
import { Sparkles } from "@/lib/icons";

/**
 * GridQuoteWidget — displays the daily motivational quote inside a grid widget.
 * Reads the same deterministic daily quote as the classic dashboard's MotivationalQuote.
 */
export function GridQuoteWidget() {
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  useEffect(() => {
    setQuote(getDailyQuote());
  }, []);

  if (!quote) return null;

  return (
    <div className="flex h-full flex-col items-start justify-center gap-3 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground leading-relaxed line-clamp-4">
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">— {quote.author}</p>
      </div>
    </div>
  );
}
