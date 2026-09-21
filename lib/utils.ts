import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Numeric = number | string | { toString(): string } | null | undefined;

export function formatCurrency(value: Numeric): string {
  const amount =
    value === null || value === undefined
      ? 0
      : typeof value === "object"
        ? Number(value.toString())
        : Number(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatHours(mins: number): string {
  if (!mins) return "0h";
  const hours = Math.floor(mins / 60);
  const minutes = Math.round(mins % 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export function shiftDurationMins(startAt: Date, endAt: Date): number {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
}
