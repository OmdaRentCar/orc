// Fills a SEPARATE demo database with realistic data for manual testing.
// Usage: DATABASE_URL=<...rentcar_demo...> DEMO_EMAIL=you@gmail.com npm run seed:demo
// It wipes the demo database first, and refuses to run on a database whose name doesn't contain "demo".
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { createPrismaClient } from '../src/lib/prisma';
import { runAsAgency, runUnscoped, requireAgency, AGENCY_SELECT } from '../src/lib/tenant';
import { computeQuote } from '../src/services/pricing';
import { DEFAULT_SETTINGS, BusinessSettings } from '../src/services/settings';
import { generateReference } from '../src/services/reference';
import { addDaysISO, todayISO } from '../src/lib/dates';
import { chargesTotal, ExtraCharge } from '../src/services/handover';

const url = process.env.DATABASE_URL ?? '';
const dbName = (() => { try { return new URL(url).pathname; } catch { return ''; } })();
if (!/demo/i.test(dbName)) {
  console.error(`Refusing to seed "${dbName || url}": the demo database name must contain "demo".`);
  process.exit(1);
}

const prisma = createPrismaClient();
const DEMO_EMAIL = process.env.DEMO_EMAIL || null; // the tester's own inbox, for email and online-signature tests
const today = todayISO();
const day = (n: number) => addDaysISO(today, n);
const month = (monthsAgo: number, dayOfMonth: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo, dayOfMonth);
  return d.toISOString().slice(0, 10);
};

const settings: BusinessSettings = {
  ...DEFAULT_SETTINGS,
  deliveryFee: 30,
  weeklyDiscountPct: 10,
  monthlyDiscountPct: 20,
  depositAmount: 500,
  whatsappNumber: '21694859352',
  contactEmail: DEMO_EMAIL ?? 'contact@example.com',
  contactPhone: '+216 94 859 352',
  weekendPct: 10,
  seasons: [{ name: 'Été', from: '07-01', to: '08-31', pct: 25 }],
  kmPerDayIncluded: 250,
  extraKmPrice: 0.3,
  fuelChargePerEighth: 15,
  lateGraceHours: 1,
  minDriverAge: 21,
  minLicenseYears: 2,
  companyName: 'RentCar Démo',
  companyAddress: '45 Avenue Habib Bourguiba, 1000 Tunis',
  companyTaxId: '1234567/A/M/000',
};

const img = (id: string) => `https://images.unsplash.com/${id}?w=1200&h=800&fit=crop`;

