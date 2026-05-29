interface BadgeProps {
  status: 'available' | 'maintenance' | 'pending' | 'approved' | 'declined';
}

const MAP: Record<BadgeProps['status'], string> = {
  available: 'badge-available',
  maintenance: 'badge-maintenance',
  pending: 'badge-pending',
  approved: 'badge-approved',
  declined: 'badge-declined',
};

const LABELS: Record<BadgeProps['status'], string> = {
  available: 'Available',
  maintenance: 'Maintenance',
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
};

export default function Badge({ status }: BadgeProps) {
  return <span className={MAP[status]}>{LABELS[status]}</span>;
}
