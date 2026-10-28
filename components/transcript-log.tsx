"use client";

import { useEffect, useRef } from "react";
import { coachStartIndex } from "@/lib/coaching";
import type { TranscriptTurn } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TranscriptLog({
  turns,
  buyerName,
  empty,
}: {
  turns: TranscriptTurn[];
  buyerName: string;
  empty: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const coachFrom = coachStartIndex(turns);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  return (
    <div
      ref={scrollerRef}
      role="log"
      aria-label="Call transcript"
      className="h-[min(28rem,60vh)] overflow-y-auto rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4"
    >
      {turns.length === 0 ? (
        <p className="px-1 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="grid gap-3">
          {turns.map((turn, index) => {
            const mine = turn.role === "user";
            const coach = !mine && coachFrom !== -1 && index >= coachFrom;
            const label = mine ? "You" : coach ? "Coach" : buyerName;
            return (
              <li
                key={turn.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3 py-2 sm:max-w-[80%]",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-background ring-1 ring-foreground/10",
                    coach && !mine && "ring-primary/50",
                    !turn.final && "opacity-80",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[11px] font-medium tracking-wide uppercase",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {label}
                    {!turn.final ? " · speaking" : ""}
                  </span>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
