// Moves pre-organisation client rows onto the organisation model. Idempotent:
// only touches clients whose `name` is still empty, so it is safe to run on
// every deploy (see vercel.json).
//
// - Rows with a company name become that organisation; the person recorded on
//   the row becomes its first contact. They are not made a timesheet signatory:
//   that authority is granted deliberately on the client page.
// - Rows with only a person's name keep that name as the organisation name, so
//   nothing disappears from invoices; rename them on the client page.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legacy = await prisma.client.findMany({ where: { OR: [{ name: null }, { name: "" }] } });
  let contacts = 0;

  for (const client of legacy) {
    const person = [client.firstName, client.lastName].filter(Boolean).join(" ").trim();
    const company = client.companyName?.trim();

    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: client.id },
        data: { name: company || person || "Unnamed client" },
      });
      if (company && person) {
        const exists = await tx.clientContact.count({ where: { clientId: client.id, name: person } });
        if (!exists) {
          await tx.clientContact.create({
            data: {
              agencyId: client.agencyId,
              clientId: client.id,
              name: person,
              email: client.email,
              phone: client.phone,
              isSignatory: false,
            },
          });
          contacts += 1;
        }
      }
    });
  }

  console.log(`backfill-clients: named ${legacy.length} client(s), created ${contacts} contact(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
