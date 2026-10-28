import crypto from 'node:crypto';
import { query, queryOne } from './db';

const OTP_TTL_MINUTES = 5;

// Mock mode: no SMS provider is called, and the generated code is returned
// directly in the request API response so the UI can show it. Flip this to
// 'live' (and wire StartMessaging's send call where noted below) once real
// SMS sending is wanted — nothing else about the flow changes.
export const OTP_MODE: 'mock' | 'live' = 'mock';

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export async function requestOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!/^\+?\d{8,15}$/.test(phone)) {
    throw new Error('Enter a valid phone number, with country code.');
  }
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate any still-open codes for this number so only the latest works.
  await query('UPDATE otp_codes SET consumed = true WHERE phone_number = $1 AND consumed = false', [phone]);
  await query('INSERT INTO otp_codes (phone_number, code_hash, expires_at) VALUES ($1, $2, $3)', [phone, hashCode(code), expiresAt]);

  if (OTP_MODE === 'live') {
    // TODO: call StartMessaging's send-SMS API here with STARTMESSAGING_API_KEY,
    // and stop returning `code` from this function.
  }

  return { phone, code, mock: OTP_MODE === 'mock', expiresInMinutes: OTP_TTL_MINUTES };
}

export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM otp_codes
     WHERE phone_number = $1 AND code_hash = $2 AND consumed = false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, hashCode(code)]
  );
  if (!row) return null;
  await query('UPDATE otp_codes SET consumed = true WHERE id = $1', [row.id]);

  // Single-founder app: attach this phone to the existing owner account if
  // none has it yet (first successful OTP "claims" phone login for the
  // founder); otherwise it must match the account that already owns it.
  let user = await queryOne<{ id: string; email: string; name: string }>(
    'SELECT id, email, name FROM users WHERE phone_number = $1',
    [phone]
  );
  if (!user) {
    user = await queryOne<{ id: string; email: string; name: string }>(
      `UPDATE users SET phone_number = $1
       WHERE id = (SELECT id FROM users WHERE phone_number IS NULL ORDER BY created_at LIMIT 1)
       RETURNING id, email, name`,
      [phone]
    );
  }
  return user;
}
