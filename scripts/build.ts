/* Production build with sentinel secrets, so the secret-leak scan (AC-6) is meaningful.
 * Server secrets are read at runtime, so the same build also serves `test:real`. */
import { spawnSync } from 'node:child_process';
import { SENTINELS } from '../tests/helpers/sentinels';

const env: NodeJS.ProcessEnv = { ...process.env, ...SENTINELS, AUTH_GOOGLE_ID: '' };
delete env.HUDDLE_TEST_MODE;
const r = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { env, stdio: 'inherit' });
process.exit(r.status ?? 1);
