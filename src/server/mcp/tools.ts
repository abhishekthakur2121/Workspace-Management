import "server-only";
import { z } from "zod";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { db } from "@/server/db";
import { AccessError, visibleBoardWhere, type Actor } from "@/server/access";
import { getMyWork } from "@/server/queries/my-work";
import { callerOf, type McpCaller } from "@/server/mcp/auth";
import type { Prisma } from "@/generated/prisma/client";

// The tools a connected MCP client can call. Every tool acts as the signed-in
// person and goes through the same visibility rules as the app, so a client
// can never see or change more than that person could themselves.

export const INSTRUCTIONS = `Nxt Workspace Manager is a work manager. Work is organised as
workspaces > boards > groups (sections of a board) > tasks, and tasks can have subtasks.
Each board has its own status labels; a status marked done means the task is finished.
A task has one accountable person (who owns the outcome) and any number of responsible
people (who do the work). Dates are YYYY-MM-DD. Use list_boards to find board, group and
status ids, and include each task's url when you mention it, so people can open it.`;

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

export function registerTools(server: McpServer) {
  server.registerTool(
    "list_boards",
    {
      title: "List boards",
      description: "Boards you can see, with their workspace, groups and status labels (ids included).",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    (_args, ctx) => run(() => listBoards(callerOf(ctx))),
  );

  server.registerTool(
    "list_my_tasks",
    {
      title: "List my tasks",
      description:
        "Tasks and subtasks where you are accountable or responsible, soonest due first (no due date last). Open tasks only unless include_done is true.",
      inputSchema: z.object({
        include_done: z.boolean().default(false).describe("Also return tasks whose status is done."),
      }),
      annotations: readOnly,
    },
    ({ include_done }, ctx) => run(() => listMyTasks(callerOf(ctx), include_done)),
  );

  server.registerTool(
    "search_tasks",
    {
      title: "Search tasks",
      description:
        "Find tasks across the boards you can see, by words in the name and/or by board. Open tasks only unless include_done is true. Soonest due first.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200).optional().describe("Words to look for in the task name (case-insensitive)."),
        board_id: z.string().min(1).optional().describe("Only tasks on this board."),
        include_done: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: readOnly,
    },
    (args, ctx) => run(() => searchTasks(callerOf(ctx), args)),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "One task in full: people, dates, tags, subtasks and the latest 20 comments.",
      inputSchema: z.object({ task_id: z.string().min(1) }),
      annotations: readOnly,
    },
    ({ task_id }, ctx) => run(() => getTask(callerOf(ctx), task_id)),
  );
}

// ─── results ────────────────────────────────────────────────────────────────

class NotFound extends Error {}

// Expected failures (no access, nothing found) go back to the client as the
// message; anything else is logged and reported without details.
async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await fn()) }] };
  } catch (e) {
    if (e instanceof AccessError || e instanceof NotFound) return failure(e.message);
    console.error("MCP tool failed", e);
    return failure("Something went wrong. Please try again.");
  }
}

const failure = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

// ─── reads ──────────────────────────────────────────────────────────────────

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const person = (u: { name: string | null; email: string } | null) => (u ? (u.name ?? u.email) : null);
const taskUrl = (caller: McpCaller, boardId: string, taskId: string) => `${caller.origin}/b/${boardId}?task=${taskId}`;

// Live tasks on boards the person can see, as in My Work.
function visibleTaskWhere(u: Actor): Prisma.TaskWhereInput {
  return {
    deletedAt: null,
    group: { deletedAt: null },
    board: { deletedAt: null, workspace: { deletedAt: null }, ...visibleBoardWhere(u) },
    OR: [{ parentId: null }, { parent: { deletedAt: null } }],
  };
}

const openWhere: Prisma.TaskWhereInput = { OR: [{ statusId: null }, { status: { isDone: false } }] };

const summarySelect = {
  id: true,
  name: true,
  dueDate: true,
  priority: true,
  status: { select: { name: true, isDone: true } },
  group: { select: { name: true } },
  board: { select: { id: true, name: true } },
  parent: { select: { id: true, name: true } },
  accountable: { select: { name: true, email: true } },
  responsible: { select: { user: { select: { name: true, email: true } } } },
} satisfies Prisma.TaskSelect;

function summary(caller: McpCaller, t: Prisma.TaskGetPayload<{ select: typeof summarySelect }>) {
  return {
    id: t.id,
    name: t.name,
    subtask_of: t.parent ?? undefined,
    board: t.board,
    group: t.group.name,
    status: t.status?.name ?? null,
    done: t.status?.isDone ?? false,
    due: day(t.dueDate),
    priority: t.priority,
    accountable: person(t.accountable),
    responsible: t.responsible.map((r) => person(r.user)),
    url: taskUrl(caller, t.board.id, t.id),
  };
}

async function listBoards(caller: McpCaller) {
  const boards = await db.board.findMany({
    where: { deletedAt: null, workspace: { deletedAt: null }, ...visibleBoardWhere(caller) },
    orderBy: [{ workspace: { position: "asc" } }, { position: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      workspace: { select: { name: true } },
      groups: { where: { deletedAt: null }, orderBy: { position: "asc" }, select: { id: true, name: true } },
      statuses: { orderBy: { position: "asc" }, select: { id: true, name: true, isDone: true } },
    },
  });
  return boards.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    workspace: b.workspace.name,
    groups: b.groups,
    statuses: b.statuses.map((s) => ({ id: s.id, name: s.name, done: s.isDone })),
    url: `${caller.origin}/b/${b.id}`,
  }));
}

async function listMyTasks(caller: McpCaller, includeDone: boolean) {
  const tasks = await getMyWork(caller);
  return tasks
    .map((t) => {
      const status = t.board.statuses.find((s) => s.id === t.statusId);
      return {
        id: t.id,
        name: t.name,
        subtask_of: t.parentName ?? undefined,
        board: { id: t.board.id, name: t.board.name },
        workspace: t.board.workspace.name,
        status: status?.name ?? null,
        done: status?.isDone ?? false,
        due: t.dueDate,
        priority: t.priority,
        my_role: t.role,
        url: taskUrl(caller, t.board.id, t.id),
      };
    })
    .filter((t) => includeDone || !t.done);
}

async function searchTasks(
  caller: McpCaller,
  args: { query?: string; board_id?: string; include_done: boolean; limit: number },
) {
  const tasks = await db.task.findMany({
    where: {
      AND: [
        visibleTaskWhere(caller),
        args.include_done ? {} : openWhere,
        args.board_id ? { boardId: args.board_id } : {},
        args.query ? { name: { contains: args.query, mode: "insensitive" } } : {},
      ],
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: args.limit,
    select: summarySelect,
  });
  return tasks.map((t) => summary(caller, t));
}

async function getTask(caller: McpCaller, taskId: string) {
  const t = await db.task.findFirst({
    where: { AND: [{ id: taskId }, visibleTaskWhere(caller)] },
    select: {
      ...summarySelect,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
      tags: { select: { tag: { select: { name: true } } } },
      subtasks: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, name: true, dueDate: true, status: { select: { name: true, isDone: true } } },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { body: true, createdAt: true, author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!t) throw new NotFound("No task with that id, or you can't see it.");
  return {
    ...summary(caller, t),
    tags: t.tags.map((x) => x.tag.name),
    created: { at: t.createdAt.toISOString(), by: person(t.createdBy) },
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status?.name ?? null,
      done: s.status?.isDone ?? false,
      due: day(s.dueDate),
    })),
    comments: t.comments.map((c) => ({ by: person(c.author), at: c.createdAt.toISOString(), text: c.body })),
  };
}
