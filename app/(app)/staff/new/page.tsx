import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";
import { NewStaffForm } from "../NewStaffForm";

export const metadata = { title: "Add carer" };

export default function NewStaffPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add a carer"
        description="Store their role, pay rates and payroll details so payslips are correct."
        action={
          <Link href="/staff" className="text-sm font-medium text-brand-700 hover:underline">
            Back to staff
          </Link>
        }
      />
      <Card className="p-6">
        <NewStaffForm />
      </Card>
    </div>
  );
}
