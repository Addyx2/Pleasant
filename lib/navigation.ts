import {
  Banknote,
  Bot,
  Building2,
  CalendarClock,
  FileUp,
  Fingerprint,
  Gauge,
  Headset,
  LayoutDashboard,
  LayoutGrid,
  Plug,
  Settings,
  Sparkles,
  Trophy,
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
  href: "/qualifiers",
  label: "Qualifiers",
  icon: LayoutDashboard,
  keywords: "dashboard home overview oversight quality index",
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
    key: "supply",
    title: "Supply",
    icon: Building2,
    items: [
      { href: "/clients", label: "Care Homes & Clients", keywords: "supply care homes sites clients" },
      { href: "/shifts/requests", label: "Shift Requests", keywords: "supply requests book" },
    ],
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
];

// The sidebar has three groups: Pleasant itself, then Persona (Aultrum's AI)
// and Elements (Aultrum's modules) as they run inside it.
export type NavGroupKey = "pleasant" | "persona" | "elements";

export interface NavGroup {
  key: NavGroupKey;
  label: string;
  /** Top-level links with icons. */
  links: NavItem[];
  /** Collapsible sections of features listed as text. */
  sections: NavSection[];
}

export const PERSONA_LINKS: NavItem[] = [
  { href: "/persona", label: "Overview", icon: Fingerprint, keywords: "persona ai suite competence compliance readiness layers" },
  { href: "/persona/pushbots", label: "Pushbots", icon: Bot, keywords: "persona ai sms text carers offers fill shifts campaigns messages" },
  { href: "/persona/assist", label: "Assist", icon: Sparkles, keywords: "persona ai agent chat history automations connections" },
  { href: "/persona/qualifiers", label: "Qualifiers", icon: Gauge, keywords: "persona ai quality index performance reliability readiness competence carers review" },
];

export const ELEMENT_LINKS: NavItem[] = [
  { href: "/addons/gateway", label: "Gateway", icon: Headset, keywords: "elements contact centre calls conversations" },
  { href: "/addons/peak", label: "Peak", icon: Trophy, keywords: "elements rewards recognition points" },
  { href: "/addons", label: "All Elements", icon: LayoutGrid, keywords: "elements modules add-ons install marketplace" },
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
  { href: "/settings/integrations", label: "Integrations", icon: Plug, keywords: "workspace xero sms twilio text bank holidays connect" },
  { href: "/import", label: "Import data", icon: FileUp, keywords: "workspace csv upload migrate" },
];

export function navForRole(role: string): {
  home: NavItem;
  groups: NavGroup[];
  /** Every sidebar page other than home, for search. */
  pages: NavItem[];
  workspace: NavItem[];
} {
  const allowed = (items: NavItem[]) => items.filter((i) => canAccess(role, i.href));
  const sections = NAV_SECTIONS.map((s) => ({ ...s, items: allowed(s.items) })).filter((s) => s.items.length > 0);
  const groups: NavGroup[] = (
    [
      { key: "pleasant", label: "Pleasant", links: allowed([HOME_ITEM]), sections },
      { key: "persona", label: "Persona", links: allowed(PERSONA_LINKS), sections: [] },
      { key: "elements", label: "Elements", links: allowed(ELEMENT_LINKS), sections: [] },
    ] satisfies NavGroup[]
  ).filter((g) => g.links.length + g.sections.length > 0);
  return {
    home: HOME_ITEM,
    groups,
    pages: groups.flatMap((g) => [...g.links, ...g.sections.flatMap((s) => s.items)]).filter((i) => i.href !== HOME_ITEM.href),
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
