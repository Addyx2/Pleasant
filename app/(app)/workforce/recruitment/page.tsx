import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, UserCheck, UserPlus, Users } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isBookable,
  onboardingProgress,
  onboardingSteps,
  type OnboardingStep,
  type StepState,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader, StatCard, Td, Th, buttonClass } from "@/components/ui";

export const metadata = { title: "Onboarding" };
export const dynamic = "force-dynamic";

const STEP_STYLE: Record<StepState, { icon: typeof CheckCircle2; className: string }> = {
  DONE: { icon: CheckCircle2, className: "text-emerald-600" },
  IN_REVIEW: { icon: Clock, className: "text-sky-600" },
  TODO: { icon: CircleDashed, className: "text-slate-400" },
  BLOCKED: { icon: AlertTriangle, className: "text-red-600" },
};

function StepCell({ step }: { step: OnboardingStep }) {
  const { icon: Icon, className } = STEP_STYLE[step.state];
  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-medium", className)} title={step.detail}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{step.detail}</span>
    </div>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireOps();
  const { view } = await searchParams;
  const showAll = view === "all";

  const staff = await prisma.staffProfile.findMany({
    where: { agencyId: user.agencyId, status: { not: "INACTIVE" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      createdAt: true,
      niNumber: true,
      sortCode: true,
      bankAcct: true,
      dbsNumber: true,
      dbsExpiry: true,
      userId: true,
      rightToWork: { select: { status: true, expiryDate: true } },
      trainingRecords: { select: { status: true, expiryDate: true } },
      onboardingForms: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = staff.map((member) => {
    const steps = onboardingSteps(member);
    return { member, steps, progress: onboardingProgress(steps), bookable: isBookable(steps) };
  });
  const inPipeline = rows.filter((r) => !r.bookable);
  const blocked = rows.filter((r) => r.steps.some((s) => s.state === "BLOCKED"));
  const inReview = rows.filter((r) => r.steps.some((s) => s.state === "IN_REVIEW"));
  const visible = (showAll ? rows : inPipeline).sort(
    (a, b) =>
      Number(b.steps.some((s) => s.state === "BLOCKED")) - Number(a.steps.some((s) => s.state === "BLOCKED")) ||
      a.progress - b.progress,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        description="Every active worker's path to bookable: right to work, DBS, training, forms and payroll details."
        action={
          <Link href="/staff/new" className={buttonClass}>
            <UserPlus className="h-4 w-4" />
            Add a worker
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active workers" value={String(rows.length)} icon={Users} tone="slate" />
        <StatCard
          label="Ready to book"
          value={String(rows.length - inPipeline.length)}
          hint="All compliance and payroll steps done"
          icon={UserCheck}
          tone="green"
        />
        <StatCard label="Awaiting review" value={String(inReview.length)} hint="Checks or forms to verify" icon={Clock} tone="blue" />
        <StatCard label="Blocked" value={String(blocked.length)} hint="Expired or rejected items" icon={AlertTriangle} tone="red" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {showAll ? "All active workers" : "In the pipeline"}
          </h2>
          <div className="flex gap-1.5 text-xs">
            <Link
              href="/workforce/recruitment"
              className={cn("rounded-full px-3 py-1 font-medium", !showAll ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              In pipeline ({inPipeline.length})
            </Link>
            <Link
              href="/workforce/recruitment?view=all"
              className={cn("rounded-full px-3 py-1 font-medium", showAll ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              Everyone ({rows.length})
            </Link>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={rows.length === 0 ? "No workers yet" : "Everyone is ready to book"}
              description={
                rows.length === 0
                  ? "Add your first worker or import a staff list to start onboarding."
                  : "No outstanding right-to-work, DBS, training, form or payroll steps."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <Th>Worker</Th>
                  <Th>Progress</Th>
                  {visible[0].steps.map((s) => (
                    <Th key={s.key}>{s.label}</Th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(({ member, steps, progress }) => (
                  <tr key={member.id} className="transition hover:bg-slate-50/60">
                    <Td className="min-w-[11rem]">
                      <Link href={`/staff/${member.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {member.firstName} {member.lastName}
                      </Link>
                      <p className="text-xs text-slate-500">{member.jobTitle}</p>
                    </Td>
                    <Td>
                      <div className="flex w-28 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn("h-full rounded-full", progress === 100 ? "bg-emerald-500" : "bg-brand-500")}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="tabular w-8 text-right text-xs text-slate-500">{progress}%</span>
                      </div>
                    </Td>
                    {steps.map((step) => (
                      <Td key={step.key} className="max-w-[11rem]">
                        <StepCell step={step} />
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
