import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api, apiJSON } from '../services/api';
import { Agency, applyBranding, IS_PLATFORM } from '../services/agency';

interface AgencyValue {
  agency: Agency;
  refresh: () => Promise<void>;
}

const AgencyContext = createContext<AgencyValue | null>(null);

// Loads the agency this site belongs to before anything else renders, so its name, logo and colour
// are in place from the first paint
export function AgencyProvider({ children }: { children: ReactNode }) {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unknown' | 'offline'>('loading');

  const refresh = useCallback(async () => {
    try {
      if (IS_PLATFORM) {
        const next = await platformAgency();
        applyBranding(next);
        setAgency(next);
        setState('ready');
        return;
      }
      const res = await api('/agency');
      if (res.status === 404) return setState('unknown');
      if (!res.ok) return setState('offline');
      const next = (await res.json()) as Agency;
      applyBranding(next);
      setAgency(next);
      setState('ready');
    } catch {
      setState('offline');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (state === 'loading') return <div className="min-h-screen bg-brand-dark" />;
  if (state !== 'ready' || !agency) return <AgencyUnavailable unknown={state === 'unknown'} retry={refresh} />;
  return <AgencyContext.Provider value={{ agency, refresh }}>{children}</AgencyContext.Provider>;
}

export function useAgency(): AgencyValue {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgency must be used within AgencyProvider');
  return ctx;
}

function AgencyUnavailable({ unknown, retry }: { unknown: boolean; retry: () => void }) {
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-display font-extrabold text-5xl text-brand-text mb-4">{unknown ? '404' : '…'}</p>
        <h1 className="text-xl font-semibold text-brand-text mb-2">
          {unknown ? 'This agency does not exist' : 'The site is not reachable right now'}
        </h1>
        <p className="text-brand-muted text-sm mb-6">
          {unknown
            ? 'Check the address. If you run this agency, your account may have been closed: contact support.'
            : 'Please try again in a moment.'}
        </p>
        {!unknown && (
          <button onClick={retry} className="px-5 py-2.5 rounded-lg bg-brand-red text-white text-sm font-semibold">Try again</button>
        )}
      </div>
    </div>
  );
}

// The general page (platform address) uses the same 3D site, under the platform's name, for agency owners
async function platformAgency(): Promise<Agency> {
  const [info, stats] = await Promise.all([
    apiJSON<{ name: string; email: string }>('/platform/info'),
    apiJSON<{ agencies: number; cars: number; cities: number; trialDays: number }>('/platform/stats'),
  ]);
  const origin = window.location.origin;
  return {
    slug: '', name: info.name, logoUrl: null, primaryColor: '#e72526', customDomain: null, siteUrl: origin,
    city: null, listed: false, status: 'active', plan: 'business',
    subscription: {
      status: 'active', plan: 'business', planName: '', cycle: 'monthly', trialEndsAt: null, currentPeriodEnd: null, suspendsAt: null, trialDaysLeft: null,
      features: { onlineSignature: true, customDomain: true, hideBranding: true }, limits: { cars: null, users: null },
    },
    platform: { name: info.name, url: origin, email: info.email },
    isPlatform: true,
    platformStats: stats,
  };
}
