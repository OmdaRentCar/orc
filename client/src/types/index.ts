export interface Car {
  id: number;
  brand: string;
  model: string;
  type: string;
  year: number;
  price: number;
  image: string | null;
  images: string[];
  available: boolean;
  seats: number;
  fuel: string;
  transmission: string;
  description: string | null;
  features: string[];
  plateNumber: string | null;
  mileage: number;
  insuranceExpiry: string | null;
  vignetteExpiry: string | null;
  inspectionExpiry: string | null;
  nextServiceKm: number | null;
  documentsExpired: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExtraCharge {
  label: string;
  amount: number;
  kind: 'km' | 'fuel' | 'late' | 'damage' | 'fine' | 'other';
}

export type BookingStatus = 'pending' | 'approved' | 'picked_up' | 'completed' | 'declined' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'deposit' | 'paid';
export type DeliveryType = 'agency' | 'delivery';

export interface BookingExtra {
  id: string;
  name: string;
  price: number;
  per: 'day' | 'booking';
  total: number;
}

export interface Booking {
  id: number;
  reference: string;
  carId: number;
  guestName: string;
  phone: string;
  email: string | null;
  startDate: string;
  endDate: string;
  pickupTime: string;
  returnTime: string;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  status: BookingStatus;
  documentImage: string | null;
  extras: BookingExtra[];
  subtotal: number;
  discount: number;
  extrasTotal: number;
  deliveryFee: number;
  total: number;
  deposit: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  locale: string;
  source: 'online' | 'admin';
  notes: string | null;
  birthDate: string | null;
  licenseNumber: string | null;
  licenseIssueDate: string | null;
  licenseExpiry: string | null;
  idNumber: string | null;
  customerAddress: string | null;
  extraCharges: ExtraCharge[];
  extraChargesTotal: number;
  createdAt: string;
  updatedAt: string;
  car?: { brand: string; model: string; image: string | null };
}

export interface Damage {
  x: number;
  y: number;
  note?: string;
}

export interface Inspection {
  id: number;
  bookingId: number;
  type: 'checkout' | 'checkin';
  mileage: number;
  fuelLevel: number;
  damages: Damage[];
  photos: { url: string; view: string; thumb: string }[];
  signature: string | null;
  signerName: string;
  notes: string | null;
  staffName: string;
  createdAt: string;
}

export interface Fine {
  id: number;
  carId: number;
  bookingId: number | null;
  date: string;
  time: string;
  amount: number;
  description: string | null;
  status: 'open' | 'charged' | 'paid';
  createdAt: string;
  car: { brand: string; model: string; plateNumber: string | null };
  booking: { reference: string; guestName: string; phone: string } | null;
}

export interface FineMatch {
  id: number;
  reference: string;
  guestName: string;
  phone: string;
  email: string | null;
  idNumber: string | null;
  licenseNumber: string | null;
  status: BookingStatus;
  from: string;
  to: string;
  basedOn: 'handover' | 'booking';
}

export type ExpenseCategory = 'repair' | 'service' | 'tyres' | 'insurance' | 'documents' | 'cleaning' | 'other';

export interface Expense {
  id: number;
  carId: number;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
  car: { brand: string; model: string; plateNumber: string | null };
}

export interface CarReport {
  from: string;
  to: string;
  periodDays: number;
  totals: { revenue: number; expenses: number; profit: number };
  cars: {
    carId: number;
    car: string;
    plateNumber: string | null;
    bookings: number;
    bookedDays: number;
    utilization: number;
    revenue: number;
    expenses: number;
    profit: number;
    byCategory: Record<ExpenseCategory, number>;
  }[];
}

export interface QuoteLine {
  label: string;
  days: number;
  rate: number;
  amount: number;
}

export interface Quote {
  days: number;
  dailyRate: number;
  lines: QuoteLine[];
  subtotal: number;
  discountPct: number;
  discount: number;
  extras: BookingExtra[];
  extrasTotal: number;
  deliveryFee: number;
  total: number;
  deposit: number;
}

export interface Extra {
  id: string;
  name: string;
  price: number;
  per: 'day' | 'booking';
}

export interface BusinessSettings {
  deliveryFee: number;
  weeklyDiscountPct: number;
  monthlyDiscountPct: number;
  depositAmount: number;
  whatsappNumber: string;
  contactEmail: string;
  contactPhone: string;
  extras: Extra[];
  weekendPct: number;
  seasons: Season[];
  kmPerDayIncluded: number;
  extraKmPrice: number;
  fuelChargePerEighth: number;
  lateGraceHours: number;
  minDriverAge: number;
  minLicenseYears: number;
  companyName: string;
  companyAddress: string;
  companyTaxId: string;
  contractTerms: string;
}

export interface Season {
  name: string;
  from: string; // MM-DD
  to: string;
  pct: number;
}

export interface BookingStatusView {
  reference: string;
  status: BookingStatus;
  guestName: string;
  car: { brand: string; model: string; image: string | null };
  startDate: string;
  endDate: string;
  pickupTime: string;
  returnTime: string;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  extras: BookingExtra[];
  subtotal: number;
  discount: number;
  extrasTotal: number;
  deliveryFee: number;
  total: number;
  deposit: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  extraCharges: ExtraCharge[];
  extraChargesTotal: number;
  createdAt: string;
}

export interface Notification {
  id: number;
  message: string;
  type: string;
  read: boolean;
  bookingId: number | null;
  createdAt: string;
}

export type AdminRole = 'owner' | 'staff';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
  createdAt?: string;
}

export interface DashboardStats {
  activeRentals: number;
  revenue: number;
  collected: number;
  inMaintenance: number;
  pendingCount: number;
  totalCars: number;
  totalBookings: number;
  bookingByStatus: { status: string; count: number }[];
  carsByType: { type: string; count: number }[];
  carsByBrand: { brand: string; count: number }[];
  upcoming: { id: number; reference: string; guestName: string; phone: string; locale: string; car: string; kind: 'pickup' | 'return'; date: string; time: string }[];
  alerts: { carId: number; car: string; kind: 'document' | 'service'; label: string; due: string; level: 'expired' | 'soon' | 'upcoming' }[];
  lateReturns: { id: number; reference: string; guestName: string; phone: string; locale: string; car: string; due: string }[];
  unpaid: { id: number; reference: string; guestName: string; phone: string; balance: number }[];
  unpaidTotal: number;
  monthly: { month: string; bookings: number; revenue: number }[];
}

export interface Customer {
  phone: string;
  normalizedPhone: string;
  name: string;
  email: string | null;
  bookings: number;
  completed: number;
  cancelledOrDeclined: number;
  totalSpent: number;
  lastBookingAt: string | null;
  blocked: boolean;
  blockReason: string | null;
}

export interface AuditEntry {
  id: number;
  adminId: number | null;
  username: string;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
}

export interface BookingSocketEvent {
  type: string;
  message: string;
  bookingId: number;
}
