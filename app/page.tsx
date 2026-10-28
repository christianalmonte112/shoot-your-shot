import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartPracticingButton } from "@/components/start-practicing-button";

export const metadata: Metadata = {
  title: { absolute: "Shoot Your Shot" },
  description:
    "Practice your pitch against an AI buyer who pushes back, then get coached.",
};

const STEPS = [
  {
    number: "01",
    title: "Write the brief",
    body: "Product, buyer, and the objections you hope they skip.",
  },
  {
    number: "02",
    title: "Take the call",
    body: "A voice buyer stays in character and pushes back out loud.",
  },
  {
    number: "03",
    title: "Read the notes",
    body: "What worked, what to tighten, and one line to try next time.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-12 pb-8 sm:px-6 sm:pt-20">
      <p className="text-sm font-medium tracking-wide text-primary">Voice practice for builders</p>
      <h1 className="mt-4 max-w-3xl font-heading text-5xl leading-[1.05] tracking-tight text-balance sm:text-7xl">
        Shoot Your Shot
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
        Practice your pitch against an AI buyer who pushes back, then get coached.
      </p>
      <div className="mt-8">
        <StartPracticingButton />
      </div>

      <ol className="mt-16 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.number}>
            <Card className="h-full">
              <CardHeader>
                <p className="font-mono text-xs tracking-widest text-primary">{step.number}</p>
                <CardTitle className="font-heading text-2xl">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
