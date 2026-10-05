// Where an agency stands with its subscription, worked out from its dates rather than trusted from
// the stored status, so an unpaid agency is limited on time even if the hourly job has not run yet.
//
//   trial      free trial, until trialEndsAt
//   active     paid until currentPeriodEnd (no date = no expiry, granted by the platform)
//   past_due   trial or period over and not paid: everything still works for GRACE_DAYS, with a warning
//   suspended  grace over (or suspended from the console): the public site is closed, the dashboard only shows billing
//   cancelled  closed for good
export type EffectiveStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS || 7);
const DAY = 86_400_000;

export interface SubscriptionDates {
  status?: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  pastDueSince?: Date | null;
}

export function overdueSince(a: SubscriptionDates, now = new Date()): Date | null {
  if (a.status === 'trial') return a.trialEndsAt && a.trialEndsAt < now ? a.trialEndsAt : null;
  if (a.status === 'active') return a.currentPeriodEnd && a.currentPeriodEnd < now ? a.currentPeriodEnd : null;
  if (a.status === 'past_due') return a.pastDueSince ?? a.currentPeriodEnd ?? a.trialEndsAt ?? now;
  return null;
}

export function effectiveStatus(a: SubscriptionDates, now = new Date()): EffectiveStatus {
  if (!a.status) return 'active';
  if (a.status === 'suspended' || a.status === 'cancelled') return a.status;
  const since = overdueSince(a, now);
  if (!since) return a.status === 'trial' ? 'trial' : 'active';
  return now.getTime() - since.getTime() > GRACE_DAYS * DAY ? 'suspended' : 'past_due';
}

// Day the agency gets suspended if it does not pay (null when nothing is due)
export function suspensionDate(a: SubscriptionDates, now = new Date()): Date | null {
  const since = overdueSince(a, now);
  return since ? new Date(since.getTime() + GRACE_DAYS * DAY) : null;
}

export const daysUntil = (d: Date | null | undefined, now = new Date()) => (d ? Math.ceil((d.getTime() - now.getTime()) / DAY) : null);
