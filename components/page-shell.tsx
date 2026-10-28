import { cn } from "@/lib/utils";

export function PageShell({
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12", className)}>
      <header className="max-w-2xl">
        <p className="text-sm font-medium tracking-wide text-primary">{eyebrow}</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">{lede}</p>
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}
