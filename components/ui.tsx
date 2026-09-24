import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "slate";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-50 text-slate-600 ring-slate-500/10",
  slate: "bg-slate-100 text-slate-600 ring-slate-600/10",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-card",
        interactive &&
          "transition duration-150 hover:border-slate-300 hover:shadow-card-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TILE_TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  slate: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  blue: "bg-sky-50 text-sky-600",
};

export function IconTile({
  icon: Icon,
  tone = "brand",
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/[0.04]",
        TILE_TONES[tone],
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
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
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-slate-500">{description}</p> : null}
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
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? <IconTile icon={Icon} tone={tone} /> : null}
      </div>
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
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

export const labelClass = "block text-sm font-medium text-slate-700";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition duration-150 hover:bg-brand-700 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60";

export const subtleButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60";

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3 align-middle text-sm text-slate-700", className)}>
      {children}
    </td>
  );
}