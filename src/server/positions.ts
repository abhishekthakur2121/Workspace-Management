import "server-only";
import { generateKeyBetween } from "fractional-indexing";

// Ordering uses fractional-index strings: moving an item computes a key between
// its new neighbours, so a reorder updates a single row.
export function positionBetween(before?: string | null, after?: string | null) {
  return generateKeyBetween(before ?? null, after ?? null);
}

export function positionAfter(last?: string | null) {
  return generateKeyBetween(last ?? null, null);
}
