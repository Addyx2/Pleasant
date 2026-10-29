import { Building2 } from "lucide-react";

/**
 * In place of "get their signature" when the home signs in Aultrum Workspace:
 * the button greyed out, and why.
 */
export function WorkspaceSignNote({ home }: { home: string }) {
  return (
    <div className="space-y-1.5">
      <button type="button" disabled aria-disabled="true" className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400">
        <Building2 className="h-4 w-4" /> Their signature: in Aultrum Workspace
      </button>
      <p className="text-center text-xs text-slate-500">{home} signs your timesheets in Aultrum Workspace. It shows as signed here once they have.</p>
    </div>
  );
}