const CARS = [
  { key: 'clio', brand: 'Renault', model: 'Clio 5', type: 'Sedan', year: 2023, price: 90, seats: 5, fuel: 'Petrol', transmission: 'Manual', plateNumber: '215 TU 4481', mileage: 38200, image: img('photo-1549399542-7e3f8b79c341'), features: ['Bluetooth', 'Climatisation', 'Régulateur'], description: 'Citadine économique, idéale pour la ville et les trajets courts.' },
  { key: 'polo', brand: 'Volkswagen', model: 'Polo', type: 'Sedan', year: 2022, price: 110, seats: 5, fuel: 'Diesel', transmission: 'Manual', plateNumber: '221 TU 1093', mileage: 51750, image: img('photo-1541899481282-d53bffe3c35d'), features: ['Apple CarPlay', 'Climatisation', 'Radar de recul'], description: 'Compacte fiable et sobre en diesel.' },
  { key: 'tucson', brand: 'Hyundai', model: 'Tucson', type: 'SUV', year: 2024, price: 180, seats: 5, fuel: 'Hybrid', transmission: 'Auto', plateNumber: '230 TU 7712', mileage: 12400, image: img('photo-1606664515524-ed2f786a0bd6'), features: ['Caméra 360°', 'Sièges chauffants', 'Toit panoramique'], description: 'SUV familial hybride, confortable sur autoroute.' },
  { key: 'bmw', brand: 'BMW', model: 'M4 Competition', type: 'Sports', year: 2025, price: 249, seats: 4, fuel: 'Petrol', transmission: 'DCT', plateNumber: '233 TU 0505', mileage: 8900, image: img('photo-1555215695-3004980ad54e'), features: ['M Sport Exhaust', 'Carbone', 'Harman Kardon'], description: '503 ch, six cylindres biturbo.' },
  { key: 'gclass', brand: 'Mercedes', model: 'G-Class', type: 'SUV', year: 2025, price: 399, seats: 5, fuel: 'Petrol', transmission: 'Auto', plateNumber: '234 TU 9001', mileage: 15600, image: img('photo-1519641471654-76ce0107ad1b'), features: ['3 blocages', 'Burmester', 'Sièges massants'], description: 'La légende tout-terrain, raffinée sur route.' },
  { key: 'tesla', brand: 'Tesla', model: 'Model 3', type: 'Electric', year: 2024, price: 160, seats: 5, fuel: 'Electric', transmission: 'Auto', plateNumber: '231 TU 3300', mileage: 22100, image: img('photo-1617704548623-340376564e68'), features: ['Autopilot', 'Toit vitré', 'Écran 15"'], description: '100 % électrique, 500 km d’autonomie.' },
  { key: 'porsche', brand: 'Porsche', model: '911 Turbo S', type: 'Sports', year: 2025, price: 450, seats: 4, fuel: 'Petrol', transmission: 'PDK', plateNumber: '235 TU 9110', mileage: 6100, image: img('photo-1503376780353-7e6692767b70'), features: ['Freins céramique', 'Aéro active', 'Échappement sport'], description: '650 ch, la 911 ultime.' },
  { key: 'dacia', brand: 'Dacia', model: 'Duster', type: 'SUV', year: 2021, price: 100, seats: 5, fuel: 'Diesel', transmission: 'Manual', plateNumber: '209 TU 6528', mileage: 97400, image: img('photo-1533473359331-0135ef1b58bf'), features: ['4x4', 'Climatisation'], description: 'SUV robuste pour toutes les routes.' },
  { key: 'audi', brand: 'Audi', model: 'RS e-tron GT', type: 'Electric', year: 2025, price: 320, seats: 4, fuel: 'Electric', transmission: 'Auto', plateNumber: '236 TU 2024', mileage: 4300, image: img('photo-1603584173870-7f23fdae1b7a'), features: ['Quattro', 'Matrix LED', 'Suspension pneumatique'], description: 'Grand tourisme électrique de 637 ch.' },
  { key: 'range', brand: 'Range Rover', model: 'Evoque', type: 'SUV', year: 2023, price: 230, seats: 5, fuel: 'Diesel', transmission: 'Auto', plateNumber: '226 TU 8845', mileage: 33900, image: img('photo-1606016159991-dfe4f2746ad5'), features: ['Terrain Response', 'Meridian', 'Caméra'], description: 'SUV premium compact.' },
] as const;

type Status = 'pending' | 'approved' | 'picked_up' | 'completed' | 'declined' | 'cancelled';
interface DemoBooking {
  car: (typeof CARS)[number]['key'];
  name: string;
  phone: string;
  email?: string | null;
  start: string;
  end: string;
  pickupTime?: string;
  returnTime?: string;
  status: Status;
  extras?: string[];
  delivery?: string;
  locale?: 'fr' | 'en' | 'ar';
  source?: 'online' | 'admin';
  paid?: 'unpaid' | 'deposit' | 'paid';
  checkout?: { mileage: number; fuel: number; damages?: { x: number; y: number; note: string }[] };
  checkin?: { mileage: number; fuel: number; damages?: { x: number; y: number; note: string }[] };
  charges?: ExtraCharge[];
  notes?: string;
  birth?: string;
  license?: string;
}

