"use server";

// Email + password sign-in for accounts an admin created, and password changes.

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { getSignedInUser } from "@/server/auth-guard";
import { burnVerifyTime, hashPassword, passwordProblem, verifyPassword } from "@/server/passwords";
import { createSession, currentSessionToken } from "@/server/sessions";

export type FormState = { error?: string } | undefined;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const WRONG = "Email or password is incorrect.";

// Only redirect back into this app.
const safeCallback = (url: unknown) =>
  typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/";

export async function signInWithPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, active: true, passwordHash: true, mustChangePassword: true, failedLogins: true, lockedUntil: true },
  });

  // Same message (and similar timing) whether or not the account exists.
  if (!user?.passwordHash || !user.active) {
    await burnVerifyTime(password);
    return { error: WRONG };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or ask an admin to reset your password.` };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data:
        failed >= MAX_FAILED
          ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLogins: failed },
    });
    return { error: WRONG };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await createSession(user.id);
  redirect(user.mustChangePassword ? "/account/password" : safeCallback(form.get("callbackUrl")));
}

const changeSchema = z
  .object({ current: z.string(), next: z.string(), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "The new passwords don't match." });

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await getSignedInUser();
  const parsed = changeSchema.safeParse({
    current: String(form.get("current") ?? ""),
    next: String(form.get("next") ?? ""),
    confirm: String(form.get("confirm") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { current, next } = parsed.data;

  const problem = passwordProblem(next);
  if (problem) return { error: problem };

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true, mustChangePassword: true } });
  // Changing an existing password requires the current one, except right
  // after signing in with a temporary password (just proven).
  if (user.passwordHash && !user.mustChangePassword && !(await verifyPassword(current, user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  if (user.passwordHash && (await verifyPassword(next, user.passwordHash))) {
    return { error: "Choose a password different from the current one." };
  }

  const token = await currentSessionToken();
  await db.$transaction([
    db.user.update({
      where: { id: me.id },
      data: { passwordHash: await hashPassword(next), mustChangePassword: false, passwordUpdatedAt: new Date(), failedLogins: 0, lockedUntil: null },
    }),
    // Sign out everywhere else; this browser stays signed in.
    db.session.deleteMany({ where: { userId: me.id, ...(token ? { sessionToken: { not: token } } : {}) } }),
  ]);
  redirect("/");
}
