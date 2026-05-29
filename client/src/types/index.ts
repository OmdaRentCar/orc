export interface Car {
  id: number;
  brand: string;
  model: string;
  type: string;
  year: number;
  price: number;
  image: string | null;
  available: boolean;
  seats: number;
  fuel: string;
  transmission: string;
  description: string | null;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'pending' | 'approved' | 'declined';

export interface Booking {
  id: number;
  carId: number;
  guestName: string;
  phone: string;
  email: string | null;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  documentImage: string | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  car?: { brand: string; model: string };
}

export interface Notification {
  id: number;
  message: string;
  type: string;
  read: boolean;
  bookingId: number | null;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
}

export interface DashboardStats {
  activeRentals: number;
  revenue: number;
  inMaintenance: number;
  pendingCount: number;
  totalCars: number;
  totalBookings: number;
  bookingByStatus: { status: string; count: number }[];
  carsByType: { type: string; count: number }[];
  carsByBrand: { brand: string; count: number }[];
  monthlyBookings: { month: string; count: number }[];
}

export interface BookingSocketEvent {
  type: string;
  message: string;
  bookingId: number;
}
