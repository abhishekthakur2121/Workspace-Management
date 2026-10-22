// Placeholder shown while a page's data loads, so navigation feels instant.
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="border-b border-grid bg-surface px-6 py-5">
        <div className="skeleton h-7 w-56 rounded-md" />
        <div className="skeleton mt-2 h-4 w-72 rounded" />
      </div>
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
