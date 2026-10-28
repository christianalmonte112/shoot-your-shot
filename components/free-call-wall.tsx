"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown when the account has used its three free calls.
 * Past notes stay on the results page; this only replaces Start call.
 *
 * TODO(stripe): swap the waitlist button for Stripe Checkout and let
 * start_practice_call() allow calls above the free cap for paid accounts.
 */
export function FreeCallWall({
  email,
  alreadyJoined,
}: {
  email: string;
  alreadyJoined: boolean;
}) {
  const [joined, setJoined] = useState(alreadyJoined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/waitlist", { method: "POST" });
      if (!response.ok) {
        setError("Could not save your email. Try again in a moment.");
        return;
      }
      setJoined(true);
    } catch {
      setError("Could not save your email. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>You&apos;ve used your free practice calls</CardTitle>
        <CardDescription className="text-foreground/80">
          Your past transcripts and coaching notes are still on the Notes page.
          More calls are not for sale yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {joined ? (
          <p className="text-sm text-muted-foreground">
            {email ? `${email} is` : "You're"} on the waitlist. We&apos;ll write when more calls open up.
          </p>
        ) : (
          <Button
            type="button"
            className="h-11 rounded-full px-5"
            onClick={() => void join()}
            disabled={pending}
          >
            {pending ? "Saving…" : "Join the waitlist for more calls"}
          </Button>
        )}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
