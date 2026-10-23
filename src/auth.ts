import { inspect } from "node:util";
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { isOwner } from "@/server/owners";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; active: boolean; mustChangePassword: boolean } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    active?: boolean;
    mustChangePassword?: boolean;
  }
}


export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter is typed against @prisma/client; our client is generated to a
  // custom path but has the same model delegates.
  adapter: PrismaAdapter(db as never),
  // Database sessions (not JWT) so removing a user ends their sessions at once.
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      // The User row is created by an admin before the first sign-in, so the
      // Google account has to be linked to it by email. Safe here: Google is
      // the only provider and we require a verified email below.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: { signIn: "/signin", error: "/signin" },
  logger: {
    // Auth.js hides the underlying error by default; log it in full.
    error(error) {
      console.error("[auth]", inspect(error, { depth: 6 }));
    },
  },
  callbacks: {
    // The allowlist: only an existing, active User row (or an initial admin) gets in.
    async signIn({ user, profile }) {
      const email = user.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return false;

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return existing.active;

      // Owners (INITIAL_ADMIN_EMAILS) get in before anyone has used the admin page.
      if (isOwner(email)) {
        await db.user.create({
          data: { email, name: user.name, image: user.image, role: "admin" },
        });
        return true;
      }
      return false;
    },
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role ?? "member";
      session.user.active = user.active ?? false;
      session.user.mustChangePassword = user.mustChangePassword ?? false;
      return session;
    },
  },
  events: {
    // Keep name and photo in sync with the Google profile.
    async signIn({ user, profile }) {
      if (!user.id || !profile) return;
      await db.user.update({
        where: { id: user.id },
        data: {
          name: profile.name ?? user.name,
          image: (profile.picture as string | undefined) ?? user.image,
        },
      });
    },
  },
});
