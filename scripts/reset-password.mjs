// Reset the password on an already-configured instance. There's no in-app
// "change password" feature (`/api/setup` only ever works once), so this does
// the two steps by hand: clear the stored hash, then claim a new one.
//
//   node scripts/reset-password.mjs [--env <name>] <newPassword> <url> [setupKey]
//
// --env can be any environment that has an [env.<name>] block in wrangler.toml
// (e.g. demo, or a personal test sandbox like demo-2) — not just "demo".
// <url> is the deployed instance, e.g. https://family-grocery.<subdomain>.workers.dev
// setupKey is only needed if that instance has a SETUP_KEY secret set.

import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const envIndex = args.indexOf('--env');
const ENV = envIndex !== -1 ? args[envIndex + 1] : null;
if (ENV && !/^[a-z0-9-]+$/.test(ENV)) {
  console.error('--env must be lowercase letters, digits and hyphens only.');
  process.exit(1);
}
const rest = args.filter((_, i) => i !== envIndex && i !== envIndex + 1);
const [PASSWORD, URL, SETUP_KEY] = rest;

if (!PASSWORD || PASSWORD.length < 8 || !URL) {
  console.error('Usage: node scripts/reset-password.mjs [--env <name>] <newPassword (8+ chars)> <url> [setupKey]');
  process.exit(1);
}

const DB_NAME = ENV ? `family-grocery-${ENV}` : 'family-grocery';
const WRANGLER_ENV_FLAGS = ENV ? ['--env', ENV] : [];

const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(`This deletes the current password on ${DB_NAME} and sets a new one.`);
console.log('Anyone still using the old password will need the new one afterward.');
const answer = (await rl.question('Continue? [y/N] ')).trim().toLowerCase();
rl.close();
if (answer !== 'y' && answer !== 'yes') {
  console.log('Cancelled.');
  process.exit(0);
}

execFileSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    DB_NAME,
    '--remote',
    '--command',
    "DELETE FROM app_meta WHERE key='password_hash'",
    ...WRANGLER_ENV_FLAGS,
  ],
  { stdio: 'inherit' },
);

const body = JSON.stringify({ password: PASSWORD, ...(SETUP_KEY ? { key: SETUP_KEY } : {}) });
const res = await fetch(`${URL}/api/setup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
});

if (res.ok) {
  console.log('Password reset. Existing devices stay signed in; new logins need the new password.');
} else {
  console.error(`Could not set the new password (HTTP ${res.status}): ${await res.text()}`);
  process.exit(1);
}
