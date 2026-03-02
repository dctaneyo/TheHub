"use client";

/**
 * Patches the global `fetch` to automatically add the `X-Hub-Request: 1`
 * header on same-origin API mutation requests (POST, PUT, DELETE, PATCH).
 *
 * This works with the CSRF check in middleware.ts — cross-origin requests
 * can't set custom headers without a CORS preflight, so the header proves
 * the request originated from our own frontend.
 *
 * Call `installCsrfFetch()` once at app startup (e.g. in layout.tsx).
 */

let installed = false;

export function installCsrfFetch() {
  if (installed) return;
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Determine the URL string
    let url: string;
    if (input instanceof Request) {
      url = input.url;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input;
    }

    // Only patch same-origin API requests with mutation methods
    const isSameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
    const isApi = url.includes("/api/");
    const method = (init?.method || "GET").toUpperCase();
    const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

    if (isSameOrigin && isApi && isMutation) {
      const headers = new Headers(init?.headers);
      if (!headers.has("x-hub-request")) {
        headers.set("x-hub-request", "1");
      }
      return originalFetch(input, { ...init, headers });
    }

    return originalFetch(input, init);
  };

  installed = true;
}
