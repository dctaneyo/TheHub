// Client-safe timezone helpers (Intl only — no external deps).

/** The browser's current IANA timezone, e.g. "America/New_York". */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** List of selectable IANA timezones (full list when supported, else a curated set). */
export function getTimeZoneList(): string[] {
  try {
    // Modern browsers expose the full IANA list.
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (typeof supported === "function") {
      const list = supported("timeZone");
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    /* fall through to curated list */
  }
  return [
    "Pacific/Honolulu",
    "America/Anchorage",
    "America/Los_Angeles",
    "America/Denver",
    "America/Phoenix",
    "America/Chicago",
    "America/New_York",
    "America/Toronto",
    "America/Sao_Paulo",
    "UTC",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}

/** Offset (ms) between the given timezone's wall clock and UTC at `date`. */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // 24:xx can appear for midnight in some environments — normalize.
  const hour = map.hour === "24" ? "0" : map.hour;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

/**
 * Convert a wall-clock date+time entered AS IF in `timeZone` to a UTC ISO string.
 * e.g. ("2026-06-12", "14:00", "America/New_York") → the UTC instant for 2 PM ET.
 */
export function zonedWallTimeToUtcISO(
  dateStr: string,
  timeStr: string,
  timeZone: string
): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  // Treat the wall-clock numbers as if they were UTC, then subtract the zone's
  // offset at that instant to get the true UTC moment.
  const naiveUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset = tzOffsetMs(timeZone, new Date(naiveUTC));
  return new Date(naiveUTC - offset).toISOString();
}

/** Format an instant's time (e.g. "2:00 PM PDT") in a given timezone. */
export function formatTimeInZone(iso: string | number | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Format an instant's date + time (e.g. "Jun 12, 2:00 PM PDT") in a given timezone. */
export function formatDateTimeInZone(
  iso: string | number | Date,
  timeZone: string
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Short timezone label for an instant (e.g. "PDT", "CDT"). */
export function tzAbbrev(iso: string | number | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** A friendly label for a timezone option (e.g. "America/New_York (EDT)"). */
export function timeZoneLabel(timeZone: string): string {
  const abbr = tzAbbrev(Date.now(), timeZone);
  const name = timeZone.replace(/_/g, " ");
  return abbr ? `${name} (${abbr})` : name;
}
