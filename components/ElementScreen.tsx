import { ElementsError, elementScreenUrl } from "@/lib/elements";

/**
 * Shows an Element's screen from the Elements console inside Pleasant. The
 * address is signed for this user and only works for five minutes, so it is
 * fetched fresh on every visit.
 */
export async function ElementScreen({
  installationId,
  user,
  title,
  className = "h-[calc(100dvh-11rem)] min-h-[560px]",
}: {
  installationId: string;
  user: { id: string; name: string; role: "manager" | "member"; personId?: string };
  title: string;
  className?: string;
}) {
  let url: string | null = null;
  let problem: string | null = null;
  try {
    url = await elementScreenUrl(installationId, user);
  } catch (error) {
    problem = error instanceof ElementsError ? error.message : "This screen couldn't be loaded. Try again in a minute.";
    if (!(error instanceof ElementsError)) console.error("element screen failed", error);
  }
  if (!url) {
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {problem}
      </div>
    );
  }
  return (
    <iframe
      src={url}
      title={title}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50 ${className}`}
      allow="clipboard-write"
      referrerPolicy="no-referrer"
    />
  );
}
