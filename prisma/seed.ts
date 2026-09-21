import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month, day, hour, minute, 0, 0);
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const existing = await prisma.agency.findUnique({ where: { slug: "brightwater-care" } });
  if (existing) {
    await prisma.agency.delete({ where: { id: existing.id } });
  }

  const agency = await prisma.agency.create({
    data: {
      name: "Brightwater Care",
      slug: "brightwater-care",
      phone: "01234 567890",
      email: "office@brightwatercare.co.uk",
      address: "12 Riverside Way",
      postcode: "BS1 4AB",
      payrollRef: "123/AB45678",
      payFrequency: "WEEKLY",
      cutoffWeekday: 1,
      cutoffTime: "16:00",
      payWeekday: 5,
      roundingMins: 15,
    },
  });

  const passwordHash = await bcrypt.hash("pleasant123", 10);

  await prisma.user.create({
    data: {
      agencyId: agency.id,
      email: "admin@pleasant.demo",
      passwordHash,
      firstName: "Amara",
      lastName: "Okafor",
      role: "ADMIN",
    },
  });

  interface StaffSeed {
    firstName: string;
    lastName: string;
    jobTitle: string;
    band?: string;
    baseRate: number;
    nightRate?: number;
    weekendRate?: number;
    bankHolidayRate?: number;
    taxCode: string;
    niNumber?: string;
    studentLoanPlan?: string;
    pensionEnrolled: boolean;
    engagementType?: string;
    ltdCompanyName?: string;
  }

  const staffSeed: StaffSeed[] = [
    {
      firstName: "Grace",
      lastName: "Miller",
      jobTitle: "Registered Nurse",
      band: "Band 5",
      baseRate: 18.5,
      nightRate: 22.2,
      weekendRate: 24.05,
      bankHolidayRate: 29.6,
      taxCode: "1257L",
      niNumber: "QQ123456C",
      pensionEnrolled: true,
    },
    {
      firstName: "Tunde",
      lastName: "Adeyemi",
      jobTitle: "Care Assistant",
      band: "Senior",
      baseRate: 13.9,
      nightRate: 16.68,
      weekendRate: 18.07,
      bankHolidayRate: 22.24,
      taxCode: "1257L",
      niNumber: "QQ123457D",
      pensionEnrolled: true,
    },
    {
      firstName: "Priya",
      lastName: "Sharma",
      jobTitle: "Support Worker",
      baseRate: 12.71,
      nightRate: 15.25,
      weekendRate: 16.52,
      taxCode: "BR",
      studentLoanPlan: "PLAN_2",
      pensionEnrolled: true,
    },
    {
      firstName: "Daniel",
      lastName: "Nowak",
      jobTitle: "Care Assistant",
      baseRate: 12.71,
      weekendRate: 15.25,
      taxCode: "1257L",
      niNumber: "QQ123458E",
      pensionEnrolled: false,
    },
    {
      firstName: "Elena",
      lastName: "Popescu",
      jobTitle: "Healthcare Assistant",
      baseRate: 14.0,
      weekendRate: 16.0,
      taxCode: "LTD",
      pensionEnrolled: false,
      engagementType: "LTD",
      ltdCompanyName: "Popescu Care Ltd",
    },
  ];

  const staff = [];
  for (const person of staffSeed) {
    staff.push(
      await prisma.staffProfile.create({
        data: {
          agencyId: agency.id,
          firstName: person.firstName,
          lastName: person.lastName,
          email: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@brightwatercare.co.uk`,
          jobTitle: person.jobTitle,
          band: person.band ?? null,
          baseRate: person.baseRate,
          nightRate: person.nightRate ?? null,
          weekendRate: person.weekendRate ?? null,
          bankHolidayRate: person.bankHolidayRate ?? null,
          taxCode: person.taxCode,
          niNumber: person.niNumber ?? null,
          studentLoanPlan: (person.studentLoanPlan ?? "NONE") as never,
          pensionEnrolled: person.pensionEnrolled,
          engagementType: person.engagementType ?? "PAYE",
          ltdCompanyName: person.ltdCompanyName ?? null,
          holidayAccrualPct: 12.07,
          startDate: at(year - 1, 2, 1, 9),
        },
      }),
    );
  }

  const [grace, tunde, priya, daniel, elena] = staff;

  // Carer login for the mobile "My shifts" demo.
  await prisma.user.create({
    data: {
      agencyId: agency.id,
      email: "tunde.adeyemi@brightwatercare.co.uk",
      passwordHash,
      firstName: "Tunde",
      lastName: "Adeyemi",
      role: "STAFF",
      staff: { connect: { id: tunde.id } },
    },
  });

  const sites = await Promise.all(
    [
      { name: "Meadow View Care Home", address: "8 Meadow Lane", postcode: "BS2 7QT" },
      { name: "Oakfield Supported Living", address: "44 Oakfield Road", postcode: "BS3 1LN" },
    ].map((site) => prisma.site.create({ data: { agencyId: agency.id, ...site } })),
  );

  const clients = await Promise.all(
    [
      { firstName: "Margaret", lastName: "Hughes", careLevel: "High", postcode: "BS1 5TR" },
      { firstName: "Arthur", lastName: "Bell", careLevel: "Medium", postcode: "BS2 8PL" },
      { firstName: "Sofia", lastName: "Reyes", careLevel: "Complex", postcode: "BS3 4DW" },
    ].map((client) => prisma.client.create({ data: { agencyId: agency.id, ...client } })),
  );

  type ShiftSeed = {
    day: number;
    startHour: number;
    endHour: number;
    staff: string | null;
    client: number;
    site: number;
    title: string;
    breakMins?: number;
    isSleepIn?: boolean;
    sleepInRate?: number;
    expenses?: number;
    expenseNotes?: string;
  };

  const shiftSeeds: ShiftSeed[] = [
    { day: 3, startHour: 8, endHour: 14, staff: grace.id, client: 0, site: 0, title: "Morning care — Margaret" },
    { day: 4, startHour: 20, endHour: 8, staff: grace.id, client: 2, site: 0, title: "Night shift — Sofia" },
    { day: 5, startHour: 9, endHour: 17, staff: tunde.id, client: 1, site: 1, title: "Day support — Arthur", expenses: 12.4, expenseNotes: "Mileage — 28 miles @ 45p" },
    { day: 6, startHour: 22, endHour: 7, staff: priya.id, client: 2, site: 0, title: "Sleep-in — Sofia", isSleepIn: true, sleepInRate: 45 },
    { day: 8, startHour: 8, endHour: 14, staff: tunde.id, client: 0, site: 0, title: "Morning care — Margaret" },
    { day: 9, startHour: 14, endHour: 22, staff: priya.id, client: 2, site: 1, title: "Afternoon support — Sofia" },
    { day: 10, startHour: 9, endHour: 17, staff: grace.id, client: 1, site: 1, title: "Day support — Arthur" },
    { day: 11, startHour: 8, endHour: 14, staff: daniel.id, client: 0, site: 0, title: "Morning care — Margaret" },
    { day: 12, startHour: 20, endHour: 8, staff: priya.id, client: 2, site: 0, title: "Night shift — Sofia" },
    { day: 13, startHour: 9, endHour: 17, staff: elena.id, client: 1, site: 1, title: "Day support — Arthur (Ltd)" },
    { day: Math.min(now.getDate() + 1, 28), startHour: 9, endHour: 17, staff: null, client: 1, site: 1, title: "Day support — Arthur" },
    { day: Math.min(now.getDate() + 2, 28), startHour: 8, endHour: 14, staff: null, client: 0, site: 0, title: "Morning care — Margaret" },
  ];

  const plannedMins = (s: ShiftSeed) => {
    const start = at(year, month, s.day, s.startHour);
    let end = at(year, month, s.day, s.endHour);
    if (s.endHour <= s.startHour) end = at(year, month, s.day + 1, s.endHour);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  };

  for (const seed of shiftSeeds) {
    const startAt = at(year, month, seed.day, seed.startHour);
    let endAt = at(year, month, seed.day, seed.endHour);
    if (seed.endHour <= seed.startHour) endAt = at(year, month, seed.day + 1, seed.endHour);
    const breakMins = seed.breakMins ?? (plannedMins(seed) > 360 ? 30 : 0);

    const shift = await prisma.shift.create({
      data: {
        agencyId: agency.id,
        clientId: clients[seed.client].id,
        siteId: sites[seed.site].id,
        staffId: seed.staff,
        title: seed.title,
        role: seed.staff === grace.id ? "Registered Nurse" : "Care Assistant",
        startAt,
        endAt,
        breakMins,
        chargeRate: 24.5,
        isSleepIn: seed.isSleepIn ?? false,
        sleepInRate: seed.sleepInRate ?? 0,
        status: seed.staff ? "COMPLETED" : "OPEN",
      },
    });

    if (seed.staff && startAt < now) {
      const clockOut = endAt;
      const workedMins = plannedMins(seed) - breakMins;
      await prisma.timesheet.create({
        data: {
          agencyId: agency.id,
          shiftId: shift.id,
          staffId: seed.staff,
          clockIn: startAt,
          clockOut,
          breakMins,
          workedMins,
          status: "APPROVED",
          expenses: seed.expenses ?? 0,
          expenseNotes: seed.expenseNotes ?? null,
          candidateSignedAt: startAt,
          clientAuthName: "J. Whitfield",
          clientAuthPosition: "Home Manager",
          clientAuthAt: endAt,
        },
      });
    }
  }

  const pending = await prisma.shift.create({
    data: {
      agencyId: agency.id,
      clientId: clients[0].id,
      siteId: sites[0].id,
      staffId: tunde.id,
      title: "Evening care — Margaret",
      role: "Care Assistant",
      startAt: at(year, month, Math.min(now.getDate(), 27), 18),
      endAt: at(year, month, Math.min(now.getDate(), 27), 22),
      breakMins: 0,
      chargeRate: 24.5,
      status: "ASSIGNED",
    },
  });

  await prisma.timesheet.create({
    data: {
      agencyId: agency.id,
      shiftId: pending.id,
      staffId: tunde.id,
      clockIn: at(year, month, Math.min(now.getDate(), 27), 18),
      clockOut: at(year, month, Math.min(now.getDate(), 27), 22),
      breakMins: 0,
      workedMins: 240,
      status: "PENDING",
    },
  });

  // Open-shift marketplace: seed a couple of pending carer requests for demo.
  const openShifts = await prisma.shift.findMany({
    where: { agencyId: agency.id, status: "OPEN", staffId: null },
    orderBy: { startAt: "asc" },
    take: 2,
  });
  if (openShifts.length > 0) {
    await prisma.shiftRequest.create({
      data: {
        agencyId: agency.id,
        shiftId: openShifts[0].id,
        staffId: grace.id,
        message: "Happy to cover — can extend if needed.",
      },
    });
  }
  if (openShifts.length > 1) {
    await prisma.shiftRequest.create({
      data: {
        agencyId: agency.id,
        shiftId: openShifts[1].id,
        staffId: priya.id,
        message: "I can do this one.",
      },
    });
  }

  console.log("Seeded Brightwater Care.");
  console.log("Manager: admin@pleasant.demo / pleasant123");
  console.log("Carer: tunde.adeyemi@brightwatercare.co.uk / pleasant123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
