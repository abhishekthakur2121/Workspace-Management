"use client";

import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = "start", ...props }: DropdownMenu.DropdownMenuContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={4}
        className={cn(
          "z-50 min-w-48 rounded-lg border border-border bg-surface p-1.5 text-sm shadow-lg",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  danger,
  icon,
  children,
  ...props
}: DropdownMenu.DropdownMenuItemProps & { danger?: boolean; icon?: React.ReactNode }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 outline-none select-none",
        "data-highlighted:bg-hover data-disabled:pointer-events-none data-disabled:opacity-50",
        danger && "text-danger",
        className,
      )}
      {...props}
    >
      {icon && <span className="flex size-4 items-center justify-center [&>svg]:size-4">{icon}</span>}
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 py-1 text-xs font-medium text-muted">{children}</DropdownMenu.Label>;
}
