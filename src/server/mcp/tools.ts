import "server-only";
import { z } from "zod";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { db } from "@/server/db";
import { AccessError, assertCanSeeBoard, boardAudience, visibleBoardWhere, type Actor } from "@/server/access";
import { getMyWork } from "@/server/queries/my-work";
import { createTaskAs, updateTaskAs } from "@/server/tasks/mutations";
import { addCommentAs } from "@/server/tasks/comments";
import { InvalidReferenceError } from "@/server/tasks/refs";
import { callerOf, type McpCaller } from "@/server/mcp/auth";
import type { Prisma } from "@/generated/prisma/client";

// The tools a connected MCP client can call. Every tool acts as the signed-in
// person and goes through the same visibility rules as the app, so a client
// can never see or change more than that person could themselves. Changes use
// the app's own save code, so they're logged in the task history (marked with
// the connected app's name) and show up on open boards. Nothing can be deleted.

export const INSTRUCTIONS = `Nxt Workspace Manager is a work manager. Work is organised as
workspaces > boards > groups (sections of a board) > tasks, and tasks can have subtasks.
Each board has its own status labels; a status marked done means the task is finished.
A task has one accountable person (who owns the outcome) and any number of responsible
people (who do the work). Dates are YYYY-MM-DD. Use list_boards to find board, group and
status ids, and find_people for people's ids, and include each task's url when you mention
it, so people can open it. Changes are made in the signed-in person's name and shown in the
task history, so only change what they asked for.`;

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
const additive = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

const ref = z.string().min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const priority = z.enum(["low", "medium", "high", "critical"]);

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

  server.registerTool(
    "find_people",
    {
      title: "Find people",
      description: "People who can be assigned tasks on a board (those who can see it), with their ids. Optionally filter by name or email.",
      inputSchema: z.object({
        board_id: z.string().min(1),
        query: z.string().trim().min(1).max(100).optional().describe("Part of a name or email (case-insensitive)."),
      }),
      annotations: readOnly,
    },
    ({ board_id, query }, ctx) => run(() => findPeople(callerOf(ctx), board_id, query)),
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description:
        "Create a task (or a subtask) on a board, in your name. Unless given, it goes at the end of the board's first group, gets the board's first status, and you are accountable. Returns the new task.",
      inputSchema: z.object({
        board_id: z.string().min(1),
        name: z.string().trim().min(1).max(500),
        group_id: ref.optional().describe("Group (section) to add it to. Defaults to the board's first group."),
        parent_task_id: ref.optional().describe("Makes it a subtask of this task (same board; subtasks can't have subtasks)."),
        status_id: ref.optional(),
        due: date.optional().describe("Due date, YYYY-MM-DD."),
        priority: priority.optional(),
        accountable_id: ref.optional().describe("Who owns the outcome. Defaults to you. Ids from find_people."),
        responsible_ids: z.array(ref).max(50).optional().describe("Who does the work. Ids from find_people."),
      }),
      annotations: additive,
    },
    (args, ctx) => run(() => createTask(callerOf(ctx), args)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        "Change a task's name, status, due date, priority or people. Only the fields you pass change; pass null to clear one. responsible_ids replaces the whole list, so include anyone who should stay. Returns the updated task.",
      inputSchema: z.object({
        task_id: z.string().min(1),
        name: z.string().trim().min(1).max(500).optional(),
        status_id: ref.nullable().optional(),
        due: date.nullable().optional(),
        priority: priority.nullable().optional(),
        accountable_id: ref.nullable().optional(),
        responsible_ids: z.array(ref).max(50).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    (args, ctx) => run(() => updateTask(callerOf(ctx), args)),
  );

  server.registerTool(
    "add_comment",
    {
      title: "Add comment",
      description: "Post an update (comment) on a task, in your name.",
      inputSchema: z.object({ task_id: z.string().min(1), text: z.string().trim().min(1).max(5000) }),
      annotations: additive,
    },
    ({ task_id, text }, ctx) => run(() => addComment(callerOf(ctx), task_id, text)),
  );
}

// ─── results ────────────────────────────────────────────────────────────────

class NotFound extends Error {}

// Expected failures (no access, nothing found, a bad id or value) go back to
// the client as a message it can act on; anything else is logged and
// reported without details.
async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await fn()) }] };
  } catch (e) {
    if (e instanceof AccessError || e instanceof NotFound) return failure(e.message);
    if (e instanceof InvalidReferenceError) {
      return failure(
        "A group, status or person isn't valid for this board (people must be able to see the board). Use list_boards and find_people for valid ids.",
      );
    }
    if (e instanceof z.ZodError) return failure(z.prettifyError(e));
    console.error("MCP tool failed", e);
    return failure("Something went wrong. Please try again.");
  }
}

