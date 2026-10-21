"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeHref, navForRole, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition duration-150",
        active
          ? "bg-brand-50 font-semibold text-brand-900 ring-1 ring-inset ring-brand-600/10"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-brand-500 transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />
      <item.icon
        className={cn(
          "h-4 w-4 transition-colors duration-150",
          active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600",
        )}
      />
      {item.label}
    </Link>
  );
}

export function AppNav({ role }: { role: string }) {
  const pathname = usePathname();
  const { home, sections } = navForRole(role);
  const current = activeHref(pathname, [home.href, ...sections.flatMap((s) => s.items.map((i) => i.href))]);

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      <NavLink item={home} active={current === home.href} />
      {sections.map((section) => (
        <div key={section.title} className="space-y-0.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {section.title}
          </p>
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} active={current === item.href} />
          ))}
        </div>
      ))}
    </nav>
  );
}
