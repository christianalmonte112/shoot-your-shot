"use client";

import dynamic from "next/dynamic";
import { ScreenSkeleton } from "@/components/screen-skeleton";

function loading() {
  return <ScreenSkeleton />;
}

// These screens read localStorage on the first render. Skipping SSR avoids
// a flash of an empty brief that then fills in after hydration.
export const BriefScreen = dynamic(
  () => import("@/components/brief-form").then((mod) => mod.BriefForm),
  { ssr: false, loading },
);

export const CallScreen = dynamic(
  () => import("@/components/call-room").then((mod) => mod.CallRoom),
  { ssr: false, loading },
);

export const ResultsScreen = dynamic(
  () => import("@/components/results-view").then((mod) => mod.ResultsView),
  { ssr: false, loading },
);
