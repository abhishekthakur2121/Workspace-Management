"use server";

// A person's own name and profile picture.

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { getSignedInUser } from "@/server/auth-guard";

type Result = { ok: true } | { error: string };

const MAX_AVATAR_BYTES = 300 * 1024; // the browser resizes to ~256px first, so real uploads are far smaller
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function updateName(input: { name: string }): Promise<Result> {
  const me = await getSignedInUser();
  const parsed = z.object({ name: z.string().trim().max(80, "That name is too long.") }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  await db.user.update({ where: { id: me.id }, data: { name: parsed.data.name || null } });
  refresh();
  return { ok: true };
}

// `data` is the image as base64 (no data: prefix).
export async function uploadAvatar(input: { data: string; contentType: string }): Promise<Result> {
  const me = await getSignedInUser();
  if (!IMAGE_TYPES.includes(input.contentType)) return { error: "Use a JPEG, PNG or WebP image." };
  const bytes = Buffer.from(input.data, "base64");
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) return { error: "That image is too large." };

  const url = `/api/avatars/${me.id}?v=${Date.now()}`;
  await db.$transaction([
    db.avatar.upsert({
      where: { userId: me.id },
      create: { userId: me.id, data: bytes, contentType: input.contentType },
      update: { data: bytes, contentType: input.contentType },
    }),
    db.user.update({ where: { id: me.id }, data: { image: url } }),
  ]);
  refresh();
  return { ok: true };
}

export async function removeAvatar(): Promise<Result> {
  const me = await getSignedInUser();
  await db.$transaction([db.avatar.deleteMany({ where: { userId: me.id } }), db.user.update({ where: { id: me.id }, data: { image: null } })]);
  refresh();
  return { ok: true };
}
