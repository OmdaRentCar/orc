import { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { apiJSON, openAuthedPdf } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import ContractManager, { ContractBadge } from './ContractManager';
import type { Booking, BookingStatus, PaymentStatus } from '../../types';
import { money, whatsappUrl } from '../../utils/format';
import { brandName } from '../../services/agency';

interface Props {
  booking: Booking | null;
  onClose: () => void;
  onChanged: (booking?: Booking) => void;
  onEdit: (booking: Booking) => void;
}

const ACTIONS: Record<BookingStatus, { to: BookingStatus; label: string; style: string }[]> = {
  pending: [
    { to: 'approved', label: 'Approve', style: 'bg-green-500/10 text-green-400 hover:bg-green-500/20' },
    { to: 'declined', label: 'Decline', style: 'bg-red-500/10 text-red-400 hover:bg-red-500/20' },
    { to: 'cancelled', label: 'Cancel', style: 'bg-white/5 text-brand-muted hover:text-brand-text' },
  ],
  approved: [
    { to: 'picked_up', label: 'Mark picked up (no inspection)', style: 'bg-white/5 text-brand-muted hover:text-brand-text' },
    { to: 'cancelled', label: 'Cancel', style: 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' },
    { to: 'pending', label: 'Back to pending', style: 'bg-white/5 text-brand-muted hover:text-brand-text' },
  ],
  picked_up: [
    { to: 'completed', label: 'Mark returned (no inspection)', style: 'bg-white/5 text-brand-muted hover:text-brand-text' },
  ],
  declined: [{ to: 'pending', label: 'Reopen', style: 'bg-white/5 text-brand-muted hover:text-brand-text' }],
  cancelled: [{ to: 'pending', label: 'Reopen', style: 'bg-white/5 text-brand-muted hover:text-brand-text' }],
  completed: [],
};

// WhatsApp message in the language the customer booked in
const MESSAGES: Record<string, Partial<Record<BookingStatus, string>> & { default: string }> = {
  en: {
    default: 'Hello {name}, this is {brand} about your booking {ref} ({car}, {start} → {end}).',
    approved: 'Hello {name}, your booking {ref} for the {car} is confirmed: pick-up {start} at {time}. See you soon! — {brand}',
    declined: 'Hello {name}, unfortunately we cannot accept booking {ref} for the {car}. Reply here and we will find another option. — {brand}',
    pending: 'Hello {name}, we received your booking {ref} for the {car} and will confirm it shortly. — {brand}',
  },
  fr: {
    default: 'Bonjour {name}, ici {brand} au sujet de votre réservation {ref} ({car}, {start} → {end}).',
    approved: 'Bonjour {name}, votre réservation {ref} pour la {car} est confirmée : prise en charge le {start} à {time}. À bientôt ! — {brand}',
    declined: "Bonjour {name}, nous ne pouvons malheureusement pas accepter la réservation {ref} pour la {car}. Répondez-nous et nous trouverons une autre solution. — {brand}",
    pending: 'Bonjour {name}, nous avons bien reçu votre réservation {ref} pour la {car} et la confirmerons rapidement. — {brand}',
  },
  ar: {
    default: 'مرحبًا {name}، معك {brand} بخصوص حجزك {ref} ({car}، {start} ← {end}).',
    approved: 'مرحبًا {name}، تم تأكيد حجزك {ref} للسيارة {car}: الاستلام يوم {start} على الساعة {time}. نراك قريبًا! — {brand}',
    declined: 'مرحبًا {name}، للأسف لا يمكننا قبول الحجز {ref} للسيارة {car}. راسلنا هنا وسنجد لك حلًا آخر. — {brand}',
    pending: 'مرحبًا {name}، استلمنا حجزك {ref} للسيارة {car} وسنؤكده قريبًا. — {brand}',
  },
};

function whatsappMessage(b: Booking): string {
  const set = MESSAGES[b.locale] ?? MESSAGES.en;
  const template = set[b.status] ?? set.default;
  const vars: Record<string, string> = {
    name: b.guestName, ref: b.reference, car: b.car ? `${b.car.brand} ${b.car.model}` : 'car',
    start: b.startDate, end: b.endDate, time: b.pickupTime,
  };
  return template.replace(/\{(\w+)\}/g, (_, k: string) => ({ brand: brandName(), ...vars } as Record<string, string>)[k] ?? '');
}

const LANGUAGES: Record<string, string> = { en: 'English', fr: 'French', ar: 'Arabic' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-brand-muted">{label}</span>
      <span className="text-brand-text text-right">{children}</span>
    </div>
  );
}

export default function BookingDetails({ booking, onClose, onChanged, onEdit }: Props) {
  const { showToast } = useToast();
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const [chargeLabel, setChargeLabel] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [contractOpen, setContractOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [amountPaid, setAmountPaid] = useState('0');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setPaymentStatus(booking.paymentStatus);
    setAmountPaid(String(booking.amountPaid));
  }, [booking]);

  if (!booking) return null;
  const b = booking;

  async function changeStatus(status: BookingStatus) {
    setBusy(true);
    try {
      const updated = await apiJSON<Booking>(`/bookings/${b.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      showToast(`${b.reference}: ${status.replace('_', ' ')}`, 'success');
      onChanged(updated);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function savePayment() {
    const amount = Number(amountPaid);
    if (!Number.isFinite(amount) || amount < 0) { showToast('Enter a valid amount', 'error'); return; }
    setBusy(true);
    try {
      const updated = await apiJSON<Booking>(`/bookings/${b.id}/payment`, { method: 'PUT', body: JSON.stringify({ paymentStatus, amountPaid: amount }) });
      showToast('Payment saved', 'success');
      onChanged(updated);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function changeLanguage(locale: string) {
    setBusy(true);
    try {
      const updated = await apiJSON<Booking>(`/bookings/${b.id}`, { method: 'PUT', body: JSON.stringify({ locale }) });
      showToast(`Emails for ${b.reference} will now be in ${LANGUAGES[locale]}`, 'success');
      onChanged(updated);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function viewDocument() {
    // Open the tab now: browsers block pop-ups opened after an await
    const tab = window.open('', '_blank');
    try {
      const { url } = await apiJSON<{ url: string }>(`/bookings/${b.id}/document`);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) {
      tab?.close();
      showToast((e as Error).message, 'error');
    }
  }

  async function deleteBooking() {
    try {
      await apiJSON(`/bookings/${b.id}`, { method: 'DELETE' });
      showToast('Booking deleted', 'success');
      setConfirmDelete(false);
      onChanged();
      onClose();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  const balance = Math.max(0, b.total + b.extraChargesTotal - b.amountPaid);
  const handedOver = b.status === 'picked_up' || b.status === 'completed';

  async function openPdf(path: string) {
    try { await openAuthedPdf(path); } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function addCharge(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(chargeAmount);
    if (chargeLabel.trim().length < 2 || !(amount > 0)) { showToast('Enter a description and an amount', 'error'); return; }
    try {
      const updated = await apiJSON<Booking>(`/bookings/${b.id}/charges`, { method: 'POST', body: JSON.stringify({ label: chargeLabel.trim(), amount, kind: 'damage' }) });
      setChargeLabel(''); setChargeAmount('');
      showToast('Charge added', 'success');
      onChanged(updated);
    } catch (err) { showToast((err as Error).message, 'error'); }
  }

  async function removeCharge(index: number) {
    try {
      const updated = await apiJSON<Booking>(`/bookings/${b.id}/charges/${index}`, { method: 'DELETE' });
      showToast('Charge removed', 'success');
      onChanged(updated);
    } catch (err) { showToast((err as Error).message, 'error'); }
  }

  return (
    <>
      <Modal open onClose={onClose} maxWidth="max-w-2xl">
        <div className="flex items-start justify-between gap-4 pr-8 mb-5">
          <div>
            <p className="text-xs text-brand-muted">Booking #{b.id} · {b.source === 'admin' ? 'added by staff' : 'online'} · {new Date(b.createdAt).toLocaleString('en-GB')}</p>
            <h3 className="font-display text-2xl font-bold text-brand-text tracking-wide">{b.reference}</h3>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge status={b.status} />
            <Badge status={b.paymentStatus} />
          </div>
        </div>

        {(b.status === 'approved' || b.status === 'picked_up' || handedOver) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {b.status === 'approved' && (
              <button onClick={() => navigate(`/admin/bookings/${b.id}/handover/checkout`)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-sky-500/15 text-sky-300 hover:bg-sky-500/25">
                🔑 Start pick-up (photos + signature)
              </button>
            )}
            {b.status === 'picked_up' && (
              <button onClick={() => navigate(`/admin/bookings/${b.id}/handover/checkin`)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-500/15 text-green-300 hover:bg-green-500/25">
                🏁 Return car (inspection)
              </button>
            )}
            {handedOver && (
              <button onClick={() => openPdf(`/bookings/${b.id}/contract.pdf`)} className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-brand-text hover:bg-white/10">Contract (PDF)</button>
            )}
            {b.status === 'completed' && (
              <button onClick={() => openPdf(`/bookings/${b.id}/return-report.pdf`)} className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-brand-text hover:bg-white/10">Return report (PDF)</button>
            )}
          </div>
        )}

        {b.status !== 'declined' && b.status !== 'cancelled' && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2 text-sm text-brand-muted">Contract <ContractBadge state={b.contractState ?? 'none'} /></div>
            <button onClick={() => setContractOpen(true)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 text-brand-text hover:bg-white/15">📄 Manage contract</button>
          </div>
        )}

        {ACTIONS[b.status].length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {ACTIONS[b.status].map((a) => (
              <button key={a.to} disabled={busy} onClick={() => changeStatus(a.to)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${a.style}`}>
                {a.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <section className="glass-card p-4">
            <h4 className="text-xs uppercase tracking-wider text-brand-muted mb-2">Customer</h4>
            <Row label="Name">{b.guestName}</Row>
            <Row label="Phone"><a href={`tel:${b.phone.replace(/\s/g, '')}`} className="hover:text-brand-red">{b.phone}</a></Row>
            <Row label="Email">{b.email ? <a href={`mailto:${b.email}`} className="hover:text-brand-red">{b.email}</a> : '—'}</Row>
            <Row label="Email language">
              <select
                value={b.locale}
                disabled={busy}
                onChange={(e) => changeLanguage(e.target.value)}
                aria-label="Email language"
                className="bg-brand-surface border border-white/10 rounded-lg px-2 py-1 text-sm text-brand-text"
              >
                {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </Row>
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={whatsappUrl(b.phone, whatsappMessage(b))} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20">
                WhatsApp
              </a>
              {b.documentImage ? (
                <button onClick={viewDocument} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-brand-text hover:bg-white/10">View ID document</button>
              ) : (
                <span className="px-3 py-1.5 text-xs text-brand-muted/60">No ID document</span>
              )}
            </div>
          </section>

          <section className="glass-card p-4">
            <h4 className="text-xs uppercase tracking-wider text-brand-muted mb-2">Rental</h4>
            <Row label="Car">{b.car ? `${b.car.brand} ${b.car.model}` : `Car #${b.carId}`}</Row>
            <Row label="Pick-up">{b.startDate} · {b.pickupTime}</Row>
            <Row label="Return">{b.endDate} · {b.returnTime}</Row>
            <Row label="Method">{b.deliveryType === 'delivery' ? `Delivery: ${b.deliveryAddress}` : 'At the agency'}</Row>
            <Row label="Extras">{b.extras.length ? b.extras.map((e) => e.name).join(', ') : '—'}</Row>
            {(b.birthDate || b.licenseIssueDate || b.idNumber || b.licenseNumber) && (
              <div className="border-t border-white/5 mt-1 pt-1">
                {b.idNumber && <Row label="CIN / passport">{b.idNumber}</Row>}
                {b.licenseNumber && <Row label="Licence n°">{b.licenseNumber}</Row>}
                {b.birthDate && <Row label="Born">{b.birthDate}</Row>}
                {b.licenseIssueDate && <Row label="Licence since">{b.licenseIssueDate}</Row>}
              </div>
            )}
            {b.notes && <p className="mt-2 text-xs text-brand-muted whitespace-pre-wrap border-t border-white/5 pt-2">{b.notes}</p>}
          </section>

          <section className="glass-card p-4">
            <h4 className="text-xs uppercase tracking-wider text-brand-muted mb-2">Price</h4>
            <Row label="Rental">{money(b.subtotal)}</Row>
            {b.discount > 0 && <Row label="Discount">−{money(b.discount)}</Row>}
            {b.extras.map((e) => <Row key={e.id} label={e.name}>{money(e.total)}</Row>)}
            {b.deliveryFee > 0 && <Row label="Delivery">{money(b.deliveryFee)}</Row>}
            <div className="border-t border-white/5 mt-1 pt-1">
              <Row label="Total"><strong className="text-brand-red">{money(b.total)}</strong></Row>
              <Row label="Deposit (refundable)">{money(b.deposit)}</Row>
            </div>
            {(b.extraCharges.length > 0 || handedOver) && (
              <div className="border-t border-white/5 mt-2 pt-2">
                <p className="text-xs uppercase tracking-wider text-brand-muted mb-1">Extra charges</p>
                {b.extraCharges.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-1 text-sm">
                    <span className="text-brand-muted">{c.label}</span>
                    <span className="flex items-center gap-2 text-brand-text whitespace-nowrap">
                      {money(c.amount)}
                      <button onClick={() => removeCharge(i)} aria-label={`Remove charge ${c.label}`} className="text-brand-muted hover:text-red-400">×</button>
                    </span>
                  </div>
                ))}
                {handedOver && (
                  <form onSubmit={addCharge} className="flex gap-1.5 mt-1.5">
                    <input value={chargeLabel} onChange={(e) => setChargeLabel(e.target.value)} placeholder="e.g. scratch rear bumper" aria-label="Charge description" className="flex-1 min-w-0 bg-brand-surface border border-white/10 rounded-lg px-2 py-1 text-xs text-brand-text" />
                    <input type="number" min={0} step="0.5" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="DT" aria-label="Charge amount (DT)" className="w-20 bg-brand-surface border border-white/10 rounded-lg px-2 py-1 text-xs text-brand-text" />
                    <button type="submit" className="px-2 py-1 rounded-lg text-xs font-semibold bg-white/10 text-brand-text hover:bg-white/15">Add</button>
                  </form>
                )}
                {b.extraChargesTotal > 0 && <Row label="Total with charges"><strong className="text-brand-red">{money(b.total + b.extraChargesTotal)}</strong></Row>}
              </div>
            )}
          </section>

          <section className="glass-card p-4">
            <h4 className="text-xs uppercase tracking-wider text-brand-muted mb-2">Payment</h4>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} className="bg-brand-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-brand-text" aria-label="Payment status">
                <option value="unpaid">Unpaid</option>
                <option value="deposit">Deposit paid</option>
                <option value="paid">Paid in full</option>
              </select>
              <input type="number" min={0} step="0.001" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} aria-label="Amount paid (DT)" className="bg-brand-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm text-brand-text" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-brand-muted">Balance due: <span className="text-brand-text">{money(balance)}</span></p>
              <button onClick={savePayment} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50">Save</button>
            </div>
          </section>
        </div>

        <div className="flex justify-between mt-5">
          {isOwner ? (
            <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 rounded-lg text-xs text-brand-muted hover:text-red-400 hover:bg-red-500/5">Delete booking</button>
          ) : <span />}
          {b.status !== 'completed' && (
            <button onClick={() => onEdit(b)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 text-brand-text hover:bg-white/10">Edit booking</button>
          )}
        </div>
      </Modal>

      {contractOpen && <ContractManager booking={b} onClose={() => { setContractOpen(false); onChanged(); }} onChanged={() => onChanged()} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Booking"
        message={`Permanently delete booking ${b.reference} and its ID document?`}
        confirmLabel="Delete"
        danger
        onConfirm={deleteBooking}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
