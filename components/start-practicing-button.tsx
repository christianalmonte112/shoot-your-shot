"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StartPracticingButton() {
  return (
    <Button
      render={<Link href="/brief" />}
      className="h-12 rounded-full px-6 text-base"
    >
      Start practicing
      <ArrowRight />
    </Button>
  );
}
