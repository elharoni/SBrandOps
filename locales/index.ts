import ar from './ar';
import en from './en';

export type Language = 'ar' | 'en';

export type TranslationKeys = typeof ar;

export const translations: Record<Language, TranslationKeys> = {
    ar,
    en,
};

export const languages = [
    { code: 'ar' as Language, name: 'العربية', nativeName: 'العربية', dir: 'rtl' as const },
    { code: 'en' as Language, name: 'English', nativeName: 'English', dir: 'ltr' as const },
];

export const defaultLanguage: Language = 'ar';

export const getLanguageDirection = (lang: Language): 'rtl' | 'ltr' => {
    return lang === 'ar' ? 'rtl' : 'ltr';
};

export const getLanguageName = (lang: Language): string => {
    const language = languages.find(l => l.code === lang);
    return language?.name || lang;
};

export const getLanguageNativeName = (lang: Language): string => {
    const language = languages.find(l => l.code === lang);
    return language?.nativeName || lang;
};
