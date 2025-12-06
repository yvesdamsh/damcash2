import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/components/translations';
import { format, formatDistanceToNow } from 'date-fns';
import { enUS, ru, de, zhCN, nl } from 'date-fns/locale';

const LanguageContext = createContext(null);

const dateFnsLocales = {
  en: enUS,
  ru: ru,
  de: de,
  zh: zhCN,
  nl: nl,
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language');
    if (savedLang && translations[savedLang]) {
      setLanguage(savedLang);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (translations[browserLang]) {
        setLanguage(browserLang);
      }
    }
  }, []);

  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLanguage(lang);
      localStorage.setItem('app_language', lang);
      // Update HTML lang attribute
      document.documentElement.lang = lang;
    }
  };

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
      if (!value) break;
    }

    if (!value) {
        // Fallback to English
        let fallback = translations['en'];
        for (const k of keys) {
            fallback = fallback?.[k];
            if (!fallback) break;
        }
        value = fallback || key;
    }

    // Replace params
    Object.keys(params).forEach(param => {
      value = value.replace(`{{${param}}}`, params[param]);
    });

    return value;
  };

  // Date formatting helpers using the current locale
  const formatDate = (date, formatStr = 'PP') => {
    return format(new Date(date), formatStr, { locale: dateFnsLocales[language] });
  };

  const formatRelative = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: dateFnsLocales[language] });
  };

  const formatCurrency = (amount, currency = 'USD') => {
      return new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount);
  };

  const formatNumber = (number) => {
      return new Intl.NumberFormat(language).format(number);
  };

  return (
    <LanguageContext.Provider value={{ 
      language, 
      changeLanguage, 
      t, 
      formatDate, 
      formatRelative,
      formatCurrency,
      formatNumber
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};