import prisma from '../lib/prisma';
import { addDaysISO, localInstant, todayISO } from '../lib/dates';
import { sendBookingEmail, sendAdminEmail } from './email';
import { getSettings } from './settings';
import { CAR_DOCUMENTS } from './rules';
import { emitBookingUpdate } from '../socket';

// Background work, run every hour: customer reminders, late returns, and car document/service alerts.
// Every alert is recorded in AlertLog so it goes out only once, even across restarts.

async function once(key: string): Promise<boolean> {
  try {
    await prisma.alertLog.create({ data: { key } });
    return true;
  } catch {
    return false; // already sent
  }
}

function emailData(b: { reference: string; guestName: string; startDate: string; endDate: string; pickupTime: string; returnTime: string; total: number; deposit: number; locale: string; car: { brand: string; model: string } }) {
  return {
    reference: b.reference, name: b.guestName, car: `${b.car.brand} ${b.car.model}`, start: b.startDate, end: b.endDate,
    pickupTime: b.pickupTime, returnTime: b.returnTime, total: b.total, deposit: b.deposit, locale: b.locale,
  };
}

export async function runReminders(now = new Date()): Promise<{ pickup: number; return: number; late: number }> {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const settings = await getSettings();
  const counts = { pickup: 0, return: 0, late: 0 };

  const pickups = await prisma.booking.findMany({ where: { status: 'approved', startDate: tomorrow, pickupReminderSent: false }, include: { car: true } });
  for (const b of pickups) {
    await prisma.booking.update({ where: { id: b.id }, data: { pickupReminderSent: true } });
    if (b.email) await sendBookingEmail('pickup_reminder', b.email, emailData(b));
    counts.pickup++;
  }

  const returns = await prisma.booking.findMany({ where: { status: 'picked_up', endDate: today, returnReminderSent: false }, include: { car: true } });
  for (const b of returns) {
    await prisma.booking.update({ where: { id: b.id }, data: { returnReminderSent: true } });
    if (b.email) await sendBookingEmail('return_reminder', b.email, emailData(b));
    counts.return++;
  }

  const out = await prisma.booking.findMany({ where: { status: 'picked_up', endDate: { lte: today }, lateNotified: false }, include: { car: true } });
  for (const b of out) {
    const due = localInstant(b.endDate, b.returnTime).getTime() + settings.lateGraceHours * 3_600_000;
    if (now.getTime() <= due) continue;
    await prisma.booking.update({ where: { id: b.id }, data: { lateNotified: true } });
    const message = `Late return: ${b.reference} (${b.guestName}, ${b.car.brand} ${b.car.model}) was due ${b.endDate} at ${b.returnTime}`;
    await prisma.notification.create({ data: { type: 'late_return', message, bookingId: b.id } });
    emitBookingUpdate({ type: 'late_return', message, bookingId: b.id });
    counts.late++;
  }
  return counts;
}

export interface CarAlert {
  carId: number;
  car: string;
  kind: 'document' | 'service';
  label: string;
  due: string; // date or km
  level: 'expired' | 'soon' | 'upcoming';
}

// Current state of every car's documents and service, for the dashboard
export async function carAlerts(): Promise<CarAlert[]> {
  const today = todayISO();
  const cars = await prisma.car.findMany();
  const alerts: CarAlert[] = [];
  for (const car of cars) {
    const name = `${car.brand} ${car.model}${car.plateNumber ? ` (${car.plateNumber})` : ''}`;
    for (const d of CAR_DOCUMENTS) {
      const expiry = car[d.field];
      if (!expiry || expiry > addDaysISO(today, 30)) continue;
      alerts.push({
        carId: car.id, car: name, kind: 'document', label: d.label, due: expiry,
        level: expiry < today ? 'expired' : expiry <= addDaysISO(today, 7) ? 'soon' : 'upcoming',
      });
    }
    if (car.nextServiceKm && car.mileage >= car.nextServiceKm - 1000) {
      alerts.push({
        carId: car.id, car: name, kind: 'service', label: 'Service', due: `${car.nextServiceKm} km`,
        level: car.mileage >= car.nextServiceKm ? 'expired' : 'soon',
      });
    }
  }
  const order = { expired: 0, soon: 1, upcoming: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

export async function runCarAlerts(): Promise<number> {
  const today = todayISO();
  const fresh: string[] = [];
  for (const a of await carAlerts()) {
    // One alert per document per stage: 30 days, 7 days, 1 day before, and on expiry
    let stage: string;
    if (a.kind === 'service') stage = a.level;
    else if (a.due < today) stage = 'expired';
    else if (a.due <= addDaysISO(today, 1)) stage = '1d';
    else if (a.due <= addDaysISO(today, 7)) stage = '7d';
    else stage = '30d';
    if (!(await once(`car:${a.carId}:${a.label}:${a.due}:${stage}`))) continue;

    const message = a.kind === 'service'
      ? `${a.car}: service ${a.level === 'expired' ? 'overdue' : 'due soon'} (${a.due})`
      : a.level === 'expired'
        ? `${a.car}: ${a.label} EXPIRED on ${a.due}. The car can't be booked until it is renewed.`
        : `${a.car}: ${a.label} expires on ${a.due}`;
    await prisma.notification.create({ data: { type: a.level === 'expired' ? 'car_alert_expired' : 'car_alert', message } });
    fresh.push(message);
  }
  if (fresh.length) {
    emitBookingUpdate({ type: 'car_alert', message: `${fresh.length} car alert(s)`, bookingId: 0 });
    const settings = await getSettings();
    await sendAdminEmail(settings.contactEmail, `Car alerts (${fresh.length})`, fresh);
  }
  return fresh.length;
}

export function startJobs(): void {
  // Set on extra instances (e.g. a test server on the same database) so reminders are only sent once
  if (process.env.DISABLE_JOBS === 'true') return;
  const run = async () => {
    try {
      const r = await runReminders();
      const alerts = await runCarAlerts();
      if (r.pickup || r.return || r.late || alerts) console.log(`[JOBS] reminders: ${r.pickup} pick-up, ${r.return} return, ${r.late} late · ${alerts} car alert(s)`);
    } catch (err) {
      console.error('[JOBS] failed:', (err as Error).message);
    }
  };
  setTimeout(run, 20_000);
  setInterval(run, 60 * 60 * 1000);
}
