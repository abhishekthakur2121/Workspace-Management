"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Home, KeyRound, ListChecks, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Shield, Star, Sun, UserRound, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { CreateBoardDialog } from "@/components/create-buttons";
import { BoardLink, BoardList } from "./board-list";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { signOutAction } from "@/server/actions/auth";
import type { NavData } from "@/server/queries/nav";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/lib/use-persistent-state";
import { DEFAULT_THEME, THEME_KEY, applyTheme, type Theme } from "@/lib/theme";

type User = { name?: string | null; email?: string | null; image?: string | null; role: "admin" | "member" };

const LAST_WORKSPACE_KEY = "wm:lastWorkspace";
const noopSubscribe = () => () => {};
function readLastWorkspace() {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function AppShell({ user, nav, children }: { user: User; nav: NavData; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar user={user} nav={nav} onClose={() => setMobileOpen(false)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 md:hidden">
          <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="rounded p-1.5 hover:bg-hover">
            <MenuIcon className="size-5" />
          </button>
          <span className="font-semibold">WorkManager</span>
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ user, nav, onClose }: { user: User; nav: NavData; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const allBoards = nav.workspaces.flatMap((w) => w.boards);

  const activeBoardId = pathname.match(/^\/b\/([^/]+)/)?.[1];
  const urlWorkspaceId =
    pathname.match(/^\/w\/([^/]+)/)?.[1] ?? allBoards.find((b) => b.id === activeBoardId)?.workspaceId;

  // Outside a workspace (Home, My work) keep showing the last one used.
  const lastWorkspaceId = useSyncExternalStore(noopSubscribe, readLastWorkspace, () => undefined);
  useEffect(() => {
    try {
      if (urlWorkspaceId) localStorage.setItem(LAST_WORKSPACE_KEY, urlWorkspaceId);
    } catch {}
  }, [urlWorkspaceId]);

  const current =
    nav.workspaces.find((w) => w.id === (urlWorkspaceId ?? lastWorkspaceId)) ?? nav.workspaces[0];
  const favorites = nav.favoriteBoardIds
    .map((id) => allBoards.find((b) => b.id === id))
    .filter((b) => b !== undefined);

  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [creatingBoard, setCreatingBoard] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href="/" className="group/logo flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#2f8cff] to-[#6c4cf5] text-sm font-bold text-white shadow-sm shadow-primary/30 transition-transform duration-200 group-hover/logo:rotate-[-6deg]">W</span>
          <span className="font-semibold">WorkManager</span>
        </Link>
        <button aria-label="Close menu" onClick={onClose} className="rounded p-1 hover:bg-hover md:hidden">
          <X className="size-4" />
        </button>
      </div>

      <nav className="space-y-0.5 px-2">
        <NavItem href="/" icon={<Home />} label="Home" active={pathname === "/"} />
        <NavItem href="/my-work" icon={<ListChecks />} label="My work" active={pathname === "/my-work"} />
        {user.role === "admin" && (
          <NavItem href="/admin/users" icon={<Shield />} label="Users" active={pathname.startsWith("/admin")} />
        )}
      </nav>

      <div className="mx-4 my-3 h-px bg-border" />

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <button
          onClick={() => setFavoritesOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-hover"
        >
          <Star className="size-4 text-muted" />
          <span className="flex-1 text-left">Favorites</span>
          <ChevronDown className={cn("size-4 text-muted transition-transform", !favoritesOpen && "-rotate-90")} />
        </button>
        <div className="collapsible" data-open={favoritesOpen} inert={!favoritesOpen}>
          <ul className="mt-0.5 space-y-0.5 pl-3">
            {favorites.map((b) => (
              <li key={b.id}>
                <BoardLink board={b} active={b.id === activeBoardId} isFavorite />
              </li>
            ))}
            {favorites.length === 0 && (
              <li className="px-3 py-1 text-xs text-muted">Star a board to pin it here</li>
            )}
          </ul>
        </div>

        <div className="mx-2 my-3 h-px bg-border" />

        <div className="px-1">
          <WorkspaceSwitcher workspaces={nav.workspaces} current={current} />
        </div>

        {current && (
          <>
            <div className="mt-3 mb-1 flex items-center justify-between px-3">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Boards</span>
              <button
                aria-label="Add board"
                onClick={() => setCreatingBoard(true)}
                className="rounded p-1 text-muted hover:bg-hover hover:text-foreground"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <BoardList boards={current.boards} favoriteIds={nav.favoriteBoardIds} activeBoardId={activeBoardId} />
            <CreateBoardDialog workspaceId={current.id} open={creatingBoard} onOpenChange={setCreatingBoard} />
          </>
        )}
      </div>

      <div className="border-t border-border p-2">
        <Menu>
          <MenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover">
              <Avatar name={user.name ?? user.email ?? "?"} image={user.image} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name ?? user.email}</span>
                <span className="block text-xs text-muted capitalize">{user.role}</span>
              </span>
            </button>
          </MenuTrigger>
          <MenuContent side="top" className="w-56">
            <MenuLabel>{user.email}</MenuLabel>
            {user.role === "admin" && (
              <MenuItem icon={<Shield />} onSelect={() => router.push("/admin/users")}>
                Manage users
              </MenuItem>
            )}
            <MenuItem icon={<UserRound />} onSelect={() => router.push("/account/profile")}>
              Profile
            </MenuItem>
            <MenuItem icon={<KeyRound />} onSelect={() => router.push("/account/password")}>
              Password
            </MenuItem>
            <MenuSeparator />
            <ThemeItems />
            <MenuSeparator />
            <MenuItem icon={<LogOut />} onSelect={() => signOutAction()}>
              Sign out
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        // Active marker: a small bar that grows in from the left edge.
        "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors duration-150 [&>svg]:size-4",
        "before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:transition-transform before:duration-200",
        active ? "bg-selected font-medium text-primary before:scale-y-100 [&>svg]:text-primary" : "before:scale-y-0 hover:bg-hover [&>svg]:text-muted",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
  { value: "system", label: "Match system", icon: <Monitor /> },
];

function ThemeItems() {
  const [theme, setTheme] = usePersistentState<Theme>(THEME_KEY, DEFAULT_THEME);
  useEffect(() => applyTheme(theme), [theme]);
  const choose = (t: Theme) => {
    applyTheme(t, { animate: true });
    setTheme(t);
  };
  return (
    <>
      <MenuLabel>Theme</MenuLabel>
      {THEMES.map((t) => (
        <MenuItem key={t.value} icon={t.icon} onSelect={(e) => {
          e.preventDefault(); // keep the menu open so the change is visible
          choose(t.value);
        }}>
          <span className="flex-1">{t.label}</span>
          {theme === t.value && <Check className="size-4 text-primary" />}
        </MenuItem>
      ))}
    </>
  );
}