// Customers (Tunisian names), including a repeat customer and a blacklisted one
const B: DemoBooking[] = [
  // Past, completed: revenue history over 12 months
  { car: 'clio', name: 'Mohamed Ben Ali', phone: '+216 22 145 678', start: month(10, 5), end: month(10, 9), status: 'completed', paid: 'paid', checkout: { mileage: 21000, fuel: 8 }, checkin: { mileage: 21820, fuel: 8 } },
  { car: 'tucson', name: 'Salma Gharbi', phone: '+216 98 330 441', start: month(9, 12), end: month(9, 19), status: 'completed', paid: 'paid', extras: ['child-seat'], checkout: { mileage: 5100, fuel: 8 }, checkin: { mileage: 6450, fuel: 8 } },
  { car: 'bmw', name: 'Karim Jlassi', phone: '+216 55 902 118', start: month(8, 2), end: month(8, 4), status: 'completed', paid: 'paid', checkout: { mileage: 3200, fuel: 8 }, checkin: { mileage: 3610, fuel: 7 }, charges: [{ kind: 'fuel', label: 'Fuel: 1/8 tank missing', amount: 15 }] },
  { car: 'polo', name: 'Mohamed Ben Ali', phone: '22 145 678', start: month(7, 14), end: month(7, 18), status: 'completed', paid: 'paid', checkout: { mileage: 40100, fuel: 8 }, checkin: { mileage: 41000, fuel: 8 } },
  { car: 'gclass', name: 'Nour El Houda Mansour', phone: '+216 20 777 802', start: month(6, 20), end: month(6, 27), status: 'completed', paid: 'paid', delivery: 'Hôtel Mövenpick, Sousse', checkout: { mileage: 9800, fuel: 8 }, checkin: { mileage: 11200, fuel: 8 } },
  { car: 'tesla', name: 'Youssef Trabelsi', phone: '+216 29 610 334', start: month(5, 3), end: month(5, 10), status: 'completed', paid: 'paid', checkout: { mileage: 14000, fuel: 8 }, checkin: { mileage: 15700, fuel: 8 } },
  { car: 'porsche', name: 'Amine Hammami', phone: '+216 52 118 900', start: month(4, 8), end: month(4, 10), status: 'completed', paid: 'paid', checkout: { mileage: 2100, fuel: 8 }, checkin: { mileage: 2690, fuel: 6 }, charges: [{ kind: 'km', label: '90 km over the 500 km included', amount: 27 }, { kind: 'fuel', label: 'Fuel: 2/8 tank missing', amount: 30 }] },
  { car: 'dacia', name: 'Mohamed Ben Ali', phone: '0021622145678', start: month(3, 1), end: month(3, 6), status: 'completed', paid: 'paid', checkout: { mileage: 88000, fuel: 8 }, checkin: { mileage: 89100, fuel: 8 } },
  { car: 'range', name: 'Ines Bouaziz', phone: '+216 97 440 215', start: month(2, 15), end: month(2, 22), status: 'completed', paid: 'paid', locale: 'en', checkout: { mileage: 30100, fuel: 8 }, checkin: { mileage: 31800, fuel: 8 } },
  { car: 'audi', name: 'Walid Sassi', phone: '+216 24 909 512', start: month(1, 4), end: month(1, 7), status: 'completed', paid: 'deposit', checkout: { mileage: 2900, fuel: 8, damages: [{ x: 70, y: 20, note: 'Petite rayure aile avant droite' }] }, checkin: { mileage: 3650, fuel: 7, damages: [{ x: 70, y: 20, note: 'Petite rayure aile avant droite' }, { x: 30, y: 88, note: 'Nouvelle bosse pare-choc arrière' }] }, charges: [{ kind: 'fuel', label: 'Fuel: 1/8 tank missing', amount: 15 }, { kind: 'damage', label: 'Bosse pare-choc arrière', amount: 180 }], notes: 'Client prévenu pour la bosse, règlement du solde à venir.' },
  { car: 'clio', name: 'Hedi Kefi', phone: '+216 21 305 660', start: day(-12), end: day(-9), status: 'completed', paid: 'paid', checkout: { mileage: 37100, fuel: 8 }, checkin: { mileage: 37950, fuel: 8 } },
  // Blacklisted customer: a past unpaid rental
  { car: 'polo', name: 'Riadh Mejri', phone: '+216 50 123 987', start: day(-40), end: day(-35), status: 'completed', paid: 'unpaid', checkout: { mileage: 49000, fuel: 8 }, checkin: { mileage: 50600, fuel: 3 }, charges: [{ kind: 'km', label: '350 km over the 1250 km included', amount: 105 }, { kind: 'fuel', label: 'Fuel: 5/8 tank missing', amount: 75 }], notes: 'Injoignable depuis le retour. Client bloqué.' },
  { car: 'bmw', name: 'Sarra Ayari', phone: '+216 23 876 540', start: day(-20), end: day(-17), status: 'declined', locale: 'fr' },
  { car: 'tesla', name: 'Oussama Khelifi', phone: '+216 26 454 101', start: day(-8), end: day(-5), status: 'cancelled' },

  // Out right now
  { car: 'tucson', name: 'Fatma Zouari', phone: '+216 99 212 343', start: day(-2), end: day(2), status: 'picked_up', paid: 'deposit', extras: ['gps'], checkout: { mileage: 12400, fuel: 8 } },
  // Late: was due back yesterday
  { car: 'dacia', name: 'Anis Chebbi', phone: '+216 58 700 612', start: day(-5), end: day(-1), returnTime: '18:00', status: 'picked_up', paid: 'deposit', checkout: { mileage: 97400, fuel: 8 } },

  // To hand over: approved, today and tomorrow (with the tester's email for contract/signature tests)
  { car: 'bmw', name: 'Aymen Test Démo', phone: '+216 94 000 111', email: DEMO_EMAIL, start: day(0), end: day(3), status: 'approved', paid: 'deposit', extras: ['full-insurance'], locale: 'fr', birth: '1992-03-14', license: '2012-09-01' },
  { car: 'gclass', name: 'Leila Test Démo', phone: '+216 94 000 222', email: DEMO_EMAIL, start: day(1), end: day(5), status: 'approved', paid: 'unpaid', delivery: 'Aéroport Tunis-Carthage', locale: 'ar', birth: '1988-11-02', license: '2008-06-15' },
  { car: 'porsche', name: 'Sami Bouzid', phone: '+216 25 333 777', start: day(6), end: day(9), status: 'approved', paid: 'unpaid' },

  // Waiting for the agency
  { car: 'audi', name: 'Rim Chaabane', phone: '+216 93 610 845', start: day(4), end: day(7), status: 'pending', source: 'online', locale: 'fr', birth: '1995-07-21', license: '2015-02-10' },
  { car: 'clio', name: 'Tom Dupont', phone: '+33 6 12 34 56 78', start: day(10), end: day(24), status: 'pending', source: 'online', locale: 'en', extras: ['extra-driver'], birth: '1990-01-30', license: '2009-05-05' },
  // Summer booking (seasonal price) for next year
  { car: 'range', name: 'Mehdi Ferchichi', phone: '+216 90 455 101', start: `${Number(today.slice(0, 4)) + 1}-07-20`, end: `${Number(today.slice(0, 4)) + 1}-07-27`, status: 'approved', paid: 'unpaid' },
];

