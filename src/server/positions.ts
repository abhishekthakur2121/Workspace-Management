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

// n increasing positions, for seeding a fresh list (e.g. a new board's labels).
export function positionsFromStart(n: number) {
  const keys: string[] = [];
  for (let i = 0; i < n; i++) keys.push(positionAfter(keys[i - 1]));
  return keys;
}
