/* Dumps question reports as CSV (decision Q11: no review UI). Usage: npx tsx scripts/export-reports.ts > reports.csv */
import { existsSync } from 'node:fs';
import pg from 'pg';

if (existsSync('.env.local') && !process.env.DATABASE_URL) process.loadEnvFile('.env.local');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `select question_id, count(*)::int as reports, string_agg(reason, ';' order by reason) as reasons
   from question_reports group by question_id order by reports desc, question_id`,
);
console.log('question_id,reports,reasons');
for (const row of r.rows) console.log(`${row.question_id},${row.reports},${row.reasons}`);
await c.end();
