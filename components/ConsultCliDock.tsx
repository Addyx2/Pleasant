"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, Send, X, ChevronUp, ChevronDown, Sparkles, AlertCircle } from "lucide-react";

export function ConsultCliDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<{ query: string; response: string; timestamp: string }[]>([
    {
      query: "consult status",
      response: "🟢 Agents Online | Pushbots: 3 Running | Shifts Triage: Active | Oversight: Clear",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const cmdLower = command.toLowerCase().trim();
    let responseText = "Command executed successfully.";

    if (cmdLower.includes("triage") || cmdLower.includes("unattended")) {
      responseText = "🚨 Emergency Triage Initiated: Scanned 2 unattended shifts. Pushbots dispatched WhatsApp offers to 5 top-ranked RN candidates.";
    } else if (cmdLower.includes("list open") || cmdLower.includes("open shifts")) {
      responseText = "📅 Found 4 Open Shifts: Shift #8402 (RN - Metro Health), Shift #8403 (Carer - St. Jude), Shift #8405 (Driver), Shift #8406 (Support Worker).";
    } else if (cmdLower.includes("clientpoint") || cmdLower.includes("complaints")) {
      responseText = "🏢 Clientpoint Status: 1 Pending Complaint at Site B. Client Confidence Rating: 4.85/5.00.";
    } else if (cmdLower.includes("payroll") || cmdLower.includes("export")) {
      responseText = "💳 Payroll Sync: 128 completed shifts verified and ready for ADP export.";
    } else {
      responseText = `⚡ Consult Agent: Processed command "${command}". Target updated across Workforce, Shifts & Clientpoint.`;
    }

    setHistory((prev) => [
      ...prev,
      {
        query: command,
        response: responseText,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setCommand("");
  };

  return (
    <div className="fixed bottom-0 right-4 z-50 w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-t-xl shadow-2xl text-gray-100 font-mono text-xs transition-all duration-300">
      {/* Dock Bar Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-2.5 bg-gray-950/80 hover:bg-gray-950 cursor-pointer rounded-t-xl border-b border-gray-800 select-none"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold tracking-wide text-gray-200">CONSULT CLI</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800">
            AGENTS ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-[11px] hidden sm:inline">Press Ctrl+K to toggle</span>
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Terminal Body */}
      {isOpen && (
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto bg-gray-950/95">
          {/* Output Logs */}
          <div className="space-y-2">
            {history.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-emerald-400 font-bold">&gt;</span>
                  <span>{item.query}</span>
                  <span className="ml-auto text-[10px] text-gray-600">{item.timestamp}</span>
                </div>
                <div className="pl-4 text-gray-300 bg-gray-900/60 p-2 rounded border border-gray-850">
                  {item.response}
                </div>
              </div>
            ))}
          </div>

          {/* Prompt Bar */}
          <form onSubmit={handleExecute} className="flex items-center gap-2 pt-2 border-t border-gray-800">
            <span className="text-emerald-400 font-bold">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Type a command... (e.g., 'triage unattended', 'list open shifts', 'export payroll')"
              className="flex-1 bg-transparent text-gray-100 focus:outline-none placeholder-gray-600 text-xs"
            />
            <button
              type="submit"
              className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
