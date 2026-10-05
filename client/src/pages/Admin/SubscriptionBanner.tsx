import { Link } from 'react-router-dom';
import { useAgency } from '../../context/AgencyContext';
import { useAuth } from '../../context/AuthContext';

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '');

// One line at the top of the dashboard when the subscription needs attention
export default function SubscriptionBanner() {
  const { agency } = useAgency();
  const { isOwner } = useAuth();
  const s = agency.subscription;
  let tone = '', text = '';
  if (s.status === 'trial' && (s.trialDaysLeft ?? 99) <= 7) {
    tone = 'bg-sky-500/10 text-sky-200 border-sky-500/20';
    text = `Free trial of ${s.planName}: ${s.trialDaysLeft} day${s.trialDaysLeft === 1 ? '' : 's'} left (until ${day(s.trialEndsAt)}).`;
  } else if (s.status === 'past_due') {
    tone = 'bg-orange-500/10 text-orange-200 border-orange-500/20';
    text = `Payment due. Your booking site will be paused on ${day(s.suspendsAt)} if the subscription is not paid.`;
  } else if (s.status === 'suspended') {
    tone = 'bg-red-500/10 text-red-200 border-red-500/20';
    text = 'Your booking site is paused: the subscription was not paid. Your data is safe.';
  } else return null;

  return (
    <div className={`flex-shrink-0 border-b px-6 py-2.5 text-sm flex items-center justify-between gap-4 ${tone}`}>
      <span>{text}</span>
      {isOwner
        ? <Link to="/admin/billing" className="flex-shrink-0 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white">{s.status === 'trial' ? 'Choose a plan' : 'Pay now'}</Link>
        : <span className="flex-shrink-0 text-xs opacity-80">Ask the agency owner to renew.</span>}
    </div>
  );
}
