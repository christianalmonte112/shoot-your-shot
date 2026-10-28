import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SupabaseSetupNotice({ missing }: { missing: string[] }) {
  return (
    <Card className="border-primary/40 bg-primary/10">
      <CardHeader>
        <CardTitle>Accounts are not configured yet</CardTitle>
        <CardDescription className="text-foreground/80">
          Sign-in and the free-call limit need Supabase. Add these to{" "}
          <span className="font-mono text-xs">.env.local</span>, restart the dev
          server, and run <span className="font-mono text-xs">supabase/migrations/20261028160000_init.sql</span>.
          Until then you can still draft a brief on this device, but a call cannot start.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {missing.map((name) => (
            <li
              key={name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/70 px-3 py-2"
            >
              <code className="text-xs sm:text-sm">{name}</code>
              <span className="text-sm text-primary">Missing</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
