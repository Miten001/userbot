/**
 * Transactional email via Resend.
 *
 * Fully optional: if RESEND_API_KEY isn't set, every call is a silent no-op so
 * the app works identically in demo mode. When configured, these helpers send
 * branded notifications for the key lifecycle moments (account ready, funded,
 * breached, payout updates).
 *
 * Set RESEND_API_KEY and EMAIL_FROM (e.g. "ApexFunded <noreply@yourdomain.com>")
 * to enable. All sends are best-effort and never throw into the caller.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const FROM = () => process.env.EMAIL_FROM || "ApexFunded <onboarding@resend.dev>";
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "https://apexfunded.example";

type SendArgs = { to: string; subject: string; html: string };

export async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  if (!isEmailConfigured() || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM(), to, subject, html }),
    });
    if (!res.ok) {
      console.warn("Resend send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Resend send error:", err);
    return false;
  }
}

/* ───────────────────────── templates ───────────────────────── */

function layout(heading: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  return `
  <div style="background:#050813;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <div style="max-width:520px;margin:0 auto;background:#0b1024;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="font-size:20px;font-weight:bold;color:#fff;">Apex<span style="color:#fbbf24;">Funded</span></span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 12px;font-size:22px;color:#fff;">${heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#cbd5e1;">${bodyHtml}</div>
        ${cta ? `<a href="${cta.href}" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#fde68a,#fbbf24,#f59e0b);color:#050813;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;">${cta.label}</a>` : ""}
      </div>
      <div style="padding:18px 28px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#64748b;">
        You're receiving this because you have an account with ApexFunded.
      </div>
    </div>
  </div>`;
}

const money = (n: number) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function notifyAccountReady(to: string, a: { login: string; password: string; server: string; size: number; step: string }) {
  return sendEmail({
    to,
    subject: "Your funded challenge account is ready 🎯",
    html: layout(
      "Your account is live",
      `Your <strong>${money(a.size)}</strong> ${a.step}-step evaluation has been provisioned. Log in to MetaTrader 5 with:
       <div style="margin-top:14px;padding:14px;background:rgba(255,255,255,0.03);border-radius:12px;font-family:monospace;">
         Login: <strong>${a.login}</strong><br/>Password: <strong>${a.password}</strong><br/>Server: <strong>${a.server}</strong>
       </div>
       <p style="margin-top:14px;">Good luck — trade within the daily and overall drawdown limits to pass.</p>`,
      { label: "Open dashboard", href: `${SITE()}/dashboard` },
    ),
  });
}

export function notifyFunded(to: string, a: { size: number }) {
  return sendEmail({
    to,
    subject: "Congratulations — you're now funded! 🏆",
    html: layout(
      "You passed the evaluation",
      `Your <strong>${money(a.size)}</strong> account is now <strong style="color:#34d399;">FUNDED</strong>. You can request profit withdrawals from your dashboard at any time.`,
      { label: "View funded account", href: `${SITE()}/dashboard` },
    ),
  });
}

export function notifyBreached(to: string, a: { reason: string }) {
  return sendEmail({
    to,
    subject: "Account breached — drawdown limit hit",
    html: layout(
      "Your account was breached",
      `Unfortunately a risk limit was hit and this account is now closed.<br/><br/>
       <span style="color:#fb7185;">${a.reason}</span><br/><br/>
       You can start a fresh challenge anytime.`,
      { label: "Start a new challenge", href: `${SITE()}/#plans` },
    ),
  });
}

export function notifyPayout(to: string, a: { amount: number; status: string }) {
  const map: Record<string, string> = {
    approved: "Your withdrawal has been approved and is being processed.",
    paid: "Your withdrawal has been paid out. 🎉",
    rejected: "Your withdrawal request was declined. Please contact support for details.",
  };
  return sendEmail({
    to,
    subject: `Withdrawal ${a.status}: ${money(a.amount)}`,
    html: layout(
      `Withdrawal ${a.status}`,
      `${map[a.status] ?? "Your withdrawal status was updated."}<br/><br/>Amount: <strong>${money(a.amount)}</strong>`,
      { label: "View withdrawals", href: `${SITE()}/dashboard` },
    ),
  });
}
