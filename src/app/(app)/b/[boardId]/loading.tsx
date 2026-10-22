export default function BoardLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-border bg-surface px-6 pt-3 pb-4">
        <div className="h-3 w-24 rounded bg-hover" />
        <div className="mt-3 h-7 w-64 rounded bg-hover" />
      </div>
      <div className="space-y-4 p-6">
        <div className="h-5 w-32 rounded bg-hover" />
        <div className="h-24 rounded-lg bg-hover/60" />
      </div>
    </div>
  );
}
