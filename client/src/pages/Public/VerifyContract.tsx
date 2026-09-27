import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface Verification {
  valid: true;
  reference: string;
  car: string;
  signer: string;
  signedAt: string;
  company: string;
  documentHash: string;
}

// SHA-256 of a local file, computed in the browser (the file never leaves the device)
async function fileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function VerifyContract() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [result, setResult] = useState<Verification | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileCheck, setFileCheck] = useState<'match' | 'mismatch' | null>(null);

  async function check(value = code) {
    setNotFound(false);
    setResult(null);
    setFileCheck(null);
    setLoading(true);
    try {
      const res = await api(`/verify/${encodeURIComponent(value.trim().toUpperCase())}`);
      if (!res.ok) { setNotFound(true); return; }
      setResult(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    if (params.get('code')) check(params.get('code')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(file: File | undefined) {
    if (!file || !result) return;
    setFileCheck((await fileHash(file)) === result.documentHash ? 'match' : 'mismatch');
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 pt-32 pb-16">
        <h1 className="font-display text-5xl font-extrabold uppercase tracking-tight text-brand-text mb-3">{t('verify.title')}</h1>
        <p className="text-sm text-brand-muted mb-8">{t('verify.subtitle')}</p>

        <form onSubmit={(e: FormEvent) => { e.preventDefault(); check(); }} className="glass-card p-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="vcode" className="block text-xs text-brand-muted mb-1.5">{t('verify.code')}</label>
            <input id="vcode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX" required maxLength={11} dir="ltr" className="w-full bg-brand-surface border border-white/10 rounded-xl px-4 py-3 font-mono tracking-[0.2em] text-brand-text focus:outline-none focus:border-brand-red/50" />
          </div>
          <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl font-semibold bg-brand-red text-white hover:bg-red-500 disabled:opacity-50">{loading ? t('verify.checking') : t('verify.check')}</button>
        </form>

        {notFound && <p role="alert" className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{t('verify.notFound')}</p>}

        {result && (
          <div className="mt-6 space-y-5">
            <div className="glass-card p-6">
              <p className="flex items-center gap-2 text-green-400 font-semibold text-lg mb-4"><span className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">✓</span>{t('verify.valid')}</p>
              <dl className="text-sm">
                {([
                  [t('verify.reference'), result.reference],
                  [t('verify.car'), result.car],
                  [t('verify.signer'), result.signer],
                  [t('verify.signedAt'), new Date(result.signedAt).toLocaleString(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' })],
                  [t('verify.company'), result.company],
                ] as const).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2 border-b border-white/5"><dt className="text-brand-muted">{label}</dt><dd className="text-brand-text text-end"><bdi>{value}</bdi></dd></div>
                ))}
              </dl>
              <p className="text-xs text-brand-muted mt-4">{t('verify.fingerprint')}</p>
              <p className="font-mono text-[11px] text-brand-text break-all" dir="ltr">{result.documentHash}</p>
            </div>

            <div className="glass-card p-6">
              <h2 className="font-semibold text-brand-text mb-1">{t('verify.fileTitle')}</h2>
              <p className="text-xs text-brand-muted mb-3">{t('verify.fileHint')}</p>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => onFile(e.target.files?.[0])} aria-label={t('verify.fileTitle')} className="text-sm text-brand-muted file:me-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-white/10 file:text-brand-text" />
              {fileCheck === 'match' && <p className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">✓ {t('verify.fileMatch')}</p>}
              {fileCheck === 'mismatch' && <p className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">✗ {t('verify.fileMismatch')}</p>}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
