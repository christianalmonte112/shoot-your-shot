import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountFallback } from "@/components/account-fallback";
import { PageShell } from "@/components/page-shell";
import { CallScreen } from "@/components/practice-screens";

export const metadata: Metadata = {
  title: "Call",
  description: "Pitch the buyer out loud and watch the live transcript.",
};

export default function CallPage() {
  return (
    <PageShell
      eyebrow="Live practice"
      title="The call"
      lede="Each account gets three calls. Each call stops at seven minutes."
    >
      <Suspense fallback={<AccountFallback />}>
        <CallScreen />
      </Suspense>
    </PageShell>
  );
}
