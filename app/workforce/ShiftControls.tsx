"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

/**
 * Clock in, sending the phone's location if the carer allows it. If location
 * is refused or slow, the clock-in still goes through without it.
 */
export function ClockInButton({ shiftId, breakMins, action }: { shiftId: string; breakMins: number; action: (formData: FormData) => Promise<void> }) {
  const form = useRef<HTMLFormElement>(null);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: string; lng: string; accuracy: string } | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (coords && ready.current) form.current?.requestSubmit();
  }, [coords]);

  function start(event: React.FormEvent<HTMLFormElement>) {
    if (ready.current) return; // second pass: let the form submit
    event.preventDefault();
    setLocating(true);
    const submit = (c: { lat: string; lng: string; accuracy: string }) => {
      ready.current = true;
      setCoords(c);
    };
    if (!("geolocation" in navigator)) return submit({ lat: "", lng: "", accuracy: "" });
    navigator.geolocation.getCurrentPosition(
      (p) => submit({ lat: String(p.coords.latitude), lng: String(p.coords.longitude), accuracy: String(p.coords.accuracy) }),
      () => submit({ lat: "", lng: "", accuracy: "" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <form ref={form} action={action} onSubmit={start}>
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="breakMins" value={breakMins} />
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <input type="hidden" name="accuracy" value={coords?.accuracy ?? ""} />
      <button type="submit" disabled={locating} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-4 text-base font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-80">
        <MapPin className="h-5 w-5" />
        {locating ? "Clocking in…" : "Clock in"}
      </button>
    </form>
  );
}

/** "2h 05m" since a moment, ticking every half minute. */
export function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  return <span className="tabular-nums">{Math.floor(mins / 60)}h {String(mins % 60).padStart(2, "0")}m</span>;
}
