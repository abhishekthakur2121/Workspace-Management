"use client";

import { createContext, startTransition, use, useCallback, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  bulkUpdateTasks,
  createTask,
  deleteTasks,
  moveTask,
  moveTaskKanban,
  restoreTasks,
  updateTask,
  type TaskPatch,
} from "@/server/actions/tasks";
import { generateKeyBetween } from "fractional-indexing";
import { capitalizeFirst } from "@/lib/text";
import type { BoardData, Tag, TaskRow } from "./model";

type BoardApi = {
  board: BoardData;
  tasks: TaskRow[];
  saving: boolean;
  addTag: (tag: Tag) => void;
  update: (id: string, patch: TaskPatch) => void;
  bulkUpdate: (ids: string[], patch: TaskPatch, groupId?: string) => void;
  create: (input: { groupId: string; name: string; parentId?: string | null; statusId?: string | null; at?: "top" | "bottom" }) => Promise<string | undefined>;
  move: (id: string, groupId: string, prevId: string | null, nextId: string | null) => void;
  moveCard: (id: string, statusId: string | null, prevId: string | null, nextId: string | null) => void;
  remove: (ids: string[]) => void;
  autoEditId: string | null;
  setAutoEditId: (id: string | null) => void;
  currentUserId: string;
  isAdmin: boolean;
  openTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
};

const BoardContext = createContext<BoardApi | null>(null);

export function useBoard() {
  const ctx = use(BoardContext);
  if (!ctx) throw new Error("useBoard outside BoardProvider");
  return ctx;
}

// Sync is deliberately frugal (free-tier hosting and database): check every
// 2 minutes, only while the tab is visible and someone is actually using it.
const SYNC_INTERVAL_MS = 2 * 60_000;
const IDLE_AFTER_MS = 5 * 60_000; // no mouse/keyboard/touch for this long = idle
const MIN_GAP_MS = 15_000; // focus/return checks never closer together than this

