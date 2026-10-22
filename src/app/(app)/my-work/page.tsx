import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "My work" };

export default function MyWorkPage() {
  return (
    <>
      <PageHeader title="My work" subtitle="Every task assigned to you, across all workspaces." />
      <div className="p-6 text-sm text-muted">Your tasks will appear here once boards have tasks.</div>
    </>
  );
}
