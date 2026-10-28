import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountFallback } from "@/components/account-fallback";
import { LoginForm } from "@/components/login-form";
import { PageShell } from "@/components/page-shell";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { safeNextPath } from "@/lib/limits";
import { getAccountUser } from "@/lib/account";
import { missingSupabaseEnv, supabaseIsConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in with an email link or Google to use Shoot Your Shot.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <PageShell
      eyebrow="Your account"
      title="Log in"
      lede="Three free practice calls come with an account. Each one stops at seven minutes."
    >
      <Suspense fallback={<AccountFallback />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function LoginGate({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!supabaseIsConfigured()) {
    return <SupabaseSetupNotice missing={missingSupabaseEnv()} />;
  }
  const user = await getAccountUser();
  if (user) {
    const params = await searchParams;
    redirect(safeNextPath(params.next));
  }
  return <LoginForm />;
}
