import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month, day, hour, minute, 0, 0);
}

/** A date `offsetDays` from now, preserving the clock time. Month-safe. */
function daysFromNow(offsetDays: number, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

const existing = await prisma.agency.findUnique({ where: { slug: "brightwater-care" } });
if (existing) {
  // InvoiceLine.staffId is onDelete: Restrict, so the agency's billing history
  // has to be cleared explicitly before the agency (and its staff) can go.
  await prisma.invoice.deleteMany({ where: { agencyId: existing.id } });
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
      companyNo: "09876543",
      vatNumber: "GB123456789",
      invoiceEmail: "billing@brightwatercare.co.uk",
      bankSortCode: "401162",
      bankAccount: "31234567",
      bankAccountName: "Brightwater Care Ltd",
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
    bankName?: string;
    accountName?: string;
    sortCode?: string;
    bankAcct?: string;
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
      bankName: "Barclays",
      accountName: "Grace Miller",
      sortCode: "20-00-00",
      bankAcct: "10203040",
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
      bankName: "Barclays",
      accountName: "Tunde Adeyemi",
      sortCode: "20-18-26",
      bankAcct: "55667788",
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
          bankName: person.bankName ?? null,
          accountName: person.accountName ?? null,
          sortCode: person.sortCode ?? null,
          bankAcct: person.bankAcct ?? null,
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
    day: number | null;
    daysFromNow: number;
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
    { day: 3, daysFromNow: 0, startHour: 8, endHour: 14, staff: grace.id, client: 0, site: 0, title: "Morning care — Margaret" },
    { day: 4, daysFromNow: 0, startHour: 20, endHour: 8, staff: grace.id, client: 2, site: 0, title: "Night shift — Sofia" },
    { day: 5, daysFromNow: 0, startHour: 9, endHour: 17, staff: tunde.id, client: 1, site: 1, title: "Day support — Arthur", expenses: 12.4, expenseNotes: "Mileage — 28 miles @ 45p" },
    { day: 6, daysFromNow: 0, startHour: 22, endHour: 7, staff: priya.id, client: 2, site: 0, title: "Sleep-in — Sofia", isSleepIn: true, sleepInRate: 45 },
    { day: 8, daysFromNow: 0, startHour: 8, endHour: 14, staff: tunde.id, client: 0, site: 0, title: "Morning care — Margaret" },
    { day: 9, daysFromNow: 0, startHour: 14, endHour: 22, staff: priya.id, client: 2, site: 1, title: "Afternoon support — Sofia" },
    { day: 10, daysFromNow: 0, startHour: 9, endHour: 17, staff: grace.id, client: 1, site: 1, title: "Day support — Arthur" },
    { day: 11, daysFromNow: 0, startHour: 8, endHour: 14, staff: daniel.id, client: 0, site: 0, title: "Morning care — Margaret" },
    { day: 12, daysFromNow: 0, startHour: 20, endHour: 8, staff: priya.id, client: 2, site: 0, title: "Night shift — Sofia" },
    { day: 13, daysFromNow: 0, startHour: 9, endHour: 17, staff: elena.id, client: 1, site: 1, title: "Day support — Arthur (Ltd)" },
    // Upcoming, still unassigned so dispatch has live cover to offer.
    { day: null, daysFromNow: 1, startHour: 9, endHour: 17, staff: null, client: 1, site: 1, title: "Day support — Arthur" },
    { day: null, daysFromNow: 2, startHour: 8, endHour: 14, staff: null, client: 0, site: 0, title: "Morning care — Margaret" },
    { day: null, daysFromNow: 3, startHour: 20, endHour: 8, staff: null, client: 2, site: 0, title: "Night shift — Sofia" },
    // Upcoming and already assigned, so the carer app has forward-looking shifts.
    { day: null, daysFromNow: 2, startHour: 18, endHour: 22, staff: tunde.id, client: 0, site: 0, title: "Evening call — Margaret" },
    { day: null, daysFromNow: 4, startHour: 7, endHour: 15, staff: priya.id, client: 2, site: 0, title: "Morning care — Sofia" },
  ];

  const plannedMins = (s: ShiftSeed) => {
    const start = seedStart(s);
    const end = seedEnd(s);
    if (s.endHour <= s.startHour) {
      return Math.round((end.getTime() + 24 * 60 * 60 * 1000 - start.getTime()) / 60000);
    }
    return Math.round((end.getTime() - start.getTime()) / 60000);
  };

  function seedStart(s: ShiftSeed) {
    return s.day === null ? daysFromNow(s.daysFromNow, s.startHour) : at(year, month, s.day, s.startHour);
  }

  function seedEnd(s: ShiftSeed) {
    const base = seedStart(s);
    const e = new Date(base);
    e.setHours(s.endHour, 0, 0, 0);
    return e;
  }

  for (const seed of shiftSeeds) {
    const startAt = seedStart(seed);
    let endAt = seedEnd(seed);
    if (seed.endHour <= seed.startHour) endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
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
        // Future assigned shifts are still upcoming, not finished.
        status: !seed.staff ? "OPEN" : startAt < now ? "COMPLETED" : "ASSIGNED",
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
      startAt: daysFromNow(2, 18),
      endAt: daysFromNow(2, 22),
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
      clockIn: daysFromNow(2, 18),
      clockOut: daysFromNow(2, 22),
      breakMins: 0,
      workedMins: 240,
      status: "PENDING",
    },
  });

  // Open-shift marketplace: seed a couple of pending carer requests for demo.
  const openShifts = await prisma.shift.findMany({
    where: {
      agencyId: agency.id,
      status: "OPEN",
      staffId: null,
      startAt: { gte: new Date() },
    },
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

  // A settled payroll run and a couple of issued invoices, so the payroll
  // and billing/Xero flows have real records to work against.
  const payrollStart = daysFromNow(-21);
  const payrollEnd = daysFromNow(-14);
  const payrollRun = await prisma.payrollRun.create({
    data: {
      agencyId: agency.id,
      reference: `${payrollStart.getFullYear()}-${String(payrollStart.getMonth() + 1).padStart(2, "0")}-M1`,
      periodStart: payrollStart,
      periodEnd: payrollEnd,
      payDate: daysFromNow(-7),
      taxYear: `${new Date().getFullYear()}/${String(new Date().getFullYear() + 1).slice(2)}`,
      status: "PAID",
      grossTotal: 940,
      payeTotal: 120,
      niTotal: 60,
      pensionTotal: 45,
      netTotal: 715,
      employerNiTotal: 68.4,
      payslips: {
        create: [
          {
            staffId: tunde.id,
            timesheetHours: 37.5,
            grossPay: 610,
            taxablePay: 610,
            paye: 76.25,
            niEmployee: 32.11,
            pensionEmployee: 30.5,
            pensionEmployer: 30.5,
            employerNi: 36.6,
            netPay: 471.14,
            taxCode: "1257L",
          },
          {
            staffId: grace.id,
            timesheetHours: 26,
            grossPay: 330,
            taxablePay: 330,
            paye: 43.75,
            niEmployee: 17.33,
            pensionEmployee: 14.5,
            pensionEmployer: 14.5,
            employerNi: 19.4,
            netPay: 254.42,
            taxCode: "1257L",
          },
        ],
      },
    },
  });

  for (const [index, client] of [clients[0], clients[1]].entries()) {
    const invoiceHours = index === 0 ? 42.5 : 18;
    const chargeAmount = index === 0 ? 1041.25 : 441;
    const payAmount = index === 0 ? 610 : 330;
    await prisma.invoice.create({
      data: {
        agencyId: agency.id,
        clientId: client.id,
        reference: `INV-${daysFromNow(-20).getFullYear()}${String(index + 1).padStart(2, "0")}-0${index + 1}`,
        periodStart: payrollStart,
        periodEnd: payrollEnd,
        issueDate: daysFromNow(-19),
        dueDate: daysFromNow(-5),
        paidAt: daysFromNow(-7),
        status: index === 0 ? "ISSUED" : "PAID",
        hoursTotal: invoiceHours,
        chargeTotal: chargeAmount,
        payTotal: payAmount,
        marginTotal: chargeAmount - payAmount,
        vatRatePct: 0,
        vatTotal: 0,
        grandTotal: chargeAmount,
        lines: {
          create: {
            staffId: tunde.id,
            date: payrollEnd,
            title: "Completed care visits",
            hours: invoiceHours,
            chargeRate: 24.5,
            chargeAmount,
            payAmount,
            marginAmount: chargeAmount - payAmount,
          },
        },
      },
    });
  }

  console.log(`Seeded Brightwater Care (payroll ${payrollRun.reference}).`);
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
