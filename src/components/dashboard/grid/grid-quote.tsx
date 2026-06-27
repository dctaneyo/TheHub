"use client";

import { useState, useEffect } from "react";
import { getDailyQuote } from "@/lib/motivational-quotes";

/**
 * GridQuoteWidget — displays the daily motivational quote inside a grid widget.
 * Reads the same deterministic daily quote as the classic dashboard's MotivationalQuote.
 *
 * No icon — a decorative sparkle-in-a-colored-box doesn't represent anything
 * about the actual content (the quote text itself already signals "this is
 * a quote" via its quotation marks), and it didn't fit the now-borderless,
 * ambient presentation this widget gets (see widget-container.tsx).
 */
export function GridQuoteWidget() {
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  useEffect(() => {
    setQuote(getDailyQuote());
  }, []);

  if (!quote) return null;

  return (
    <div className="flex h-full flex-col items-start justify-center gap-1 p-4">
      <p className="text-sm font-semibold text-foreground leading-relaxed line-clamp-4">
        &ldquo;{quote.text}&rdquo;
      </p>
      <p className="text-xs text-muted-foreground">— {quote.author}</p>
    </div>
  );
}
