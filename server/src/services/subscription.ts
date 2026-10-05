import { getPlan } from '../lib/plans';
import { effectiveStatus, suspensionDate, daysUntil, SubscriptionDates } from '../lib/subscription';

// What the dashboard and the site need to know about an agency's subscription
export function subscriptionSummary(a: SubscriptionDates & { plan: string; billingCycle?: string }) {
  const plan = getPlan(a.plan);
  const status = effectiveStatus(a);
  const suspendsAt = suspensionDate(a);
  return {
    status,
    plan: plan.id,
    planName: plan.name,
    cycle: a.billingCycle ?? 'monthly',
    trialEndsAt: a.trialEndsAt ?? null,
    currentPeriodEnd: a.currentPeriodEnd ?? null,
    suspendsAt,
    trialDaysLeft: status === 'trial' ? daysUntil(a.trialEndsAt) : null,
    features: plan.features,
    limits: { cars: plan.maxCars, users: plan.maxUsers },
  };
}
