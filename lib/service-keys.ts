import { prisma } from "@/lib/db";

const cache = new Map<string, Promise<string>>();

/**
 * A key Pleasant makes for itself the first time it is needed and keeps in
 * its database. Safe when several servers start at once: the first write wins
 * and everyone reads it back.
 */
export function serviceKey(name: string, make: () => string | Promise<string>): Promise<string> {
  let value = cache.get(name);
  if (!value) {
    value = (async () => {
      const existing = await prisma.serviceKey.findUnique({ where: { name } });
      if (existing) return existing.value;
      await prisma.serviceKey.createMany({ data: [{ name, value: await make() }], skipDuplicates: true });
      return (await prisma.serviceKey.findUniqueOrThrow({ where: { name } })).value;
    })().catch((error) => {
      cache.delete(name);
      throw error;
    });
    cache.set(name, value);
  }
  return value;
}
