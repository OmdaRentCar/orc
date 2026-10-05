import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// Error alerts from visitors' browsers. Does nothing until VITE_SENTRY_DSN is set.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p style={{ padding: 24, color: '#f0ede8' }}>Something went wrong. Please reload the page.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
