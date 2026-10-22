import { inject } from 'vitest';

// Unit tests never touch .env.local: they get a throwaway database and the local realtime driver.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.REALTIME_DRIVER = 'local';
process.env.HUDDLE_TEST_MODE = '1';
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
