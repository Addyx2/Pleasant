"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { activeHref, navForRole, type NavItem, type NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { useSidebar } from "./SidebarShell";

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onNavigate}
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
      {Icon ? (
        <Icon
          className={cn(
            "h-4 w-4 transition-colors duration-150",
            active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600",
          )}
        />
      ) : null}
      {item.label}
    </Link>
  );
}

function Section({ section, current }: { section: NavSection; current: string | null }) {
  const { closed, toggleSection } = useSidebar();
  const open = !closed.has(section.key);
  const holdsActive = section.items.some((i) => i.href === current);
  const listId = `nav-${section.key}`;
  return (
    <div>
      <button
        type="button"
        onClick={() => toggleSection(section.key)}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition duration-150 hover:bg-slate-100",
          holdsActive && !open ? "text-brand-900" : "text-slate-800",
        )}
      >
        <section.icon
          className={cn("h-4 w-4 transition-colors", holdsActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600")}
        />
        <span className="flex-1 text-left">{section.title}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-slate-400 transition-transform duration-150", !open && "-rotate-90")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div id={listId} className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} active={current === item.href} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const railButton = (active: boolean) =>
  cn(
    "flex h-9 w-9 items-center justify-center rounded-lg transition duration-150",
    active ? "bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/10" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  );

/** Icon-only sidebar: each section opens a fly-out with its features on hover, focus or click. */
function RailNav({ home, sections, current }: { home: NavItem; sections: NavSection[]; current: string | null }) {
  const pathname = usePathname();
  const [fly, setFly] = useState<{ key: string; top: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setFly(null), 150);
  };
  const openFor = (section: NavSection, target: HTMLElement) => {
    cancelClose();
    const rect = target.getBoundingClientRect();
    const height = 44 + section.items.length * 34;
    setFly({ key: section.key, top: Math.max(8, Math.min(rect.top - 6, window.innerHeight - height - 8)) });
  };

  useEffect(() => setFly(null), [pathname]);
  useEffect(() => cancelClose, []);

  const HomeIcon = home.icon;
  return (
    <nav aria-label="Main" className="flex flex-col items-center gap-1">
      <Link
        href={home.href}
        prefetch={false}
        aria-label={home.label}
        title={home.label}
        aria-current={current === home.href ? "page" : undefined}
        className={railButton(current === home.href)}
      >
        {HomeIcon ? <HomeIcon className="h-4 w-4" /> : null}
      </Link>
      {sections.map((section) => {
        const isOpen = fly?.key === section.key;
        const holdsActive = section.items.some((i) => i.href === current);
        return (
          <div
            key={section.key}
            onMouseLeave={scheduleClose}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFly(null);
            }}
          >
            <button
              type="button"
              aria-label={section.title}
              aria-expanded={isOpen}
              onMouseEnter={(e) => openFor(section, e.currentTarget)}
              onFocus={(e) => openFor(section, e.currentTarget)}
              onClick={(e) => openFor(section, e.currentTarget)}
              className={railButton(holdsActive)}
            >
              <section.icon className="h-4 w-4" />
            </button>
            {isOpen ? (
              <div
                onMouseEnter={cancelClose}
                style={{ top: fly.top }}
                className="fixed left-[4.5rem] z-40 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop"
              >
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} active={current === item.href} onNavigate={() => setFly(null)} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AppNav({ role, allowRail = false }: { role: string; allowRail?: boolean }) {
  const pathname = usePathname();
  const { rail } = useSidebar();
  const { home, sections } = navForRole(role);
  const current = activeHref(pathname, [home.href, ...sections.flatMap((s) => s.items.map((i) => i.href))]);

  if (allowRail && rail) return <RailNav home={home} sections={sections} current={current} />;

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      <NavLink item={home} active={current === home.href} />
      {sections.map((section) => (
        <Section key={section.key} section={section} current={current} />
      ))}
    </nav>
  );
}
