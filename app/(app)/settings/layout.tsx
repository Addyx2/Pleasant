import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <PageHeader
          title="Agency settings"
          description={`${user.agency.name} · invoicing, bank files, team access and the audit trail.`}
        />
        <SettingsTabs />
      </div>
      {children}
    </div>
  );
}
