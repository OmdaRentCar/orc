import { useCallback, useEffect, useState } from 'react';
import { apiJSON, openAuthedPdf } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { socket } from '../../services/socket';
import type { Booking } from '../../types';
import { whatsappUrl } from '../../utils/format';

interface ContractStatus {
  state: 'none' | 'sent' | 'signed' | 'expired' | 'revoked';
  sentAt?: string;
  sentBy?: string;
  expiresAt?: string;
  viewedAt?: string | null;
  signedAt?: string | null;
  signerName?: string | null;
  signerIp?: string | null;
  documentHash?: string | null;
  verificationCode?: string | null;
  verifyUrl?: string | null;
  link?: string;
  emailed?: boolean;
}

const WHATSAPP_TEXT: Record<string, string> = {
  en: 'Hello {name}, here is your rental contract {ref} to sign online: {link}',
  fr: 'Bonjour {name}, voici votre contrat de location {ref} à signer en ligne : {link}',
  ar: 'مرحبًا {name}، هذا رابط عقد الكراء {ref} للتوقيع عبر الإنترنت: {link}',
};

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

// Remote signature of the rental contract, for the booking details panel
export default function OnlineContractPanel({ booking }: { booking: Booking }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<ContractStatus | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiJSON<ContractStatus>(`/bookings/${booking.id}/contract`).then(setStatus).catch(() => setStatus({ state: 'none' }));
  }, [booking.id]);

  useEffect(() => {
    load();
    const refresh = (e: { bookingId: number }) => { if (e.bookingId === booking.id) load(); };
    socket.on('booking-update', refresh);
    return () => { socket.off('booking-update', refresh); };
  }, [load, booking.id]);

  const signable = booking.status === 'approved' || booking.status === 'picked_up';
  if (!status || (!signable && status.state !== 'signed')) return null;

  async function send() {
    setBusy(true);
    try {
      const res = await apiJSON<ContractStatus>(`/bookings/${booking.id}/contract/send`, { method: 'POST', body: JSON.stringify({ sendEmail: true }) });
      setStatus(res);
      setLink(res.link ?? '');
      showToast(res.emailed ? `Contract sent to ${booking.email}` : 'Link created (email could not be sent)', res.emailed ? 'success' : 'info');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      setStatus(await apiJSON<ContractStatus>(`/bookings/${booking.id}/contract/revoke`, { method: 'POST' }));
      setLink('');
      showToast('Signing link cancelled', 'info');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied', 'success');
    } catch {
      showToast('Copy failed: select the link and copy it', 'error');
    }
  }

  const waText = (WHATSAPP_TEXT[booking.locale] ?? WHATSAPP_TEXT.fr).replace('{name}', booking.guestName).replace('{ref}', booking.reference).replace('{link}', link);

  return (
    <section className="glass-card p-4 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-xs uppercase tracking-wider text-brand-muted">Online contract signature <span className="normal-case tracking-normal">(optional)</span></h4>
        {status.state === 'signed' && <span className="badge-approved">Signed online</span>}
        {status.state === 'sent' && <span className="badge-pending">Waiting for signature</span>}
        {status.state === 'expired' && <span className="badge-maintenance">Link expired</span>}
        {status.state === 'revoked' && <span className="badge-declined">Link cancelled</span>}
      </div>

      {status.state === 'signed' ? (
        <div className="text-sm space-y-1">
          <p className="text-brand-text">Signed by <strong>{status.signerName}</strong> on {fmt(status.signedAt)}</p>
          <p className="text-xs text-brand-muted">Identity checked with a code sent to {booking.email} · IP {status.signerIp} · sent by {status.sentBy}</p>
          <p className="text-xs text-brand-muted">Verification code <span className="font-mono text-brand-text">{status.verificationCode}</span> · SHA-256 <span className="font-mono">{status.documentHash?.slice(0, 16)}…</span></p>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => openAuthedPdf(`/bookings/${booking.id}/contract/signed.pdf`).catch((e) => showToast((e as Error).message, 'error'))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 text-green-300 hover:bg-green-500/25">Signed contract (PDF)</button>
            {status.verifyUrl && <a href={status.verifyUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-brand-text">Verification page</a>}
          </div>
        </div>
      ) : (
        <div className="text-sm space-y-2">
          {status.state === 'sent' && (
            <p className="text-xs text-brand-muted">
              Sent by {status.sentBy} on {fmt(status.sentAt)} · {status.viewedAt ? `opened ${fmt(status.viewedAt)}` : 'not opened yet'} · link valid until {fmt(status.expiresAt)}
            </p>
          )}
          {status.state === 'none' && (
            <p className="text-xs text-brand-muted">The customer receives a personal link by email, confirms it is them with a code, and signs on their phone. You and they both receive the signed PDF.</p>
          )}
          {!booking.email ? (
            <p className="text-xs text-orange-400">Add the customer’s email (Edit booking) to send the contract: the signing code goes there.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={send} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50">
                {status.state === 'none' ? `Send for signature to ${booking.email}` : 'Send a new link'}
              </button>
              {status.state === 'sent' && <button onClick={revoke} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-red-400">Cancel link</button>}
            </div>
          )}
          {link && (
            <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10">
              <p className="text-[11px] text-brand-muted mb-1">Signing link (shown once, only valid for this customer):</p>
              <p className="font-mono text-[11px] text-brand-text break-all select-all">{link}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={copy} className="px-2.5 py-1 rounded-lg text-xs bg-white/10 text-brand-text">Copy</button>
                <a href={whatsappUrl(booking.phone, waText)} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#25D366]/10 text-[#25D366]">Send on WhatsApp</a>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
