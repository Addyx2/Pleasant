import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const tables = (await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  )) as { tablename: string }[];

  const dump: Record<string, unknown> = {};
  for (const { tablename } of tables) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${tablename}"`);
    dump[tablename] = rows;
  }

  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `pleasant-${stamp}.json`);
  writeFileSync(file, JSON.stringify(dump, null, 2));

  const summary = Object.entries(dump).map(([table, rows]) => `${table}:${(rows as unknown[]).length}`);
  console.log(`Backup written to ${file}`);
  console.log(summary.join("  "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });