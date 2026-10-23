-- Role hierarchy.
-- App-wide: admin/member  →  super_admin / admin / user
--   today's admins stay "admin" and members become "user"; owners
--   (INITIAL_ADMIN_EMAILS) are treated as super_admin by the app.
-- Workspace: admin/member + canCreateBoards  →  admin / editor / member
--   members who could create boards become editors.
-- Postgres can't drop enum values, so each enum is recreated and every row
-- converted explicitly.

-- App-wide role
CREATE TYPE "Role_new" AS ENUM ('super_admin', 'admin', 'user');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE "role"::text WHEN 'admin' THEN 'admin' ELSE 'user' END)::"Role_new";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Workspace role
CREATE TYPE "WorkspaceRole_new" AS ENUM ('admin', 'editor', 'member');
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" TYPE "WorkspaceRole_new"
  USING (CASE
    WHEN "role"::text = 'admin' THEN 'admin'
    WHEN "canCreateBoards" THEN 'editor'
    ELSE 'member'
  END)::"WorkspaceRole_new";
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" SET DEFAULT 'member';
DROP TYPE "WorkspaceRole";
ALTER TYPE "WorkspaceRole_new" RENAME TO "WorkspaceRole";

-- The switches are replaced by the roles above.
ALTER TABLE "WorkspaceMember" DROP COLUMN "canCreateBoards";
ALTER TABLE "User" DROP COLUMN "canCreateWorkspaces";
