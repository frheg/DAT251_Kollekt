import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import { cn } from './ui/utils';

const languageLabels: Record<SupportedLanguage, string> = {
  en: 'EN',
  no: 'NO',
};

export default function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const currentLanguage = (SUPPORTED_LANGUAGES.includes(i18n.resolvedLanguage as SupportedLanguage)
    ? i18n.resolvedLanguage
    : 'en') as SupportedLanguage;

  return (
    <div
      className={cn('glass inline-flex shrink-0 items-center gap-1 rounded-xl p-1', className)}
      role="group"
      aria-label={t('languageSwitcher.ariaLabel')}
    >
      <span className="sr-only">{t('languageSwitcher.label')}</span>
      <Languages className="ml-1 hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
      {SUPPORTED_LANGUAGES.map((language) => {
        const isActive = language === currentLanguage;
        return (
          <button
            key={language}
            type="button"
            onClick={() => { void i18n.changeLanguage(language); }}
            aria-pressed={isActive}
            aria-label={t(`languages.${language}`)}
            title={t(`languages.${language}`)}
            className={cn(
              'shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors sm:px-2.5 sm:text-[11px]',
              isActive ? 'gradient-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {languageLabels[language]}
          </button>
        );
      })}
    </div>
  );
}
