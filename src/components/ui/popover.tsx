"use client";

import { Popover as P } from "radix-ui";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, align = "center", sideOffset = 4, ...props }: P.PopoverContentProps) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn("anim-pop z-50 rounded-xl border border-grid bg-surface p-2 text-sm shadow-xl shadow-black/5 outline-none", className)}
        {...props}
      />
    </P.Portal>
  );
}
