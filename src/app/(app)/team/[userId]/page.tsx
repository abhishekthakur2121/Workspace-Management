import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireSuperAdmin } from "@/server/auth-guard";
import { db } from "@/server/db";
import { getAssignedTasks } from "@/server/queries/my-work";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { MyWorkList } from "@/components/my-work/my-work-list";

export const metadata: Metadata = { title: "Team" };

// One person's task list, as they see it on My work (super admins only).
export default async function PersonWorkPage({ params }: PageProps<"/team/[userId]">) {
  const { userId } = await params;
  const me = await requireSuperAdmin();
  const person = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, active: true },
  });
  if (!person?.active) notFound();
  const tasks = await getAssignedTasks(me, person.id);
  const name = person.name ?? person.email;

  return (
    <>
      <PageHeader
        title={name}
        subtitle={
          <Link href="/team" className="inline-flex items-center gap-0.5 hover:text-foreground">
            <ChevronLeft className="size-4" /> Team · every task {person.id === me.id ? "you're" : "they're"} accountable or responsible for
          </Link>
        }
        icon={<Avatar name={name} image={person.image} className="size-10 text-sm" />}
      />
      <MyWorkList key={person.id} tasks={tasks} personName={person.id === me.id ? undefined : name} />
    </>
  );
}
