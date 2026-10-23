-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "BoardVisibility" AS ENUM ('workspace', 'private');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "visibility" "BoardVisibility" NOT NULL DEFAULT 'workspace';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canCreateWorkspaces" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'member',
    "canCreateBoards" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "BoardMember" (
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardMember_pkey" PRIMARY KEY ("boardId","userId")
);

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "BoardMember_userId_idx" ON "BoardMember"("userId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: nothing changes for anyone on day one.
-- Every active person joins every existing workspace; super admins as its
-- admins. Members keep today's ability to create boards (admins can turn it
-- off). Existing boards default to "visible to the whole workspace".
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "canCreateBoards", "createdAt")
SELECT w."id",
       u."id",
       CASE WHEN u."role" = 'admin' THEN 'admin'::"WorkspaceRole" ELSE 'member'::"WorkspaceRole" END,
       true,
       now()
FROM "Workspace" w
CROSS JOIN "User" u
WHERE u."active" = true;
