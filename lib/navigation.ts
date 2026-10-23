import {
  Banknote,
  Building2,
  CalendarClock,
  FileUp,
  Fingerprint,
  LayoutDashboard,
  Puzzle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { canAccess } from "./permissions";

export interface NavItem {
  href: string;
  label: string;
  /** Only top-level links carry an icon; section features are listed as text. */
  icon?: LucideIcon;
  keywords?: string;
}

export interface NavSection {
  key: string;
  title: string;
  icon: LucideIcon;
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
    key: "shifts",
    title: "Shifts",
    icon: CalendarClock,
    items: [
      { href: "/shifts", label: "Shifts", keywords: "rota schedule list operations" },
      { href: "/shifts/calendar", label: "Calendar", keywords: "rota schedule week" },
      { href: "/rota", label: "Recurring", keywords: "template pattern rota" },
      { href: "/dispatch", label: "Dispatch", keywords: "offer fill requests approve claim" },
    ],
  },
  {
    key: "people",
    title: "People",
    icon: Users,
    items: [
      { href: "/staff", label: "Workers", keywords: "carers staff nurses" },
      { href: "/timesheets", label: "Timesheets", keywords: "hours approve" },
      { href: "/compliance", label: "Compliance", keywords: "dbs right to work training expiry" },
      { href: "/workforce/recruitment", label: "Onboarding", keywords: "recruitment candidates" },
    ],
  },
  {
    key: "clientpointe",
    title: "Clientpointe",
    icon: Building2,
    items: [{ href: "/clients", label: "Clients", keywords: "clientpointe care homes sites" }],
  },
  {
    key: "finance",
    title: "Finance",
    icon: Banknote,
    items: [
      { href: "/payroll", label: "Payroll", keywords: "pay run payslips rti hmrc bacs" },
      { href: "/billing", label: "Invoices", keywords: "billing invoice receivables xero" },
    ],
  },
  {
    key: "persona",
    title: "Persona",
    icon: Fingerprint,
    items: [
      { href: "/persona", label: "Overview", keywords: "persona ai suite competence compliance readiness layers" },
      { href: "/persona/assist", label: "Assist", keywords: "persona ai agent chat history automations connections" },
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

/** Agency setup, opened from the account menu rather than the sidebar. */
export const WORKSPACE_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, keywords: "workspace team audit bank invoice" },
  { href: "/import", label: "Import data", icon: FileUp, keywords: "workspace csv upload migrate" },
  { href: "/addons", label: "Add-ons", icon: Puzzle, keywords: "workspace gateway peak integrations" },
];

export function navForRole(role: string): { home: NavItem; sections: NavSection[]; workspace: NavItem[] } {
  return {
    home: HOME_ITEM,
    sections: NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => canAccess(role, i.href)) })).filter(
      (s) => s.items.length > 0,
    ),
    workspace: WORKSPACE_ITEMS.filter((i) => canAccess(role, i.href)),
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
