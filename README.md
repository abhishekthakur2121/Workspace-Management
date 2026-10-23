# Monday-WorkManager

A free, self-hosted work-management tool for a small agency (up to ~20 internal users), built to replace monday.com Work Management. Organise work into workspaces and boards, assign tasks, and track progress in a **Table** view and a **Kanban** view.

> **Status:** early development. The project skeleton and database connection are in place; features land phase by phase (see [Roadmap](#roadmap)).

## Features (v1)

**Sign-in and users**
- Internal staff only; there is no public sign-up. Admins keep the team list (each person has a role: `admin` or `member`).
- Two ways to sign in: **Google**, or **email + password** for people an admin gives a password.
- Admins set an initial password (typed, or generated and shown once). On first sign-in the person must choose their own; forgotten passwords are reset by an admin.
- Passwords are stored only as salted `scrypt` hashes. Five wrong attempts lock the account for 15 minutes.
- After choosing a password, people can optionally add their name and a profile photo (also under **Profile** in the user menu).
- Removing a person signs them out immediately (database sessions); their work stays, shown greyed out. Admins can also delete a person permanently: their work stays, attributed to "Deleted user".

**Access**

| App role | Can do |
|---|---|
| **Super admin** (everyone in `INITIAL_ADMIN_EMAILS`, plus anyone promoted) | Everything: every workspace and board, all people, data clean-up (owners only) |
| **Admin** | Creates workspaces; manages people with the User role. Sees only workspaces they're a member of |
| **User** | Works in the workspaces they're added to |

| Workspace role | Can do |
|---|---|
| **Admin** (the creator by default) | Everything in the workspace, including every board; manages members and their roles |
| **Editor** | Creates boards; renames, shares and deletes the boards they created |
| **Member** | Edits tasks on boards they can see |

- A workspace is visible only to its members. A board is visible to **everyone in the workspace** or **only selected people**, chosen when it's created and changeable with **Share** (workspace admins and the creator always have access). Anyone who can see a board can edit its tasks.
- Tasks can only be assigned to people who can see the board. All checks run on the server (`src/server/access.ts`).

**How work is organised**
- **Workspace:** e.g. one per client, or any grouping you like.
- **Board:** a stream of work inside a workspace (e.g. "Digital Operations").
- **Group:** a collapsible section of a board (e.g. "This week", "Backlog").
- **Task:** a single piece of work. Tasks can have one level of **subtasks**, and subtasks have the same fields as tasks.
- Workspaces, boards, groups and tasks can be created, renamed, reordered and deleted. Every delete can be undone.

**Task fields**
- Name
- **Accountable:** one person who owns the outcome
- **Responsible:** one or more people who do the work
- Status: colored labels you can edit per board. The defaults are Not started, Working on it, Stuck and Done.
- Due date
- Priority: Low, Medium, High or Critical
- Tags: colored, defined per board
- **Updates:** a comment thread on each task, plus a full log of changes

**Board views**
- **Table:** rows grouped by section, editing inside the row, expandable subtasks, bulk select and actions, drag to reorder.
- **Kanban:** one column per status. Dragging a card to another column changes its status; dragging within a column reorders it. You can add a task straight into a column.
- **Shared toolbar:** New task, Search, Person filter, Filter, Sort, Hide columns, Group by (group or status).

**Navigation**
- A sidebar with Home, **My work**, Favorites, a workspace switcher and the board list.
- **My work:** every task assigned to you across all workspaces, sorted by due date.
- **Home:** recently visited boards, plus your overdue tasks and tasks due this week.

Out of scope for v1: automations, integrations, dashboards, timeline/Gantt views, client logins, notifications, custom columns and fine-grained permissions.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | [Neon](https://neon.com) serverless Postgres |
| ORM | [Prisma 7](https://www.prisma.io) with the Neon driver adapter (`@neondatabase/serverless`) |
| Auth | [Auth.js](https://authjs.dev) v5 with Google, using database sessions |
| Hosting | [Netlify](https://www.netlify.com) (free tier, commercial use allowed) |

## Getting started

### Prerequisites
- Node.js 22 or newer
- A Neon project (the free tier is enough)
- A Google Cloud OAuth client (type "Web application")

### 1. Install
```bash
git clone git@github.com:abhishekthakur2121/Workspace-Management.git
cd Workspace-Management
npm install          # also runs `prisma generate`
```

### 2. Environment variables
Create a `.env` file in the project root. It is gitignored, so never commit it.

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (the host contains `-pooler`). The app uses this at runtime. |
| `DATABASE_URL_UNPOOLED` | Neon **direct** connection string. Prisma migrations use this. |
| `AUTH_SECRET` | Random secret for Auth.js. Generate one with `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials |
| `AUTH_TRUST_HOST` | `true` |
| `INITIAL_ADMIN_EMAILS` | Comma-separated emails that become admins on their first sign-in |
| `AUTH_URL` | **Netlify only:** the site's public URL, e.g. `https://your-site.netlify.app` (no trailing slash). Without it, sign-in redirects to Netlify's per-deploy hostname and fails. Don't set it locally. |

If you use the [Neon CLI](https://neon.com/docs/cli), `neon env pull` writes both database URLs for you.

In Google Cloud, add these authorised redirect URIs to the OAuth client:
```
http://localhost:3000/api/auth/callback/google
https://<your-domain>/api/auth/callback/google
```

### 3. Run
```bash
npx prisma migrate dev   # apply database migrations
npm run dev              # http://localhost:3000
```

Check the database connection at http://localhost:3000/api/health. A healthy app returns `{"ok":true,"db":"up",...}`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npx prisma migrate dev` | Create and apply a migration (development) |
| `npx prisma studio` | Browse the database |

## Project structure

```
prisma/
  schema.prisma          database schema
prisma.config.ts         Prisma CLI config (uses the direct connection)
src/
  auth.ts                Auth.js: Google sign-in + allowlist
  proxy.ts               redirects signed-out visitors to /signin
  app/
    (app)/               signed-in pages: Home, My work, workspace, board
    signin/              sign-in page
    api/                 Auth.js, health check, board sync version
  components/
    ui/                  shared primitives (button, menu, popover, dialog, label pill, ...)
    sidebar/             sidebar, workspace switcher, board list
    board/
      board-context.tsx  board state, optimistic saves, live sync
      filtering.ts       search / filter / sort / group-by (pure functions)
      table/             Table view (sections, rows, group header, add rows)
      kanban.tsx         Kanban view
      pickers/           status, priority, people, date and tag pickers
      task-panel/        task side panel: fields, Updates, Activity
    my-work/             My work list and Home's "Due soon"
  lib/                   dates, theme, text, time and other helpers
  server/
    db.ts                Prisma client on the pooled Neon connection
    auth-guard.ts        requireUser() / requireAdmin()
    actions/             server actions (one file per area)
    tasks/               task-action helpers: validation, ordering, change log
    queries/             data loading for pages
  generated/prisma/      generated Prisma client (gitignored)
```

## Deployment (Netlify + Neon)

1. Import this repository in Netlify. Build settings come from `netlify.toml`: migrations run first (`prisma migrate deploy`), then `npm run build`, published from `.next` with the Next.js runtime plugin. Leave **Base directory** empty.
2. Add every variable from the table above under **Project configuration → Environment variables**, including `AUTH_URL` (Production context). Mark URLs and secrets as secret.
3. In Google Cloud, add `https://<your-site>/api/auth/callback/google` as an authorised redirect URI. Set the OAuth consent screen to **Internal** (Google Workspace) or **publish** it (Gmail accounts); in "Testing" mode only listed test users can sign in.
4. Keep the Neon database in **AWS US East 2 (Ohio)**, the same region as Netlify's default functions region. The database must sit next to the server, not next to the users.
5. After the first deploy, check `https://<your-site>/api/health` returns `{"ok":true,"db":"up",...}`, then sign in with an `INITIAL_ADMIN_EMAILS` account and add the team under **Users**.

### Housekeeping

- Deleted workspaces, boards, groups, tasks and comments can be undone right away and stay in the database for 30 days. A daily Netlify scheduled function (`netlify/functions/purge-deleted.mts`) then removes them permanently, along with expired sign-in sessions. Its runs are listed under **Logs → Functions** in Netlify.
- People are never deleted: removing someone deactivates them and signs them out, and their past work stays visible.

## Roadmap

- [x] Phase 0: project setup, Neon database, Prisma connection
- [x] Phase 1: database schema, Google sign-in with the allowlist
- [x] Phase 2: workspaces and boards (sidebar)
- [x] Phase 3: Table view with groups and tasks
- [x] Phase 4: Kanban view
- [x] Phase 5: My work and Home
- [x] Phase 6: comments and change history
- [x] Phase 7: admin user management, deploy
