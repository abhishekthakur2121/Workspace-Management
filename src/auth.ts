import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@/generated/prisma/client";
import { db } from "@/server/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; active: boolean } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    active?: boolean;
  }
}

// Emails that become admins on first sign-in, so the first admin can get in
// before anyone has used the admin page.
const initialAdmins = (process.env.INITIAL_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
  callbacks: {
    // The allowlist: only an existing, active User row (or an initial admin) gets in.
    async signIn({ user, profile }) {
      const email = user.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return false;

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return existing.active;

      if (initialAdmins.includes(email)) {
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
