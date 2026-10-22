"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;

export function DialogContent({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-xl bg-surface p-6 shadow-xl focus:outline-none",
          className,
        )}
      >
        <D.Title className="text-xl font-semibold">{title}</D.Title>
        {description ? (
          <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        <div className="mt-5">{children}</div>
        <D.Close aria-label="Close" className="absolute top-4 right-4 rounded-md p-1 text-muted hover:bg-hover">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
