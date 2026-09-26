import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './test/globalSetup.ts',
    // One database, so test files must not run at the same time
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://sabriii@localhost/omda_test?host=/var/run/postgresql',
      // Emails are skipped and uploads are never attempted in tests
      SMTP_USER: '',
      SMTP_PASS: '',
      TURNSTILE_SECRET_KEY: '',
      SENTRY_DSN: '',
    },
  },
});
