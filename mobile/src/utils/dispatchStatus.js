// Shared status helpers for responder dispatches (badges, filters, map pins).

export const ACTIVE_DISPATCH_STATUSES = ['DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS', 'PENDING'];
export const NAVIGABLE_DISPATCH_STATUSES = ['DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS'];

// One colour per lifecycle stage, independent of incident type.
export const STATUS_STYLES = {
  ASSIGNED: { label: 'Assigned', bg: 'bg-violet-50', text: 'text-violet-700', dot: '#7C3AED' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-50', text: 'text-blue-700', dot: '#2563EB' },
  EN_ROUTE: { label: 'En Route', bg: 'bg-blue-50', text: 'text-blue-700', dot: '#2563EB' },
  ON_SCENE: { label: 'On Scene', bg: 'bg-sky-50', text: 'text-sky-700', dot: '#0284C7' },
  PENDING: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-800', dot: '#D97706' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-50', text: 'text-[#1F7A4D]', dot: '#1F7A4D' },
  DECLINED: { label: 'Declined', bg: 'bg-slate-100', text: 'text-slate-600', dot: '#64748B' },
};

export function getStatusStyle(item) {
  let key = item?.status;
  if (key === 'DISPATCHED') key = 'ASSIGNED';
  if (key === 'ACCEPTED') key = 'IN_PROGRESS';
  if (item?.is_maintenance && item?.inspection_done && !['COMPLETED', 'PENDING', 'DECLINED'].includes(item.status)) {
    key = 'IN_PROGRESS';
  }
  return (
    STATUS_STYLES[key] || {
      label: String(item?.status || 'Assigned')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase()),
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      dot: '#64748B',
    }
  );
}

export function formatTimestamp(value) {
  if (!value) return 'Just now';
  const str = String(value);
  const date = new Date(str.includes('T') ? str : `${str.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTitleCase(value, fallback = 'Untitled Incident') {
  const str = String(value || '').trim();
  if (!str) return fallback;
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
