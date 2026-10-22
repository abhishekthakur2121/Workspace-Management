import "dotenv/config";
import { defineConfig } from "prisma/config";

// The Prisma CLI (migrate, studio) uses the direct connection; Neon's
// PgBouncer pooler breaks migrations. The app itself connects through the
// pooled DATABASE_URL in src/server/db.ts.
// Read with process.env (not Prisma's env(), which throws when unset) so
// `prisma generate` still works during installs that have no database vars.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL_UNPOOLED },
});
