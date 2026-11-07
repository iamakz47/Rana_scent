// Streams each admin page behind its own boundary, so navigation between
// sections is instant while live data loads.
export function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="space-y-3 border-b border-ink/10 pb-6">
        <div className="h-3 w-24 animate-pulse rounded bg-gold/20" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-ink/8" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink/5" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-ink/5" />
    </div>
  );
}
