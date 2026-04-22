import React, { useState, useEffect } from 'react';

interface Props {
    userName: string;
    onClose: () => void;
    onUpgrade: () => void;
}

const PERKS = [
    { icon: 'fa-robot',       color: 'bg-cyan-500',     label: 'ذكاء اصطناعي غير محدود' },
    { icon: 'fa-layer-group', color: 'bg-violet-500',   label: 'براندات غير محدودة' },
    { icon: 'fa-calendar-alt',color: 'bg-indigo-500',   label: 'جدولة تلقائية للمنشورات' },
    { icon: 'fa-chart-line',  color: 'bg-emerald-500',  label: 'تحليلات متقدمة وتقارير' },
    { icon: 'fa-users',       color: 'bg-pink-500',     label: 'إدارة الفريق والصلاحيات' },
];

export const WelcomeModal: React.FC<Props> = ({ userName, onClose, onUpgrade }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setTimeout(() => setVisible(true), 80);
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 400);
    };

    const handleUpgrade = () => {
        setVisible(false);
        setTimeout(onUpgrade, 300);
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>

            <div className={`w-full max-w-sm transition-all duration-500 ${visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-8'}`}>

                {/* Confetti top */}
                <div className="text-center mb-4">
                    <div className="text-5xl animate-bounce">🎉</div>
                </div>

                <div className="rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 p-6 text-center">
                        <h2 className="text-xl font-bold text-white mb-1">
                            مرحباً {userName.split(' ')[0]}! حسابك مفعّل 🚀
                        </h2>
                        <p className="text-white/75 text-sm">
                            تجربتك المجانية لمدة 14 يوماً بدأت الآن
                        </p>
                    </div>

                    {/* Body */}
                    <div className="bg-dark-card p-5">
                        <p className="text-dark-text-secondary text-xs mb-4 text-center">
                            مع الخطة المدفوعة تحصل على كل هذا
                        </p>

                        <div className="space-y-2.5 mb-5">
                            {PERKS.map((p, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-lg ${p.color} flex items-center justify-center flex-shrink-0`}>
                                        <i className={`fas ${p.icon} text-white text-xs`}></i>
                                    </div>
                                    <span className="text-sm text-dark-text">{p.label}</span>
                                    <i className="fas fa-check text-emerald-500 text-xs mr-auto"></i>
                                </div>
                            ))}
                        </div>

                        {/* Urgency */}
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center mb-4">
                            <p className="text-amber-400 text-xs font-semibold">
                                ⏰ &nbsp;عرض خاص للمستخدمين الجدد — وفّر 30% على الاشتراك السنوي
                            </p>
                        </div>

                        <button
                            onClick={handleUpgrade}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-sm shadow-lg shadow-amber-500/30 transition-all mb-2"
                        >
                            <i className="fas fa-crown mr-2"></i>
                            ترقية الآن واستفد من العرض
                        </button>

                        <button
                            onClick={handleClose}
                            className="w-full py-2 text-dark-text-secondary hover:text-dark-text text-xs transition-colors"
                        >
                            متابعة التجربة المجانية
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
