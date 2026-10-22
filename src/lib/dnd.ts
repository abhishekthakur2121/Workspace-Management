import type { Modifier } from "@dnd-kit/core";
import type { useSortable } from "@dnd-kit/sortable";

// Same as @dnd-kit/modifiers' restrictToVerticalAxis, without the extra package.
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// A sortable item's menus and pickers render in portals, but React still
// bubbles their events through the item. Only handle events that start inside
// the item's own DOM, so typing or clicking in a popover never starts a drag.
export function ownEventsOnly(listeners: ReturnType<typeof useSortable>["listeners"]) {
  if (!listeners) return {};
  return Object.fromEntries(
    Object.entries(listeners).map(([name, handler]) => [
      name,
      (e: React.SyntheticEvent) => {
        if (e.currentTarget.contains(e.target as Node)) (handler as (e: React.SyntheticEvent) => void)(e);
      },
    ]),
  );
}
