import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface Props {
    userName: string;
    email: string;
    emailConfirmed: boolean;
    onComplete: () => void;
}

const STEPS = [
    {
        icon: 'fa-layer-group',
        iconBg: 'from-violet-500 to-indigo-600',
        title: 'مرحباً في SBrandOps',
        subtitle: 'منصة إدارة البراندات الذكية',
        desc: 'كل أدواتك التسويقية في مكان واحد — أنشئ المحتوى، جدوّل المنشورات، وتابع النتائج بقوة الذكاء الاصطناعي.',
        visual: 'hero',
    },
    {
        icon: 'fa-palette',
        iconBg: 'from-pink-500 to-rose-600',
        title: 'أدر جميع براندزك',
        subtitle: 'هوية موحدة لكل براند',
        desc: 'أنشئ براندات متعددة بهوية بصرية مستقلة. SBrandOps يتذكر أسلوب كل براند ويطبّقه تلقائياً على المحتوى.',
        visual: 'brands',
    },
    {
        icon: 'fa-robot',
        iconBg: 'from-cyan-500 to-blue-600',
        title: 'ذكاء اصطناعي متكامل',
        subtitle: 'Gemini AI في خدمتك',
        desc: 'أنشئ كابشنات، صور، خطط تسويقية، وردود على التعليقات — كل ذلك بضغطة زر وبأسلوب براندك.',
        visual: 'ai',
    },
    {
        icon: 'fa-chart-line',
        iconBg: 'from-emerald-500 to-teal-600',
        title: 'تحليلات تحرك قراراتك',
        subtitle: 'بيانات حقيقية، نتائج ملموسة',
        desc: 'تابع أداء كل منشور، اعرف أفضل أوقات النشر، وحلّل منافسيك — كل شيء في لوحة تحكم واحدة.',
        visual: 'analytics',
    },
    {
        icon: 'fa-rocket',
        iconBg: 'from-amber-500 to-orange-600',
        title: 'ابدأ رحلتك الآن',
        subtitle: 'خطوة واحدة تفصلك',
        desc: 'فعّل بريدك الإلكتروني للوصول الكامل لجميع المميزات. لديك تجربة مجانية كاملة لمدة 14 يوماً.',
        visual: 'cta',
    },
];

const VisualHero = () => (
    <div className="relative h-32 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-20">
            {['fa-instagram', 'fa-twitter', 'fa-tiktok', 'fa-facebook', 'fa-linkedin'].map((ic, i) => (
                <i key={i} className={`fab ${ic} text-4xl text-white`} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
        </div>
        <div className="relative z-10 w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center animate-pulse">
            <i className="fas fa-layer-group text-white text-3xl" />
        </div>
    </div>
);

const VisualBrands = () => (
    <div className="flex gap-3 justify-center h-32 items-center">
        {[
            { label: 'براند A', color: 'bg-violet-500' },
            { label: 'براند B', color: 'bg-pink-500' },
            { label: 'براند C', color: 'bg-cyan-500' },
        ].map((b, i) => (
            <div key={i} className="flex flex-col items-center gap-2 animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '2s' }}>
                <div className={`w-14 h-14 rounded-xl ${b.color} flex items-center justify-center shadow-lg`}>
                    <i className="fas fa-star text-white text-xl" />
                </div>
                <span className="text-white/70 text-xs">{b.label}</span>
            </div>
        ))}
    </div>
);

const VisualAI = () => (
    <div className="h-32 flex items-center justify-center">
        <div className="relative">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
                <i className="fas fa-robot text-white text-2xl" />
            </div>
            {['fa-pen', 'fa-image', 'fa-chart-bar', 'fa-calendar'].map((ic, i) => {
                const angle = (i / 4) * 360;
                const x = Math.cos((angle * Math.PI) / 180) * 48;
                const y = Math.sin((angle * Math.PI) / 180) * 48;
                return (
                    <div key={i} className="absolute w-9 h-9 rounded-full bg-white/30 flex items-center justify-center"
                        style={{ left: `calc(50% + ${x}px - 18px)`, top: `calc(50% + ${y}px - 18px)` }}>
                        <i className={`fas ${ic} text-white text-sm`} />
                    </div>
                );
            })}
        </div>
    </div>
);

const VisualAnalytics = () => (
    <div className="h-32 flex items-end justify-center gap-2 px-4">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-white/30 transition-all duration-1000"
                style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
        ))}
    </div>
);

