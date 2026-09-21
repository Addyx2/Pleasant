import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "slate";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  slate: "bg-slate-200 text-slate-700",
  brand: "bg-brand-100 text-brand-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-700",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {Icon ? <Icon className="h-5 w-5 text-brand-500" /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export const labelClass = "block text-sm font-medium text-slate-700";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60";

export const subtleButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-sm text-slate-700", className)}>{children}</td>;
}
