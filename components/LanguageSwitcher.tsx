import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Language, languages } from '../locales';

export const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();

    const toggleLanguage = () => {
        const newLang: Language = language === 'ar' ? 'en' : 'ar';
        setLanguage(newLang);
    };

    const currentLanguage = languages.find(l => l.code === language);

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={t.common.language}
        >
            <i className="fas fa-globe w-5 h-5 text-gray-600 dark:text-gray-400"></i>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {currentLanguage?.nativeName}
            </span>
        </button>
    );
};
