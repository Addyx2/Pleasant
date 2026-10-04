import { Skeleton } from "@/components/ui";

export default function WorkforceLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-full space-y-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-9 w-16 shrink-0 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
