import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// The real access check. Every page, Server Action and data loader calls one
// of these; proxy.ts only does a cheap cookie check for redirects.
// Sessions are read from the database on each request, so a deactivated user
// is rejected on their very next request.
export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id || !session.user.active) redirect("/signin");
  return session.user;
});

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
