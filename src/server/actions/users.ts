"use server";

// Admin-only management of the allowlist. Actions return { error } instead of
// throwing, because thrown messages are hidden from the browser in production.

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth-guard";
import { generatePassword, hashPassword, passwordProblem } from "@/server/passwords";
import { isOwner } from "@/server/owners";

type Result = { ok: true } | { error: string };
// A temporary password is returned once so the admin can pass it on.
type PasswordResult = { ok: true; password?: string } | { error: string };

// "generate" → a random readable password; { typed } → the admin's own choice.
type PasswordChoice = "none" | "generate" | { typed: string };

async function temporaryPassword(choice: PasswordChoice) {
  if (choice === "none") return { password: undefined, error: undefined };
  const password = choice === "generate" ? generatePassword() : choice.typed;
  return { password, error: passwordProblem(password) ?? undefined };
}

const id = z.string().min(1);
const role = z.enum(["admin", "member"]);
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

const otherActiveAdmins = (exceptId: string) =>
  db.user.count({ where: { role: "admin", active: true, id: { not: exceptId } } });

export async function addUser(input: { email: string; role: "admin" | "member"; password: PasswordChoice }): Promise<PasswordResult> {
  await requireAdmin();
  const parsed = z.object({ email, role }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const temp = await temporaryPassword(input.password);
  if (temp.error) return { error: temp.error };

  const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true, active: true } });
  if (existing?.active) return { error: `${data.email} is already on the team.` };
  // With a password, they must choose their own at first sign-in.
  const passwordData = temp.password
    ? { passwordHash: await hashPassword(temp.password), mustChangePassword: true, passwordUpdatedAt: new Date(), failedLogins: 0, lockedUntil: null }
    : {};
  if (existing) {
    // Previously removed: bring them back with the chosen role.
    await db.user.update({ where: { id: existing.id }, data: { active: true, role: data.role, ...passwordData } });
  } else {
    await db.user.create({ data: { email: data.email, role: data.role, ...passwordData } });
  }
  refresh();
  return { ok: true, password: temp.password };
}

// Forgotten password: an admin sets a new temporary one. The person is signed
// out everywhere and must choose their own password at next sign-in.
export async function resetPassword(input: { id: string; password: "generate" | { typed: string } }): Promise<PasswordResult> {
  await requireAdmin();
  const data = z.object({ id }).parse(input);
  const temp = await temporaryPassword(input.password);
  if (temp.error || !temp.password) return { error: temp.error ?? "Choose a password." };
  await db.$transaction([
    db.user.update({
      where: { id: data.id },
      data: { passwordHash: await hashPassword(temp.password), mustChangePassword: true, passwordUpdatedAt: new Date(), failedLogins: 0, lockedUntil: null },
    }),
    db.session.deleteMany({ where: { userId: data.id } }),
  ]);
  refresh();
  return { ok: true, password: temp.password };
}

export async function setRole(input: { id: string; role: "admin" | "member" }): Promise<Result> {
  await requireAdmin();
  const data = z.object({ id, role }).parse(input);
  if (data.role === "member" && (await otherActiveAdmins(data.id)) === 0) {
    return { error: "There must be at least one admin. Make someone else an admin first." };
  }
  await db.user.update({ where: { id: data.id }, data: { role: data.role } });
  refresh();
  return { ok: true };
}

// Blocks the person immediately: sessions are database-backed, so deleting
// them signs the person out on their next request.
export async function deactivateUser(input: { id: string }): Promise<Result> {
  const me = await requireAdmin();
  const data = z.object({ id }).parse(input);
  if (data.id === me.id) return { error: "You can't remove yourself. Ask another admin." };
  const target = await db.user.findUnique({ where: { id: data.id }, select: { role: true } });
  if (!target) return { error: "That person no longer exists." };
  if (target.role === "admin" && (await otherActiveAdmins(data.id)) === 0) {
    return { error: "There must be at least one admin." };
  }
  await db.$transaction([
    db.user.update({ where: { id: data.id }, data: { active: false } }),
    db.session.deleteMany({ where: { userId: data.id } }),
  ]);
  refresh();
  return { ok: true };
}

export async function reactivateUser(input: { id: string }): Promise<Result> {
  await requireAdmin();
  const data = z.object({ id }).parse(input);
  await db.user.update({ where: { id: data.id }, data: { active: true } });
  refresh();
  return { ok: true };
}

// Removes the person for good: their account, sign-ins, assignments,
// favourites and photo. Tasks, comments and history they created stay,
// attributed to "Deleted user" (those links are set to null).
export async function deleteUserPermanently(input: { id: string }): Promise<Result> {
  const me = await requireAdmin();
  const data = z.object({ id }).parse(input);
  if (data.id === me.id) return { error: "You can't delete yourself. Ask another admin." };
  const target = await db.user.findUnique({ where: { id: data.id }, select: { email: true, role: true, active: true } });
  if (!target) return { error: "That person no longer exists." };
  if (isOwner(target.email)) {
    return { error: "Owners are set in INITIAL_ADMIN_EMAILS. Remove them from that setting first, or they'd be re-created at their next sign-in." };
  }
  if (target.role === "admin" && target.active && (await otherActiveAdmins(data.id)) === 0) {
    return { error: "There must be at least one admin." };
  }
  await db.user.delete({ where: { id: data.id } });
  refresh();
  return { ok: true };
}

// Super admins decide who besides themselves may create workspaces.
export async function setCanCreateWorkspaces(input: { id: string; value: boolean }): Promise<Result> {
  await requireAdmin();
  const data = z.object({ id, value: z.boolean() }).parse(input);
  await db.user.update({ where: { id: data.id }, data: { canCreateWorkspaces: data.value } });
  refresh();
  return { ok: true };
}
