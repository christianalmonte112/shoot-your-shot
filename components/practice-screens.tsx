import { redirect } from "next/navigation";
import { loadAccount } from "@/lib/account";
import { missingSupabaseEnv, supabaseIsConfigured } from "@/lib/supabase/env";
import { BriefForm } from "@/components/brief-form";
import { CallRoom } from "@/components/call-room";
import { ResultsView } from "@/components/results-view";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AccountDataError({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Could not read your account</CardTitle>
        <CardDescription className="text-foreground/80">
          The database query failed. If you have not run the migration yet, run{" "}
          <span className="font-mono text-xs">supabase/migrations/20261028160000_init.sql</span> in the
          Supabase SQL editor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Practice pages require a signed-in user once Supabase is configured.
 * Without those env vars we show the setup notice and keep the local draft
 * so the screens still open while the owner is wiring accounts.
 */
export async function BriefScreen() {
  if (!supabaseIsConfigured()) {
    return (
      <div className="grid gap-8">
        <SupabaseSetupNotice missing={missingSupabaseEnv()} />
        <BriefForm source="local" />
      </div>
    );
  }

  const account = await loadAccount();
  if (!account) redirect("/login?next=/brief");
  if ("error" in account) return <AccountDataError message={account.error} />;
  return <BriefForm source="account" initialBrief={account.brief} />;
}

export async function CallScreen() {
  if (!supabaseIsConfigured()) {
    return (
      <div className="grid gap-8">
        <SupabaseSetupNotice missing={missingSupabaseEnv()} />
        <CallRoom source="local" />
      </div>
    );
  }

  const account = await loadAccount();
  if (!account) redirect("/login?next=/call");
  if ("error" in account) return <AccountDataError message={account.error} />;
  return (
    <CallRoom
      source="account"
      email={account.user.email}
      callsUsed={account.callsUsed}
      callLimit={account.callLimit}
      onWaitlist={account.onWaitlist}
      pastTurns={account.calls[0]?.turns ?? []}
    />
  );
}

export async function ResultsScreen() {
  if (!supabaseIsConfigured()) {
    return (
      <div className="grid gap-8">
        <SupabaseSetupNotice missing={missingSupabaseEnv()} />
        <ResultsView source="local" />
      </div>
    );
  }

  const account = await loadAccount();
  if (!account) redirect("/login?next=/results");
  if ("error" in account) return <AccountDataError message={account.error} />;
  return (
    <ResultsView
      source="account"
      brief={account.brief}
      calls={account.calls}
    />
  );
}
