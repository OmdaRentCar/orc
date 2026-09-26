import { z } from 'zod';
import prisma from '../lib/prisma';

export const extraSchema = z.object({
  id: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/, 'id may only contain lowercase letters, numbers and dashes'),
  name: z.string().trim().min(1).max(60),
  price: z.number().min(0).max(10_000),
  per: z.enum(['day', 'booking']),
});

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
});

export type Extra = z.infer<typeof extraSchema>;
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
