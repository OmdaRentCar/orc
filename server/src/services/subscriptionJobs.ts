import prisma from '../lib/prisma';
import { agencySiteUrl, runUnscoped } from '../lib/tenant';
import { getPlan } from '../lib/plans';
import { effectiveStatus, overdueSince, suspensionDate, daysUntil } from '../lib/subscription';
import { forgetAgency } from '../middleware/agency';
import { platformEvent } from './billing';
import { sendPlatformEmail } from './platformEmail';

const fr = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '');

// Records a key the first time; false if it was already there (so each email goes out once)
async function once(key: string): Promise<boolean> {
  try {
    await prisma.alertLog.create({ data: { key } });
    return true;
  } catch {
    return false;
  }
}

// Hourly: reminders before a trial or a paid period ends, then past due, then suspension
export async function runSubscriptionJobs(now = new Date()): Promise<{ reminders: number; pastDue: number; suspended: number }> {
  return runUnscoped(async () => {
    const out = { reminders: 0, pastDue: 0, suspended: 0 };
    const agencies = await prisma.agency.findMany({ where: { status: { in: ['trial', 'active', 'past_due'] } } });
    for (const a of agencies) {
      const billing = `${agencySiteUrl(a)}/admin/billing`;
      const plan = getPlan(a.plan).name;
      const status = effectiveStatus(a, now);
      const ends = a.status === 'trial' ? a.trialEndsAt : a.currentPeriodEnd;

      if (status === 'trial' || status === 'active') {
        const left = daysUntil(ends, now);
        for (const mark of a.status === 'trial' ? [3, 1] : [7, 1]) {
          if (left !== null && left <= mark && left > 0 && await once(`sub-reminder:${a.id}:${ends!.toISOString()}:${mark}`)) {
            out.reminders++;
            await sendPlatformEmail(a.ownerEmail, a.status === 'trial' ? `Votre essai se termine dans ${left} jour${left > 1 ? 's' : ''}` : `Votre abonnement se renouvelle le ${fr(ends)}`, {
              heading: a.status === 'trial' ? 'Continuez sans interruption' : 'Pensez au renouvellement',
              paragraphs: [
                a.status === 'trial'
                  ? `L’essai gratuit de ${a.name} (formule ${plan}) se termine le ${fr(ends)}.`
                  : `L’abonnement ${plan} de ${a.name} est payé jusqu’au ${fr(ends)}.`,
                'Le paiement se fait en ligne en une minute (carte bancaire, e-Dinar ou portefeuille). Vos voitures, réservations et réglages sont conservés.',
              ],
              action: { label: 'Choisir ma formule et payer', url: billing },
            });
            break;
          }
        }
      }

      if (status === 'past_due' && a.status !== 'past_due') {
        await prisma.agency.update({ where: { id: a.id }, data: { status: 'past_due', pastDueSince: overdueSince(a, now) } });
        out.pastDue++;
        await platformEvent('system', 'past-due', a.id, a.status === 'trial' ? 'trial ended' : 'period ended');
        await sendPlatformEmail(a.ownerEmail, 'Paiement en attente', {
          heading: a.status === 'trial' ? 'Votre essai est terminé' : 'Votre abonnement est arrivé à échéance',
          paragraphs: [
            `Votre site et votre tableau de bord restent ouverts jusqu’au ${fr(suspensionDate(a, now))}.`,
            'Après cette date, le site de réservation sera mis en pause jusqu’au paiement. Aucune donnée n’est supprimée.',
          ],
          action: { label: 'Payer maintenant', url: billing },
        });
      }

      if (status === 'suspended') {
        await prisma.agency.update({ where: { id: a.id }, data: { status: 'suspended' } });
        out.suspended++;
        await platformEvent('system', 'suspended', a.id, 'not paid after the grace period');
        await sendPlatformEmail(a.ownerEmail, 'Site mis en pause', {
          heading: `${a.name} est en pause`,
          paragraphs: [
            'Le paiement n’a pas été reçu : votre site de réservation n’accepte plus de réservations.',
            'Toutes vos données sont conservées. Dès le paiement, tout redevient actif immédiatement.',
          ],
          action: { label: 'Réactiver mon agence', url: billing },
        });
      }
    }
    if (out.pastDue || out.suspended) forgetAgency();
    return out;
  });
}
