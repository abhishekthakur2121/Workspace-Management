# Monday-WorkManager

A free, self-hosted work-management tool for a small agency (up to ~20 internal users), built to replace monday.com Work Management. Organise work into workspaces and boards, assign tasks, and track progress in a **Table** view and a **Kanban** view.

> **Status:** early development. The project skeleton and database connection are in place; features land phase by phase (see [Roadmap](#roadmap)).

## Features (v1)

**Sign-in and users**
- Google sign-in for internal staff only. No passwords are stored.
- Admins manage an allowlist of emails, each with a role (`admin` or `member`).
- Removing a user blocks them immediately. Their past work and comments stay, shown greyed out.

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
  schema.prisma        database schema
prisma.config.ts       Prisma CLI config (uses the direct connection)
neon.ts                Neon project / branch policy
src/
  app/                 routes (App Router)
    api/health/        database health check
  server/
    db.ts              Prisma client on the pooled Neon connection
  generated/prisma/    generated Prisma client (gitignored)
```

## Deployment (Netlify + Neon)

1. Import this repository in Netlify. It detects Next.js automatically: build command `npm run build`.
2. Add every variable from the table above under **Project configuration → Environment variables**.
3. Add the Netlify URL, and later your custom domain, as redirect URIs on the Google OAuth client.
4. Keep the Neon database in **AWS US East 2 (Ohio)**, the same region as Netlify's default functions region.

## Roadmap

- [x] Phase 0: project setup, Neon database, Prisma connection
- [x] Phase 1: database schema, Google sign-in with the allowlist
- [x] Phase 2: workspaces and boards (sidebar)
- [ ] Phase 3: Table view with groups and tasks
- [ ] Phase 4: Kanban view
- [ ] Phase 5: My work and Home
- [ ] Phase 6: comments and change history
- [ ] Phase 7: admin user management, deploy
