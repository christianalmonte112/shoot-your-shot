export function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-4">
      <span className="sr-only">Loading</span>
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="h-44 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
