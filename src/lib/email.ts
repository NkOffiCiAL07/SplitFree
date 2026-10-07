import { APP_NAME } from "@/lib/app-config";

/** Transactional email via Resend (https://resend.com). Inert until RESEND_API_KEY is set. */
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(opts: { title: string; text: string; ctaUrl: string; appName?: string }) {
  const app = opts.appName ?? APP_NAME;
  return `<!doctype html><html><body style="margin:0;background:#f6f5fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fff;border-radius:16px;padding:28px">
<tr><td style="font-size:13px;color:#7c3aed;font-weight:700">${escapeHtml(app)}</td></tr>
<tr><td style="font-size:20px;font-weight:700;color:#111827;padding-top:8px">${escapeHtml(opts.title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.5;color:#374151;padding-top:12px">${escapeHtml(opts.text)}</td></tr>
<tr><td style="padding-top:20px"><a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;border-radius:10px;padding:10px 18px">Open ${escapeHtml(app)}</a></td></tr>
<tr><td style="font-size:12px;color:#9ca3af;padding-top:24px">You get these because email notifications are on. Turn them off in Settings.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(opts: { to: string; subject: string; text: string; ctaPath: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.splitr.pro";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`,
        to: [opts.to],
        subject: opts.subject,
        text: `${opts.text}\n\n${appUrl}${opts.ctaPath}`,
        html: renderEmail({ title: opts.subject, text: opts.text, ctaUrl: `${appUrl}${opts.ctaPath}` }),
      }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
