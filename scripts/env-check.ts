/* Prints required variable NAMES with set/MISSING. Never prints values (PLAN rule 3). */
import { existsSync } from 'node:fs';

const REQUIRED = ['DATABASE_URL', 'ABLY_API_KEY', 'AUTH_SECRET'];
const OPTIONAL = ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'];

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
else console.log('.env.local: MISSING');

let missing = 0;
for (const k of REQUIRED) {
  const set = Boolean(process.env[k]);
  if (!set) missing++;
  console.log(`${k}: ${set ? 'set' : 'MISSING'}`);
}
for (const k of OPTIONAL) console.log(`${k}: ${process.env[k] ? 'set' : 'not set (optional; added after H5)'}`);
process.exit(missing ? 1 : 0);
