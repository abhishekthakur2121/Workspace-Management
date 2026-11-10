import type { Metadata } from "next";
import { requireUser } from "@/server/auth-guard";
import { isSuperAdmin } from "@/server/access";
import { getFeedToken, getLeaveOverview, isSoleSuperAdmin } from "@/server/queries/leave";
import { PageHeader } from "@/components/page-header";
import { LeaveView, RequestLeaveButton } from "@/components/leave/leave-view";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage({ searchParams }: PageProps<"/leave">) {
  const me = await requireUser();
  const { month: requested } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const month = typeof requested === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const [overview, feedToken, sole] = await Promise.all([getLeaveOverview(me, month, today), getFeedToken(), isSoleSuperAdmin(me)]);
  const booked = overview.mine.filter((r) => r.status === "pending" || r.status === "approved");

  return (
    <>
      <PageHeader title="Leave" subtitle="Who's away, and your own requests." actions={<RequestLeaveButton sole={sole} booked={booked} />} />
      <LeaveView overview={overview} month={month} feedToken={feedToken} isSuperAdmin={isSuperAdmin(me)} meId={me.id} />
    </>
  );
}
