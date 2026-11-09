// Deploys the database before the app builds (vercel.json buildCommand):
// 1. A database made before migrations (by `prisma db push`) is marked as
//    already at the baseline, once.
// 2. Every newer migration in prisma/migrations is applied, in order.
// Neon pauses an idle database; the first connection can time out (P1002)
// while it wakes, and a preview and a production build sharing one database
// can wait on each other's migration lock. Both clear within a minute, so
// the database is woken first and the migration step retried.
// 3. The live database must then match prisma/schema.prisma exactly; if it
//    doesn't (a change made by hand, or a migration missing), the deploy stops
//    here instead of shipping code against the wrong tables.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

// Locally, DATABASE_URL comes from .env (Vercel sets it in the environment).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env: Prisma reports the missing URL below
  }
}

// Run the Prisma CLI with this Node binary rather than through npx: npx isn't
// an executable on Windows, where `npm run db:deploy` is used too.
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const prisma = (...args) => execFileSync(process.execPath, [prismaCli, ...args], { stdio: "inherit" });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Runs a step, trying again (up to `tries` times, `waitMs` apart) if it fails. */
async function withRetries(label, step, tries = 4, waitMs = 15_000) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (error) {
      if (attempt >= tries) throw error;
      console.log(`${label} failed (attempt ${attempt} of ${tries}); the database may be waking up or busy. Trying again in ${waitMs / 1000}s.`);
      await sleep(waitMs);
    }
  }
}
const baseline = readdirSync("prisma/migrations").filter((d) => /^0_/.test(d)).sort()[0];
if (!baseline) throw new Error("No baseline migration (prisma/migrations/0_*) found");

prisma("generate");
const db = new PrismaClient();
await withRetries("Reaching the database", () => db.$queryRaw`SELECT 1`, 6, 10_000);
const [{ migrations, tables }] = await db.$queryRaw`
  SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS migrations,
         (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations') AS tables`;
const done = migrations ? await db.$queryRaw`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${baseline} AND finished_at IS NOT NULL` : [];
// A migration that failed part-way stops every later deploy until it's resolved.
const failed = migrations ? await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL` : [];
await db.$disconnect();

if (tables > 0 && done.length === 0) {
  console.log(`Existing database without the ${baseline} record: marking it applied.`);
  prisma("migrate", "resolve", "--applied", baseline);
}
// One marked "-- idempotent: safe to re-run" is retried; any other needs a person.
for (const { migration_name: name } of failed) {
  const file = `prisma/migrations/${name}/migration.sql`;
  if (existsSync(file) && /^--\s*idempotent:\s*safe to re-run/m.test(readFileSync(file, "utf8"))) {
    console.log(`Migration ${name} failed before; it is safe to re-run, so retrying it.`);
    prisma("migrate", "resolve", "--rolled-back", name);
  } else {
    console.error(`Migration ${name} failed before and isn't marked safe to re-run. Check the database, then run: npx prisma migrate resolve --rolled-back ${name} (or --applied).`);
    process.exit(1);
  }
}
await withRetries("Applying migrations", () => prisma("migrate", "deploy"), 3, 20_000);

try {
  execFileSync(
    process.execPath,
    [prismaCli, "migrate", "diff", "--from-url", process.env.DATABASE_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"],
    { stdio: "pipe" },
  );
  console.log("Database matches prisma/schema.prisma.");
} catch (error) {
  if (error.status === 2) {
    console.error("The live database doesn't match prisma/schema.prisma. Differences:");
    execFileSync(
      process.execPath,
      [prismaCli, "migrate", "diff", "--from-url", process.env.DATABASE_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
      { stdio: "inherit" },
    );
    process.exit(1);
  }
  throw error;
}
