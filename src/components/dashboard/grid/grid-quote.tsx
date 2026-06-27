"use client";

import { useState, useEffect } from "react";
import { getDailyQuote } from "@/lib/motivational-quotes";
import { Quotes } from "@/lib/icons";

/**
 * GridQuoteWidget — displays the daily motivational quote inside a grid widget.
 * Reads the same deterministic daily quote as the classic dashboard's MotivationalQuote.
 *
 * Deliberate exception to the rest of the dashboard's restraint: a giant
 * watermark quotation mark behind the text and an italic serif treatment
 * (the one place serif appears in the whole app — see DESIGN.md Section 1's
 * font-weight exception note, same idea extended to family). Justified
 * because this widget has zero function — it's the dashboard's one purely
 * editorial/decorative surface, not a data widget wearing a costume, so the
 * usual "no decoration without a job" rule doesn't apply to it. Kept subtle
 * (low-opacity, monochrome, no gradient) so it doesn't read as a generic
 * template flourish.
 */
export function GridQuoteWidget() {
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  useEffect(() => {
    setQuote(getDailyQuote());
  }, []);

  if (!quote) return null;

  return (
    <div className="relative flex h-full flex-col items-start justify-center gap-2 overflow-hidden p-5">
      <Quotes
        weight="fill"
        aria-hidden
        className="pointer-events-none absolute -left-3 -top-4 h-24 w-24 text-foreground/[0.07]"
      />
      <p className="relative font-serif text-base italic leading-relaxed text-foreground line-clamp-4">
        {quote.text}
      </p>
      <p className="relative text-xs font-semibold tracking-wide text-muted-foreground">
        — {quote.author}
      </p>
    </div>
  );
}
