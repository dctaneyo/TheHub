"use client";

export function BuildBadge() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
  if (!buildId) return null;

  const short = buildId.length > 8 ? buildId.slice(0, 7) : buildId;

  return (
    <div className="fixed bottom-1 right-2 z-[9998] select-none pointer-events-none">
      <span className="text-[9px] text-slate-300/60 dark:text-slate-600/40 font-mono">
        Build: {short}
      </span>
    </div>
  );
}
