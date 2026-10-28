import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ENV_VARS = [
  "NEXT_PUBLIC_VAPI_PUBLIC_KEY",
  "NEXT_PUBLIC_VAPI_ASSISTANT_ID",
] as const;

export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <Card className="border-primary/40 bg-primary/10">
      <CardHeader>
        <CardTitle>Voice is not configured yet</CardTitle>
        <CardDescription className="text-foreground/80">
          The rest of the app works. Add these public env vars to{" "}
          <span className="font-mono text-xs">.env.local</span>, restart the dev
          server, and the Start call button will show up. The prompt those
          variables fill is in <span className="font-mono text-xs">docs/buyer-prompt.md</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {ENV_VARS.map((name) => {
            const absent = missing.includes(name);
            return (
              <li
                key={name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/70 px-3 py-2"
              >
                <code className="text-xs sm:text-sm">{name}</code>
                <span className={absent ? "text-sm text-primary" : "text-sm text-muted-foreground"}>
                  {absent ? "Missing" : "Set"}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
