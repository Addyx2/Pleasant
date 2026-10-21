"use server";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export interface SearchResult {
  id: string;
  kind: "Worker" | "Client" | "Shift" | "Invoice";
  title: string;
  subtitle: string;
  href: string;
}

const LIMIT = 5;

export async function searchAction(raw: string): Promise<SearchResult[]> {
  const user = await requireOps();
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };
  const agencyId = user.agencyId;

  const [staff, clients, shifts, invoices] = await Promise.all([
    prisma.staffProfile.findMany({
      where: {
        agencyId,
        OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { jobTitle: contains }],
      },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, status: true },
      take: LIMIT,
      orderBy: { lastName: "asc" },
    }),
    prisma.client.findMany({
      where: {
        agencyId,
        OR: [{ companyName: contains }, { firstName: contains }, { lastName: contains }, { postcode: contains }],
      },
      select: { id: true, firstName: true, lastName: true, companyName: true, postcode: true },
      take: LIMIT,
    }),
    prisma.shift.findMany({
      where: { agencyId, OR: [{ title: contains }, { role: contains }] },
      select: { id: true, title: true, startAt: true, status: true },
      orderBy: { startAt: "desc" },
      take: LIMIT,
    }),
    user.role === "ADMIN"
      ? prisma.invoice.findMany({
          where: { agencyId, reference: contains },
          select: { id: true, reference: true, status: true, client: { select: { companyName: true, firstName: true, lastName: true } } },
          take: LIMIT,
        })
      : Promise.resolve([]),
  ]);

  return [
    ...staff.map((s) => ({
      id: s.id,
      kind: "Worker" as const,
      title: `${s.firstName} ${s.lastName}`,
      subtitle: `${s.jobTitle} · ${s.status.toLowerCase().replace("_", " ")}`,
      href: `/staff/${s.id}`,
    })),
    ...clients.map((c) => ({
      id: c.id,
      kind: "Client" as const,
      title: c.companyName || `${c.firstName} ${c.lastName}`,
      subtitle: [c.companyName ? `${c.firstName} ${c.lastName}` : null, c.postcode].filter(Boolean).join(" · "),
      href: "/clients",
    })),
    ...shifts.map((s) => ({
      id: s.id,
      kind: "Shift" as const,
      title: s.title,
      subtitle: `${formatDateTime(s.startAt)} · ${s.status.toLowerCase().replace("_", " ")}`,
      href: `/shifts/${s.id}`,
    })),
    ...invoices.map((i) => ({
      id: i.id,
      kind: "Invoice" as const,
      title: i.reference,
      subtitle: `${i.client.companyName || `${i.client.firstName} ${i.client.lastName}`} · ${i.status.toLowerCase()}`,
      href: `/billing/${i.id}`,
    })),
  ];
}
