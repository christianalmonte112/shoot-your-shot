import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { ResultsScreen } from "@/components/screens";

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
      <ResultsScreen />
    </PageShell>
  );
}
