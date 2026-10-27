/**
 * Normalises a UK or international phone number to E.164 ("+447700900123").
 * Returns null when it can't be a mobile-capable number.
 */
export function toE164(raw: string | null | undefined, defaultCountry = "44"): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) {
    // "+44 (0)7700..." style: drop the trunk zero after the country code.
    digits = digits.replace(/^\+44\(?0\)?/, "+44").replace(/^\+440/, "+44");
  } else if (digits.startsWith("0")) {
    digits = `+${defaultCountry}${digits.slice(1)}`;
  } else {
    return null;
  }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** "+447700900123" → "07700 900123", for display. */
export function displayPhone(e164: string): string {
  if (e164.startsWith("+44") && e164.length === 13) return `0${e164.slice(3, 7)} ${e164.slice(7)}`;
  return e164;
}
