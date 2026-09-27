import { z } from 'zod';
import prisma from '../lib/prisma';

export const extraSchema = z.object({
  id: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/, 'id may only contain lowercase letters, numbers and dashes'),
  name: z.string().trim().min(1).max(60),
  price: z.number().min(0).max(10_000),
  per: z.enum(['day', 'booking']),
});

const monthDay = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'use MM-DD, e.g. 07-01');

export const seasonSchema = z.object({
  name: z.string().trim().min(1).max(40),
  from: monthDay,
  to: monthDay,
  pct: z.number().min(-90).max(300),
});

export const DEFAULT_CONTRACT_TERMS = [
  "Le locataire s'engage à restituer le véhicule à la date, l'heure et au lieu convenus, dans l'état constaté lors de la prise en charge.",
  "Le véhicule doit être rendu avec le même niveau de carburant qu'au départ. Tout huitième manquant est facturé selon le tarif en vigueur.",
  "Les kilomètres au-delà du forfait inclus sont facturés au tarif en vigueur. Tout retard au-delà de la tolérance est facturé par journée entamée.",
  "Le locataire est responsable des amendes, contraventions et péages encourus pendant la durée de la location.",
  "Il est interdit de sous-louer le véhicule, de le conduire sous l'emprise d'alcool ou de stupéfiants, ou de le confier à un conducteur non déclaré.",
  "Tout dommage constaté au retour et absent de l'état des lieux de départ est à la charge du locataire, dans la limite de la caution et de l'assurance souscrite.",
  "La caution est restituée au retour du véhicule, déduction faite des éventuels frais supplémentaires.",
].join('\n');

export const settingsSchema = z.object({
  deliveryFee: z.number().min(0).max(10_000),
  weeklyDiscountPct: z.number().min(0).max(90),
  monthlyDiscountPct: z.number().min(0).max(90),
  depositAmount: z.number().min(0).max(100_000),
  whatsappNumber: z.string().trim().max(20).regex(/^\+?\d*$/, 'digits only, e.g. 21612345678'),
  contactEmail: z.string().trim().max(200),
  contactPhone: z.string().trim().max(30),
  extras: z.array(extraSchema).max(20).refine(
    (extras) => new Set(extras.map((e) => e.id)).size === extras.length,
    'each extra needs a unique id',
  ),
  // Pricing by date: +% for weekends (Saturday and Sunday) and for seasons such as summer
  weekendPct: z.number().min(-90).max(300).default(0),
  seasons: z.array(seasonSchema).max(12).default([]),
  // Handover charges
  kmPerDayIncluded: z.number().int().min(0).max(5000).default(0), // 0 = unlimited
  extraKmPrice: z.number().min(0).max(100).default(0.3),
  fuelChargePerEighth: z.number().min(0).max(1000).default(15),
  lateGraceHours: z.number().min(0).max(48).default(1),
  // Driver requirements
  minDriverAge: z.number().int().min(16).max(99).default(21),
  minLicenseYears: z.number().min(0).max(50).default(2),
  // Printed on the rental contract
  companyName: z.string().trim().max(120).default('RentCar'),
  companyAddress: z.string().trim().max(300).default(''),
  companyTaxId: z.string().trim().max(60).default(''),
  contractTerms: z.string().trim().max(5000).default(DEFAULT_CONTRACT_TERMS),
});

export type Extra = z.infer<typeof extraSchema>;
export type Season = z.infer<typeof seasonSchema>;
export type BusinessSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: BusinessSettings = {
  deliveryFee: 30,
  weeklyDiscountPct: 10,
  monthlyDiscountPct: 20,
  depositAmount: 500,
  whatsappNumber: '',
  contactEmail: 'contact@example.com',
  contactPhone: '',
  extras: [
    { id: 'child-seat', name: 'Child seat', price: 10, per: 'day' },
    { id: 'extra-driver', name: 'Additional driver', price: 15, per: 'day' },
    { id: 'full-insurance', name: 'Full insurance', price: 25, per: 'day' },
    { id: 'gps', name: 'GPS', price: 5, per: 'day' },
  ],
  weekendPct: 0,
  seasons: [],
  kmPerDayIncluded: 0,
  extraKmPrice: 0.3,
  fuelChargePerEighth: 15,
  lateGraceHours: 1,
  minDriverAge: 21,
  minLicenseYears: 2,
  companyName: 'RentCar',
  companyAddress: '',
  companyTaxId: '',
  contractTerms: DEFAULT_CONTRACT_TERMS,
};

export async function getSettings(): Promise<BusinessSettings> {
  const row = await prisma.businessSettings.findUnique({ where: { id: 1 } });
  return { ...DEFAULT_SETTINGS, ...((row?.data as Partial<BusinessSettings> | undefined) ?? {}) };
}

export async function saveSettings(data: BusinessSettings): Promise<BusinessSettings> {
  await prisma.businessSettings.upsert({
    where: { id: 1 },
    create: { id: 1, data },
    update: { data },
  });
  return data;
}
