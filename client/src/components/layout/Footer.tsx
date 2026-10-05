import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n, TKey } from '../../i18n';
import { useBusinessSettings } from '../../services/settings';

const LINKS: { label: TKey; target: string }[] = [
  { label: 'nav.overview', target: 'section-overview' },
  { label: 'nav.fleet', target: 'section-fleet' },
  { label: 'nav.features', target: 'section-features' },
];

export default function Footer() {
  const { t } = useI18n();
  const settings = useBusinessSettings();
  const location = useLocation();
  const navigate = useNavigate();

  function goToSection(id: string) {
    if (location.pathname === '/') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    else navigate(`/#${id}`);
  }

  return (
    <footer className="w-full pointer-events-auto px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="border-t border-white/10 pt-10 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <p className="font-display font-extrabold text-2xl text-brand-text tracking-tight mb-2" dir="ltr">
              RentCar<span className="text-brand-red">.</span>
            </p>
            <p className="text-xs text-brand-muted leading-relaxed max-w-[220px]">{t('footer.tagline')}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-[0.2em] mb-4">{t('footer.quickLinks')}</p>
            <div className="flex flex-col gap-2.5">
              {LINKS.map(({ label, target }) => (
                <button
                  key={target}
                  onClick={() => goToSection(target)}
                  className="cursor-pointer text-start text-xs text-brand-muted hover:text-brand-red transition-colors uppercase tracking-[0.15em]"
                >
                  {t(label)}
                </button>
              ))}
              <Link to="/booking-status" className="text-xs text-brand-muted hover:text-brand-red transition-colors uppercase tracking-[0.15em]">
                {t('nav.myBooking')}
              </Link>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-brand-muted uppercase tracking-[0.2em] mb-4">{t('footer.contact')}</p>
            {settings?.contactEmail && (
              <a href={`mailto:${settings.contactEmail}`} className="block text-xs text-brand-text hover:text-brand-red" dir="ltr">{settings.contactEmail}</a>
            )}
            {settings?.contactPhone && (
              <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`} className="block text-xs text-brand-text hover:text-brand-red mt-1.5" dir="ltr">{settings.contactPhone}</a>
            )}
            <p className="text-xs text-brand-muted mt-1.5 uppercase tracking-[0.15em]">{t('footer.support')}</p>
          </div>
        </div>
        <div className="border-t border-white/10 mt-10 pt-6">
          <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] text-end">© {new Date().getFullYear()} RentCar — {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}
