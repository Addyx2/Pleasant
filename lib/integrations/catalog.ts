// Every integration Pleasant offers or plans, in the order agencies need them.
// "live" ones can be connected today; "planned" ones are on the roadmap and
// show as such, so the page never claims a connection that doesn't exist.

export type IntegrationCategory = "accounting" | "messaging" | "payroll" | "compliance" | "data";

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  accounting: "Accounting",
  messaging: "Messaging carers",
  payroll: "Payroll & pensions",
  compliance: "Compliance checks",
  data: "Reference data",
};

export interface IntegrationDefinition {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  availability: "live" | "planned";
  /** How it connects: built in (always on), an OAuth sign-in, or pasted API keys. */
  connect?: "builtin" | "oauth" | "apiKey";
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    key: "xero",
    name: "Xero",
    category: "accounting",
    description: "Issued invoices and their clients go to Xero automatically, and payments recorded in Xero mark invoices paid here.",
    availability: "live",
    connect: "oauth",
  },
  { key: "quickbooks", name: "QuickBooks Online", category: "accounting", description: "Invoice and payment sync with QuickBooks.", availability: "planned" },
  { key: "sage", name: "Sage Accounting", category: "accounting", description: "Invoice and payment sync with Sage.", availability: "planned" },
  {
    key: "twilio",
    name: "Your own Twilio number (optional)",
    category: "messaging",
    description: "Your Pushbot already texts carers from a number of its own (Persona → Pushbots → Settings). Connect your own Twilio account only to send from a number you already have.",
    availability: "live",
    connect: "apiKey",
  },
  { key: "whatsapp", name: "WhatsApp Business", category: "messaging", description: "Shift offers and replies over WhatsApp.", availability: "planned" },
  { key: "hmrc-rti", name: "HMRC RTI", category: "payroll", description: "Submit FPS and EPS returns directly instead of downloading the file.", availability: "planned" },
  { key: "pensions", name: "NEST, People's Pension, Smart Pension", category: "payroll", description: "Send auto-enrolment contributions each pay run.", availability: "planned" },
  { key: "dbs", name: "DBS Update Service", category: "compliance", description: "Check a carer's DBS certificate is still current, automatically.", availability: "planned" },
  { key: "right-to-work", name: "Digital right to work", category: "compliance", description: "Certified identity checks (IDSP) and Home Office share codes.", availability: "planned" },
  {
    key: "bank-holidays",
    name: "UK bank holidays (GOV.UK)",
    category: "data",
    description: "Bank holiday pay and charge rates follow the official GOV.UK calendar for your nation, updated daily.",
    availability: "live",
    connect: "builtin",
  },
  { key: "postcodes", name: "Postcode lookup", category: "data", description: "Check postcodes and work out travel distance from carer to shift.", availability: "planned" },
];

export function integrationDef(key: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.key === key);
}
