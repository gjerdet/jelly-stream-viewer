import React, { createContext, useContext, useState, ReactNode } from 'react';
import { enTranslations } from '@/translations/en';
import { noTranslations } from '@/translations/no';

type Language = 'en' | 'no';

// Use a generic type that accepts the structure but not literal values
type RecursiveRecord = {
  [key: string]: string | RecursiveRecord;
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: RecursiveRecord;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'en' || saved === 'no') ? saved : 'no';
  });

  const translations: Record<Language, RecursiveRecord> = {
    en: enTranslations as unknown as RecursiveRecord,
    no: noTranslations as unknown as RecursiveRecord,
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
