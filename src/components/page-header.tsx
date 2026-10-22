export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-grid bg-surface px-6 py-5">
      {icon}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[26px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
