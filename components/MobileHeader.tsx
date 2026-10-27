"use client";

import { useState } from "react";
import { Menu, Search, X } from "lucide-react";

import { AccountMenu } from "./AccountMenu";
import { AppNav } from "./AppNav";
import { openCommandPalette } from "./CommandPalette";
import { AppMark } from "@/components/Brand";

interface MobileHeaderProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    agency: {
      name: string;
    };
  };
}

export function MobileHeader({ user }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3.5 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          <AppMark className="h-9 w-9" />
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-tight text-slate-900">Pleasant</p>
            <p className="truncate text-xs text-slate-500 max-w-[160px]">{user.agency.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay & Sliding Panel */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />

          {/* Sliding Panel */}
          <div className="fixed inset-y-0 right-0 flex w-full max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <AppMark className="h-8 w-8" />
                <div>
                  <p className="font-display text-sm font-bold text-slate-900">Pleasant</p>
                  <p className="truncate text-xs text-slate-500 max-w-[140px]">
                    {user.agency.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4"
              onClick={(e) => {
                // Close after following a link; section toggles keep the drawer open.
                if ((e.target as HTMLElement).closest("a")) setIsOpen(false);
              }}
            >
              <AppNav role={user.role} />
            </div>

            <div
              className="border-t border-slate-200 p-3"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setIsOpen(false);
              }}
            >
              <AccountMenu
                user={{
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  role: user.role,
                  agencyName: user.agency.name,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
