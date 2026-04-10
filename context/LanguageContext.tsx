import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TranslationKeys, translations, defaultLanguage, getLanguageDirection } from '../locales';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: TranslationKeys;
    dir: 'rtl' | 'ltr';
    isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'sbrandops_language';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        // Get language from localStorage or use default
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        return (stored as Language) || defaultLanguage;
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);

        // Update document direction
        document.documentElement.dir = getLanguageDirection(lang);
        document.documentElement.lang = lang;
    };

    useEffect(() => {
        // Set initial direction
        document.documentElement.dir = getLanguageDirection(language);
        document.documentElement.lang = language;
    }, [language]);

    const dir = getLanguageDirection(language);
    const isRTL = dir === 'rtl';
    const t = translations[language];

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
