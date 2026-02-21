"use client";

import { useEffect, useRef } from "react";
import twemoji from "twemoji";

interface EmojiProps {
  emoji: string;
  className?: string;
}

export function Emoji({ emoji, className = "" }: EmojiProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = twemoji.parse(emoji, {
        folder: "svg",
        ext: ".svg",
      });
    }
  }, [emoji]);

  return <span ref={ref} className={className} />;
}
