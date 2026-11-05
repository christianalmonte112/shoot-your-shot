"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePhone } from "@/lib/phone";

type PhoneStatus = "idle" | "calling" | "ringing";

/**
 * Outbound practice call. The private Vapi key never comes to the browser;
 * this component only posts the number to /api/call-me.
 */
export function CallMePanel({
  savedPhone,
  disabled,
  onAuthorized,
  onLimit,
}: {
  savedPhone: string;
  disabled: boolean;
  onAuthorized: (freeCallsUsed: number) => void;
  onLimit: () => void;
}) {
  const [phone, setPhone] = useState(savedPhone);
  const [status, setStatus] = useState<PhoneStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function remember(next: string) {
    const normalized = normalizePhone(next);
    if (!normalized) return;
    await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: normalized }),
    });
  }

  async function callMe() {
    setError(null);
    if (!normalizePhone(phone)) {
      setStatus("idle");
      setError("Add a phone number in international format, like +15551234567.");
      return;
    }
    setStatus("calling");
    try {
      const response = await fetch("/api/call-me", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ phone }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        freeCallsUsed?: number;
        phone?: string;
      } | null;

      if (payload?.error === "free_call_limit") {
        setStatus("idle");
        onLimit();
        setError("You've used your free practice calls.");
        return;
      }
      if (payload?.error === "outbound_disabled" || payload?.error === "not_allowlisted") {
        setStatus("idle");
        setError("Outbound calls are off until this number is on the verified allowlist. No call was placed.");
        return;
      }
      if (response.status === 400 && payload?.error === "missing_phone") {
        setStatus("idle");
        setError("Add a phone number in international format, like +15551234567.");
        return;
      }
      if (response.status === 400 && payload?.error === "brief_incomplete") {
        setStatus("idle");
        setError("Finish the brief before the buyer calls you.");
        return;
      }
      if (!response.ok) {
        setStatus("idle");
        setError(payload?.message || "Vapi could not place the call.");
        return;
      }
      if (typeof payload?.freeCallsUsed === "number") onAuthorized(payload.freeCallsUsed);
      if (payload?.phone) setPhone(payload.phone);
      setStatus("ringing");
    } catch {
      setStatus("idle");
      setError("Vapi could not place the call.");
    }
  }

  return (
    <div className="grid gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Label htmlFor="phone">Or have the buyer call you</Label>
      <Input
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+15551234567"
        className="h-11"
        value={phone}
        aria-invalid={Boolean(error) || undefined}
        disabled={disabled || status === "calling"}
        onChange={(event) => {
          setPhone(event.target.value);
          if (status === "ringing") setStatus("idle");
          if (error) setError(null);
        }}
        onBlur={() => void remember(phone)}
      />
      <p className="text-sm text-muted-foreground">
        Use international format, like +15551234567. It is saved on your profile.
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full"
        onClick={() => void callMe()}
        disabled={disabled || status === "calling"}
      >
        <Phone />
        {status === "calling" ? "Calling…" : "Call me"}
      </Button>
      {status === "ringing" ? (
        <p className="text-sm text-foreground" role="status">
          Your phone should ring now.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