const failure = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

// ─── reads ──────────────────────────────────────────────────────────────────

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const person = (u: { name: string | null; email: string } | null) => (u ? (u.name ?? u.email) : null);
const personRef = (u: { id: string; name: string | null; email: string } | null) => (u ? { id: u.id, name: u.name ?? u.email } : null);
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
  accountable: { select: { id: true, name: true, email: true } },
  responsible: { select: { user: { select: { id: true, name: true, email: true } } } },
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
    accountable: personRef(t.accountable),
    responsible: t.responsible.map((r) => personRef(r.user)),
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

async function findPeople(caller: McpCaller, boardId: string, query?: string) {
  await assertCanSeeBoard(caller, boardId);
  const q = query?.toLowerCase();
  const people = await db.user.findMany({
    where: { id: { in: await boardAudience(boardId) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return people.filter((p) => !q || p.email.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q));
}

// ─── changes ────────────────────────────────────────────────────────────────

// Changes go to tasks the person can see, and only live ones.
async function assertVisibleTask(
  caller: McpCaller,
  taskId: string,
  where: Prisma.TaskWhereInput = {},
  message = "No task with that id, or you can't see it.",
) {
  const task = await db.task.findFirst({ where: { AND: [{ id: taskId }, visibleTaskWhere(caller), where] }, select: { id: true } });
  if (!task) throw new NotFound(message);
}

async function createTask(
  caller: McpCaller,
  args: {
    board_id: string;
    name: string;
    group_id?: string;
    parent_task_id?: string;
    status_id?: string;
    due?: string;
    priority?: "low" | "medium" | "high" | "critical";
    accountable_id?: string;
    responsible_ids?: string[];
  },
) {
  await assertCanSeeBoard(caller, args.board_id);
  if (args.parent_task_id) {
    const where = { boardId: args.board_id, parentId: null };
    await assertVisibleTask(caller, args.parent_task_id, where, "The parent task isn't on that board, is itself a subtask, or you can't see it.");
  }
  const groupId =
    args.group_id ??
    (await db.group.findFirst({ where: { boardId: args.board_id, deletedAt: null }, orderBy: { position: "asc" }, select: { id: true } }))?.id;
  if (!groupId) throw new NotFound("This board has no groups yet. Add one in the app first.");

  // Check the people before creating anything, so a bad id doesn't leave a
  // half-filled task behind.
  const patch = {
    dueDate: args.due,
    priority: args.priority,
    accountableId: args.accountable_id,
    responsibleIds: args.responsible_ids,
  };
  const hasPatch = Object.values(patch).some((v) => v !== undefined);
  if (args.accountable_id || args.responsible_ids?.length) {
    const audience = await boardAudience(args.board_id);
    if (![args.accountable_id, ...(args.responsible_ids ?? [])].every((id) => !id || audience.includes(id))) throw new InvalidReferenceError();
  }

  const { id } = await createTaskAs(
    caller,
    { boardId: args.board_id, groupId, name: args.name, parentId: args.parent_task_id, statusId: args.status_id },
    caller.app,
  );
  if (hasPatch) await updateTaskAs(caller, { id, patch }, caller.app);
  return getTask(caller, id);
}

async function updateTask(
  caller: McpCaller,
  args: {
    task_id: string;
    name?: string;
    status_id?: string | null;
    due?: string | null;
    priority?: "low" | "medium" | "high" | "critical" | null;
    accountable_id?: string | null;
    responsible_ids?: string[];
  },
) {
  await assertVisibleTask(caller, args.task_id);
  await updateTaskAs(
    caller,
    {
      id: args.task_id,
      patch: {
        name: args.name,
        statusId: args.status_id,
        dueDate: args.due,
        priority: args.priority,
        accountableId: args.accountable_id,
        responsibleIds: args.responsible_ids,
      },
    },
    caller.app,
  );
  return getTask(caller, args.task_id);
}

async function addComment(caller: McpCaller, taskId: string, text: string) {
  await assertVisibleTask(caller, taskId);
  const comment = await addCommentAs(caller, { taskId, body: text }, caller.app);
  return { id: comment.id, posted_at: comment.createdAt.toISOString(), task_id: taskId };
}