export function BoardProvider({
  board,
  currentUserId,
  isAdmin,
  children,
}: {
  board: BoardData;
  currentUserId: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // The open task panel lives in the URL (?task=…) so it can be linked to.
  // Next keeps useSearchParams in sync with history.pushState, without a server round trip.
  const searchParams = useSearchParams();
  const openTaskId = searchParams.get("task");

  // Server data plus every edit still being saved. Each edit stays applied
  // until its save (and the fresh data it returns) lands, so quick
  // successive edits never flicker or overwrite each other.
  const [tasks, applyOptimistic] = useOptimistic(board.tasks, (state: TaskRow[], edit: (ts: TaskRow[]) => TaskRow[]) => edit(state));
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  // Tags created here show up at once, before the refreshed board arrives.
  const [newTags, setNewTags] = useState<Tag[]>([]);
  const tags = useMemo(
    () => [...board.tags, ...newTags.filter((t) => !board.tags.some((b) => b.id === t.id))],
    [board.tags, newTags],
  );
  const pendingSaves = useRef(0);
  const [saving, setSaving] = useState(0);

  // Saves run one after another; warn before leaving while some are queued.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSaves.current > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const run = useCallback(
    <T,>(optimistic: (tasks: TaskRow[]) => TaskRow[], action: () => Promise<T>) =>
      new Promise<T | undefined>((resolve) => {
        pendingSaves.current++;
        setSaving((n) => n + 1);
        startTransition(async () => {
          applyOptimistic(optimistic);
          try {
            resolve(await action());
          } catch {
            toast.error("Couldn't save that change. The board was reloaded.");
            router.refresh();
            resolve(undefined);
          } finally {
            pendingSaves.current--;
            setSaving((n) => n - 1);
          }
        });
      }),
    [applyOptimistic, router],
  );

  const api = useMemo<BoardApi>(() => {
    const patchRow = (t: TaskRow, patch: TaskPatch): TaskRow =>
      ({ ...t, ...patch, ...(patch.name !== undefined && { name: capitalizeFirst(patch.name) }) }) as TaskRow;
    return {
      board: tags === board.tags ? board : { ...board, tags },
      tasks,
      saving: saving > 0,
      addTag: (tag) => setNewTags((ts) => [...ts, tag]),
      currentUserId,
      isAdmin,
      openTaskId,
      openTask: (id) => {
        const params = new URLSearchParams(window.location.search);
        params.set("task", id);
        window.history.pushState(null, "", `?${params}`);
      },
      closeTask: () => {
        const params = new URLSearchParams(window.location.search);
        params.delete("task");
        const query = params.toString();
        window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
      },
      autoEditId,
      setAutoEditId,
      update: (id, patch) =>
        run(
          (ts) => ts.map((t) => (t.id === id ? patchRow(t, patch) : t)),
          () => updateTask({ id, patch }),
        ),
      bulkUpdate: (ids, patch, groupId) =>
        run(
          (ts) =>
            ts.map((t) =>
              ids.includes(t.id) ? { ...patchRow(t, patch), groupId: groupId && !t.parentId ? groupId : t.groupId } : t,
            ),
          () => bulkUpdateTasks({ ids, patch, groupId }),
        ),
      create: async (input) => {
        const tempId = `temp-${crypto.randomUUID()}`;
        const parent = input.parentId ? tasks.find((t) => t.id === input.parentId) : undefined;
        const created = await run((ts) => {
          const row: TaskRow = {
            id: tempId,
            groupId: parent?.groupId ?? input.groupId,
            parentId: input.parentId ?? null,
            name: capitalizeFirst(input.name),
            accountableId: currentUserId,
            responsibleIds: [],
            statusId: input.statusId !== undefined ? input.statusId : (board.statuses[0]?.id ?? null),
            dueDate: null,
            priority: null,
            tagIds: [],
            position: input.at === "top" ? "" : "￿",
            kanbanPosition: "￿",
            commentCount: 0,
          };
          return input.at === "top" ? [row, ...ts] : [...ts, row];
        }, () => createTask({ boardId: board.id, ...input }));
        return created?.id;
      },
      move: (id, groupId, prevId, nextId) =>
        run(
          (ts) => {
            const moving = ts.find((t) => t.id === id);
            if (!moving) return ts;
            const rest = ts.filter((t) => t.id !== id);
            const updated = { ...moving, groupId };
            const anchor = prevId ? rest.findIndex((t) => t.id === prevId) + 1 : nextId ? rest.findIndex((t) => t.id === nextId) : rest.length;
            rest.splice(anchor, 0, updated);
            return rest.map((t) => (t.parentId === id ? { ...t, groupId } : t));
          },
          () => moveTask({ id, groupId, prevId, nextId }),
        ),
      moveCard: (id, statusId, prevId, nextId) =>
        run(
          (ts) => {
            const pos = (x: string | null) => (x ? ts.find((t) => t.id === x)?.kanbanPosition : undefined) ?? null;
            const prev = pos(prevId);
            const next = pos(nextId);
            let kanbanPosition: string;
            try {
              kanbanPosition = generateKeyBetween(prev, prev && next && prev >= next ? null : next);
            } catch {
              kanbanPosition = generateKeyBetween(prev, null);
            }
            return ts.map((t) => (t.id === id ? { ...t, statusId, kanbanPosition } : t));
          },
          () => moveTaskKanban({ id, statusId, prevId, nextId }),
        ),
      remove: (ids) => {
        const hidden = new Set(ids);
        run(
          (ts) => ts.filter((t) => !hidden.has(t.id) && !(t.parentId && hidden.has(t.parentId))),
          () => deleteTasks({ ids }),
        );
        toast(`Deleted ${ids.length === 1 ? "1 task" : `${ids.length} tasks`}`, {
          action: { label: "Undo", onClick: () => startTransition(() => restoreTasks({ ids })) },
        });
      },
    };
  }, [board, tags, tasks, saving, autoEditId, run, currentUserId, isAdmin, openTaskId]);

  useBoardSync(board.id, board.version);

  return <BoardContext value={api}>{children}</BoardContext>;
}

// Picks up other people's changes by polling a tiny version endpoint.
// - every 2 minutes while the tab is visible and the person is active
// - paused after 5 idle minutes (so a board left open overnight doesn't keep
//   the server and database awake), resuming with an immediate check on the
//   next mouse move, key press or touch
// - an immediate check when the tab regains focus or becomes visible
function useBoardSync(boardId: string, version: string) {
  const router = useRouter();
  const versionRef = useRef(version);
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  useEffect(() => {
    let stopped = false;
    let lastActivity = Date.now();
    let lastCheck = Date.now(); // the page was just rendered with fresh data
    let wasIdle = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      lastCheck = Date.now();
      try {
        const res = await fetch(`/api/boards/${boardId}/version`, { cache: "no-store" });
        if (!res.ok) return;
        const { version: latest } = (await res.json()) as { version: string };
        if (!stopped && latest !== versionRef.current) router.refresh();
      } catch {}
    }
    const checkSoon = () => {
      if (Date.now() - lastCheck >= MIN_GAP_MS) check();
    };

    const tick = () => {
      const idle = Date.now() - lastActivity > IDLE_AFTER_MS;
      wasIdle = idle;
      if (!idle) check();
    };
    const onActivity = () => {
      lastActivity = Date.now();
      if (wasIdle) {
        wasIdle = false;
        checkSoon(); // back from idle: catch up right away
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        lastActivity = Date.now();
        checkSoon();
      }
    };

    const timer = setInterval(tick, SYNC_INTERVAL_MS);
    const activityEvents = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    activityEvents.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [boardId, router]);
}
