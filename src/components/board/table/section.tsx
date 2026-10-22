"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { COLUMNS } from "../model";
import { AddTaskRow } from "./add-rows";
import { GroupMenu, GroupName } from "./group-header";
import { gridTemplate, type Section, type TableProps } from "./layout";
import { TaskRows } from "./rows";
import { GroupProgress } from "./summary";

export function SectionView({ section, index, sectionCount, ...props }: TableProps & { section: Section; index: number; sectionCount: number }) {
  const isCollapsed = props.collapsed.includes(section.id);
  const ids = section.tasks.map((t) => t.id);
  const allSelected = ids.length > 0 && ids.every((id) => props.selected.has(id));
  const someSelected = ids.some((id) => props.selected.has(id));
  const { setNodeRef } = useDroppable({ id: `group:${section.id}`, disabled: !props.canDrag || section.kind !== "group" });
  const template = gridTemplate(props.columns);
  const [renaming, setRenaming] = useState(false);

  return (
    <section ref={setNodeRef}>
      <div className="group/header mb-2 flex items-center gap-1.5">
        <button
          aria-label={isCollapsed ? `Expand ${section.name}` : `Collapse ${section.name}`}
          aria-expanded={!isCollapsed}
          onClick={() => props.onToggleCollapsed(section.id)}
          className="rounded p-0.5 hover:bg-hover"
          style={{ color: section.color }}
        >
          <ChevronDown className={cn("size-5 transition-transform", isCollapsed && "-rotate-90")} />
        </button>
        {section.kind === "group" ? (
          <GroupName key={section.name} id={section.id} name={section.name} color={section.color} editing={renaming} onEditingChange={setRenaming} />
        ) : (
          <span className="px-1 text-[17px] font-semibold" style={{ color: section.color }}>
            {section.name}
          </span>
        )}
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-muted">
          {section.tasks.length} {section.tasks.length === 1 ? "task" : "tasks"}
        </span>
        <GroupProgress tasks={section.tasks} />
        {section.kind === "group" && (
          <GroupMenu section={section} index={index} count={sectionCount} onRename={() => setRenaming(true)} />
        )}
      </div>

      {/* Always rendered so collapsing animates; inert keeps hidden rows out of tab order. */}
      <div className="collapsible" data-open={!isCollapsed} inert={isCollapsed}>
        <div className="-m-1 p-1">
        <div
          className="card-shadow overflow-clip rounded-xl border border-grid bg-surface"
          style={{ borderLeft: `4px solid ${section.color}` }}
        >
          <div role="row" className="grid h-9 border-b border-grid bg-surface text-xs font-medium text-muted" style={{ gridTemplateColumns: template }}>
            <div className="grid place-items-center border-r border-grid">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onChange={(on) => props.onSelect(ids, on)}
                label={`Select all in ${section.name}`}
              />
            </div>
            <div className="flex items-center border-r border-grid px-4">Task</div>
            {props.columns.map((k) => (
              <div key={k} className="grid place-items-center border-r border-grid px-2 last:border-r-0">
                {COLUMNS.find((c) => c.key === k)!.label}
              </div>
            ))}
          </div>

          <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={!props.canDrag || section.kind !== "group"}>
            {section.tasks.map((task) => (
              <TaskRows key={task.id} task={task} section={section} template={template} {...props} />
            ))}
          </SortableContext>

          <AddTaskRow section={section} template={template} />
        </div>
        </div>
      </div>
      {isCollapsed && section.tasks.length > 0 && (
        <button
          onClick={() => props.onToggleCollapsed(section.id)}
          className="anim-page card-shadow flex w-full items-center gap-3 rounded-xl border border-grid bg-surface px-4 py-2.5 text-left transition-colors hover:bg-hover/40"
          style={{ borderLeft: `4px solid ${section.color}` }}
        >
          <span className="text-xs text-muted">Show {section.tasks.length} {section.tasks.length === 1 ? "task" : "tasks"}</span>
        </button>
      )}
    </section>
  );
}
