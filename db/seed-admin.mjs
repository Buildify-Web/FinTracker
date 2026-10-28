// Creates (or updates the password of) the single founder login from
// ADMIN_EMAIL / ADMIN_PASSWORD in the environment. Run after `npm run migrate`.
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

if (!email || !password) {
  // Runs automatically on every Vercel build (see package.json's vercel-build
  // script) — skip quietly rather than failing the deploy if these haven't
  // been added to the project's env vars yet.
  console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed. Set them and redeploy to create your login.');
  process.exit(0);
}

const client = new pg.Client({ connectionString, ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });

async function main() {
  await client.connect();
  const hash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, 'Founder', 'owner')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email.toLowerCase(), hash]
  );
  console.log(`Admin user ready: ${email}`);
  await client.end();
}

main().catch((err) => {
  console.error('Seeding admin failed:', err.message);
  process.exit(1);
});
