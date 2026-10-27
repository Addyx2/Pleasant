import { cn } from "@/lib/utils";

// Brand images are masks painted in the current colour, so one file serves every theme.
const mask = (src: string) => ({ WebkitMask: `url(${src}) center / contain no-repeat`, mask: `url(${src}) center / contain no-repeat` });

/** The Aultrum wordmark. Set its height; the width follows. */
export function AultrumLogo({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block aspect-[3251/638] bg-current", className)} style={mask("/brand/aultrum.svg")} />;
}

/** Pleasant's app mark: the Aultrum "a" on a purple tile. */
export function AppMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 [print-color-adjust:exact] bg-gradient-to-b from-brand-500 to-brand-700 shadow-btn", className)}>
      <span className="h-[55%] w-[55%] bg-white [print-color-adjust:exact]" style={mask("/brand/aultrum-mark.svg")} />
    </span>
  );
}
