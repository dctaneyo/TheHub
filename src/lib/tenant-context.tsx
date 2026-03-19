"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface TenantBranding {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  faviconUrl: string | null;
  appTitle: string | null;
  plan: string;
  features: string[];
  maxLocations: number;
  maxUsers: number;
  isActive: boolean;
  customDomain: string | null;
}

interface TenantContextValue {
  tenant: TenantBranding | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  hasFeature: (feature: string) => boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  loading: true,
  error: null,
  refetch: () => {},
  hasFeature: () => true,
});

/**
 * Convert a hex color to HSL components for CSS variable injection.
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Generate a lighter variant of a hex color for backgrounds.
 */
function lightenHex(hex: string, amount: number = 0.92): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.round(parseInt(result[1], 16) + (255 - parseInt(result[1], 16)) * amount);
  const g = Math.round(parseInt(result[2], 16) + (255 - parseInt(result[2], 16)) * amount);
  const b = Math.round(parseInt(result[3], 16) + (255 - parseInt(result[3], 16)) * amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Darken a hex color for dark mode usage.
 */
function darkenHex(hex: string, amount: number = 0.3): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.round(parseInt(result[1], 16) * amount);
  const g = Math.round(parseInt(result[2], 16) * amount);
  const b = Math.round(parseInt(result[3], 16) * amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Apply tenant branding to CSS custom properties on :root.
 */
function applyBranding(tenant: TenantBranding) {
  const root = document.documentElement;
  const color = tenant.primaryColor || "#dc2626";
  const lightBg = lightenHex(color, 0.92);
  const darkVariant = darkenHex(color, 0.6);

  // Core brand color — used as var(--hub-red) throughout the app
  root.style.setProperty("--hub-red", color);
  root.style.setProperty("--hub-red-light", lightBg);

  // shadcn/ui primary theming
  root.style.setProperty("--primary", color);
  root.style.setProperty("--ring", color);
  root.style.setProperty("--chart-1", color);
  root.style.setProperty("--sidebar-primary", color);
  root.style.setProperty("--sidebar-ring", color);
  root.style.setProperty("--sidebar-accent-foreground", color);

  // Document title
  if (tenant.appTitle) {
    document.title = tenant.appTitle;
  }

  // Favicon
  if (tenant.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = tenant.faviconUrl;
  }

  // Theme-color meta tag
  const meta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (meta) {
    meta.content = color;
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetch("/api/tenants/current");
      if (!res.ok) {
        // Not on a tenant subdomain or tenant not found — use defaults
        setTenant(null);
        return;
      }
      const data = await res.json();
      if (data.tenant) {
        setTenant(data.tenant);
        applyBranding(data.tenant);
      }
    } catch (err) {
      console.error("Failed to fetch tenant:", err);
      setError("Failed to load tenant configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const hasFeature = useCallback(
    (feature: string) => {
      if (!tenant) return true; // No tenant context = allow all (dev mode)
      return tenant.features.includes(feature);
    },
    [tenant]
  );

  return (
    <TenantContext.Provider value={{ tenant, loading, error, refetch: fetchTenant, hasFeature }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
