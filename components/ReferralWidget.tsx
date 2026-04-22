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

    return (
        <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border-b border-dark-border px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-gift text-white text-sm" />
                </div>
                <div>
                    <h3 className="font-bold text-dark-text text-sm">ادعُ أصدقاءك واربح</h3>
                    <p className="text-xs text-dark-text-secondary">لكل صديق يشترك، تحصل على شهر مجاني</p>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Rewards tiers */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { count: '1', reward: 'شهر', color: 'from-emerald-500 to-teal-500' },
                        { count: '3', reward: '3 شهور', color: 'from-cyan-500 to-blue-500' },
                        { count: '10', reward: 'سنة', color: 'from-violet-500 to-indigo-500' },
                    ].map((tier) => (
                        <div key={tier.count} className="text-center p-3 rounded-xl border border-dark-border bg-dark-bg">
                            <div className={`text-xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
                                {tier.count}
                            </div>
                            <div className="text-xs text-dark-text-secondary mt-0.5">دعوة</div>
                            <div className="text-xs font-semibold text-dark-text mt-1">{tier.reward} مجاناً</div>
                        </div>
                    ))}
                </div>

                {/* Referral link */}
                <div>
                    <label className="text-xs font-semibold text-dark-text-secondary mb-1.5 block">رابط الإحالة الخاص بك</label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text-secondary font-mono truncate" dir="ltr">
                            {refLink}
                        </div>
                        <button
                            onClick={handleCopy}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                                copied
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-brand-primary hover:bg-brand-secondary text-white'
                            }`}
                        >
                            {copied ? <><i className="fas fa-check ml-1" />تم!</> : <><i className="fas fa-copy ml-1" />نسخ</>}
                        </button>
                    </div>
                </div>

                {/* Share buttons */}
                <div className="flex gap-2">
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`جرّب SBrandOps — منصة إدارة البراندات بالذكاء الاصطناعي 🚀 ${refLink}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dark-border hover:border-blue-400 text-dark-text-secondary hover:text-blue-400 transition-colors text-xs">
                        <i className="fab fa-x-twitter" /> تويتر
                    </a>
                    <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`جرّب SBrandOps — منصة إدارة البراندات الذكية 🚀\n${refLink}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dark-border hover:border-emerald-400 text-dark-text-secondary hover:text-emerald-400 transition-colors text-xs">
                        <i className="fab fa-whatsapp" /> واتساب
                    </a>
                </div>
            </div>
        </div>
    );
};
