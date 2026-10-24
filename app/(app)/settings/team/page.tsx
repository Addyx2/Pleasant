import { ShieldCheck, Users } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { formatDateTime, initials } from "@/lib/utils";
import { Badge, Card, Td, Th } from "@/components/ui";

import { setAccessAction } from "./actions";
import { InviteMemberForm, ResendInviteButton, RoleSelect } from "./TeamForms";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const admin = await requireAdmin();
  const members = await prisma.user.findMany({
    where: { agencyId: admin.agencyId, role: { in: ["ADMIN", "MANAGER"] } },
    orderBy: [{ deactivatedAt: { sort: "asc", nulls: "first" } }, { role: "asc" }, { firstName: "asc" }],
  });
  const activeAdmins = members.filter((m) => m.role === "ADMIN" && !m.deactivatedAt).length;
  const carerLogins = await prisma.user.count({
    where: { agencyId: admin.agencyId, role: "STAFF", deactivatedAt: null },
  });

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">Invite a teammate</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Back-office access for coordinators and finance. Carers are invited from their worker
          profile and only ever see the Workers app.
        </p>
        <div className="mt-4">
          <InviteMemberForm />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Members</h2>
            <p className="text-xs text-slate-500">
              {members.filter((m) => !m.deactivatedAt).length} active · {carerLogins} carer app login
              {carerLogins === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th className="text-right">Access</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const isSelf = member.id === admin.id;
                const lastAdmin = member.role === "ADMIN" && activeAdmins <= 1 && !member.deactivatedAt;
                const locked = isSelf || lastAdmin;
                return (
                  <tr key={member.id} className={member.deactivatedAt ? "bg-slate-50/60" : undefined}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/10">
                          {initials(member.firstName, member.lastName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {member.firstName} {member.lastName}
                            {isSelf ? <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span> : null}
                          </p>
                          <p className="truncate text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <RoleSelect
                        userId={member.id}
                        role={member.role as "ADMIN" | "MANAGER"}
                        disabled={locked || !!member.deactivatedAt}
                      />
                    </Td>
                    <Td>
                      {member.deactivatedAt ? (
                        <Badge tone="slate">Removed</Badge>
                      ) : member.lockedUntil && member.lockedUntil > new Date() ? (
                        <Badge tone="red">Locked out</Badge>
                      ) : member.lastLoginAt ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <div className="space-y-1.5">
                          <Badge tone="amber">Invited</Badge>
                          <ResendInviteButton userId={member.id} />
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-slate-500">
                      {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                    </Td>
                    <Td className="text-right">
                      {locked ? (
                        <span
                          className="text-xs text-slate-400"
                          title={isSelf ? "You can't change your own access" : "Every agency needs at least one admin"}
                        >
                          {isSelf ? "—" : "Last admin"}
                        </span>
                      ) : (
                        <form action={setAccessAction}>
                          <input type="hidden" name="userId" value={member.id} />
                          <input type="hidden" name="enable" value={member.deactivatedAt ? "true" : "false"} />
                          <button
                            type="submit"
                            className={
                              member.deactivatedAt
                                ? "text-xs font-medium text-brand-700 hover:text-brand-800"
                                : "text-xs font-medium text-red-600 hover:text-red-700"
                            }
                          >
                            {member.deactivatedAt ? "Restore access" : "Remove access"}
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">What each role can do</h2>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {(["ADMIN", "MANAGER"] as const).map((role) => (
            <div key={role} className="rounded-lg bg-slate-50 p-3">
              <dt className="font-semibold text-slate-900">{role === "ADMIN" ? "Admin" : "Manager"}</dt>
              <dd className="mt-0.5 text-xs text-slate-600">{ROLE_DESCRIPTIONS[role]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Role changes and removals sign the person out of every device immediately.
        </p>
      </Card>
    </div>
  );
}
