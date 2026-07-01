"use client";

interface EmojiProps {
  emoji: string;
  size?: number;
}

// Renders a native Unicode emoji at the requested size. We previously used
// emoji-picker-react's Emoji component (image-based, requires CDN) which
// rendered as placeholder boxes when images failed to load. Native rendering
// is reliable on Chrome/Safari (the kiosk runtime) and needs no network fetch.
export function Emoji({ emoji, size = 22 }: EmojiProps) {
  return (
    <span
      role="img"
      style={{ fontSize: size, lineHeight: 1 }}
      className="select-none"
    >
      {emoji}
    </span>
  );
}