async function main() {
  console.log(`Seeding demo database ${dbName}${DEMO_EMAIL ? ` (demo emails go to ${DEMO_EMAIL})` : ' (no DEMO_EMAIL: demo customers have no email)'}`);

  // Wipe everything (demo database only): removing the agencies removes all their data with them
  await runUnscoped(async () => {
    await prisma.alertLog.deleteMany();
    await prisma.platformEvent.deleteMany();
    await prisma.platformAdmin.deleteMany();
    await prisma.agency.deleteMany();
    // The platform console (http://app.localhost:5180/console)
    await prisma.platformAdmin.create({ data: { email: 'console@demo.test', name: 'Platform owner', passwordHash: await bcrypt.hash('demo1234', 10) } });
  });
  // The flagship agency: Business plan granted by the platform, no end date
  const agency = await runUnscoped(() => prisma.agency.create({
    data: { slug: process.env.DEFAULT_AGENCY_SLUG || 'rentcar', name: 'RentCar', city: 'Tunis', ownerEmail: DEMO_EMAIL ?? 'admin@demo.test', phone: '+216 94 859 352' },
    select: AGENCY_SELECT,
  }));
  await runAsAgency(agency, seedMainAgency);

  // A second, smaller agency on the same platform: its data must never show up in the first one
  const other = await runUnscoped(() => prisma.agency.create({
    // On a Starter trial that ends in 2 days: shows the trial banner and the upgrade flow
    data: { slug: 'sahel', name: 'Sahel Cars', primaryColor: '#1d4ed8', plan: 'starter', status: 'trial', trialEndsAt: new Date(Date.now() + 2 * 86_400_000), city: 'Sousse', ownerEmail: 'sahel@example.com', phone: '+216 73 000 000' },
    select: AGENCY_SELECT,
  }));
  await runAsAgency(other, async () => {
    await prisma.businessSettings.create({ data: { agencyId: other.id, data: { ...settings, contactEmail: 'contact@sahel-cars.example', contactPhone: '+216 73 000 000', whatsappNumber: '21673000000', companyName: 'Sahel Cars', companyAddress: 'Avenue Léopold Senghor, 4000 Sousse', companyTaxId: '7654321/B/M/000', siteTag: 'Sousse · Monastir · Enfidha', siteTitle1: 'Sahel', siteTitle2: 'Cars', siteText: 'Citadines récentes à petit prix, livrées à l’aéroport d’Enfidha et à votre hôtel. Réponse en 15 minutes sur WhatsApp.', siteAbout: 'Agence familiale à Sousse depuis 2015 : voitures récentes, révisées avant chaque location, et une équipe joignable 7 jours sur 7.' } as unknown as Prisma.InputJsonValue } });
    await prisma.adminUser.create({ data: { username: 'admin', email: 'sahel@example.com', role: 'owner', passwordHash: await bcrypt.hash('demo1234', 10) } });
    await prisma.car.createMany({ data: CARS.slice(0, 2).map(({ key: _key, ...c }) => ({ ...c, features: [...c.features], available: true })) });
  });

  // A paying Pro agency with a few months of invoices, for the console's revenue chart
  const djerba = await runUnscoped(() => prisma.agency.create({
    data: { slug: 'djerba-drive', name: 'Djerba Drive', primaryColor: '#d97706', plan: 'pro', status: 'active', city: 'Djerba', ownerEmail: 'djerba@example.com', phone: '+216 75 000 000', currentPeriodEnd: new Date(Date.now() + 18 * 86_400_000), createdAt: new Date(Date.now() - 130 * 86_400_000) },
    select: AGENCY_SELECT,
  }));
  await runAsAgency(djerba, async () => {
    await prisma.businessSettings.create({ data: { agencyId: djerba.id, data: { ...settings, contactEmail: 'contact@djerba-drive.example', contactPhone: '+216 75 000 000', whatsappNumber: '21675000000', companyName: 'Djerba Drive', companyAddress: 'Houmt Souk, Djerba', companyTaxId: '1112223/C/M/000', siteTag: 'Djerba · Zarzis', siteTitle1: 'Island', siteTitle2: 'Drive', siteText: 'SUV et électriques pour explorer Djerba : livraison gratuite à l’aéroport et dans les hôtels de la zone touristique.', siteAbout: 'Djerba Drive loue des voitures sur l’île depuis 2018. Nous connaissons chaque route, chaque plage et chaque hôtel.' } as unknown as Prisma.InputJsonValue } });
    await prisma.adminUser.create({ data: { username: 'admin', email: 'djerba@example.com', role: 'owner', passwordHash: await bcrypt.hash('demo1234', 10) } });
    await prisma.car.createMany({ data: CARS.filter((c) => ['tucson', 'dacia', 'tesla'].includes(c.key)).map(({ key: _key, ...c }) => ({ ...c, features: [...c.features], available: true })) });
    for (let m = 4; m >= 1; m--) {
      const paidAt = new Date(Date.now() - (m * 30 - 12) * 86_400_000);
      const inv = await prisma.invoice.create({ data: { plan: 'pro', cycle: 'monthly', months: 1, amount: 129, status: 'paid', provider: m % 2 ? 'konnect' : 'transfer', paidAt, periodStart: paidAt, periodEnd: new Date(paidAt.getTime() + 30 * 86_400_000), createdAt: paidAt } });
      await prisma.invoice.update({ where: { id: inv.id }, data: { number: `INV-${paidAt.getUTCFullYear()}-${String(inv.id).padStart(5, '0')}` } });
    }
  });

  // An agency that did not pay after its trial: suspended (its site shows a "paused" page)
  const capbon = await runUnscoped(() => prisma.agency.create({
    data: { slug: 'capbon', name: 'Cap Bon Location', primaryColor: '#16a34a', plan: 'starter', status: 'suspended', city: 'Nabeul', ownerEmail: 'capbon@example.com', trialEndsAt: new Date(Date.now() - 25 * 86_400_000), pastDueSince: new Date(Date.now() - 25 * 86_400_000), createdAt: new Date(Date.now() - 40 * 86_400_000) },
    select: AGENCY_SELECT,
  }));
  await runAsAgency(capbon, async () => {
    await prisma.adminUser.create({ data: { username: 'admin', email: 'capbon@example.com', role: 'owner', passwordHash: await bcrypt.hash('demo1234', 10) } });
    await prisma.car.createMany({ data: CARS.slice(7, 8).map(({ key: _key, ...c }) => ({ ...c, features: [...c.features], available: true })) });
  });
  await runUnscoped(() => prisma.platformEvent.createMany({ data: [
    { actor: 'agency: djerba-drive', action: 'signup', agencyId: djerba.id, details: 'Pro trial · Djerba', createdAt: new Date(Date.now() - 130 * 86_400_000) },
    { actor: 'agency: capbon', action: 'signup', agencyId: capbon.id, details: 'Starter trial · Nabeul', createdAt: new Date(Date.now() - 40 * 86_400_000) },
    { actor: 'system', action: 'suspended', agencyId: capbon.id, details: 'not paid after the grace period', createdAt: new Date(Date.now() - 18 * 86_400_000) },
    { actor: 'agency: sahel', action: 'signup', agencyId: other.id, details: 'Starter trial · Sousse', createdAt: new Date(Date.now() - 12 * 86_400_000) },
  ] }));
}

