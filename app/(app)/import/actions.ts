"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { normalizeAccount, normalizeSortCode } from "@/lib/payroll/bacs";
import {
  previewImport,
  shiftEnd,
  toClientDraft,
  toShiftDraft,
  toWorkerDraft,
  validateRecord,
  type ImportKind,
} from "@/lib/import";

export type ImportResult = { ok: boolean; message: string; sessionId?: string; validRows?: number };

function kindFrom(value: FormDataEntryValue | null): ImportKind {
  const raw = String(value ?? "clients");
  return raw === "workers" || raw === "shifts" ? raw : "clients";
}

async function readText(formData: FormData): Promise<string> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    return file.text();
  }
  return String(formData.get("paste") ?? "");
}

export async function previewImportAction(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const user = await requireAdmin();
  const kind = kindFrom(formData.get("kind"));
  const text = await readText(formData);

  if (!text.trim()) {
    return { ok: false, message: "Paste some CSV or choose a file first" };
  }

  const parsed = parseCsv(text);
  if (parsed.headers.length === 0) {
    return { ok: false, message: "That file has no header row" };
  }

  const preview = previewImport(kind, parsed);

  if (preview.missingColumns.length > 0) {
    return {
      ok: false,
      message: `Missing required column${preview.missingColumns.length === 1 ? "" : "s"}: ${preview.missingColumns.join(", ")}`,
    };
  }

  const session = await prisma.importSession.create({
    data: {
      agencyId: user.agencyId,
      kind,
      headers: JSON.stringify(parsed.headers),
      payload: text,
      totalRows: parsed.rows.length,
    },
  });

  revalidatePath("/import");
  return {
    ok: true,
    sessionId: session.id,
    validRows: preview.valid,
    message: `Read ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"} — ${preview.valid} ready to import${
      preview.invalid > 0 ? `, ${preview.invalid} will be skipped` : ""
    }.`,
  };
}

export async function commitImportAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) redirect("/import?result=nothing");

  const session = await prisma.importSession.findFirst({
    where: { id: sessionId, agencyId: user.agencyId },
  });
  if (!session) redirect("/import?result=gone");

  const parsed = parseCsv(session.payload);
  const kind = session.kind as ImportKind;

  let created = 0;
  let skipped = 0;

  let failed = false;
  try {
    // Every row and the session update commit together: a failure part way
    // through rolls the whole import back rather than leaving it half applied.
    await prisma.$transaction(
      async (tx) => {
        for (const row of parsed.rows) {
          const headers = parsed.headers;
          const record: Record<string, string> = {};
          headers.forEach((header, index) => {
            record[header.toLowerCase().replace(/[^a-z0-9]/g, "")] = (row[index] ?? "").trim();
          });

          if (validateRecord(kind, record)) {
            skipped += 1;
            continue;
          }

          if (kind === "clients") {
            const draft = toClientDraft(record);
            const existing = await tx.client.findFirst({
              where: { agencyId: user.agencyId, firstName: draft.firstName, lastName: draft.lastName },
              select: { id: true },
            });
            if (existing) {
              skipped += 1;
              continue;
            }
            await tx.client.create({
              data: {
                agencyId: user.agencyId,
                firstName: draft.firstName,
                lastName: draft.lastName,
                email: draft.email,
                phone: draft.phone,
                address: draft.address,
                postcode: draft.postcode,
                careLevel: draft.careLevel,
                companyName: draft.companyName,
                vatNumber: draft.vatNumber,
                status: "ACTIVE",
              },
            });
            created += 1;
          } else if (kind === "workers") {
            const draft = toWorkerDraft(record);
            const existing = await tx.staffProfile.findFirst({
              where: { agencyId: user.agencyId, firstName: draft.firstName, lastName: draft.lastName },
              select: { id: true },
            });
            if (existing) {
              skipped += 1;
              continue;
            }
            await tx.staffProfile.create({
              data: {
                agencyId: user.agencyId,
                firstName: draft.firstName,
                lastName: draft.lastName,
                email: draft.email,
                phone: draft.phone,
                jobTitle: draft.jobTitle,
                niNumber: draft.niNumber,
                baseRate: draft.baseRate,
                engagementType: draft.engagementType,
                bankName: draft.bankName,
                accountName: draft.accountName,
                sortCode: draft.sortCode ? normalizeSortCode(draft.sortCode) || null : null,
                bankAcct: draft.bankAcct ? normalizeAccount(draft.bankAcct) || null : null,
                dbsNumber: draft.dbsNumber,
                dbsExpiry: draft.dbsExpiry,
                status: "ACTIVE",
              },
            });
            created += 1;
          } else {
            const draft = toShiftDraft(record);
            if (!draft) {
              skipped += 1;
              continue;
            }

            const client = draft.clientName
              ? await findByName(tx.client, user.agencyId, draft.clientName)
              : null;
            const staffMember = draft.staffName
              ? await findByName(tx.staffProfile, user.agencyId, draft.staffName)
              : null;
            const site = draft.siteName
              ? await tx.site.findFirst({
                  where: { agencyId: user.agencyId, name: draft.siteName },
                  select: { id: true },
                })
              : null;

            const startAt = draft.date;
            const endAt = shiftEnd(draft);

            // Don't double-book a carer who is already on shift at that time.
            if (staffMember) {
              const clash = await tx.shift.findFirst({
                where: {
                  agencyId: user.agencyId,
                  staffId: staffMember.id,
                  status: { notIn: ["CANCELLED"] },
                  startAt: { lt: endAt },
                  endAt: { gt: startAt },
                },
                select: { id: true },
              });
              if (clash) {
                skipped += 1;
                continue;
              }
            }

            await tx.shift.create({
              data: {
                agencyId: user.agencyId,
                clientId: client?.id ?? null,
                siteId: site?.id ?? null,
                staffId: staffMember?.id ?? null,
                title: draft.title,
                role: draft.role,
                startAt,
                endAt,
                status: staffMember ? "ASSIGNED" : "OPEN",
              },
            });
            created += 1;
          }
        }

        await tx.importSession.update({
          where: { id: session.id },
          data: { status: "COMPLETED", createdRows: created, skippedRows: skipped, completedAt: new Date() },
        });
      },
      { timeout: 120_000 },
    );
  } catch {
    // The transaction rolled back, so nothing from this import was saved.
    // redirect() throws, so it must be called outside this try/catch.
    failed = true;
  }

  if (failed) {
    revalidatePath("/import");
    redirect(`/import?session=${session.id}&result=failed`);
  }

  revalidatePath("/import");
  revalidatePath("/clients");
  revalidatePath("/staff");
  revalidatePath("/shifts");
  revalidatePath("/dispatch");
  revalidatePath("/dashboard");

  if (created === 0) {
    redirect(`/import?session=${session.id}&result=none`);
  }
  redirect(`/import?session=${session.id}&result=created&count=${created}&skipped=${skipped}`);
}

async function findByName(
  model: { findFirst: (args: never) => Promise<{ id: string } | null> },
  agencyId: string,
  name: string,
): Promise<{ id: string } | null> {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(" ");
  return model.findFirst({
    where: { agencyId, firstName, lastName },
    select: { id: true },
  } as never);
}
