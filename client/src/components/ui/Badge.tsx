export type BadgeStatus =
  | 'available' | 'maintenance'
  | 'pending' | 'approved' | 'picked_up' | 'completed' | 'declined' | 'cancelled'
  | 'unpaid' | 'deposit' | 'paid';

const MAP: Record<BadgeStatus, string> = {
  available: 'badge-available',
  maintenance: 'badge-maintenance',
  pending: 'badge-pending',
  approved: 'badge-approved',
  picked_up: 'badge-picked-up',
  completed: 'badge-completed',
  declined: 'badge-declined',
  cancelled: 'badge-maintenance',
  unpaid: 'badge-declined',
  deposit: 'badge-pending',
  paid: 'badge-approved',
};

export const STATUS_LABELS: Record<BadgeStatus, string> = {
  available: 'Available',
  maintenance: 'Maintenance',
  pending: 'Pending',
  approved: 'Approved',
  picked_up: 'Picked up',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  unpaid: 'Unpaid',
  deposit: 'Deposit paid',
  paid: 'Paid',
};

export default function Badge({ status }: { status: BadgeStatus }) {
  return <span className={MAP[status]}>{STATUS_LABELS[status]}</span>;
}
