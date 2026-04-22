import React, { useState, useEffect } from 'react';
import { signUp } from '../../services/authService';
import { isSupabaseConfigured, supabaseConfigError, supabase } from '../../services/supabaseClient';

interface RegisterPageProps {
    onSuccess: () => void;
    onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSuccess, onNavigateToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [showSurvey, setShowSurvey] = useState(false);
    const [surveyGoal, setSurveyGoal] = useState('');

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const handleResend = async () => {
        setResendStatus('sending');
        await supabase.auth.resend({ type: 'signup', email });
        setResendStatus('sent');
        setResendCooldown(60);
        setTimeout(() => setResendStatus('idle'), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('كلمتا المرور غير متطابقتين');
            return;
        }
        if (password.length < 6) {
            setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
            return;
        }

        setIsLoading(true);
        try {
            await signUp(email, password, name);
            setShowSurvey(true);
        } catch (err: any) {
            const msg = err?.message || 'فشل إنشاء الحساب';
            if (msg.includes('User already registered')) {
                setError('هذا البريد الإلكتروني مسجل بالفعل');
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const surveyOptions = [
        { value: 'social',    icon: 'fa-heart', color: 'from-pink-500 to-rose-500',    label: 'محتوى سوشيال ميديا' },
        { value: 'seo',       icon: 'fa-search', color: 'from-blue-500 to-cyan-500',   label: 'تحسين محركات البحث SEO' },
        { value: 'ads',       icon: 'fa-bullhorn', color: 'from-amber-500 to-orange-500', label: 'إدارة الإعلانات المدفوعة' },
        { value: 'branding',  icon: 'fa-star', color: 'from-violet-500 to-indigo-500', label: 'بناء هوية البراند' },
        { value: 'analytics', icon: 'fa-chart-bar', color: 'from-emerald-500 to-teal-500', label: 'تحليل الأداء والمنافسين' },
        { value: 'all',       icon: 'fa-rocket', color: 'from-gray-500 to-slate-600',  label: 'كل ما سبق!' },
    ];

    if (showSurvey && !success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-3">👋</div>
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">أهلاً {name.split(' ')[0]}!</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mt-1">
                            سؤال سريع يساعدنا نخصّص تجربتك
                        </p>
                    </div>
                    <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-6 shadow-xl">
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text mb-4 text-center">ما هو هدفك الرئيسي من SBrandOps؟</p>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            {surveyOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSurveyGoal(opt.value)}
                                    className={`relative p-4 rounded-xl border-2 text-right transition-all ${
                                        surveyGoal === opt.value
                                            ? 'border-brand-primary bg-brand-primary/10'
                                            : 'border-light-border dark:border-dark-border hover:border-brand-primary/50'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${opt.color} flex items-center justify-center mb-2`}>
                                        <i className={`fas ${opt.icon} text-white text-xs`}></i>
                                    </div>
                                    <span className="text-xs font-medium text-light-text dark:text-dark-text leading-tight block">{opt.label}</span>
                                    {surveyGoal === opt.value && (
                                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                                            <i className="fas fa-check text-white text-xs"></i>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setSuccess(true)}
                            disabled={!surveyGoal}
                            className="w-full py-3 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-indigo-500/25"
                        >
                            متابعة <i className="fas fa-arrow-left mr-2 text-xs"></i>
                        </button>
                        <button onClick={() => setSuccess(true)} className="w-full mt-2 py-2 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition-colors">
                            تخطّى هذه الخطوة
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        const steps = [
            { icon: 'fa-layer-group', color: 'text-violet-400', label: 'أنشئ براندك الأول' },
            { icon: 'fa-robot',       color: 'text-cyan-400',   label: 'اكتب بالذكاء الاصطناعي' },
            { icon: 'fa-chart-line',  color: 'text-emerald-400',label: 'تابع التحليلات' },
        ];
        return (
            <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-4 shadow-lg shadow-indigo-500/30">
                            <i className="fas fa-envelope-open-text text-white text-2xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">تحقق من بريدك!</h2>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm mt-1">
                            أرسلنا رابط التفعيل إلى <strong className="text-brand-primary">{email}</strong>
                        </p>
                    </div>

                    {/* Main card */}
                    <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl overflow-hidden shadow-xl">

                        {/* "While you wait" section */}
                        <div className="p-6 border-b border-light-border dark:border-dark-border">
                            <p className="text-xs font-semibold text-brand-primary uppercase tracking-widest mb-4">بعد التفعيل ستتمكن من</p>
                            <div className="space-y-3">
                                {steps.map((s, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-dark-bg/50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                            <i className={`fas ${s.icon} ${s.color} text-sm`}></i>
                                        </div>
                                        <span className="text-sm text-light-text dark:text-dark-text font-medium">{s.label}</span>
                                        <i className="fas fa-check text-emerald-500 text-xs mr-auto"></i>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Trial badge */}
                        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                            <i className="fas fa-gift text-amber-400 text-sm"></i>
                            <span className="text-amber-400 text-xs font-semibold">تجربة مجانية 14 يوماً — لا بطاقة ائتمانية</span>
                        </div>

                        {/* Actions */}
                        <div className="p-6 space-y-3">
                            <button
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || resendStatus === 'sending'}
                                className="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
                            >
                                {resendStatus === 'sending' ? (
                                    <><i className="fas fa-circle-notch fa-spin"></i> جاري الإرسال...</>
                                ) : resendStatus === 'sent' ? (
                                    <><i className="fas fa-check"></i> تم الإرسال بنجاح!</>
                                ) : resendCooldown > 0 ? (
                                    <>⏳ إعادة الإرسال بعد {resendCooldown}ث</>
                                ) : (
                                    <><i className="fas fa-paper-plane"></i> إعادة إرسال رابط التفعيل</>
                                )}
                            </button>
                            <button
                                onClick={onNavigateToLogin}
                                className="w-full py-2.5 px-4 border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text rounded-xl transition-colors text-sm"
                            >
                                العودة لتسجيل الدخول
                            </button>
                        </div>

                        {/* Tip */}
                        <div className="px-6 pb-5">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                                <i className="fas fa-info-circle ml-1 text-blue-400"></i>
                                لم يصلك الإيميل؟ تحقق من مجلد <strong>Spam</strong> أو أضف <strong>noreply@supabase.io</strong> لجهات اتصالك
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary mb-4">
                        <i className="fas fa-layer-group text-white text-2xl"></i>
                    </div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">SBrandOps</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">منصة إدارة البراندات الشاملة</p>
                </div>

                <div className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-2xl p-8 shadow-lg">
                    <h2 className="text-xl font-bold text-light-text dark:text-dark-text mb-6 text-center">إنشاء حساب جديد</h2>

                    {!isSupabaseConfigured && (
                        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
                            <div className="flex items-start gap-2">
                                <i className="fas fa-triangle-exclamation mt-0.5 text-amber-500 text-sm flex-shrink-0"></i>
                                <div>
                                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">التطبيق غير مهيأ بعد</p>
                                    <p className="mt-1 text-xs leading-5 text-amber-700/90 dark:text-amber-200/90">
                                        {supabaseConfigError}. أضف القيم إلى ملف <code className="font-mono">.env</code> ثم أعد تشغيل التطبيق.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                            <i className="fas fa-exclamation-circle text-red-500 text-sm flex-shrink-0"></i>
                            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الاسم الكامل</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-user text-sm"></i>
                                </span>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    className="w-full pr-10 pl-4 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="عبدالرحمن الحاروني"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">البريد الإلكتروني</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-envelope text-sm"></i>
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="w-full pr-10 pl-4 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="name@company.com"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">كلمة المرور</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-lock text-sm"></i>
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pr-10 pl-10 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="6 أحرف على الأقل"
                                    dir="ltr"
                                />
                                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition">
                                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">تأكيد كلمة المرور</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-lock text-sm"></i>
                                </span>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full pr-10 pl-4 py-2.5 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition text-sm"
                                    placeholder="••••••••"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !email || !password || !name || !isSupabaseConfigured}
                            className="w-full py-2.5 px-4 bg-brand-primary hover:bg-brand-secondary disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <><i className="fas fa-circle-notch fa-spin"></i> جاري الإنشاء...</>
                            ) : (
                                <><i className="fas fa-user-plus"></i> إنشاء الحساب</>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            لديك حساب بالفعل؟{' '}
                            <button onClick={onNavigateToLogin} className="text-brand-primary hover:underline font-medium">
                                تسجيل الدخول
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
