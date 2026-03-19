"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Palette, Users, Zap, Check, ChevronRight,
  ChevronLeft, Loader2, Globe, Eye, EyeOff, ArrowLeft,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "org" | "branding" | "admin" | "plan" | "complete";
const STEPS: Step[] = ["org", "branding", "admin", "plan", "complete"];

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    description: "Perfect for getting started",
    locations: 10,
    users: 5,
    features: ["Messaging", "Tasks", "Forms"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49/mo",
    description: "For growing franchises",
    locations: 50,
    users: 20,
    features: ["Everything in Starter", "Gamification", "Meetings", "Analytics"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Unlimited scale",
    locations: 500,
    users: 100,
    features: ["Everything in Pro", "Broadcasts", "Custom domain", "Priority support"],
  },
];

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState<Step>("org");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Org step
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Branding step
  const [primaryColor, setPrimaryColor] = useState("#dc2626");
  const [appTitle, setAppTitle] = useState("");

  // Admin step
  const [adminName, setAdminName] = useState("");
  const [adminUserId, setAdminUserId] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Plan step
  const [selectedPlan, setSelectedPlan] = useState("starter");

  // Complete step
  const [result, setResult] = useState<{
    tenant: { slug: string; subdomain: string; name: string };
    admin: { name: string; userId: string };
  } | null>(null);

  // Auto-generate slug from org name
  useEffect(() => {
    if (orgName && !slug) {
      const auto = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30);
      setSlug(auto);
    }
  }, [orgName]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tenants/signup?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setSlugAvailable(data.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [slug]);

  const stepIndex = STEPS.indexOf(currentStep);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case "org": return orgName.length >= 2 && slug.length >= 3 && slugAvailable === true;
      case "branding": return true; // optional
      case "admin": return adminName.length >= 2 && /^\d{4}$/.test(adminUserId) && /^\d{4}$/.test(adminPin);
      case "plan": return true;
      default: return false;
    }
  }, [currentStep, orgName, slug, slugAvailable, adminName, adminUserId, adminPin]);

  const goNext = () => {
    if (currentStep === "plan") {
      handleSubmit();
    } else {
      const next = STEPS[stepIndex + 1];
      if (next) setCurrentStep(next);
    }
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tenants/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Hub-Request": "1" },
        body: JSON.stringify({
          slug,
          name: orgName,
          appTitle: appTitle || `${orgName} Hub`,
          primaryColor,
          plan: selectedPlan,
          adminName,
          adminUserId,
          adminPin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setResult(data);
      setCurrentStep("complete");
    } catch (err) {
      setError("Connection failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Back to home */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </a>

        {/* Progress bar */}
        {currentStep !== "complete" && (
          <div className="flex items-center gap-2 mb-8">
            {STEPS.filter((s) => s !== "complete").map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                    i <= stepIndex ? "bg-red-500" : "bg-white/10"
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-8 shadow-2xl backdrop-blur-sm"
          >
            {/* ── Step 1: Organization ── */}
            {currentStep === "org" && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 shadow-lg">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Your Organization</h2>
                    <p className="text-sm text-slate-400">Tell us about your franchise</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">Organization Name</label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. KFC Northwest Region"
                      className="bg-white/5 border-white/10 text-white h-12 text-base"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">Subdomain</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))}
                        placeholder="your-org"
                        className="bg-white/5 border-white/10 text-white h-12 text-base font-mono"
                      />
                      <span className="text-slate-400 text-sm whitespace-nowrap">.meetthehub.com</span>
                    </div>
                    <div className="mt-1 h-5">
                      {checkingSlug && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                        </span>
                      )}
                      {!checkingSlug && slugAvailable === true && slug.length >= 3 && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Available!
                        </span>
                      )}
                      {!checkingSlug && slugAvailable === false && (
                        <span className="text-xs text-red-400">This subdomain is taken or reserved</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Branding ── */}
            {currentStep === "branding" && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 shadow-lg">
                    <Palette className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Brand Your Hub</h2>
                    <p className="text-sm text-slate-400">Customize the look and feel (you can change this later)</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">App Title</label>
                    <Input
                      value={appTitle}
                      onChange={(e) => setAppTitle(e.target.value)}
                      placeholder={`${orgName || "Your"} Hub`}
                      className="bg-white/5 border-white/10 text-white h-12 text-base"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-300">Brand Color</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-12 w-16 rounded-xl cursor-pointer bg-transparent border-0"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="bg-white/5 border-white/10 text-white font-mono text-base w-32"
                      />
                      <div className="flex gap-2">
                        {["#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777"].map((c) => (
                          <button
                            key={c}
                            onClick={() => setPrimaryColor(c)}
                            className={`h-10 w-10 rounded-xl border-2 transition-all ${
                              primaryColor === c ? "border-white scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="mt-6 rounded-xl border border-white/10 p-4 bg-white/[0.02]">
                    <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-semibold">Preview</p>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(orgName || "H").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-bold">{appTitle || `${orgName || "Your"} Hub`}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <div className="h-8 rounded-lg px-4 flex items-center text-white text-xs font-semibold" style={{ backgroundColor: primaryColor }}>
                        Primary Button
                      </div>
                      <div className="h-8 rounded-lg px-4 flex items-center text-xs font-semibold border" style={{ borderColor: primaryColor, color: primaryColor }}>
                        Secondary
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Admin User ── */}
            {currentStep === "admin" && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Create Your Admin Account</h2>
                    <p className="text-sm text-slate-400">This will be the first admin user for your organization</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">Your Name</label>
                    <Input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="bg-white/5 border-white/10 text-white h-12 text-base"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">Login ID (4 digits)</label>
                    <Input
                      value={adminUserId}
                      onChange={(e) => setAdminUserId(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="e.g. 1001"
                      className="bg-white/5 border-white/10 text-white h-12 text-base font-mono text-center tracking-[0.5em]"
                      maxLength={4}
                    />
                    <p className="text-xs text-slate-500 mt-1">You'll use this to log in on the numpad</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-300">PIN (4 digits)</label>
                    <div className="relative">
                      <Input
                        type={showPin ? "text" : "password"}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="••••"
                        className="bg-white/5 border-white/10 text-white h-12 text-base font-mono text-center tracking-[0.5em] pr-12"
                        maxLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Keep this secure — it's your login password</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Plan ── */}
            {currentStep === "plan" && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 shadow-lg">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Choose Your Plan</h2>
                    <p className="text-sm text-slate-400">You can upgrade anytime</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`w-full text-left rounded-xl p-4 border-2 transition-all ${
                        selectedPlan === plan.id
                          ? "border-red-500 bg-red-500/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white">{plan.name}</h3>
                            {plan.id === "pro" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 uppercase">Popular</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                            {plan.features.map((f) => (
                              <span key={f} className="text-xs text-slate-300 flex items-center gap-1">
                                <Check className="h-3 w-3 text-emerald-400" /> {f}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">
                            Up to {plan.locations} locations · {plan.users} users
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <span className="text-xl font-black text-white">{plan.price}</span>
                          {selectedPlan === plan.id && (
                            <div className="mt-1">
                              <Check className="h-5 w-5 text-red-400 ml-auto" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Complete ── */}
            {currentStep === "complete" && result && (
              <div className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600/20"
                >
                  <Check className="h-10 w-10 text-emerald-400" />
                </motion.div>

                <h2 className="text-2xl font-bold text-white mb-2">Welcome to The Hub!</h2>
                <p className="text-slate-400 mb-6">
                  Your organization <span className="text-white font-semibold">{result.tenant.name}</span> is ready.
                </p>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Your Hub URL</span>
                    <span className="text-sm font-mono text-emerald-400">{result.tenant.subdomain}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Admin Name</span>
                    <span className="text-sm text-white">{result.admin.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Login ID</span>
                    <span className="text-sm font-mono text-white">{result.admin.userId}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-6">
                  Save your Login ID and PIN — you'll need them to sign in.
                </p>

                <a
                  href={`https://${result.tenant.subdomain}/login`}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-semibold transition-colors"
                >
                  <Globe className="h-5 w-5" />
                  Go to Your Hub
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Navigation */}
            {currentStep !== "complete" && (
              <div className="mt-8 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={goBack}
                  disabled={stepIndex === 0}
                  className="border-white/10 text-slate-300 hover:bg-white/5 gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={goNext}
                  disabled={!canProceed() || saving}
                  className="bg-red-600 hover:bg-red-700 gap-2 min-w-[140px]"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : currentStep === "plan" ? (
                    <>
                      Create Organization
                      <Check className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
