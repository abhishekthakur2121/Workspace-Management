import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border bg-surface hover:bg-hover",
  ghost: "hover:bg-hover",
  danger: "bg-danger text-white hover:bg-danger/90",
};

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: "sm" | "md" | "icon";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
        size === "md" && "h-9 px-4",
        size === "sm" && "h-8 px-3",
        size === "icon" && "size-7",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
