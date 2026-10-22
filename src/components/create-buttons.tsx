"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NameDialog } from "@/components/dialogs";
import { createBoard } from "@/server/actions/boards";
import { createWorkspace } from "@/server/actions/workspaces";

// Wrap any button: clicking it opens the "new board" dialog, then navigates there.
export function CreateBoardDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create board"
      label="Board name"
      placeholder="e.g. Digital Operations"
      submitLabel="Create board"
      onSubmit={async (name) => {
        const board = await createBoard({ workspaceId, name });
        router.push(`/b/${board.id}`);
      }}
    />
  );
}

export function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create workspace"
      label="Workspace name"
      placeholder="e.g. NXT"
      submitLabel="Create workspace"
      onSubmit={async (name) => {
        const workspace = await createWorkspace({ name });
        router.push(`/w/${workspace.id}`);
      }}
    />
  );
}

export function CreateBoardButton({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {children}
      </span>
      <CreateBoardDialog workspaceId={workspaceId} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CreateWorkspaceButton({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {children}
      </span>
      <CreateWorkspaceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
