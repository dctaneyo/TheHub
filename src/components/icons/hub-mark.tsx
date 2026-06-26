/**
 * Geometric "Notched H" mark — replaces the old letter-in-a-rounded-box
 * placeholder. Single top-corner chamfer on each vertical, solid crossbar.
 * Uses currentColor so tenant branding (--hub-red override) flows through
 * via the surrounding text color class, same as the rest of the app's icons.
 */
export function HubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} aria-hidden>
      <path d="M14 18 L21 10 L25 10 L25 54 L14 54 Z" />
      <path d="M39 18 L46 10 L50 10 L50 54 L39 54 Z" />
      <rect x="25" y="27" width="14" height="10" />
    </svg>
  );
}
