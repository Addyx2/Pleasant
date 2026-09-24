import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Invite carer" };
export const dynamic = "force-dynamic";

export default async function InviteStaffPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const user = await requireAdmin();
  const { staffId } = await params;

  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId },
    include: { user: true },
  });

  if (!staff) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Invite a carer" description="Choose a carer from the staff list." />
        <Card className="p-6">
          <p className="text-sm text-slate-600">
            Carer not found.{" "}
            <Link href="/staff" className="font-medium text-brand-700 hover:underline">
              Back to staff
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Invite ${staff.firstName} ${staff.lastName}`}
        description={`Give ${staff.firstName} a login for the carer app. ${
          staff.user ? "They already have an account — this issues a fresh password link." : ""
        }`}
        action={
          <Link href="/staff" className="text-sm font-medium text-brand-700 hover:underline">
            Back to staff
          </Link>
        }
      />
      <Card className="p-6">
        {staff.email ? (
          <InviteForm
            staffId={staff.id}
            email={staff.email}
            hasAccount={!!staff.user}
          />
        ) : (
          <p className="text-sm text-slate-600">
            This carer has no email address. Add one to invite them to the app.
          </p>
        )}
      </Card>
    </div>
  );
}