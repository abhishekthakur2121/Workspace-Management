import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    // Google profile photos; plain <img> avoids configuring remote image hosts.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} referrerPolicy="no-referrer" className={cn("size-7 rounded-full object-cover", className)} />;
  }
  return (
    <span
      title={name}
      className={cn("grid size-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-white", className)}
    >
      {initials(name)}
    </span>
  );
}

// Coloured rounded square with the workspace's first letter, as in monday.
export function WorkspaceIcon({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn("grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold text-white", className)}
      style={{ backgroundColor: color }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
