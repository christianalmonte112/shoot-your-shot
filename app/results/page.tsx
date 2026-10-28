import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountFallback } from "@/components/account-fallback";
import { PageShell } from "@/components/page-shell";
import { ResultsScreen } from "@/components/practice-screens";

export const metadata: Metadata = {
  title: "Notes",
  description: "What worked, what to tighten, and one line to try on the next call.",
};

export default function ResultsPage() {
  return (
    <PageShell
      eyebrow="After the call"
      title="Coaching notes"
      lede="What worked, what to tighten, and one line to try on the next call."
    >
      <Suspense fallback={<AccountFallback />}>
        <ResultsScreen />
      </Suspense>
    </PageShell>
  );
}
