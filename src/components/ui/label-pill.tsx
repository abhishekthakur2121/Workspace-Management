import { cn } from "@/lib/utils";

// A status/priority label as a glowing "neon" pill in its own colour (see
// .neon-pill in globals.css), or a dashed placeholder pill when unset.
// Fills its parent; size it with the wrapper.
export function LabelPill({
  color,
  children,
  placeholder = "–",
  className,
}: {
  color?: string;
  children?: React.ReactNode;
  placeholder?: React.ReactNode;
  className?: string;
}) {
  return color ? (
    <span className={cn("neon-pill h-full w-full px-3 text-[12.5px]", className)} style={{ "--c": color } as React.CSSProperties}>
      <span className="truncate">{children}</span>
    </span>
  ) : (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full border-[1.5px] border-dashed border-border px-3 text-[12.5px] text-muted/70 transition-colors",
        className,
      )}
    >
      {placeholder}
    </span>
  );
}
