"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Password field with a show/hide eye. Copy and paste work as normal.
export function PasswordInput({
  className,
  visible,
  onVisibleChange,
  ...props
}: React.ComponentProps<"input"> & { visible?: boolean; onVisibleChange?: (v: boolean) => void }) {
  const [ownVisible, setOwnVisible] = useState(false);
  const show = visible ?? ownVisible;
  const setShow = onVisibleChange ?? setOwnVisible;
  return (
    <span className="relative mt-1.5 block">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-surface pr-10 pl-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
          show && "font-mono tracking-wide",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
  );
}

// Strong, readable password generated in the browser (no 0/O/1/l/I).
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateStrongPassword(groups = 4) {
  const bytes = new Uint32Array(groups * 4);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]);
  return Array.from({ length: groups }, (_, i) => chars.slice(i * 4, i * 4 + 4).join("")).join("-");
}
