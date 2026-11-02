import nodemailer, { type Transporter } from 'nodemailer';

// Sends through Brevo's SMTP relay. Settings come from the environment (see .env.example).
const g = globalThis as unknown as { __mailer?: Transporter };

export function emailConfigured() {
  return !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_KEY && process.env.EMAIL_FROM);
}

function transporter() {
  if (!g.__mailer) {
    const port = Number(process.env.BREVO_SMTP_PORT) || 587;
    g.__mailer = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port,
      secure: port === 465,
      auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_KEY }
    });
  }
  return g.__mailer;
}

export async function sendMail(m: { to: string; subject: string; html: string; text: string; fromName: string; replyTo?: string }) {
  if (!emailConfigured()) throw new Error('Email is not set up yet. Add the Brevo SMTP settings (BREVO_SMTP_USER, BREVO_SMTP_KEY, EMAIL_FROM).');
  await transporter().sendMail({
    from: { name: m.fromName, address: process.env.EMAIL_FROM! },
    to: m.to,
    replyTo: m.replyTo || undefined,
    subject: m.subject,
    html: m.html,
    text: m.text
  });
}

// Where invoice links point. APP_URL wins; the caller's own origin is the fallback for manual sends.
export function appUrl(fallbackOrigin?: string) {
  const v = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : fallbackOrigin);
  return v ? v.replace(/\/$/, '') : null;
}
