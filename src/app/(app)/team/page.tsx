import type { Metadata } from "next";
import { requireSuperAdmin } from "@/server/auth-guard";
import { getWorkload } from "@/server/queries/workload";
import { PageHeader } from "@/components/page-header";
import { TeamOverview } from "@/components/team/team-overview";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireSuperAdmin();
  const people = await getWorkload(me);

  return (
    <>
      <PageHeader title="Team" subtitle="Everyone's open work at a glance. Open a person to see their task list." />
      <TeamOverview people={people} />
    </>
  );
}
