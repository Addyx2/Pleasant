"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Loader2, Search, Zap } from "lucide-react";

import { searchAction, type SearchResult } from "@/app/(app)/search/actions";
import { navForRole, quickActionsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Entry {
  key: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  haystack: string;
}

export const OPEN_PALETTE_EVENT = "pleasant:open-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

export function CommandPalette({ role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, startSearch] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const staticEntries = useMemo<Entry[]>(() => {
    const { home, sections } = navForRole(role);
    const pages = [home, ...sections.flatMap((s) => s.items)].map((item) => ({
      key: `page:${item.href}`,
      group: "Go to",
      label: item.label,
      href: item.href,
      haystack: `${item.label} ${item.keywords ?? ""}`.toLowerCase(),
    }));
    const actions = quickActionsForRole(role).map((a) => ({
      key: `action:${a.label}`,
      group: "Actions",
      label: a.label,
      href: a.href,
      haystack: `${a.label} ${a.keywords ?? ""}`.toLowerCase(),
    }));
    return [...actions, ...pages];
  }, [role]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? staticEntries.filter((e) => q.split(/\s+/).every((word) => e.haystack.includes(word)))
      : staticEntries;
    const records = results.map((r) => ({
      key: `${r.kind}:${r.id}`,
      group: `${r.kind}s`,
      label: r.title,
      hint: r.subtitle,
      href: r.href,
      haystack: "",
    }));
    return [...records, ...matched];
  }, [query, results, staticEntries]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelected(0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Debounced record search; static pages and actions filter instantly.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startSearch(async () => {
        try {
          setResults(await searchAction(q));
        } catch {
          setResults([]);
        }
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [open, query]);

  useEffect(() => setSelected(0), [query, results]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    close();
    router.push(entry.href);
  };

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          {searching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((i) => Math.min(i + 1, entries.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(entries[selected]);
              }
            }}
            placeholder="Search workers, clients, shifts, invoices — or jump to a page"
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={entries[selected] ? `cmd-${selected}` : undefined}
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
            ESC
          </kbd>
        </div>

        <ul ref={listRef} id="command-list" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {entries.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-slate-500">
              {searching ? "Searching…" : `No matches for “${query}”`}
            </li>
          ) : (
            entries.map((entry, index) => {
              const header = entry.group !== lastGroup ? entry.group : null;
              lastGroup = entry.group;
              return (
                <li key={entry.key} role="none">
                  {header ? (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {header}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    id={`cmd-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === selected}
                    onMouseMove={() => setSelected(index)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                      index === selected ? "bg-brand-50 text-brand-900" : "text-slate-700",
                    )}
                  >
                    {entry.group === "Actions" ? (
                      <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.label}</span>
                      {entry.hint ? (
                        <span className="block truncate text-xs text-slate-500">{entry.hint}</span>
                      ) : null}
                    </span>
                    {index === selected ? <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-500">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span className="ml-auto">⌘K / Ctrl K anywhere</span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-left text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white",
        className,
      )}
    >
      <Search className="h-4 w-4" />
      <span className="flex-1">Search…</span>
      <kbd className="rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400">⌘K</kbd>
    </button>
  );
}
