import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/server/db";

// Password sign-in creates the same database session Auth.js uses for Google,
// in the same cookie, so auth(), requireUser(), sign-out and instant
// deactivation all work identically for both sign-in methods.

const SESSION_DAYS = 30;

async function isSecure() {
  const proto = (await headers()).get("x-forwarded-proto");
  return proto === "https" || !!process.env.AUTH_URL?.startsWith("https://");
}

// Auth.js's cookie names (prefixed with __Secure- over HTTPS).
export async function sessionCookieName() {
  return (await isSecure()) ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export async function createSession(userId: string) {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { sessionToken, userId, expires } });
  (await cookies()).set(await sessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: await isSecure(),
    sameSite: "lax",
    path: "/",
    expires,
  });
  return sessionToken;
}

export async function currentSessionToken() {
  return (await cookies()).get(await sessionCookieName())?.value;
}
