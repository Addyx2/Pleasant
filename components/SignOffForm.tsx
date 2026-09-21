"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, PenLine, X } from "lucide-react";

import { buttonClass, inputClass, labelClass, subtleButtonClass } from "./ui";

/**
 * Full-screen e-signature capture. Used for the carer's own sign-off and for
 * the client's authorisation signature — the digital twin of the paper form's
 * signature boxes.
 */
export function SignOffForm({
  timesheetId,
  mode,
  action,
  buttonLabel,
  title,
  subtitle,
}: {
  timesheetId: string;
  mode: "candidate" | "client";
  action: (formData: FormData) => Promise<void>;
  buttonLabel: string;
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";

    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (canvas && wrap) {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#0f172a";
      }

      const pos = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const down = (e: PointerEvent) => {
        e.preventDefault();
        drawing.current = true;
        last.current = pos(e);
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // ignore — mouse input works without capture
        }
      };
      const move = (e: PointerEvent) => {
        if (!drawing.current) return;
        e.preventDefault();
        const context = canvas.getContext("2d");
        if (!context) return;
        const p = pos(e);
        context.beginPath();
        context.moveTo(last.current.x, last.current.y);
        context.lineTo(p.x, p.y);
        context.stroke();
        last.current = p;
        hasDrawn.current = true;
      };
      const up = () => {
        drawing.current = false;
      };

      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);

      return () => {
        document.body.style.overflow = "";
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
      };
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open ]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    hasDrawn.current = false;
    setError(null);
  };

  const save = async () => {
    if (mode === "client") {
      if (!name.trim()) {
        setError("Enter the signatory's name");
        return;
      }
      if (!position.trim()) {
        setError("Enter the signatory's position");
        return;
      }
    }
    if (!hasDrawn.current || !canvasRef.current) {
      setError("Please sign in the box first");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("timesheetId", timesheetId);
      formData.set("signature", canvasRef.current.toDataURL("image/png"));
      if (mode === "client") {
        formData.set("name", name.trim());
        formData.set("position", position.trim());
      }
      await action(formData);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save the signature — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        <PenLine className="h-4 w-4" /> {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {mode === "client" ? (
            <div className="grid gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-2 sm:px-6">
              <div>
                <label className={labelClass} htmlFor={`auth-name-${timesheetId}`}>
                  Signatory name
                </label>
                <input
                  id={`auth-name-${timesheetId}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. J. Whitfield"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`auth-position-${timesheetId}`}>
                  Position
                </label>
                <input
                  id={`auth-position-${timesheetId}`}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Home Manager"
                  autoComplete="off"
                />
              </div>
            </div>
          ) : null}

          <div ref={wrapRef} className="relative min-h-0 flex-1 bg-slate-50 p-4 sm:p-6">
            <canvas
              ref={canvasRef}
              className="h-full w-full touch-none rounded-2xl border-2 border-dashed border-slate-300 bg-white shadow-inner"
            />
            <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate-300">
              Sign here with your finger or mouse
            </p>
          </div>

          {error ? (
            <p className="border-t border-slate-200 bg-red-50 px-4 py-2 text-sm text-red-700 sm:px-6">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-6">
            <button type="button" onClick={clear} className={subtleButtonClass}>
              <Eraser className="h-4 w-4" /> Clear
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={subtleButtonClass}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="button" onClick={save} className={buttonClass} disabled={saving}>
                {saving ? "Saving…" : "Save signature"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
