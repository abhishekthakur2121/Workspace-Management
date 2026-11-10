import "server-only";
import { db } from "@/server/db";
import { visibleBoardWhere, type Actor } from "@/server/access";

// The Team page: every active person with the due dates of their open
// (not done) tasks. Overdue and "this week" are counted on the client, so
// "today" is the viewer's today.
export async function getWorkload(viewer: Actor) {
  const [users, tasks] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true, image: true, role: true },
    }),
    db.task.findMany({
      where: {
        deletedAt: null,
        group: { deletedAt: null },
        board: { deletedAt: null, workspace: { deletedAt: null }, ...visibleBoardWhere(viewer) },
        AND: [
          { OR: [{ parentId: null }, { parent: { deletedAt: null } }] },
          { OR: [{ statusId: null }, { status: { isDone: false } }] },
          { OR: [{ accountableId: { not: null } }, { responsible: { some: {} } }] },
        ],
      },
      select: { dueDate: true, accountableId: true, responsible: { select: { userId: true } } },
    }),
  ]);

  const dueDates = new Map<string, (string | null)[]>();
  for (const t of tasks) {
    const due = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null;
    // Someone both accountable and responsible counts the task once.
    const people = new Set([t.accountableId, ...t.responsible.map((r) => r.userId)]);
    for (const id of people) {
      if (!id) continue;
      const list = dueDates.get(id) ?? [];
      list.push(due);
      dueDates.set(id, list);
    }
  }

  return users.map((u) => ({ ...u, openDueDates: dueDates.get(u.id) ?? [] }));
}

export type WorkloadPerson = Awaited<ReturnType<typeof getWorkload>>[number];
