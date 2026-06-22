import { redirect } from "next/navigation";

/**
 * /dashboard/grid is no longer the canonical URL.
 * The grid dashboard now lives at /dashboard.
 * Preserve any query params (mirror, session, embed) for the mirror flow.
 */
export default function GridPageRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) {
      params.set(key, Array.isArray(value) ? value[0] : value);
    }
  }
  const qs = params.toString();
  redirect(qs ? `/dashboard?${qs}` : "/dashboard");
}
