"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/limits";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const authError = params.get("error");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function redirectTo() {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  }

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setStatus("error");
      setMessage("Enter the email address you want the link sent to.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase is not configured in this environment.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  async function continueWithGoogle() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase is not configured in this environment.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  if (status === "sent") {
    return (
      <div className="max-w-md rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl tracking-tight">Check your email</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We sent a sign-in link to {email.trim()}. Open it on this device and you&apos;ll land back in Shoot Your Shot.
        </p>
      </div>
    );
  }

  return (
    <div className="grid max-w-md gap-6">
      {authError ? (
        <p className="text-sm text-destructive" role="alert">
          That sign-in link did not work. Request a new one.
        </p>
      ) : null}
      <form onSubmit={(event) => void sendLink(event)} className="grid gap-3">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="h-11"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Button type="submit" className="h-11 rounded-full" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
        <p className="text-sm text-muted-foreground">No password. The link signs you in.</p>
      </form>
      <div className="flex items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full"
        onClick={() => void continueWithGoogle()}
        disabled={status === "sending"}
      >
        Continue with Google
      </Button>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
