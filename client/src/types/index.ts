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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
  car?: { brand: string; model: string; image: string | null };
}

export interface Quote {
  days: number;
  dailyRate: number;
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
  upcoming: { id: number; reference: string; guestName: string; car: string; kind: 'pickup' | 'return'; date: string; time: string }[];
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
