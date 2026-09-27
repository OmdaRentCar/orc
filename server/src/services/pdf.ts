import PDFDocument from 'pdfkit';
import type { Booking, Car, Inspection } from '@prisma/client';
import { signedImageUrl } from './cloudinary';
import type { BusinessSettings } from './settings';
import type { ExtraCharge } from './handover';

// Contract and return report, generated from the database whenever they are needed (nothing to keep in sync)

type Doc = InstanceType<typeof PDFDocument>;
type Damage = { x: number; y: number; note?: string };
type FullBooking = Booking & { car: Car; inspections: Inspection[] };

const INK = '#111111', MUTED = '#6b6b6b', LINE = '#d9d6d0', RED = '#c81e24';
const M = 42; // page margin (pt)

const money = (n: number) => `${Number(n.toFixed(3))} DT`;
const fr = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '-');
const fuel = (eighths: number) => `${eighths}/8`;
const km = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

async function fetchImage(url: string, width: number): Promise<Buffer | null> {
  try {
    const res = await fetch(signedImageUrl(url, width));
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function toBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function header(doc: Doc, s: BusinessSettings, title: string, b: FullBooking) {
  doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(s.companyName || 'RentCar', M, M, { continued: true }).fillColor(RED).text('.');
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  const company = [s.companyAddress, s.companyTaxId && `MF ${s.companyTaxId}`, s.contactPhone, s.contactEmail].filter(Boolean).join('  ·  ');
  if (company) doc.text(company, M, doc.y + 2, { width: 330 });

  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(title, 330, M + 2, { width: doc.page.width - 330 - M, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(`Réf. ${b.reference}`, 330, doc.y + 2, { width: doc.page.width - 330 - M, align: 'right' })
    .text(`Édité le ${new Date().toLocaleDateString('fr-FR', { timeZone: process.env.BUSINESS_TZ || 'Africa/Tunis' })}`, { width: doc.page.width - 330 - M, align: 'right' });

  const y = Math.max(doc.y, M + 44) + 10;
  doc.moveTo(M, y).lineTo(doc.page.width - M, y).lineWidth(0.6).strokeColor(INK).stroke();
  doc.y = y + 12;
}

function section(doc: Doc, title: string) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(RED).text(title.toUpperCase(), M, doc.y, { characterSpacing: 1.2 });
  const y = doc.y + 3;
  doc.moveTo(M, y).lineTo(doc.page.width - M, y).lineWidth(0.4).strokeColor(LINE).stroke();
  doc.y = y + 6;
}

// Two columns of label/value pairs, laid out row by row so both columns stay aligned
function fields(doc: Doc, rows: [string, string][]) {
  const colW = (doc.page.width - 2 * M) / 2;
  const labelW = 108;
  for (let i = 0; i < rows.length; i += 2) {
    const y = doc.y;
    let bottom = y;
    rows.slice(i, i + 2).forEach(([label, value], col) => {
      const x = M + col * colW;
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, x, y + 1, { width: labelW });
      bottom = Math.max(bottom, doc.y);
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(value || '-', x + labelW + 4, y, { width: colW - labelW - 12 });
      bottom = Math.max(bottom, doc.y);
    });
    doc.y = bottom + 3;
  }
  doc.x = M;
}

function amountRows(doc: Doc, rows: [string, string, boolean?][]) {
  const w = doc.page.width - 2 * M;
  for (const [label, value, strong] of rows) {
    const y = doc.y;
    doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 10.5 : 9).fillColor(strong ? INK : MUTED).text(label, M, y, { width: w - 120 });
    doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fillColor(strong ? RED : INK).text(value, M + w - 120, y, { width: 120, align: 'right' });
    doc.y = Math.max(doc.y, y + (strong ? 14 : 12));
  }
}

// Top view of a car; damage coordinates are 0-100 on both axes, like the admin screen
function carOutline(doc: Doc, x: number, y: number, w: number, h: number, damages: Damage[], color = RED) {
  const px = (v: number) => x + (v / 100) * w;
  const py = (v: number) => y + (v / 100) * h;
  doc.save().lineWidth(0.8).strokeColor(INK);
  doc.roundedRect(px(28), py(4), px(72) - px(28), py(96) - py(4), 14).stroke();
  doc.moveTo(px(31), py(27)).quadraticCurveTo(px(50), py(22), px(69), py(27)).lineTo(px(66), py(37)).lineTo(px(34), py(37)).closePath().stroke();
  doc.moveTo(px(33), py(76)).lineTo(px(67), py(76)).lineTo(px(65), py(84)).lineTo(px(35), py(84)).closePath().stroke();
  doc.rect(px(34), py(40), px(66) - px(34), py(73) - py(40)).lineWidth(0.4).strokeColor(LINE).stroke();
  for (const [wx, wy] of [[24, 16], [72, 16], [24, 72], [72, 72]]) {
    doc.roundedRect(px(wx), py(wy), px(wx + 4) - px(wx), py(wy + 12) - py(wy), 1.5).fillColor(INK).fill();
  }
  doc.font('Helvetica').fontSize(6).fillColor(MUTED).text('AVANT', px(40), py(0) - 2, { width: px(60) - px(40), align: 'center' });
  damages.forEach((d, i) => {
    doc.circle(px(d.x), py(d.y), 5.5).fillColor(color).fill();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#ffffff').text(String(i + 1), px(d.x) - 5.5, py(d.y) - 2.6, { width: 11, align: 'center' });
  });
  doc.restore();
}

function inspectionBlock(doc: Doc, insp: Inspection, title: string, damageColor = RED) {
  const damages = (insp.damages as Damage[]) ?? [];
  const top = doc.y;
  const diagramW = 120, diagramH = 170;
  carOutline(doc, M, top, diagramW, diagramH, damages, damageColor);

  const x = M + diagramW + 24;
  const w = doc.page.width - M - x;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(title, x, top, { width: w });
  doc.font('Helvetica').fontSize(9).fillColor(INK)
    .text(`Kilométrage : ${km(insp.mileage)} km`, x, doc.y + 4, { width: w })
    .text(`Carburant : ${fuel(insp.fuelLevel)}`, { width: w });
  // Fuel gauge: eight cells
  const gy = doc.y + 4;
  for (let i = 0; i < 8; i++) {
    doc.rect(x + i * 14, gy, 12, 6).lineWidth(0.5).strokeColor(INK).fillColor(i < insp.fuelLevel ? INK : '#ffffff').fillAndStroke();
  }
  doc.y = gy + 14;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Par ${insp.staffName} le ${insp.createdAt.toLocaleString('fr-FR', { timeZone: process.env.BUSINESS_TZ || 'Africa/Tunis', dateStyle: 'short', timeStyle: 'short' })}`,
    x, doc.y, { width: w },
  );
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(damages.length ? `Dommages relevés (${damages.length})` : 'Aucun dommage relevé', x, doc.y, { width: w });
  damages.forEach((d, i) => doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(`${i + 1}.  ${d.note || 'Dommage'}`, x, doc.y + 1, { width: w }));
  if (insp.notes) doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(MUTED).text(insp.notes, x, doc.y + 4, { width: w });
  doc.y = Math.max(doc.y, top + diagramH) + 8;
  doc.x = M;
}

async function photoGrid(doc: Doc, photos: string[], label: string) {
  if (!photos.length) return;
  const images = (await Promise.all(photos.slice(0, 8).map((p) => fetchImage(p, 700)))).filter((b): b is Buffer => !!b);
  if (!images.length) return;
  const cols = 4, gap = 6;
  const cellW = (doc.page.width - 2 * M - gap * (cols - 1)) / cols, cellH = cellW * 0.72;
  const rows = Math.ceil(images.length / cols);
  if (doc.y + 14 + rows * (cellH + gap) > doc.page.height - M) doc.addPage();
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, M, doc.y);
  const top = doc.y + 4;
  images.forEach((img, i) => {
    const x = M + (i % cols) * (cellW + gap);
    const y = top + Math.floor(i / cols) * (cellH + gap);
    try {
      doc.image(img, x, y, { fit: [cellW, cellH], align: 'center', valign: 'center' });
      doc.rect(x, y, cellW, cellH).lineWidth(0.3).strokeColor(LINE).stroke();
    } catch { /* unreadable image: skip it */ }
  });
  doc.y = top + rows * (cellH + gap) + 4;
  doc.x = M;
}

async function signatures(doc: Doc, insp: Inspection, customerLabel: string) {
  if (doc.y > doc.page.height - 130) doc.addPage();
  const y = doc.y + 6;
  const w = (doc.page.width - 2 * M - 30) / 2;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(customerLabel, M, y, { width: w });
  doc.text("Pour l'agence", M + w + 30, y, { width: w });
  const sig = insp.signature ? await fetchImage(insp.signature, 600) : null;
  if (sig) {
    try { doc.image(sig, M, y + 12, { fit: [w, 54] }); } catch { /* ignore */ }
  }
  doc.moveTo(M, y + 70).lineTo(M + w, y + 70).lineWidth(0.5).strokeColor(INK).stroke();
  doc.moveTo(M + w + 30, y + 70).lineTo(M + 2 * w + 30, y + 70).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(insp.signerName, M, y + 74, { width: w });
  doc.text(insp.staffName, M + w + 30, y + 74, { width: w });
  doc.y = y + 92;
}

function footer(doc: Doc, b: FullBooking) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(
      `${b.reference}  ·  page ${i + 1} / ${range.count}`,
      M, doc.page.height - M + 12, { width: doc.page.width - 2 * M, align: 'right', lineBreak: false },
    );
    doc.page.margins.bottom = bottom;
  }
}

function newDoc(title: string): Doc {
  return new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true, info: { Title: title, Author: 'RentCar' } });
}

export interface OnlineSignature {
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  ip: string;
  userAgent: string;
  signature: Buffer; // PNG of the drawn signature
  sentBy: string;
  sentAt: Date;
  verificationCode: string;
  verifyUrl: string;
}

export interface ContractOptions {
  preview?: boolean; // unsigned copy shown to the customer before signing
  online?: OnlineSignature; // signed remotely: signature + certificate page
}

const when = (d: Date) => d.toLocaleString('fr-FR', { timeZone: process.env.BUSINESS_TZ || 'Africa/Tunis', dateStyle: 'long', timeStyle: 'medium' }).replace(/\u202f/g, ' ');

function watermark(doc: Doc, text: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.save();
    doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.font('Helvetica-Bold').fontSize(58).fillColor(RED).fillOpacity(0.08)
      .text(text, 0, doc.page.height / 2 - 30, { width: doc.page.width, align: 'center', lineBreak: false });
    doc.restore();
    doc.fillOpacity(1);
  }
}

function certificatePage(doc: Doc, b: FullBooking, s: BusinessSettings, o: OnlineSignature) {
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('CERTIFICAT DE SIGNATURE ÉLECTRONIQUE', M, M, { width: doc.page.width - 2 * M });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Contrat ${b.reference}  ·  ${s.companyName || 'RentCar'}`, M, doc.y + 4);
  doc.moveTo(M, doc.y + 8).lineTo(doc.page.width - M, doc.y + 8).lineWidth(0.6).strokeColor(INK).stroke();
  doc.y += 18;
  const labelW = 150;
  for (const [label, value] of [
    ['Signataire', o.signerName],
    ['Identité vérifiée par', `Code à usage unique envoyé à ${o.signerEmail}`],
    ['Signé le', when(o.signedAt)],
    ['Adresse IP', o.ip || '-'],
    ['Appareil', o.userAgent.slice(0, 160) || '-'],
    ['Émis au nom de l’agence par', `${o.sentBy}, le ${when(o.sentAt)}`],
  ]) {
    const y = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, M, y, { width: labelW });
    doc.font('Helvetica').fontSize(9).fillColor(INK).text(value, M + labelW, y, { width: doc.page.width - 2 * M - labelW });
    doc.y = Math.max(doc.y, y + 12) + 4;
  }
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('Code de vérification', M, doc.y);
  doc.font('Courier-Bold').fontSize(20).fillColor(RED).text(o.verificationCode, M, doc.y + 4);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`Vérifiez l’authenticité de ce contrat sur ${o.verifyUrl}`, M, doc.y + 4, { width: doc.page.width - 2 * M });
  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(
    "Au moment de la signature, l'agence a enregistré l'empreinte numérique (SHA-256) de ce fichier PDF. "
    + "La page de vérification permet de contrôler que le fichier n'a pas été modifié depuis : la moindre modification change l'empreinte. "
    + 'Le locataire a lu le contrat en ligne, accepté les conditions générales, confirmé son identité par un code reçu par e-mail, puis apposé sa signature manuscrite sur écran.',
    M, doc.y, { width: doc.page.width - 2 * M, align: 'justify', lineGap: 2 },
  );
}

