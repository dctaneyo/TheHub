"use client";

import { useTenant } from "@/lib/tenant-context";
import { Lock, Zap } from "@/lib/icons";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wraps a feature section — renders children only if the tenant's plan
 * includes the required feature. Shows a locked upgrade prompt otherwise.
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { tenant, hasFeature, loading } = useTenant();

  // Still loading or no tenant context (dev mode) — show children
  if (loading || !tenant) return <>{children}</>;

  if (hasFeature(feature)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1">
        {feature.charAt(0).toUpperCase() + feature.slice(1)} Not Available
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        This feature isn't included in your current <span className="font-semibold capitalize">{tenant.plan}</span> plan.
        Contact your administrator to upgrade.
      </p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="h-3.5 w-3.5" />
        <span>Available on Pro and Enterprise plans</span>
      </div>
    </div>
  );
}
