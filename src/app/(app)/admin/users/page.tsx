import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth-guard";
import { getTeam } from "@/server/queries/users";
import { PageHeader } from "@/components/page-header";
import { TeamManager } from "@/components/admin/team-manager";

export const metadata: Metadata = { title: "Manage users" };

export default async function ManageUsersPage() {
  const me = await requireAdmin();
  const team = await getTeam();
  return (
    <>
      <PageHeader title="Manage users" subtitle="Who can sign in, and who can manage the team." />
      <TeamManager team={team} currentUserId={me.id} />
    </>
  );
}
