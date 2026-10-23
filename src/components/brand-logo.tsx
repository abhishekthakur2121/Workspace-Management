import { cn } from "@/lib/utils";

export const APP_NAME = "Nxt Workspace Manager";

// NXT Horizon logo with the product name under it. There are two copies of
// the artwork (white wordmark for dark mode, dark wordmark for light mode);
// CSS shows the right one for the theme (.logo-for-dark / .logo-for-light).
export function BrandLogo({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const height = size === "sm" ? "h-4" : size === "lg" ? "h-6" : "h-5";
  return (
    <span className={cn("inline-flex flex-col items-start leading-none", className)}>
      {[
        { src: "/brand/nxthorizon-logo.svg", theme: "logo-for-dark" },
        { src: "/brand/nxthorizon-logo-light.svg", theme: "logo-for-light" },
      ].map((logo) => (
        // eslint-disable-next-line @next/next/no-img-element -- plain SVG asset
        <img
          key={logo.theme}
          src={logo.src}
          alt="NXT Horizon"
          className={cn("w-auto", logo.theme, height)}
        />
      ))}
      {size !== "sm" && (
        <span className={cn("mt-1.5 font-medium tracking-wide text-muted", size === "lg" ? "text-sm" : "text-[11px]")}>
          Workspace Manager
        </span>
      )}
    </span>
  );
}
