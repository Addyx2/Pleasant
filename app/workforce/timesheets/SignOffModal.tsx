"use client";

import React, { useRef, useState } from "react";
import { PenTool, CheckCircle2, X, ShieldCheck, MapPin } from "lucide-react";

interface SignOffModalProps {
  timesheetId: string;
  shiftTitle: string;
  clientName: string;
  hoursWorked: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignOffModal({
  timesheetId,
  shiftTitle,
  clientName,
  hoursWorked,
  isOpen,
  onClose,
  onSuccess,
}: SignOffModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryRole, setSignatoryRole] = useState("Ward Sister / Unit Manager");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Canvas drawing handlers for touch and mouse
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSigned(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleConfirm = async () => {
    if (!signatoryName.trim()) {
      alert("Please enter the name of the authorising manager / nurse.");
      return;
    }
    if (!hasSigned) {
      alert("Please have the site manager provide their on-screen signature.");
      return;
    }

    setSubmitting(true);
    // Simulated server action sign-off
    setTimeout(() => {
      setSubmitting(false);
      onSuccess();
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                Agency Shift
              </span>
              <span className="text-xs text-slate-400">On-Glass Sign-Off</span>
            </div>
            <h3 className="font-bold text-slate-900 mt-1">Client Authorisation</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shift Summary */}
        <div className="my-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Shift Details</p>
          <p className="font-bold text-slate-900 text-sm">{shiftTitle}</p>
          <p className="text-xs text-slate-600 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-slate-400" /> {clientName}
          </p>
          <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 mt-2 text-xs">
            <span className="text-slate-500">Verified Total:</span>
            <span className="font-bold text-slate-900">{hoursWorked}</span>
          </div>
        </div>

        {/* Manager Input */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Signatory Full Name
            </label>
            <input
              type="text"
              placeholder="e.g. Sister Sarah Jenkins"
              value={signatoryName}
              onChange={(e) => setSignatoryName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Position / Job Title
            </label>
            <input
              type="text"
              value={signatoryRole}
              onChange={(e) => setSignatoryRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Signature Canvas */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <PenTool className="h-3.5 w-3.5 text-brand-600" /> Sign on Screen Below
              </label>
              {hasSigned && (
                <button onClick={clearCanvas} className="text-[11px] text-red-500 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 touch-none">
              <canvas
                ref={canvasRef}
                width={360}
                height={120}
                className="w-full h-[120px] rounded-2xl cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSigned && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                  Site Manager signs with finger here
                </div>
              )}
            </div>
          </div>
        </div>

        {/* GPS Verification Badge */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>GPS Geofence confirmed on-site at {clientName}.</span>
        </div>

        {/* Action Button */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-sm font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="flex-1 py-3 text-sm font-bold text-white rounded-xl bg-slate-900 hover:bg-slate-800 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting ? "Signing Off..." : "Approve & Sign Off"}
            {!submitting && <CheckCircle2 className="h-4 w-4" />}
          </button>
        </div>

      </div>
    </div>
  );
}
