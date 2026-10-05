import { useEffect, useState } from 'react';
import type { BusinessSettings } from '../types';
import { apiJSON } from './api';

// Fetched once per page load and shared by every component that needs it
let cached: Promise<BusinessSettings> | null = null;

export function loadSettings(force = false): Promise<BusinessSettings> {
  if (!cached || force) {
    cached = apiJSON<BusinessSettings>('/settings').catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function useBusinessSettings(): BusinessSettings | null {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => alive && setSettings(s)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return settings;
}
