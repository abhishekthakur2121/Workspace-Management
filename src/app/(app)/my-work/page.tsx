import type { Metadata } from "next";
import { requireUser } from "@/server/auth-guard";
import { getMyWork } from "@/server/queries/my-work";
import { PageHeader } from "@/components/page-header";
import { MyWorkList } from "@/components/my-work/my-work-list";

export const metadata: Metadata = { title: "My work" };

export default async function MyWorkPage() {
  const user = await requireUser();
  const tasks = await getMyWork(user);

  return (
    <>
      <PageHeader title="My work" subtitle="Every task you're accountable or responsible for, across all workspaces." />
      <MyWorkList tasks={tasks} />
    </>
  );
}
