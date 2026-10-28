"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/brief", label: "Brief" },
  { href: "/call", label: "Call" },
  { href: "/results", label: "Notes" },
] as const;

export function SiteHeader({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-heading text-lg tracking-tight text-foreground">
          Shoot Your Shot
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Practice" className="flex items-center gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {email ? (
            <div className="flex items-center gap-2">
              <span className="max-w-36 truncate text-xs text-muted-foreground" title={email}>
                {email}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium",
                pathname === "/login"
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
