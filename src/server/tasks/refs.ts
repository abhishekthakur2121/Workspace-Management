import "server-only";
import { db } from "@/server/db";
import { boardAudience } from "@/server/access";

// Fails unless every referenced status/tag/group belongs to the board and every
// person can see the board (so tasks are only assigned to people who can see them).
export async function assertRefs(
  boardId: string,
  refs: { statusIds?: (string | null)[]; tagIds?: string[]; groupIds?: string[]; userIds?: (string | null)[] },
) {
  const uniq = (xs: (string | null | undefined)[] = []) => [...new Set(xs.filter((x): x is string => !!x))];
  const statusIds = uniq(refs.statusIds);
  const tagIds = uniq(refs.tagIds);
  const groupIds = uniq(refs.groupIds);
  const userIds = uniq(refs.userIds);
  const [s, t, g, u] = await Promise.all([
    statusIds.length ? db.statusLabel.count({ where: { id: { in: statusIds }, boardId } }) : 0,
    tagIds.length ? db.tag.count({ where: { id: { in: tagIds }, boardId } }) : 0,
    groupIds.length ? db.group.count({ where: { id: { in: groupIds }, boardId, deletedAt: null } }) : 0,
    userIds.length ? boardAudience(boardId).then((audience) => userIds.filter((id) => audience.includes(id)).length) : 0,
  ]);
  if (s !== statusIds.length || t !== tagIds.length || g !== groupIds.length || u !== userIds.length) {
    throw new Error("Invalid reference");
  }
}
