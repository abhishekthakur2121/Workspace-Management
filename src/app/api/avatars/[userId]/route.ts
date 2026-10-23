import { connection } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";

// Uploaded profile pictures. Links carry a version (?v=…) that changes on
// every upload, so browsers can cache each version for good.
export async function GET(_req: Request, ctx: RouteContext<"/api/avatars/[userId]">) {
  await connection();
  const session = await auth();
  if (!session?.user?.active) return new Response("Unauthorized", { status: 401 });

  const { userId } = await ctx.params;
  const avatar = await db.avatar.findUnique({ where: { userId }, select: { data: true, contentType: true } });
  if (!avatar) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
