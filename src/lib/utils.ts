import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// monday.com's group / workspace palette
export const PALETTE = [
  "#579bfc", "#a25ddc", "#00c875", "#fdab3d", "#e2445c",
  "#ff642e", "#037f4c", "#9cd326", "#ff158a", "#66ccff",
  "#784bd1", "#bb3354", "#cab641", "#7f5347", "#225091",
] as const;
