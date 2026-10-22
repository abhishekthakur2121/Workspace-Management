import "server-only";

// Owners are the people listed in INITIAL_ADMIN_EMAILS: they become admins on
// first sign-in, and only they may permanently wipe data.
export const ownerEmails = (process.env.INITIAL_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isOwner(email: string | null | undefined) {
  return !!email && ownerEmails.includes(email.toLowerCase());
}
