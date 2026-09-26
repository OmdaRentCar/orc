import { useEffect, useMemo, useState } from 'react';
import { apiJSON } from '../../services/api';
import Pagination from '../../components/ui/Pagination';
import type { AuditEntry } from '../../types';

const PAGE_SIZE = 30;

function describe(e: AuditEntry): string {
  const action = e.action.startsWith('status:') ? `set status to ${e.action.slice(7).replace('_', ' ')} on` : `${e.action.replace('-', ' ')}`;
  return `${action} ${e.entity}${e.entityId ? ` #${e.entityId}` : ''}`;
}

export default function Activity() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiJSON<AuditEntry[]>('/audit?limit=1000').then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  const people = useMemo(() => [...new Set(entries.map((e) => e.username))].sort(), [entries]);
  const filtered = who ? entries.filter((e) => e.username === who) : entries;
  const sliced = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="flex justify-center h-32 items-center"><div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Activity Log</h1>
          <p className="text-sm text-brand-muted mt-1">Every change made in the admin area, newest first.</p>
        </div>
        <select value={who} onChange={(e) => { setWho(e.target.value); setPage(1); }} aria-label="Filter by admin" className="bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text">
          <option value="">Everyone</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="glass-card divide-y divide-white/5">
        {sliced.length === 0 && <p className="p-8 text-center text-brand-muted text-sm">No activity yet</p>}
        {sliced.map((e) => (
          <div key={e.id} className="px-4 py-3 flex gap-4 text-sm">
            <p className="w-36 flex-shrink-0 text-xs text-brand-muted pt-0.5">{new Date(e.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</p>
            <div className="min-w-0">
              <p className="text-brand-text"><strong>{e.username}</strong> {describe(e)}</p>
              {e.details && <p className="text-xs text-brand-muted truncate">{e.details}</p>}
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onChange={setPage} />
    </div>
  );
}
