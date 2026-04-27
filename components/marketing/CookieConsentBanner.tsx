import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { publicPageToPath } from '../../config/routes';

const STORAGE_KEY = 'sbo_cookie_consent';

type ConsentChoice = 'accepted' | 'declined';

export const CookieConsentBanner: React.FC = () => {
    const { language } = useLanguage();
    const isArabic = language === 'ar';
    const [visible, setVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) setVisible(true);
    }, []);

    const saveChoice = (choice: ConsentChoice) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, ts: Date.now() }));
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-label={isArabic ? 'إشعار ملفات تعريف الارتباط' : 'Cookie consent'}
            className="fixed bottom-0 inset-x-0 z-[9999] p-4 sm:p-6"
        >
            <div
                className="mx-auto max-w-3xl rounded-[20px] border border-white/10 p-5 shadow-2xl"
                style={{ background: '#0E1330' }}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                    {/* Icon */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15">
                        <i className="fas fa-cookie-bite text-cyan-400 text-lg" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                            {isArabic ? 'نستخدم ملفات تعريف الارتباط' : 'We use cookies'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/55">
                            {isArabic
                                ? 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتحليل أداء الموقع. يمكنك قبول الكل أو رفض ملفات التتبع غير الضرورية.'
                                : 'We use cookies to enhance your experience and analyze site performance. You can accept all or decline non-essential tracking cookies.'}
                            {' '}
                            <Link
                                to={publicPageToPath('cookies')}
                                className="underline text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                {isArabic ? 'سياسة الكوكيز' : 'Cookie Policy'}
                            </Link>
                        </p>

                        {/* Expandable details */}
                        {showDetails && (
                            <div className="mt-3 rounded-xl border border-white/10 p-3 space-y-2">
                                {[
                                    {
                                        label: isArabic ? 'ضرورية (مطلوبة)' : 'Essential (Required)',
                                        desc: isArabic ? 'تشغيل الجلسة والمصادقة وأمان الموقع' : 'Session, authentication, and site security',
                                        locked: true,
                                    },
                                    {
                                        label: isArabic ? 'تحليلية' : 'Analytics',
                                        desc: isArabic ? 'نفهم كيف يستخدم الزوار الموقع (مجهولة الهوية)' : 'Understand how visitors use the site (anonymized)',
                                        locked: false,
                                    },
                                    {
                                        label: isArabic ? 'تسويقية' : 'Marketing',
                                        desc: isArabic ? 'الإعلانات المخصصة وقياس أداء الحملات' : 'Personalized ads and campaign performance measurement',
                                        locked: false,
                                    },
                                ].map(cat => (
                                    <div key={cat.label} className="flex items-start gap-3">
                                        <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded ${cat.locked ? 'bg-cyan-500/40' : 'bg-white/10'} border border-white/20 flex items-center justify-center`}>
                                            {cat.locked && <i className="fas fa-lock text-[8px] text-cyan-400" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-white/80">{cat.label}</p>
                                            <p className="text-[11px] text-white/40">{cat.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setShowDetails(p => !p)}
                            className="mt-2 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                        >
                            {showDetails
                                ? (isArabic ? '▲ إخفاء التفاصيل' : '▲ Hide details')
                                : (isArabic ? '▼ عرض التفاصيل' : '▼ Show details')}
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
                        <button
                            onClick={() => saveChoice('accepted')}
                            className="rounded-[14px] bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-cyan-400 transition-colors whitespace-nowrap"
                        >
                            {isArabic ? 'قبول الكل' : 'Accept All'}
                        </button>
                        <button
                            onClick={() => saveChoice('declined')}
                            className="rounded-[14px] border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 transition-colors whitespace-nowrap"
                        >
                            {isArabic ? 'رفض غير الضروري' : 'Decline Non-Essential'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
