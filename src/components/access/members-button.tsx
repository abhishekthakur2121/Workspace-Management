"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceMembersDialog } from "./workspace-members-dialog";

export function MembersButton({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Users className="size-4" /> Members
      </Button>
      <WorkspaceMembersDialog workspaceId={workspaceId} workspaceName={workspaceName} open={open} onOpenChange={setOpen} />
    </>
  );
}
