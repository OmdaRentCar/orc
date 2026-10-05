// Online payment of subscriptions through a Tunisian gateway. PAYMENTS_PROVIDER picks one:
//   konnect  KONNECT_API_KEY, KONNECT_WALLET_ID   (KONNECT_API_URL for the sandbox: https://api.sandbox.konnect.network/api/v2)
//   flouci   FLOUCI_APP_TOKEN, FLOUCI_APP_SECRET  (FLOUCI_API_URL to override)
//   manual   no real money: a test checkout page in the dashboard. Refused in production.
// A payment is never trusted from the browser redirect or the webhook alone: it is always confirmed
// by asking the gateway directly (verify), and the amount must match the invoice.

export type ProviderId = 'konnect' | 'flouci' | 'manual';
export type PaymentState = 'paid' | 'pending' | 'failed';

export interface CheckoutInput {
  invoiceId: number;
  amount: number; // DT
  description: string;
  successUrl: string;
  failUrl: string;
  webhookUrl: string;
  customer: { name: string; email?: string | null; phone?: string | null };
}

export interface PaymentProvider {
  id: ProviderId;
  init(input: CheckoutInput): Promise<{ ref: string; payUrl: string }>;
  verify(ref: string): Promise<{ state: PaymentState; amount: number | null }>;
}

const millimes = (dt: number) => Math.round(dt * 1000);

async function call<T>(url: string, init: RequestInit, label: string): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${label} ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data as T;
}

const konnect: PaymentProvider = {
  id: 'konnect',
  async init(i) {
    const base = process.env.KONNECT_API_URL || 'https://api.konnect.network/api/v2';
    const [firstName, ...rest] = i.customer.name.split(' ');
    const data = await call<{ payUrl: string; paymentRef: string }>(`${base}/payments/init-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.KONNECT_API_KEY! },
      body: JSON.stringify({
        receiverWalletId: process.env.KONNECT_WALLET_ID,
        token: 'TND',
        amount: millimes(i.amount),
        type: 'immediate',
        description: i.description,
        acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
        lifespan: 30,
        checkoutForm: false,
        addPaymentFeesToAmount: false,
        firstName,
        lastName: rest.join(' ') || firstName,
        email: i.customer.email ?? undefined,
        phoneNumber: i.customer.phone?.replace(/\D/g, '').slice(-8) || undefined,
        orderId: String(i.invoiceId),
        webhook: i.webhookUrl,
        successUrl: i.successUrl,
        failUrl: i.failUrl,
        theme: 'dark',
      }),
    }, 'Konnect');
    return { ref: data.paymentRef, payUrl: data.payUrl };
  },
  async verify(ref) {
    const base = process.env.KONNECT_API_URL || 'https://api.konnect.network/api/v2';
    const data = await call<{ payment?: { status?: string; amount?: number } }>(`${base}/payments/${encodeURIComponent(ref)}`, {
      headers: { 'x-api-key': process.env.KONNECT_API_KEY! },
    }, 'Konnect');
    const status = data.payment?.status;
    return {
      state: status === 'completed' ? 'paid' : status === 'failed' || status === 'expired' ? 'failed' : 'pending',
      amount: typeof data.payment?.amount === 'number' ? data.payment.amount / 1000 : null,
    };
  },
};

const flouci: PaymentProvider = {
  id: 'flouci',
  async init(i) {
    const base = process.env.FLOUCI_API_URL || 'https://developers.flouci.com/api';
    const data = await call<{ result?: { success?: boolean; payment_id?: string; link?: string } }>(`${base}/generate_payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_token: process.env.FLOUCI_APP_TOKEN,
        app_secret: process.env.FLOUCI_APP_SECRET,
        amount: String(millimes(i.amount)),
        accept_card: 'true',
        session_timeout_secs: 1800,
        success_link: i.successUrl,
        fail_link: i.failUrl,
        developer_tracking_id: String(i.invoiceId),
      }),
    }, 'Flouci');
    if (!data.result?.payment_id || !data.result.link) throw new Error('Flouci: no payment link returned');
    return { ref: data.result.payment_id, payUrl: data.result.link };
  },
  async verify(ref) {
    const base = process.env.FLOUCI_API_URL || 'https://developers.flouci.com/api';
    const data = await call<{ success?: boolean; result?: { status?: string; amount?: number } }>(`${base}/verify_payment/${encodeURIComponent(ref)}`, {
      headers: { 'Content-Type': 'application/json', apppublic: process.env.FLOUCI_APP_TOKEN!, appsecret: process.env.FLOUCI_APP_SECRET! },
    }, 'Flouci');
    const status = data.result?.status;
    return {
      state: status === 'SUCCESS' ? 'paid' : status === 'FAILURE' || status === 'EXPIRED' ? 'failed' : 'pending',
      amount: typeof data.result?.amount === 'number' ? data.result.amount / 1000 : null,
    };
  },
};

// Test mode: the "checkout" is a page of the dashboard; its result is written straight to the invoice
const manual: PaymentProvider = {
  id: 'manual',
  async init(i) {
    return { ref: `manual-${i.invoiceId}-${Date.now().toString(36)}`, payUrl: i.successUrl.replace(/\/admin\/billing.*$/, `/admin/billing/test-pay/${i.invoiceId}`) };
  },
  async verify() {
    return { state: 'pending', amount: null };
  },
};

export function paymentProvider(): PaymentProvider {
  const chosen = (process.env.PAYMENTS_PROVIDER || '').toLowerCase();
  if (chosen === 'konnect' && process.env.KONNECT_API_KEY && process.env.KONNECT_WALLET_ID) return konnect;
  if (chosen === 'flouci' && process.env.FLOUCI_APP_TOKEN && process.env.FLOUCI_APP_SECRET) return flouci;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No payment gateway configured: set PAYMENTS_PROVIDER with its keys');
  }
  return manual;
}

export function providerById(id: string): PaymentProvider | null {
  return ({ konnect, flouci, manual } as Record<string, PaymentProvider>)[id] ?? null;
}

export const testPaymentsAllowed = () => process.env.NODE_ENV !== 'production';
