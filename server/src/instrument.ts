import * as Sentry from '@sentry/node';

// Error alerts. Does nothing until SENTRY_DSN is set. Must be imported before anything else in index.ts.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
  });
}