async function seedMainAgency() {
  await prisma.businessSettings.create({ data: { agencyId: requireAgency().id, data: settings as unknown as Prisma.InputJsonValue } });

  const hash = await bcrypt.hash('demo1234', 10);
  await prisma.adminUser.createMany({
    data: [
      { username: 'admin', email: 'admin@demo.test', role: 'owner', passwordHash: hash },
      { username: 'agent', email: 'agent@demo.test', role: 'staff', passwordHash: hash },
    ],
  });

  const cars: Record<string, { id: number; price: number }> = {};
  for (const c of CARS) {
    const papers = {
      // A few cars need attention: insurance ends in 5 days, vignette already expired, service due
      insuranceExpiry: c.key === 'tesla' ? day(5) : day(200 + c.price % 90),
      vignetteExpiry: c.key === 'dacia' ? day(-3) : day(95 + c.price % 60),
      inspectionExpiry: c.key === 'polo' ? day(20) : day(300),
      nextServiceKm: c.key === 'clio' ? 38500 : Math.ceil((c.mileage + 8000) / 1000) * 1000,
    };
    const { key: _key, ...data } = c;
    const created = await prisma.car.create({ data: { ...data, features: [...c.features], available: true, ...papers } });
    cars[c.key] = { id: created.id, price: c.price };
  }

  let n = 0;
  for (const b of B) {
    const car = cars[b.car];
    const quote = computeQuote({ pricePerDay: car.price, startDate: b.start, endDate: b.end, extraIds: b.extras ?? [], deliveryType: b.delivery ? 'delivery' : 'agency' }, settings);
    const charges = b.charges ?? [];
    const total = quote.total;
    const paidAmount = b.paid === 'paid' ? total + chargesTotal(charges) - (b.car === 'audi' ? 195 : 0) : b.paid === 'deposit' ? Math.round(total * 0.3) : 0;
    const createdAt = new Date(`${addDaysISO(b.start, -3 - (n % 5))}T${String(9 + (n % 9)).padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}:00Z`);
    const booking = await prisma.booking.create({
      data: {
        reference: generateReference(),
        carId: car.id,
        guestName: b.name,
        phone: b.phone,
        email: b.email ?? null,
        startDate: b.start,
        endDate: b.end,
        pickupTime: b.pickupTime ?? '10:00',
        returnTime: b.returnTime ?? '10:00',
        deliveryType: b.delivery ? 'delivery' : 'agency',
        deliveryAddress: b.delivery ?? null,
        status: b.status,
        extras: quote.extras as unknown as Prisma.InputJsonValue,
        subtotal: quote.subtotal,
        discount: quote.discount,
        extrasTotal: quote.extrasTotal,
        deliveryFee: quote.deliveryFee,
        total,
        deposit: quote.deposit,
        paymentStatus: b.paid ?? 'unpaid',
        amountPaid: Math.max(0, paidAmount),
        locale: b.locale ?? 'fr',
        source: b.source ?? 'admin',
        notes: b.notes ?? null,
        birthDate: b.birth ?? '1987-05-12',
        licenseIssueDate: b.license ?? '2007-10-01',
        licenseNumber: b.checkout ? `TN-${100000 + n * 7919}` : null,
        idNumber: b.checkout ? String(8000000 + n * 104729).slice(0, 8) : null,
        extraCharges: charges as unknown as Prisma.InputJsonValue,
        extraChargesTotal: chargesTotal(charges),
        createdAt,
      },
    });
    // Handover records use the car's photo so the PDFs have pictures
    const photo = CARS.find((c) => c.key === b.car)!.image;
    if (b.checkout) {
      await prisma.inspection.create({ data: { bookingId: booking.id, type: 'checkout', mileage: b.checkout.mileage, fuelLevel: b.checkout.fuel, damages: (b.checkout.damages ?? []) as Prisma.InputJsonValue, photos: [photo, photo, photo, photo], signerName: b.name, staffName: 'admin', createdAt: new Date(`${b.start}T09:${String(10 + n).padStart(2, '0')}:00Z`) } });
    }
    if (b.checkin) {
      await prisma.inspection.create({ data: { bookingId: booking.id, type: 'checkin', mileage: b.checkin.mileage, fuelLevel: b.checkin.fuel, damages: (b.checkin.damages ?? []) as Prisma.InputJsonValue, photos: [photo, photo, photo, photo], signerName: b.name, staffName: 'agent', createdAt: new Date(`${b.end}T09:${String(5 + n).padStart(2, '0')}:00Z`) } });
    }
    n++;
  }
  // Odometers match the latest return
  await prisma.car.update({ where: { id: cars.audi.id }, data: { mileage: 3650 } });

  await prisma.blockedCustomer.create({ data: { phone: '21650123987', name: 'Riadh Mejri', reason: 'Solde impayé et carburant non rendu' } });

  // Fines: one already charged, one still to identify with the lookup (during Hedi Kefi's rental)
  const hedi = await prisma.booking.findFirst({ where: { guestName: 'Hedi Kefi' } });
  const walid = await prisma.booking.findFirst({ where: { guestName: 'Walid Sassi' } });
  await prisma.fine.create({ data: { carId: cars.audi.id, bookingId: walid!.id, date: addDaysISO(walid!.startDate, 1), time: '16:20', amount: 60, description: 'Radar A1, 132 km/h', status: 'charged' } });
  await prisma.booking.update({
    where: { id: walid!.id },
    data: {
      extraCharges: [...(walid!.extraCharges as unknown as ExtraCharge[]), { kind: 'fine', label: 'Amende radar A1', amount: 60 }] as unknown as Prisma.InputJsonValue,
      extraChargesTotal: walid!.extraChargesTotal + 60,
    },
  });
  console.log(`Fine to look up: plate 215 TU 4481, date ${addDaysISO(hedi!.startDate, 1)}, 11:45 -> Hedi Kefi`);

  // Expenses over the year
  const expenses: [string, number, string, number, string][] = [
    ['clio', 9, 'service', 180, 'Vidange + filtres'], ['clio', 4, 'tyres', 420, '4 pneus Michelin'],
    ['polo', 8, 'repair', 350, 'Plaquettes et disques'], ['polo', 2, 'insurance', 900, 'Assurance annuelle'],
    ['tucson', 6, 'service', 260, 'Révision 10 000 km'], ['bmw', 5, 'tyres', 1400, 'Pneus sport'],
    ['gclass', 7, 'insurance', 3200, 'Assurance tous risques'], ['gclass', 1, 'cleaning', 80, 'Nettoyage intérieur'],
    ['tesla', 3, 'repair', 220, 'Pare-brise'], ['porsche', 2, 'service', 1100, 'Entretien constructeur'],
    ['dacia', 9, 'repair', 950, 'Embrayage'], ['dacia', 1, 'documents', 180, 'Visite technique + vignette'],
    ['audi', 0, 'repair', 180, 'Bosse pare-choc arrière'], ['range', 5, 'insurance', 1600, 'Assurance annuelle'],
  ];
  for (const [car, monthsAgo, category, amount, note] of expenses) {
    await prisma.expense.create({ data: { carId: cars[car].id, date: month(monthsAgo, 10), category, amount, note } });
  }

  await prisma.notification.createMany({
    data: [
      { type: 'new_booking', message: 'Nouvelle réservation en ligne de Rim Chaabane (Audi RS e-tron GT)', read: false },
      { type: 'new_booking', message: 'Nouvelle réservation en ligne de Tom Dupont (Renault Clio 5)', read: false },
    ],
  });

  const counts = await Promise.all([prisma.car.count(), prisma.booking.count(), prisma.inspection.count()]);
  console.log(`Demo ready: ${counts[0]} cars, ${counts[1]} bookings, ${counts[2]} inspections, 1 blocked customer, 1 fine, ${expenses.length} expenses`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
