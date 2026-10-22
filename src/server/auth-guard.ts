import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";

// The real access check. Every page, Server Action and data loader calls one
// of these; proxy.ts only does a cheap cookie check for redirects.
// Sessions are read from the database on each request, so a deactivated user
// is rejected on their very next request.
export const requireUser = cache(async () => {
  // Session and data reads use random values (session lookup, DB driver), so
  // they must run at request time, never during a prerender.
  await connection();
  // A failed session lookup (e.g. a dropped database connection) looks the
  // same as "signed out"; retry once so a blip doesn't bounce people to sign-in.
  const session = (await auth()) ?? (await auth());
  if (!session?.user?.id || !session.user.active) redirect("/signin");
  return session.user;
});

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
