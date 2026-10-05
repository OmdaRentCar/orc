// The company running the platform (shown on invoices, platform emails and the marketing site)
export const platform = () => ({
  name: process.env.PLATFORM_NAME || 'RentCar',
  company: process.env.PLATFORM_COMPANY || process.env.PLATFORM_NAME || 'RentCar',
  address: process.env.PLATFORM_ADDRESS || 'Tunis, Tunisie',
  taxId: process.env.PLATFORM_TAX_ID || '',
  email: process.env.PLATFORM_EMAIL || process.env.SMTP_USER || 'contact@example.com',
  vatPct: Number(process.env.PLATFORM_VAT_PCT ?? 19),
  // Where the marketing site, sign-up and console live, e.g. https://rentcar.tn
  url: (process.env.PLATFORM_URL || 'http://app.localhost:5173').replace(/\/$/, ''),
  // Public address of this API, for payment webhooks, e.g. https://api.rentcar.tn
  apiUrl: (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, ''),
});

// Sub-domains that can never be an agency's address
export const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'console', 'platform', 'mail', 'smtp', 'imap', 'pop', 'ftp', 'static', 'cdn', 'assets',
  'help', 'support', 'blog', 'docs', 'status', 'explore', 'marketplace', 'billing', 'pay', 'payment', 'signup', 'login',
  'dashboard', 'test', 'demo', 'dev', 'staging', 'cname', 'ns1', 'ns2', 'root', 'rentcar-platform',
]);
