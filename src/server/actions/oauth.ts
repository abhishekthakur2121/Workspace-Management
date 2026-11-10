"use server";

// The two buttons on /oauth/authorize. The request is checked again here
// rather than trusted from the page, since anything sent from the browser can
// be changed.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth-guard";
import { originOf } from "@/server/oauth/config";
import { deniedRedirect, issueCode, parseAuthorizeRequest } from "@/server/oauth/authorize";

const params = z.record(z.string(), z.string().max(4000));

async function checked(input: Record<string, string>) {
  const origin = originOf(await headers());
  const parsed = await parseAuthorizeRequest(params.parse(input), origin);
  if (!parsed.ok) redirect("redirect" in parsed ? parsed.redirect : "/");
  return { request: parsed.request, origin };
}

export async function approveConnection(input: Record<string, string>) {
  const user = await requireUser();
  const { request, origin } = await checked(input);
  redirect(await issueCode(request, user.id, origin));
}

export async function declineConnection(input: Record<string, string>) {
  await requireUser();
  const { request, origin } = await checked(input);
  redirect(deniedRedirect(request, origin));
}