export async function contractPdf(b: FullBooking, s: BusinessSettings, opts: ContractOptions = {}): Promise<Buffer> {
  const out = b.inspections.find((i) => i.type === 'checkout');
  const doc = newDoc(`Contrat ${b.reference}`);
  header(doc, s, 'CONTRAT DE LOCATION', b);

  section(doc, 'Locataire');
  fields(doc, [
    ['Nom et prénom', b.guestName],
    ['Téléphone', b.phone],
    ['CIN / Passeport', b.idNumber ?? ''],
    ['E-mail', b.email ?? ''],
    ['Date de naissance', fr(b.birthDate)],
    ['Adresse', b.customerAddress ?? ''],
    ['Permis n°', b.licenseNumber ?? ''],
    ['Permis délivré le', fr(b.licenseIssueDate)],
    ['Permis valable jusqu’au', fr(b.licenseExpiry)],
  ]);

  section(doc, 'Véhicule');
  fields(doc, [
    ['Véhicule', `${b.car.brand} ${b.car.model} (${b.car.year})`],
    ['Immatriculation', b.car.plateNumber ?? ''],
    ['Carburant', b.car.fuel],
    ['Boîte', b.car.transmission],
  ]);

  section(doc, 'Location');
  fields(doc, [
    ['Départ', `${fr(b.startDate)} à ${b.pickupTime}`],
    ['Retour prévu', `${fr(b.endDate)} à ${b.returnTime}`],
    ['Prise en charge', b.deliveryType === 'delivery' ? `Livraison : ${b.deliveryAddress ?? ''}` : 'En agence'],
    ['Options', ((b.extras as { name: string }[]) ?? []).map((e) => e.name).join(', ') || 'Aucune'],
    ['Kilométrage inclus', s.kmPerDayIncluded > 0 ? `${s.kmPerDayIncluded} km / jour` : 'Illimité'],
    ['Km supplémentaire', s.kmPerDayIncluded > 0 ? money(s.extraKmPrice) : '-'],
  ]);

  section(doc, 'Tarif');
  const rows: [string, string, boolean?][] = [['Location', money(b.subtotal)]];
  if (b.discount > 0) rows.push(['Remise longue durée', `-${money(b.discount)}`]);
  for (const e of (b.extras as { name: string; total: number }[]) ?? []) rows.push([e.name, money(e.total)]);
  if (b.deliveryFee > 0) rows.push(['Livraison', money(b.deliveryFee)]);
  rows.push(['Total de la location', money(b.total), true]);
  rows.push([`Caution (restituée au retour)`, money(b.deposit)]);
  amountRows(doc, rows);

  if (out) {
    section(doc, 'État des lieux de départ');
    inspectionBlock(doc, out, 'Au départ');
    await photoGrid(doc, out.photos, 'Photos au départ');
  }

  section(doc, 'Conditions générales');
  s.contractTerms.split('\n').filter((l) => l.trim()).forEach((line, i) => {
    doc.font('Helvetica').fontSize(8).fillColor(INK).text(`${i + 1}.  ${line.trim()}`, M, doc.y + 1, { width: doc.page.width - 2 * M, align: 'justify' });
  });

  if (opts.online) {
    const o = opts.online;
    section(doc, 'Signatures');
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Le locataire reconnaît avoir pris connaissance du contrat et des conditions ci-dessus, et les accepte.', M, doc.y, { width: doc.page.width - 2 * M });
    if (doc.y > doc.page.height - 130) doc.addPage();
    const y = doc.y + 6;
    const w = (doc.page.width - 2 * M - 30) / 2;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Le locataire (lu et approuvé)', M, y, { width: w });
    doc.text("Pour l'agence", M + w + 30, y, { width: w });
    try { doc.image(o.signature, M, y + 12, { fit: [w, 54] }); } catch { /* unreadable signature image */ }
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(INK).text(`Contrat émis électroniquement\npar ${o.sentBy}`, M + w + 30, y + 24, { width: w });
    doc.moveTo(M, y + 70).lineTo(M + w, y + 70).lineWidth(0.5).strokeColor(INK).stroke();
    doc.moveTo(M + w + 30, y + 70).lineTo(M + 2 * w + 30, y + 70).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(`${o.signerName}, signé électroniquement le ${when(o.signedAt)}`, M, y + 74, { width: w });
    doc.text(s.companyName || 'RentCar', M + w + 30, y + 74, { width: w });
    doc.y = y + 100;
    certificatePage(doc, b, s, o);
  } else if (out && !opts.preview) {
    section(doc, 'Signatures');
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Le locataire reconnaît avoir pris connaissance des conditions ci-dessus et reçu le véhicule dans l’état décrit.', M, doc.y, { width: doc.page.width - 2 * M });
    await signatures(doc, out, 'Le locataire (lu et approuvé)');
  }

  if (opts.preview) watermark(doc, 'APERÇU - NON SIGNÉ');
  footer(doc, b);
  return toBuffer(doc);
}

