"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { CLOSED_COOKIE, RAIL_COOKIE } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

interface SidebarState {
  rail: boolean;
  toggleRail: () => void;
  closed: ReadonlySet<string>;
  toggleSection: (key: string) => void;
}

const SidebarContext = createContext<SidebarState>({
  rail: false,
  toggleRail: () => {},
  closed: new Set(),
  toggleSection: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

function saveCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function SidebarShell({
  initialRail,
  initialClosed,
  children,
}: {
  initialRail: boolean;
  initialClosed: string[];
  children: React.ReactNode;
}) {
  const [rail, setRail] = useState(initialRail);
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set(initialClosed));

  const toggleRail = useCallback(() => {
    setRail((r) => {
      saveCookie(RAIL_COOKIE, r ? "0" : "1");
      return !r;
    });
  }, []);

  const toggleSection = useCallback((key: string) => {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveCookie(CLOSED_COOKIE, [...next].join(","));
      return next;
    });
  }, []);

  // ⌘\ / Ctrl+\ collapses or expands the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleRail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRail]);

  const value = useMemo(() => ({ rail, toggleRail, closed, toggleSection }), [rail, toggleRail, closed, toggleSection]);

  return (
    <SidebarContext.Provider value={value}>
      <div data-sidebar={rail ? "rail" : "full"} className="group/shell">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function SidebarToggle({ className }: { className?: string }) {
  const { rail, toggleRail } = useSidebar();
  const label = rail ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={toggleRail}
      aria-label={label}
      title={`${label} (⌘\\)`}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
        className,
      )}
    >
      {rail ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}
