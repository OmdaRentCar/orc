import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { apiJSON, openAuthedPdf } from '../../services/api';
import type { Booking, ContractState, Inspection } from '../../types';
import OnlineContractPanel from './OnlineContractPanel';

export const CONTRACT_LABEL: Record<ContractState, { label: string; style: string }> = {
  none: { label: 'Not sent', style: 'bg-white/5 text-brand-muted border-white/10' },
  sent: { label: 'Sent', style: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' },
  opened: { label: 'Opened', style: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  signed_online: { label: 'Signed online', style: 'bg-green-500/10 text-green-400 border-green-500/20' },
  signed_in_person: { label: 'Signed at pick-up', style: 'bg-green-500/10 text-green-400 border-green-500/20' },
  expired: { label: 'Link expired', style: 'bg-orange-500/10 text-orange-300 border-orange-500/20' },
  revoked: { label: 'Link cancelled', style: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export function ContractBadge({ state }: { state: ContractState }) {
  const { label, style } = CONTRACT_LABEL[state];
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${style}`}>{label}</span>;
}

interface Props {
  booking: Booking | null;
  onClose: () => void;
  onChanged?: () => void;
}

const btn = 'px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-4">
      <h4 className="flex items-baseline gap-2 font-semibold text-brand-text mb-3">
        <span className="font-mono text-xs text-brand-red">{String(n).padStart(2, '0')}</span>{title}
      </h4>
      {children}
    </section>
  );
}

// Everything about one booking's contract in one place: PDF, email, online signature, in-person signature, return report
export default function ContractManager({ booking, onClose, onChanged }: Props) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setInspections([]);
    apiJSON<Inspection[]>(`/bookings/${booking.id}/inspections`).then(setInspections).catch(() => {});
  }, [booking]);

  if (!booking) return null;
  const b = booking;
  const closed = b.status === 'declined' || b.status === 'cancelled';
  const pickup = inspections.find((i) => i.type === 'checkout');
  const giveBack = inspections.find((i) => i.type === 'checkin');

  async function openPdf(path: string) {
    try { await openAuthedPdf(path); } catch (e) { showToast((e as Error).message, 'error'); }
  }

  async function emailContract() {
    setSending(true);
    try {
      const r = await apiJSON<{ to: string; signed: boolean }>(`/bookings/${b.id}/contract/email`, { method: 'POST' });
      showToast(`${r.signed ? 'Signed contract' : 'Contract'} emailed to ${r.to}`, 'success');
      onChanged?.();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  }

  const go = (path: string) => { onClose(); navigate(path); };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-2xl">
      <div className="pr-8 mb-4">
        <p className="text-xs text-brand-muted">Contract</p>
        <h3 className="font-display text-2xl font-bold text-brand-text tracking-wide">{b.reference}</h3>
        <p className="text-sm text-brand-muted">
          {b.guestName} · {b.car ? `${b.car.brand} ${b.car.model}` : `Car #${b.carId}`} · {b.startDate} → {b.endDate}
        </p>
      </div>

      {closed ? (
        <p className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-brand-muted">This booking is {b.status}: there is no contract to manage.</p>
      ) : (
        <div className="space-y-4">
          <Step n={1} title="The contract">
            <p className="text-xs text-brand-muted mb-3">Customer, car, dates, price, deposit and your rental conditions. After pick-up it also contains the inspection, photos and signature.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openPdf(`/bookings/${b.id}/contract.pdf`)} className={`${btn} bg-white/10 text-brand-text hover:bg-white/15`}>📄 View contract (PDF)</button>
              {b.email ? (
                <button onClick={emailContract} disabled={sending} className={`${btn} bg-white/10 text-brand-text hover:bg-white/15`}>
                  {sending ? 'Sending...' : `✉️ Email it to ${b.email}`}
                </button>
              ) : (
                <span className="px-1 py-2 text-xs text-orange-400">No email on this booking: add one with “Edit booking” to email the contract.</span>
              )}
            </div>
          </Step>

          <Step n={2} title="Signature">
            <p className="text-xs text-brand-muted mb-3">Two ways, both optional: online before the rental, or in person at the agency when the keys are handed over.</p>
            <OnlineContractPanel booking={b} />
            <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <p className="text-xs uppercase tracking-wider text-brand-muted mb-2">In person at pick-up</p>
              {pickup ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-brand-text">Signed by <strong>{pickup.signerName}</strong> on {new Date(pickup.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {pickup.photos.length} photos</p>
                  <button onClick={() => openPdf(`/bookings/${b.id}/contract.pdf`)} className={`${btn} bg-green-500/15 text-green-300 hover:bg-green-500/25`}>Contract with inspection (PDF)</button>
                </div>
              ) : b.status === 'approved' ? (
                <button onClick={() => go(`/admin/bookings/${b.id}/handover/checkout`)} className={`${btn} bg-sky-500/15 text-sky-300 hover:bg-sky-500/25`}>🔑 Start pick-up (photos + signature)</button>
              ) : b.status === 'pending' ? (
                <p className="text-sm text-brand-muted">Approve the booking first.</p>
              ) : (
                <p className="text-sm text-brand-muted">The car was marked as picked up without an inspection.</p>
              )}
            </div>
          </Step>

          <Step n={3} title="Return">
            {giveBack ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-brand-text">Returned on {new Date(giveBack.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} at {giveBack.mileage.toLocaleString()} km</p>
                <button onClick={() => openPdf(`/bookings/${b.id}/return-report.pdf`)} className={`${btn} bg-white/10 text-brand-text hover:bg-white/15`}>📄 Return report (PDF)</button>
              </div>
            ) : b.status === 'picked_up' ? (
              <button onClick={() => go(`/admin/bookings/${b.id}/handover/checkin`)} className={`${btn} bg-green-500/15 text-green-300 hover:bg-green-500/25`}>🏁 Return car (inspection)</button>
            ) : (
              <p className="text-sm text-brand-muted">{b.status === 'completed' ? 'The car was marked as returned without an inspection.' : 'After the rental, the return inspection and report appear here.'}</p>
            )}
          </Step>
        </div>
      )}
    </Modal>
  );
}
