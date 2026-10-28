import Link from "next/link";
import { getPersona } from "@/lib/personas";
import type { PitchBrief } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function line(value: string): string {
  const trimmed = value.trim();
  return trimmed || "Not filled in";
}

export function BriefSummary({ brief }: { brief: PitchBrief }) {
  const persona = getPersona(brief.persona);
  const ready = brief.productName.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who picks up</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {ready ? (
          <div>
            <p className="font-heading text-2xl tracking-tight">{brief.productName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {persona.buyerName}, {persona.buyerRole}
            </p>
            <Badge variant="secondary" className="mt-3">
              {persona.label}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No brief yet.{" "}
            <Link href="/brief" className="font-medium text-foreground underline underline-offset-4">
              Write one
            </Link>{" "}
            before you dial.
          </p>
        )}
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">What it is</dt>
            <dd className="mt-1 line-clamp-4">{line(brief.productSummary)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Who it is for</dt>
            <dd className="mt-1">{line(brief.targetCustomer)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pricing</dt>
            <dd className="mt-1">{line(brief.pricing)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">They use today</dt>
            <dd className="mt-1">{line(brief.currentSolution)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Features</dt>
            <dd className="mt-1 line-clamp-4 whitespace-pre-wrap">{line(brief.features)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Objections you dread</dt>
            <dd className="mt-2">
              {brief.objections.length === 0 ? (
                <span>None listed. The buyer will invent their own.</span>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {brief.objections.map((item) => (
                    <li key={item}>
                      <Badge variant="outline">{item}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
