import PDFDocument from 'pdfkit';
import type { Agency, Invoice } from '@prisma/client';
import { platform } from '../lib/platform';
import { getPlan } from '../lib/plans';

// Receipt for a paid subscription period. Amounts are tax included; the VAT part is shown separately.
const INK = '#111111', MUTED = '#6b6b6b', LINE = '#d9d6d0', RED = '#c81e24';
const dt = (n: number) => `${n.toFixed(3)} DT`;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '-');

export function invoicePdf(inv: Invoice, agency: Agency): Promise<Buffer> {
  const p = platform();
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Facture ${inv.number ?? inv.id}`, Author: p.company } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });

  const W = doc.page.width - 100;
  doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(p.name, 50, 50, { continued: true }).fillColor(RED).text('.');
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(p.company).text(p.address);
  if (p.taxId) doc.text(`Matricule fiscal : ${p.taxId}`);
  doc.text(p.email);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text('FACTURE', 50, 50, { width: W, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
    .text(`N° ${inv.number ?? `#${inv.id}`}`, { width: W, align: 'right' })
    .text(`Date : ${day(inv.paidAt ?? inv.createdAt)}`, { width: W, align: 'right' })
    .text(inv.status === 'paid' ? 'Payée' : 'En attente de paiement', { width: W, align: 'right' });

  doc.moveDown(3);
  const y0 = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Facturé à', 50, y0);
  doc.font('Helvetica').fillColor(MUTED).text(agency.name).text(`${agency.slug}`);
  if (agency.city) doc.text(agency.city);
  if (agency.ownerEmail) doc.text(agency.ownerEmail);

  doc.moveDown(2);
  const ty = doc.y;
  doc.moveTo(50, ty).lineTo(50 + W, ty).strokeColor(LINE).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Description', 50, ty + 8).text('Montant TTC', 50, ty + 8, { width: W, align: 'right' });
  doc.moveTo(50, ty + 26).lineTo(50 + W, ty + 26).stroke();
  const plan = getPlan(inv.plan);
  doc.font('Helvetica').fillColor(INK)
    .text(`Abonnement ${p.name} ${plan.name} (${inv.cycle === 'yearly' ? 'annuel' : 'mensuel'})`, 50, ty + 36)
    .text(dt(inv.amount), 50, ty + 36, { width: W, align: 'right' });
  doc.fillColor(MUTED).fontSize(9).text(`Période du ${day(inv.periodStart)} au ${day(inv.periodEnd)}`, 50, ty + 52);

  const ht = inv.amount / (1 + p.vatPct / 100);
  let y = ty + 90;
  doc.moveTo(300, y - 10).lineTo(50 + W, y - 10).strokeColor(LINE).stroke();
  for (const [label, value, bold] of [['Total HT', dt(ht), false], [`TVA ${p.vatPct} %`, dt(inv.amount - ht), false], ['Total TTC', dt(inv.amount), true]] as const) {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(bold ? RED : INK)
      .text(label, 300, y).text(value, 300, y, { width: 50 + W - 300, align: 'right' });
    y += 20;
  }
  if (inv.status === 'paid') {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Réglé le ${day(inv.paidAt)} par ${({ konnect: 'Konnect', flouci: 'Flouci', manual: 'paiement de test', transfer: 'virement', cash: 'espèces' } as Record<string, string>)[inv.provider] ?? inv.provider}.`, 50, y + 20);
  }
  doc.end();
  return done;
}
