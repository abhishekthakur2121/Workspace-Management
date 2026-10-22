"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Palette, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { deleteGroup, moveGroup, restoreGroup, updateGroup } from "@/server/actions/board-structure";
import { PALETTE, cn } from "@/lib/utils";
import type { Section } from "./layout";
import { focusAfterMenu } from "@/lib/focus";

export function GroupName({
  id,
  name,
  color,
  editing,
  onEditingChange,
}: {
  id: string;
  name: string;
  color: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const [draft, setDraft] = useState(name);
  function stop(save: boolean) {
    onEditingChange(false);
    const next = draft.trim();
    if (save && next && next !== name) updateGroup({ id, name: next });
    else setDraft(name);
  }
  if (editing) {
    return (
      <input
        ref={focusAfterMenu}
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => stop(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") stop(true);
          if (e.key === "Escape") stop(false);
        }}
        className="h-8 rounded border border-primary px-1 text-lg font-semibold outline-none"
        style={{ color }}
      />
    );
  }
  return (
    <button
      onClick={() => {
        setDraft(name);
        onEditingChange(true);
      }}
      className="rounded border border-transparent px-1 text-lg font-semibold hover:border-border"
      style={{ color }}
    >
      {name}
    </button>
  );
}

export function GroupMenu({ section, index, count, onRename }: { section: Section; index: number; count: number; onRename: () => void }) {
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button
          aria-label={`${section.name} group options`}
          className="ml-1 rounded p-1 text-muted opacity-0 group-hover/header:opacity-100 hover:bg-hover focus:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </MenuTrigger>
      {/* Keep focus on the inline editor the menu opens. */}
      <MenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <MenuItem icon={<Pencil />} onSelect={onRename}>
          Rename group
        </MenuItem>
        <MenuLabel>
          <span className="flex items-center gap-1.5">
            <Palette className="size-3.5" /> Color
          </span>
        </MenuLabel>
        <div className="grid grid-cols-5 gap-1.5 px-2.5 pb-2">
          {PALETTE.map((c) => (
            <MenuItem
              key={c}
              aria-label={`Color ${c}`}
              onSelect={() => updateGroup({ id: section.id, color: c })}
              className={cn("size-6 rounded-md p-0 data-highlighted:bg-transparent", c === section.color && "ring-2 ring-foreground/40 ring-offset-1")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <MenuSeparator />
        <MenuItem icon={<ArrowUp />} disabled={index === 0} onSelect={() => moveGroup({ id: section.id, direction: "up" })}>
          Move up
        </MenuItem>
        <MenuItem icon={<ArrowDown />} disabled={index === count - 1} onSelect={() => moveGroup({ id: section.id, direction: "down" })}>
          Move down
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          danger
          icon={<Trash2 />}
          onSelect={async () => {
            await deleteGroup({ id: section.id });
            toast(`Deleted group "${section.name}"`, { action: { label: "Undo", onClick: () => restoreGroup({ id: section.id }) } });
          }}
        >
          Delete group
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
