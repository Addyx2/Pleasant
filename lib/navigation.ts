import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileUp,
  LayoutDashboard,
  Plus,
  Receipt,
  Repeat,
  Send,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { canAccess } from "./permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const HOME_ITEM: NavItem = {
  href: "/oversight",
  label: "Oversight",
  icon: LayoutDashboard,
  keywords: "dashboard home overview",
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      { href: "/shifts", label: "Shifts", icon: CalendarClock, keywords: "rota schedule calendar" },
      { href: "/rota", label: "Recurring rota", icon: Repeat, keywords: "template pattern" },
      { href: "/dispatch", label: "Dispatch", icon: Send, keywords: "offer fill broadcast" },
      { href: "/shifts/requests", label: "Shift requests", icon: CheckCircle2, keywords: "approve claim" },
      { href: "/shifts/unattended", label: "Unattended", icon: AlertTriangle, keywords: "no show missed" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/staff", label: "Workers", icon: Users, keywords: "carers staff nurses" },
      { href: "/timesheets", label: "Timesheets", icon: Clock, keywords: "hours approve" },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck, keywords: "dbs right to work training expiry" },
      { href: "/workforce/recruitment", label: "Onboarding", icon: UserPlus, keywords: "recruitment candidates" },
    ],
  },
  {
    title: "Clients",
    items: [{ href: "/clients", label: "Clients", icon: Building2, keywords: "care homes sites" }],
  },
  {
    title: "Finance",
    items: [
      { href: "/payroll", label: "Payroll", icon: Banknote, keywords: "pay run payslips rti hmrc bacs" },
      { href: "/billing", label: "Invoices", icon: Receipt, keywords: "billing invoice receivables xero" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/import", label: "Import data", icon: FileUp, keywords: "csv upload migrate" },
      { href: "/addons", label: "Add-ons", icon: Plus, keywords: "gateway peak integrations" },
      { href: "/settings", label: "Settings", icon: Settings, keywords: "team audit bank invoice" },
    ],
  },
];

export interface QuickAction {
  href: string;
  label: string;
  keywords?: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { href: "/shifts/new", label: "Create a shift", keywords: "new add" },
  { href: "/staff/new", label: "Add a worker", keywords: "new carer hire" },
  { href: "/billing", label: "Draft an invoice", keywords: "new bill" },
  { href: "/payroll", label: "Start a pay run", keywords: "new payroll" },
  { href: "/settings/team", label: "Invite a teammate", keywords: "team user manager admin" },
  { href: "/settings/audit", label: "View audit log", keywords: "security history" },
];

export function navForRole(role: string): { home: NavItem; sections: NavSection[] } {
  return {
    home: HOME_ITEM,
    sections: NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => canAccess(role, i.href)) })).filter(
      (s) => s.items.length > 0,
    ),
  };
}

export function quickActionsForRole(role: string): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => canAccess(role, a.href));
}

/** The nav item that owns `pathname`: the longest href that prefixes it. */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}
