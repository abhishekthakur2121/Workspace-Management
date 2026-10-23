import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { DEFAULT_THEME, themeBootScript } from "@/lib/theme";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Nxt Workspace Manager", template: "%s · Nxt Workspace Manager" },
  description: "Boards, tasks and progress for the team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the boot script may set data-theme before React hydrates.
    <html lang="en" data-theme={DEFAULT_THEME} className={`${figtree.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* App-wide toasts: the sign-in, password and profile pages use them too. */}
        <Toaster
          position="bottom-center"
          closeButton
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border-grid !bg-surface !text-foreground !shadow-xl",
              actionButton: "!bg-primary !text-white !rounded-md",
              closeButton: "!bg-surface !border-grid !text-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
