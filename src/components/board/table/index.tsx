"use client";

import { useId } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@/lib/dnd";
import { useBoard } from "../board-context";
import { tableMinWidth, type TableProps } from "./layout";
import { SectionView } from "./section";

export function BoardTable(props: TableProps) {
  const { tasks, move } = useBoard();
  // Stable id so dnd-kit's generated aria attributes match between server and client.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const minWidth = tableMinWidth(props.columns);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overData = over.data.current as { groupId?: string } | undefined;
    const targetGroup = overData?.groupId ?? String(over.id).replace(/^group:/, "");
    // Neighbours come from the full (unfiltered) order of the target group.
    const list = tasks.filter((t) => !t.parentId && t.groupId === targetGroup && t.id !== activeId);
    const sourceIndex = tasks.filter((t) => !t.parentId && t.groupId === targetGroup).findIndex((t) => t.id === activeId);
    let index = list.length;
    if (!String(over.id).startsWith("group:")) {
      const overIndex = list.findIndex((t) => t.id === over.id);
      // Moving down within the same group lands after the hovered row.
      index = sourceIndex !== -1 && sourceIndex <= overIndex ? overIndex + 1 : overIndex;
    }
    move(activeId, targetGroup, list[index - 1]?.id ?? null, list[index]?.id ?? null);
  }

  return (
    <div className="overflow-x-auto pb-24">
      <div style={{ minWidth }} className="space-y-8 px-6 pt-4">
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          {props.sections.map((section, i) => (
            <SectionView key={section.id} section={section} index={i} sectionCount={props.sections.length} {...props} />
          ))}
        </DndContext>
      </div>
    </div>
  );
}
