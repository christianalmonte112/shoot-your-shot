import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountFallback } from "@/components/account-fallback";
import { PageShell } from "@/components/page-shell";
import { BriefScreen } from "@/components/practice-screens";

export const metadata: Metadata = {
  title: "Brief",
  description: "Describe the product and the buyer before the practice call.",
};

export default function BriefPage() {
  return (
    <PageShell
      eyebrow="Before you dial"
      title="The brief"
      lede="Give the buyer enough to push back on. A signed-in brief is saved to your account."
    >
      <Suspense fallback={<AccountFallback />}>
        <BriefScreen />
      </Suspense>
    </PageShell>
  );
}
