"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { removeMembership, reportMembership } from "@/lib/aultrum-id";
import { hashPassword, requireAdmin, type SessionUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { issuePasswordToken, randomPassword } from "@/lib/password";
import { ROLE_LABELS } from "@/lib/permissions";
import { absoluteUrl } from "@/lib/url";

export interface TeamInviteState {
  ok?: boolean;
  error?: string;
  email?: string;
  link?: string;
  delivered?: boolean;
}

const inviteSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid work email"),
  role: z.enum(["ADMIN", "MANAGER"]),
});

async function sendInvite(
  admin: SessionUser,
  member: { id: string; email: string; firstName: string },
): Promise<{ link?: string; delivered: boolean }> {
  const token = await issuePasswordToken(member.id);
  const link = await absoluteUrl(`/reset/confirm?token=${token}`);
  const { delivered } = await sendEmail({
    to: member.email,
    subject: `${admin.firstName} invited you to ${admin.agency.name} on Pleasant`,
    text: `Hi ${member.firstName},\n\n${admin.firstName} ${admin.lastName} has invited you to join ${admin.agency.name} on Pleasant. Open this link to choose a password and sign in:\n\n${link}\n\nThe link is valid for 6 hours. If it expires, ask ${admin.firstName} to resend it.`,
  });
  return { link: delivered ? undefined : link, delivered };
}

export async function inviteTeamMemberAction(
  _prev: TeamInviteState,
  formData: FormData,
): Promise<TeamInviteState> {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details and try again" };
  }
  const { email, firstName, lastName, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error:
        existing.agencyId === admin.agencyId
          ? "This person is already on your team"
          : "This email is already registered with Pleasant",
    };
  }

  const member = await prisma.user.create({
    data: {
      agencyId: admin.agencyId,
      email,
      firstName,
      lastName,
      role,
      passwordHash: await hashPassword(randomPassword()),
    },
  });

  const { link, delivered } = await sendInvite(admin, member);
  await recordAudit(admin, {
    action: "team.invite",
    summary: `Invited ${email} as ${ROLE_LABELS[role]}`,
    targetType: "User",
    targetId: member.id,
    metadata: { role },
  });

  revalidatePath("/settings/team");
  return { ok: true, email, link, delivered };
}

async function loadMember(admin: SessionUser, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, agencyId: admin.agencyId, role: { in: ["ADMIN", "MANAGER"] } },
  });
}

async function activeAdminCount(agencyId: string): Promise<number> {
  return prisma.user.count({ where: { agencyId, role: "ADMIN", deactivatedAt: null } });
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = z.enum(["ADMIN", "MANAGER"]).safeParse(formData.get("role"));
  if (!role.success || userId === admin.id) return;

  const member = await loadMember(admin, userId);
  if (!member || member.role === role.data) return;
  if (member.role === "ADMIN" && (await activeAdminCount(admin.agencyId)) <= 1) return;

  // Role changes take effect immediately: existing sessions are revoked.
  await prisma.user.update({
    where: { id: member.id },
    data: { role: role.data, sessionVersion: { increment: 1 } },
  });
  await recordAudit(admin, {
    action: "team.role_change",
    summary: `Changed ${member.email} from ${ROLE_LABELS[member.role]} to ${ROLE_LABELS[role.data]}`,
    targetType: "User",
    targetId: member.id,
    metadata: { from: member.role, to: role.data },
  });
  revalidatePath("/settings/team");
}

export async function setAccessAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const enable = formData.get("enable") === "true";
  if (userId === admin.id) return;

  const member = await loadMember(admin, userId);
  if (!member) return;
  if (!enable && member.role === "ADMIN" && (await activeAdminCount(admin.agencyId)) <= 1) return;

  await prisma.user.update({
    where: { id: member.id },
    data: enable
      ? { deactivatedAt: null }
      : { deactivatedAt: new Date(), sessionVersion: { increment: 1 } },
  });
  await recordAudit(admin, {
    action: enable ? "team.restore" : "team.remove",
    summary: enable ? `Restored access for ${member.email}` : `Removed access for ${member.email}`,
    targetType: "User",
    targetId: member.id,
  });
  // Keep Aultrum Workspace in step: removed people no longer see the agency there.
  if (member.aultrumSub) {
    if (enable) await reportMembership(member.aultrumSub, admin.agency, member.role);
    else await removeMembership(member.aultrumSub, admin.agencyId);
  }
  revalidatePath("/settings/team");
}

export async function resendInviteAction(
  _prev: TeamInviteState,
  formData: FormData,
): Promise<TeamInviteState> {
  const admin = await requireAdmin();
  const member = await loadMember(admin, String(formData.get("userId") ?? ""));
  if (!member || member.deactivatedAt) return { error: "Team member not found" };

  const { link, delivered } = await sendInvite(admin, member);
  await recordAudit(admin, {
    action: "team.resend_invite",
    summary: `Resent sign-in link to ${member.email}`,
    targetType: "User",
    targetId: member.id,
  });
  return { ok: true, email: member.email, link, delivered };
}
