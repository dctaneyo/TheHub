"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";

const PIN_LENGTH = 6;

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "pin">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pinToken, setPinToken] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-request": "1" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Invalid email or password");
        return;
      }
      setPinToken(data.pinToken);
      setStep("pin");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  const submitPin = useCallback(async (enteredPin: string) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-request": "1" },
        body: JSON.stringify({ pinToken, pin: enteredPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Incorrect PIN");
        setPin("");
        return;
      }
      router.push("/admin/tenants");
    } catch {
      setError("Network error — please try again");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [pinToken, router]);

  const handleDigit = useCallback((digit: string) => {
    setPin((prev) => {
      const next = prev.length < PIN_LENGTH ? prev + digit : prev;
      if (next.length === PIN_LENGTH) submitPin(next);
      return next;
    });
  }, [submitPin]);

  const handleDelete = useCallback(() => setPin((p) => p.slice(0, -1)), []);
  const handleClear = useCallback(() => setPin(""), []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 text-center">
          <span className="font-mono text-lg font-bold text-foreground">nimda</span>
          <p className="mt-1 text-sm text-muted-foreground">Admin Console</p>
        </div>

        {step === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
          </form>
        ) : (
          <div>
            <p className="mb-4 text-center text-sm text-muted-foreground">Enter your 6-digit PIN</p>
            <div className="mb-3 flex justify-center gap-2">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <div key={i} className={`h-2.5 w-2.5 rounded-full ${i < pin.length ? "bg-foreground" : "bg-muted"}`} />
              ))}
            </div>
            <div className="mb-2 h-6 flex items-center justify-center">
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
            <PinPad
              value={pin}
              maxLength={PIN_LENGTH}
              onDigit={handleDigit}
              onDelete={handleDelete}
              onAction={() => { setStep("password"); setPin(""); setError(""); }}
              actionContent="Back"
              disabled={loading}
            />
            <button
              onClick={handleClear}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