const VisualCTA = () => (
    <div className="h-32 flex items-center justify-center">
        <div className="text-center">
            <div className="text-5xl mb-2 animate-bounce">🚀</div>
            <div className="flex gap-1 justify-center">
                {[1,2,3,4,5].map(s => <i key={s} className="fas fa-star text-yellow-300 text-sm" />)}
            </div>
        </div>
    </div>
);

const VISUALS: Record<string, React.ReactNode> = {
    hero: <VisualHero />,
    brands: <VisualBrands />,
    ai: <VisualAI />,
    analytics: <VisualAnalytics />,
    cta: <VisualCTA />,
};

export const OnboardingTour: React.FC<Props> = ({ userName, email, emailConfirmed, onComplete }) => {
    const [step, setStep] = useState(0);
    const [animating, setAnimating] = useState(false);
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setTimeout(() => setVisible(true), 50);
    }, []);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const goTo = (next: number) => {
        if (animating) return;
        setAnimating(true);
        setTimeout(() => {
            setStep(next);
            setAnimating(false);
        }, 300);
    };

    const handleResend = async () => {
        setResendStatus('sending');
        await supabase.auth.resend({ type: 'signup', email });
        setResendStatus('sent');
        setResendCooldown(60);
        setTimeout(() => setResendStatus('idle'), 3000);
    };

    const handleComplete = () => {
        setVisible(false);
        setTimeout(onComplete, 400);
    };

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
            <div className={`w-full max-w-sm transition-all duration-300 ${animating ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>

                {/* Card */}
                <div className="rounded-3xl overflow-hidden shadow-2xl">

                    {/* Visual header */}
                    <div className={`bg-gradient-to-br ${current.iconBg} p-6 pb-4`}>
                        {VISUALS[current.visual]}
                    </div>

                    {/* Content */}
                    <div className="bg-dark-card p-6">
                        <div className="text-center mb-5">
                            <p className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-1">{current.subtitle}</p>
                            <h2 className="text-xl font-bold text-dark-text mb-3">{current.title}</h2>
                            <p className="text-sm text-dark-text-secondary leading-relaxed">{current.desc}</p>
                        </div>

                        {/* Progress dots */}
                        <div className="flex justify-center gap-2 mb-5">
                            {STEPS.map((_, i) => (
                                <button key={i} onClick={() => goTo(i)}
                                    className={`rounded-full transition-all duration-300 ${i === step ? 'w-6 h-2 bg-brand-primary' : 'w-2 h-2 bg-dark-border hover:bg-dark-text-secondary'}`} />
                            ))}
                        </div>

                        {/* CTA buttons */}
                        {isLast ? (
                            <div className="space-y-3">
                                {!emailConfirmed && (
                                    <button onClick={handleResend} disabled={resendCooldown > 0 || resendStatus === 'sending'}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30">
                                        {resendStatus === 'sending' ? <><i className="fas fa-circle-notch fa-spin" /> جاري الإرسال...</>
                                            : resendStatus === 'sent' ? <><i className="fas fa-check" /> تم الإرسال!</>
                                            : resendCooldown > 0 ? <>إعادة الإرسال بعد {resendCooldown}ث</>
                                            : <><i className="fas fa-envelope" /> أرسل لي رابط التفعيل</>}
                                    </button>
                                )}
                                <button onClick={handleComplete}
                                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-colors">
                                    <i className="fas fa-rocket" />
                                    {emailConfirmed ? 'ابدأ استخدام المنصة' : 'تصفح المنصة أولاً'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button onClick={handleComplete}
                                    className="flex-1 py-2.5 rounded-xl border border-dark-border text-dark-text-secondary hover:text-dark-text text-sm transition-colors">
                                    تخطّى
                                </button>
                                <button onClick={() => goTo(step + 1)}
                                    className={`flex-1 py-2.5 rounded-xl bg-gradient-to-r ${current.iconBg} text-white font-semibold text-sm flex items-center justify-center gap-2`}>
                                    التالي <i className="fas fa-arrow-left text-xs" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* User greeting */}
                <p className="text-center text-dark-text-secondary text-xs mt-4">
                    مرحباً <span className="text-white font-medium">{userName}</span> 👋
                </p>
            </div>
        </div>
    );
};
