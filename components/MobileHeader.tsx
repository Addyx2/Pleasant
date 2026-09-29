"use client";

import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { AppNav } from "./AppNav";
import { logoutAction } from "@/app/login/actions";
import { initials } from "@/lib/utils";

interface MobileHeaderProps {
  user: {
    firstName: string;
    lastName: string;
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
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 text-sm font-bold text-white shadow-btn">
            P
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-tight text-slate-900">
              Pleasant
            </p>
            <p className="truncate text-xs text-slate-500 max-w-[160px]">{user.agency.name}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
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
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                  P
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-slate-900">Pleasant</p>
                  <p className="truncate text-xs text-slate-500 max-w-[140px]">{user.agency.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4" onClick={() => setIsOpen(false)}>
              <AppNav />
            </div>

            <div className="border-t border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3 px-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/10">
                  {initials(user.firstName, user.lastName)}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user.role.toLowerCase()}</p>
                </div>
              </div>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                >
                  <LogOut className="h-4 w-4 text-slate-500" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
