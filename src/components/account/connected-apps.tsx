"use client";

import { startTransition, useState } from "react";
import { Check, Copy, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeApp } from "@/server/actions/connected-apps";

// The MCP server URL, ready to copy into an app's connector settings.
export function ConnectorAddress({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the URL and copy it instead.");
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        readOnly
        value={url}
        aria-label="MCP server URL"
        onFocus={(e) => e.target.select()}
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 font-mono text-xs outline-none"
      />
      <Button variant="secondary" onClick={copy}>
        {copied ? <Check className="size-4 text-[#00c875]" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function RevokeButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  function revoke() {
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await revokeApp({ id });
        if ("error" in result) toast.error(result.error);
        else toast.success(`Access revoked for ${name}`);
      } catch {
        toast.error("Couldn't revoke access. Please try again.");
      } finally {
        setBusy(false);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        <Unplug className="size-4" /> Revoke
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="danger" size="sm" onClick={revoke} disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Revoke
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
        Cancel
      </Button>
    </div>
  );
}
