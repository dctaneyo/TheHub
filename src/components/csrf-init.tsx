"use client";

import { useEffect } from "react";
import { installCsrfFetch } from "@/lib/fetch-csrf";

/**
 * Invisible component that installs the CSRF fetch interceptor once on mount.
 * Place in the root layout so it runs before any API calls.
 */
export function CsrfInit() {
  useEffect(() => {
    installCsrfFetch();
  }, []);
  return null;
}
