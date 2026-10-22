"use client";

import { FolderInput, Trash2, X } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PopoverTrigger } from "@/components/ui/popover";
import { useBoard } from "./board-context";
import { PeoplePicker, PriorityPicker, StatusPicker } from "./pickers";

const action =
  "inline-flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs transition-all duration-150 hover:bg-hover active:scale-[0.96] data-[state=open]:bg-hover";

// Floating bar for acting on every selected task at once, as in monday.
export function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const { board, bulkUpdate, remove } = useBoard();
  if (!ids.length) return null;

  return (
    <div className="anim-bulk fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-grid bg-surface/90 py-1 pr-1 pl-4 shadow-2xl backdrop-blur-md md:left-[calc(50%+8rem)]">
      <span className="mr-2 flex items-center gap-2 text-sm">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-white">{ids.length}</span>
        <span className="hidden sm:inline">selected</span>
      </span>

      <StatusPicker boardId={board.id} statuses={board.statuses} value={null} onChange={(statusId) => bulkUpdate(ids, { statusId })}>
        <PopoverTrigger asChild>
          <button className={action}>
            <span className="size-3.5 rounded-sm bg-[#00c875]" />
            Status
          </button>
        </PopoverTrigger>
      </StatusPicker>

      <PeoplePicker people={board.users} value={[]} multiple={false} onChange={(next) => bulkUpdate(ids, { accountableId: next[0] ?? null })}>
        <PopoverTrigger asChild>
          <button className={action}>
            <span className="size-3.5 rounded-full bg-primary" />
            Accountable
          </button>
        </PopoverTrigger>
      </PeoplePicker>

      <PriorityPicker value={null} onChange={(priority) => bulkUpdate(ids, { priority })}>
        <PopoverTrigger asChild>
          <button className={action}>
            <span className="size-3.5 rounded-sm bg-[#ff7a1a]" />
            Priority
          </button>
        </PopoverTrigger>
      </PriorityPicker>

      <Menu>
        <MenuTrigger asChild>
          <button className={action}>
            <FolderInput className="size-4" />
            Move to
          </button>
        </MenuTrigger>
        <MenuContent side="top">
          {board.groups.map((g) => (
            <MenuItem key={g.id} onSelect={() => bulkUpdate(ids, {}, g.id)} icon={<span className="size-3 rounded-full" style={{ backgroundColor: g.color }} />}>
              {g.name}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <button
        className={`${action} text-danger`}
        onClick={() => {
          remove(ids);
          onClear();
        }}
      >
        <Trash2 className="size-4" />
        Delete
      </button>

      <button aria-label="Clear selection" onClick={onClear} className="ml-1 grid h-12 w-10 place-items-center border-l border-border text-muted hover:text-foreground">
        <X className="size-5" />
      </button>
    </div>
  );
}
