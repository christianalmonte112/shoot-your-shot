import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { BriefScreen } from "@/components/screens";

export const metadata: Metadata = {
  title: "Brief",
  description: "Describe the product and the buyer before the practice call.",
};

export default function BriefPage() {
  return (
    <PageShell
      eyebrow="Before you dial"
      title="The brief"
      lede="Give the buyer enough to push back on. It stays in this browser — there is no account yet."
    >
      <BriefScreen />
    </PageShell>
  );
}
