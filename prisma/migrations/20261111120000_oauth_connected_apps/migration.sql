-- CreateEnum
CREATE TYPE "OAuthTokenKind" AS ENUM ('access', 'refresh');

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "fromMetadata" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthCode" (
    "hash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "grantId" TEXT,

    CONSTRAINT "OAuthCode_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "hash" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "kind" "OAuthTokenKind" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "OAuthGrant_userId_idx" ON "OAuthGrant"("userId");

-- CreateIndex
CREATE INDEX "OAuthToken_grantId_idx" ON "OAuthToken"("grantId");

-- AddForeignKey
ALTER TABLE "OAuthGrant" ADD CONSTRAINT "OAuthGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthGrant" ADD CONSTRAINT "OAuthGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthCode" ADD CONSTRAINT "OAuthCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthCode" ADD CONSTRAINT "OAuthCode_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "OAuthGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "OAuthGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

