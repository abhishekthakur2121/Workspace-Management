import type { Modifier } from "@dnd-kit/core";

// Same as @dnd-kit/modifiers' restrictToVerticalAxis, without the extra package.
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
