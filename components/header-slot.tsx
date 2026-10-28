import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { getAccountUser } from "@/lib/account";
import { supabaseIsConfigured } from "@/lib/supabase/env";

export function HeaderSlot() {
  return (
    <Suspense fallback={<SiteHeader email={null} />}>
      <SignedInHeader />
    </Suspense>
  );
}

async function SignedInHeader() {
  if (!supabaseIsConfigured()) return <SiteHeader email={null} />;
  const user = await getAccountUser();
  return <SiteHeader email={user?.email || null} />;
}
