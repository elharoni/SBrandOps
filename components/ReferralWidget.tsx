import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export const ReferralWidget: React.FC = () => {
    const { user } = useAuth();
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const base = import.meta.env.VITE_APP_URL || window.location.origin;
    const refCode = user?.id?.slice(0, 8) ?? 'xxxxxxxx';
    const refLink = `${base}/ref/${refCode}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(refLink).then(() => {
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 2000);
        });
    };

    const tiers = [
        { count: '1', reward: 'شهر / 1 mo', color: 'from-emerald-500 to-teal-500' },
        { count: '3', reward: '3 شهور / 3 mo', color: 'from-cyan-500 to-blue-500' },
        { count: '10', reward: 'سنة / 1 yr', color: 'from-violet-500 to-indigo-500' },
    ];

    return (
        <div className="rounded-2xl border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-500/15 to-indigo-500/15 border-b border-light-border dark:border-dark-border px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <i className="fas fa-gift text-white text-sm" />
                </div>
                <div>
                    <h3 className="font-bold text-light-text dark:text-dark-text text-sm">
                        ادعُ أصدقاءك واربح · Invite &amp; Earn
                    </h3>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        لكل صديق يشترك، تحصل على شهر مجاني · 1 free month per referral
                    </p>
                </div>
            </div>

            <div className="p-5 space-y-5">
                {/* Rewards tiers */}
                <div className="grid grid-cols-3 gap-2">
                    {tiers.map(tier => (
                        <div
                            key={tier.count}
                            className="text-center p-3 rounded-xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg transition-transform hover:-translate-y-0.5 duration-200"
                        >
                            <div className={`text-2xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
                                {tier.count}
                            </div>
                            <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                دعوات / referrals
                            </div>
                            <div className="text-[11px] font-semibold text-light-text dark:text-dark-text mt-1.5 leading-tight">
                                {tier.reward}
                            </div>
                            <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">مجاناً / free</div>
                        </div>
                    ))}
                </div>

                {/* Referral link */}
                <div>
                    <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block">
                        رابط الإحالة الخاص بك · Your referral link
                    </label>
                    <div className="flex items-center gap-2">
                        <div
                            className="flex-1 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl px-3 py-2 text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono truncate"
                            dir="ltr"
                        >
                            {refLink}
                        </div>
                        <button
                            id="referral-copy-btn"
                            onClick={handleCopy}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                                copied
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-brand-primary hover:bg-brand-secondary text-white hover:-translate-y-0.5'
                            }`}
                        >
                            {copied
                                ? <><i className="fas fa-check ms-1" />تم! / Done!</>
                                : <><i className="fas fa-copy ms-1" />نسخ / Copy</>
                            }
                        </button>
                    </div>
                </div>

                {/* Share buttons */}
                <div className="flex gap-2">
                    <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`جرّب SBrandOps — منصة إدارة البراندات بالذكاء الاصطناعي 🚀 ${refLink}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        id="referral-share-twitter"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-light-border dark:border-dark-border hover:border-blue-400 dark:hover:border-blue-400 text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 dark:hover:text-blue-400 transition-all text-xs font-medium"
                    >
                        <i className="fab fa-x-twitter text-xs" />
                        X / Twitter
                    </a>
                    <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`جرّب SBrandOps — منصة إدارة البراندات الذكية 🚀\n${refLink}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        id="referral-share-whatsapp"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-light-border dark:border-dark-border hover:border-emerald-400 dark:hover:border-emerald-400 text-light-text-secondary dark:text-dark-text-secondary hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-xs font-medium"
                    >
                        <i className="fab fa-whatsapp text-xs" />
                        واتساب / WhatsApp
                    </a>
                    <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('جرّب SBrandOps 🚀')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        id="referral-share-telegram"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-light-border dark:border-dark-border hover:border-sky-400 dark:hover:border-sky-400 text-light-text-secondary dark:text-dark-text-secondary hover:text-sky-500 dark:hover:text-sky-400 transition-all text-xs font-medium"
                    >
                        <i className="fab fa-telegram text-xs" />
                        تيليجرام
                    </a>
                </div>
            </div>
        </div>
    );
};
