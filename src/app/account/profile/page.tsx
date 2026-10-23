import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/server/auth-guard";
import { ProfileForm } from "@/components/auth/profile-form";

export const metadata: Metadata = { title: "Profile" };

// Optional step right after choosing a password (?welcome=1), and the
// Profile page from the user menu.
export default function ProfilePage({ searchParams }: PageProps<"/account/profile">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="anim-dialog w-full max-w-md rounded-2xl border border-grid bg-surface p-8 shadow-xl shadow-black/5">
        <Suspense fallback={<div className="skeleton h-64 rounded-lg" />}>
          <ProfileBody searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ProfileBody({ searchParams }: Pick<PageProps<"/account/profile">, "searchParams">) {
  const [me, params] = await Promise.all([requireUser(), searchParams]);
  const welcome = params.welcome === "1";
  return (
    <>
      <h1 className="text-2xl font-semibold">{welcome ? "Complete your profile" : "Your profile"}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        {welcome ? "Optional: add your name and a photo so teammates recognise you." : "Your name and photo as the team sees them."}
      </p>
      <ProfileForm initialName={me.name ?? ""} image={me.image ?? null} email={me.email ?? ""} welcome={welcome} />
    </>
  );
}
