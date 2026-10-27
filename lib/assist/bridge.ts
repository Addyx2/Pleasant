// Calls the app's existing server actions on Assist's behalf, so every change
// Assist makes goes through exactly the same permission checks, validation
// and audit logging as the buttons in the UI.

export type FormFields = Record<string, string | number | boolean | null | undefined>;

export interface ActionOutcome {
  /** Error message returned by an action that reports one (useActionState style). */
  error?: string;
  success?: string;
  /** Where the action redirected to, if it finished with redirect(). */
  redirectedTo?: string;
}

export function toFormData(fields: FormFields): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === false) continue;
    form.set(key, value === true ? "on" : String(value));
  }
  return form;
}

/**
 * Next.js signals redirect() by throwing an error whose digest is
 * `NEXT_REDIRECT;<type>;<url>;<status>;`. An action that redirects has
 * finished successfully, so report where it went instead of failing.
 */
export function redirectTarget(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("digest" in error)) return null;
  const digest = (error as { digest: unknown }).digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;")) return null;
  const parts = digest.split(";");
  return parts.slice(2, -2).join(";") || "/";
}

type FormAction = (formData: FormData) => Promise<unknown>;
type StateAction = (prev: { error?: string; success?: string }, formData: FormData) => Promise<unknown>;

async function settle(run: () => Promise<unknown>): Promise<ActionOutcome> {
  try {
    const result = await run();
    if (result && typeof result === "object") {
      const { error, success } = result as { error?: unknown; success?: unknown };
      return {
        error: typeof error === "string" ? error : undefined,
        success: typeof success === "string" ? success : undefined,
      };
    }
    return {};
  } catch (error) {
    const to = redirectTarget(error);
    if (to !== null) return { redirectedTo: to };
    throw error;
  }
}

/** Run a `(formData) => void` server action. */
export function runFormAction(action: FormAction, fields: FormFields): Promise<ActionOutcome> {
  return settle(() => action(toFormData(fields)));
}

/** Run a `(prevState, formData) => state` server action (the useActionState shape). */
export function runStateAction(action: StateAction, fields: FormFields): Promise<ActionOutcome> {
  return settle(() => action({}, toFormData(fields)));
}
