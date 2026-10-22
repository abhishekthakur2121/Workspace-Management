import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI (migrate, studio) uses the direct connection; Neon's
// PgBouncer pooler breaks migrations. The app itself connects through the
// pooled DATABASE_URL in src/server/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL_UNPOOLED") },
});
