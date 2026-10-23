import "server-only";
import { db } from "@/server/db";
import { isOwner } from "@/server/owners";

// Everyone on the allowlist, with sign-in state for the admin page.
export async function getTeam() {
  const users = await db.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      active: true,
      createdAt: true,
      passwordHash: true,
      mustChangePassword: true,
      _count: { select: { accounts: true } },
      sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: isOwner(u.email) ? ("super_admin" as const) : u.role,
    active: u.active,
    joinedAt: u.createdAt.toISOString(),
    // Sessions are refreshed at most daily, so this is approximate.
    lastActiveAt: u.sessions[0]?.updatedAt.toISOString() ?? null,
    // Google sign-ins create an Account row; password sign-ins create sessions.
    hasSignedIn: u._count.accounts > 0 || (!!u.passwordHash && !u.mustChangePassword) || u.sessions.length > 0,
    hasPassword: !!u.passwordHash,
    mustChangePassword: u.mustChangePassword,
    // Owners (INITIAL_ADMIN_EMAILS) are always super admins and locked here.
    isOwner: isOwner(u.email),
  }));
}

export type TeamMember = Awaited<ReturnType<typeof getTeam>>[number];
