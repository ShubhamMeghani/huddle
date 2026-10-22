/* Fake secret values used for builds and E2E so tests can prove they never leak (AC-6). */
export const SENTINELS = {
  ABLY_API_KEY: 'SNTLAPP.SNTLKEY:sentinel-ably-secret-d0-not-ship',
  AUTH_SECRET: 'sentinel-auth-secret-d0-not-ship-0123456789abcdef',
  AUTH_GOOGLE_SECRET: 'sentinel-google-secret-d0-not-ship',
} as const;

/** The parts that would be dangerous if they reached a browser. */
export const SENTINEL_NEEDLES = ['sentinel-ably-secret-d0-not-ship', SENTINELS.AUTH_SECRET, SENTINELS.AUTH_GOOGLE_SECRET];
