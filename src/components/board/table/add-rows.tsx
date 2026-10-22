"use client";

import { useState } from "react";
import { useBoard } from "../board-context";
import { NO_STATUS, type TaskRow } from "../model";
import type { Section } from "./layout";
import { focusAfterMenu } from "@/lib/focus";

export function AddTaskRow({ section, template }: { section: Section; template: string }) {
  const { board, create } = useBoard();
  const [value, setValue] = useState("");
  const groupId = section.kind === "group" ? section.id : board.groups[0]?.id;
  if (!groupId) return null;
  return (
    <div className="grid h-10 border-b border-grid" style={{ gridTemplateColumns: template }}>
      <div className="border-r border-grid" />
      <form
        className="col-span-full col-start-2 flex items-center px-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = value.trim();
          if (!name) return;
          setValue("");
          // In a status section the task takes that status; otherwise the board default.
          create({
            groupId,
            name,
            statusId: section.kind === "status" ? (section.id === NO_STATUS ? null : section.id) : undefined,
          });
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+ Add task"
          aria-label={`Add task to ${section.name}`}
          maxLength={500}
          className="h-7 w-full max-w-md rounded-md border border-transparent px-2 text-sm outline-none placeholder:text-muted/80 hover:border-grid focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </form>
    </div>
  );
}

export function AddSubtaskRow({ parent, template }: { parent: TaskRow; template: string }) {
  const { create } = useBoard();
  const [value, setValue] = useState("");
  return (
    <div className="grid h-9 border-b border-grid" style={{ gridTemplateColumns: template }}>
      <div className="border-r border-grid" />
      <form
        className="col-span-full col-start-2 flex items-center pl-14"
        onSubmit={(e) => {
          e.preventDefault();
          const name = value.trim();
          if (!name) return;
          setValue("");
          create({ groupId: parent.groupId, parentId: parent.id, name });
        }}
      >
        <input
          ref={focusAfterMenu}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+ Add subtask"
          aria-label={`Add subtask to ${parent.name}`}
          maxLength={500}
          className="h-7 w-full max-w-md rounded-md border border-transparent px-2 text-sm outline-none placeholder:text-muted/80 hover:border-grid focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </form>
    </div>
  );
}
