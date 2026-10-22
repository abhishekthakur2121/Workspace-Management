import { requireUser } from "@/server/auth-guard";

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Hi {firstName} 👋</h1>
      <p className="mt-1 text-muted">You&apos;re signed in. Workspaces and boards arrive in the next phase.</p>
    </div>
  );
}
