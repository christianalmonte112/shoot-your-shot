import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { CallScreen } from "@/components/screens";

export const metadata: Metadata = {
  title: "Call",
  description: "Pitch the buyer out loud and watch the live transcript.",
};

export default function CallPage() {
  return (
    <PageShell
      eyebrow="Live practice"
      title="The call"
      lede="The buyer has your brief. Start when you are ready to say it out loud."
    >
      <CallScreen />
    </PageShell>
  );
}
