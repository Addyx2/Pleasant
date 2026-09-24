const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Pleasant <set-password@pleasant.app>";

export interface EmailResult {
  delivered: boolean;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<EmailResult> {
  if (!RESEND_KEY) return { delivered: false };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: input.to, subject: input.subject, text: input.text }),
    });
    return { delivered: res.ok };
  } catch {
    return { delivered: false };
  }
}