export async function returnReportPdf(b: FullBooking, s: BusinessSettings): Promise<Buffer> {
  const out = b.inspections.find((i) => i.type === 'checkout');
  const back = b.inspections.find((i) => i.type === 'checkin');
  const doc = newDoc(`Retour ${b.reference}`);
  header(doc, s, 'RAPPORT DE RETOUR', b);

  section(doc, 'Location');
  fields(doc, [
    ['Locataire', b.guestName],
    ['Véhicule', `${b.car.brand} ${b.car.model}${b.car.plateNumber ? ` · ${b.car.plateNumber}` : ''}`],
    ['Départ', `${fr(b.startDate)} à ${b.pickupTime}`],
    ['Retour prévu', `${fr(b.endDate)} à ${b.returnTime}`],
  ]);

  if (out && back) {
    section(doc, 'Relevés');
    amountRows(doc, [
      ['Kilométrage (départ · retour)', `${km(out.mileage)} km · ${km(back.mileage)} km`],
      ['Distance parcourue', `${km(back.mileage - out.mileage)} km`],
      ['Carburant (départ · retour)', `${fuel(out.fuelLevel)} · ${fuel(back.fuelLevel)}`],
    ]);
  }

  if (back) {
    section(doc, 'État du véhicule au retour');
    inspectionBlock(doc, back, 'Au retour');
    await photoGrid(doc, back.photos, 'Photos au retour');
  }
  if (out) {
    section(doc, 'Pour comparaison : état au départ');
    inspectionBlock(doc, out, 'Au départ', MUTED);
  }

  section(doc, 'Montants');
  const charges = (b.extraCharges as unknown as ExtraCharge[]) ?? [];
  const rows: [string, string, boolean?][] = [['Total de la location', money(b.total)]];
  for (const c of charges) rows.push([c.label, money(c.amount)]);
  const grand = b.total + b.extraChargesTotal;
  rows.push(['Total dû', money(grand), true]);
  rows.push(['Déjà payé', money(b.amountPaid)]);
  rows.push(['Reste à payer', money(Math.max(0, grand - b.amountPaid)), true]);
  amountRows(doc, rows);

  if (back) {
    section(doc, 'Signatures');
    await signatures(doc, back, 'Le locataire');
  }
  footer(doc, b);
  return toBuffer(doc);
}
