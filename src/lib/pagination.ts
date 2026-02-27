/**
 * Cursor-based pagination utilities for API routes.
 *
 * Usage in API routes:
 *   const { limit, cursor } = parsePaginationParams(req);
 *   const items = fetchItems(cursor, limit + 1); // fetch one extra to check hasMore
 *   return NextResponse.json(paginatedResponse(items, limit));
 */

import { NextRequest } from "next/server";

export interface PaginationParams {
  limit: number;
  cursor?: string;  // opaque cursor (typically a createdAt timestamp or ID)
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;  // null = no more pages
  hasMore: boolean;
  count: number;
}

/**
 * Parse pagination params from query string.
 * Defaults: limit=20, no cursor (first page).
 */
export function parsePaginationParams(req: NextRequest, defaultLimit = 20, maxLimit = 100): PaginationParams {
  const url = new URL(req.url);
  const limitStr = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor") || undefined;

  let limit = defaultLimit;
  if (limitStr) {
    const parsed = parseInt(limitStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, maxLimit);
    }
  }

  return { limit, cursor };
}

/**
 * Build a paginated response from an array of items.
 * The array should contain `limit + 1` items; if it does, hasMore is true
 * and the last item provides the cursor for the next page.
 *
 * @param items - Array of items (fetch limit + 1 to detect hasMore)
 * @param limit - Page size
 * @param cursorField - Field name to use as cursor (default: "createdAt")
 */
export function paginatedResponse<T extends Record<string, any>>(
  items: T[],
  limit: number,
  cursorField: keyof T = "createdAt" as keyof T
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const lastItem = data[data.length - 1];
  const cursor = hasMore && lastItem ? String(lastItem[cursorField]) : null;

  return { data, cursor, hasMore, count: data.length };
}
