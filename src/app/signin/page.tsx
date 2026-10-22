import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth, signIn } from "@/auth";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  AccessDenied:
    "This Google account isn't on the team list. Ask an admin to add your email, then try again.",
};

// Only allow redirects back into this app.
function safeCallback(url: string | undefined) {
  return url?.startsWith("/") && !url.startsWith("//") ? url : "/";
}

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="anim-dialog w-full max-w-sm rounded-2xl border border-grid bg-surface p-8 shadow-xl shadow-black/5">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#2f8cff] to-[#6c4cf5] text-sm font-bold text-white shadow-sm shadow-primary/30">
            W
          </span>
          <span className="text-lg font-semibold">WorkManager</span>
        </div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Use your Google account to continue.</p>
        <Suspense fallback={<GoogleButton disabled />}>
          <SignInForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function SignInForm({ searchParams }: Pick<PageProps<"/signin">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const callbackUrl = safeCallback(
    typeof params.callbackUrl === "string" ? params.callbackUrl : undefined,
  );

  const session = await auth();
  if (session?.user?.active) redirect(callbackUrl);

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    <>
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {ERRORS[error] ?? "Sign-in failed. Please try again."}
          {!ERRORS[error] && <span className="mt-1 block text-xs opacity-75">Error code: {error}</span>}
        </p>
      )}
      <form action={signInWithGoogle}>
        <GoogleButton />
      </form>
    </>
  );
}

function GoogleButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:border-primary/40 hover:bg-background hover:shadow-md active:scale-[0.98] disabled:opacity-60"
    >
      <svg aria-hidden viewBox="0 0 48 48" className="size-5">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}
