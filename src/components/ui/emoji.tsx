"use client";

import { Emoji as EmojiComponent } from "emoji-picker-react";

interface EmojiProps {
  emoji: string;
  className?: string;
}

// Convert emoji character to unified code point
function emojiToUnified(emoji: string): string {
  const codePoints = [];
  for (let i = 0; i < emoji.length; i++) {
    const code = emoji.codePointAt(i);
    if (code) {
      codePoints.push(code.toString(16));
      // Skip the next character if this is a surrogate pair
      if (code > 0xFFFF) i++;
    }
  }
  return codePoints.join('-');
}

export function Emoji({ emoji, className = "" }: EmojiProps) {
  const unified = emojiToUnified(emoji);
  
  return (
    <span className={className}>
      <EmojiComponent unified={unified} size={22} />
    </span>
  );
}
