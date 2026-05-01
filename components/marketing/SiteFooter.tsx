import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { publicPageToPath } from '../../config/routes';
import { SBrandOpsLogo } from '../SBrandOpsLogo';

const FooterLink: React.FC<{ href: string; className?: string; children: React.ReactNode }> = ({ href, className, children }) =>
    href.includes('#')
        ? <a href={href} className={className}>{children}</a>
        : <Link to={href} className={className}>{children}</Link>;

interface SiteFooterProps {
    isAuthenticated: boolean;
}

const SiteFooter: React.FC<SiteFooterProps> = ({ isAuthenticated }) => {
    const { language, setLanguage } = useLanguage();
    const isArabic = language === 'ar';
    const navigate = useNavigate();
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [waitlistDone, setWaitlistDone] = useState(false);

    const handleWaitlist = (e: React.FormEvent) => {
        e.preventDefault();
        if (!waitlistEmail.trim()) return;
        setWaitlistDone(true);
    };

    const productLinks = [
        { label: isArabic ? 'كل المميزات' : 'All Features', href: publicPageToPath('features') },
        { label: 'Brand Hub', href: `${publicPageToPath('home')}#product` },
        { label: 'Content Ops', href: `${publicPageToPath('home')}#product` },
        { label: 'Social Publishing', href: `${publicPageToPath('home')}#product` },
        { label: 'Ads Analytics', href: `${publicPageToPath('home')}#product` },
        { label: 'SEO Ops', href: `${publicPageToPath('home')}#product` },
        { label: 'Inbox Ops', href: `${publicPageToPath('home')}#product` },
        { label: 'Analytics Hub', href: `${publicPageToPath('home')}#product` },
    ];

    const companyLinks = [
        { label: isArabic ? 'من نحن' : 'About', href: publicPageToPath('about') },
        { label: isArabic ? 'للوكالات' : 'For Agencies', href: publicPageToPath('for-agencies') },
        { label: isArabic ? 'للتجارة الإلكترونية' : 'For E-commerce', href: publicPageToPath('for-ecommerce') },
        { label: isArabic ? 'تواصل معنا' : 'Contact', href: publicPageToPath('contact') },
        { label: isArabic ? 'الاسعار' : 'Pricing', href: publicPageToPath('pricing') },
        { label: isArabic ? 'طلب ديمو' : 'Book Demo', href: publicPageToPath('demo') },
    ];

    const resourceLinks = [
        { label: isArabic ? 'مركز المساعدة' : 'Help Center', href: `${publicPageToPath('contact')}#support` },
        { label: isArabic ? 'الاسئلة الشائعة' : 'FAQ', href: `${publicPageToPath('home')}#faq` },
        { label: isArabic ? 'المدونة' : 'Blog', href: publicPageToPath('home') },
        { label: isArabic ? 'دليل الاستخدام' : 'User Guide', href: `${publicPageToPath('contact')}#support` },
        { label: isArabic ? 'الامان' : 'Security', href: publicPageToPath('security') },
        { label: isArabic ? 'الفوترة' : 'Billing', href: publicPageToPath('billing') },
    ];

    const legalLinks = [
        { label: isArabic ? 'الشروط' : 'Terms', href: publicPageToPath('terms') },
        { label: isArabic ? 'الخصوصية' : 'Privacy', href: publicPageToPath('privacy') },
        { label: isArabic ? 'اتفاقية معالجة البيانات' : 'DPA', href: publicPageToPath('dpa') },
        { label: isArabic ? 'سياسة الكوكيز' : 'Cookies', href: publicPageToPath('cookies') },
        { label: isArabic ? 'الاسترجاع' : 'Refunds', href: publicPageToPath('refunds') },
    ];

    const footerColumns = [
        { title: isArabic ? 'المنتج' : 'Product', links: productLinks },
        { title: isArabic ? 'الشركة' : 'Company', links: companyLinks },
        { title: isArabic ? 'الموارد' : 'Resources', links: resourceLinks },
        { title: isArabic ? 'القانونية' : 'Legal', links: legalLinks },
    ];

    const socialLinks = [
        { icon: 'fa-brands fa-facebook-f', href: '#', label: 'Facebook' },
        { icon: 'fa-brands fa-instagram', href: '#', label: 'Instagram' },
        { icon: 'fa-brands fa-linkedin-in', href: '#', label: 'LinkedIn' },
        { icon: 'fa-brands fa-x-twitter', href: '#', label: 'X' },
        { icon: 'fa-brands fa-youtube', href: '#', label: 'YouTube' },
        { icon: 'fa-brands fa-tiktok', href: '#', label: 'TikTok' },
    ];

    return (
        <footer className="relative overflow-hidden bg-sbo-navy">

            {/* Top accent glow line */}
            <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.55) 35%, rgba(37,99,235,0.4) 65%, transparent 100%)' }}
            />
            {/* Ambient radial glow behind the header area */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-48 left-1/2 h-96 w-[800px] -translate-x-1/2 rounded-full"
                style={{ background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.11) 0%, transparent 68%)' }}
            />

            <div className="relative mx-auto max-w-7xl px-6">

                {/* ── CTA Card ─────────────────────────────────────────────────────── */}
                <div
                    className="relative my-8 overflow-hidden rounded-2xl px-5 py-8 md:my-14 md:px-8 md:py-10"
                    style={{ background: '#161B33', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    {/* Card gradient fill */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.13) 0%, transparent 55%, rgba(124,58,237,0.09) 100%)' }}
                    />
                    {/* Card top accent line */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 h-px"
                        style={{ background: 'linear-gradient(90deg, rgba(6,182,212,0.7) 0%, rgba(37,99,235,0.5) 50%, transparent 100%)' }}
                    />

                    <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-sbo-cyan">
                                {isArabic ? 'نظام النمو الذكي' : 'Smart Growth System'}
                            </p>
                            <h3 className="text-xl font-bold text-white">
                                {isArabic ? 'ابدأ بناء نظام نمو براندك' : 'Start Building Your Brand Growth System'}
                            </h3>
                            <p className="mt-2 max-w-md text-sm leading-relaxed text-sbo-gray">
                                {isArabic
                                    ? 'اربط حساباتك، نظم فريقك، وانتقل من العشوائية الى التشغيل الذكي.'
                                    : 'Connect your accounts, organize your team, and move from scattered work to intelligent operations.'}
                            </p>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
                            <button
                                onClick={() => navigate(isAuthenticated ? '/app' : '/register')}
                                className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #2563EB, #4F46E5)' }}
                            >
                                {isArabic ? 'اطلب تجربة' : 'Request Demo'}
                            </button>
                            <FooterLink
                                href={publicPageToPath('home')}
                                className="flex items-center gap-1.5 text-sm text-sbo-gray transition-colors duration-200 hover:text-sbo-cyan"
                            >
                                <span>{isArabic ? 'شاهد المنصة' : 'See the Platform'}</span>
                                <i className={`fas fa-arrow-${isArabic ? 'left' : 'right'} text-xs`} />
                            </FooterLink>
                        </div>
                    </div>
                </div>

                {/* ── Main Grid ────────────────────────────────────────────────────── */}
                <div
                    className="grid grid-cols-2 gap-8 border-t py-8 md:gap-10 md:py-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                    {/* Brand block */}
                    <div className="col-span-2 lg:col-span-1">
                        <div className="mb-4 flex items-center gap-2.5">
                            <SBrandOpsLogo variant="gradient" layout="mark" size="sm" alt="SBrandOps" />
                            <span className="text-xl font-black tracking-tight text-white">SBrandOps</span>
                        </div>
                        <p className="mb-5 text-sm leading-7 text-sbo-gray" style={{ maxWidth: '28ch' }}>
                            {isArabic
                                ? 'نظام تشغيل ذكي يساعد البراندات على التخطيط، الانتاج، النشر، التحليل، والنمو من مكان واحد.'
                                : 'An AI-powered operating system for brands to plan, produce, publish, analyze, and grow from one place.'}
                        </p>
                        <p className="text-xs font-semibold uppercase tracking-widest text-sbo-cyan">
                            One System. Smarter Growth.
                        </p>
                        <div className="mt-5">
                            <p className="mb-2 text-xs font-semibold text-white/40">
                                {isArabic ? 'أول بالجديد' : 'Stay in the loop'}
                            </p>
                            {waitlistDone ? (
                                <p className="text-xs text-sbo-cyan">
                                    {isArabic ? '✓ تم التسجيل' : '✓ You\'re on the list'}
                                </p>
                            ) : (
                                <form onSubmit={handleWaitlist} className="flex gap-1.5">
                                    <input
                                        type="email"
                                        value={waitlistEmail}
                                        onChange={e => setWaitlistEmail(e.target.value)}
                                        placeholder={isArabic ? 'بريدك الإلكتروني' : 'your@email.com'}
                                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-sbo-cyan/40"
                                    />
                                    <button type="submit" className="rounded-xl bg-sbo-cyan/15 px-3 py-2 text-xs font-semibold text-sbo-cyan transition-colors hover:bg-sbo-cyan/25">
                                        {isArabic ? 'سجّل' : 'Join'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Link columns */}
                    {footerColumns.map(col => (
                        <div key={col.title}>
                            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white md:mb-4">
                                {col.title}
                            </h4>
                            <ul className="space-y-2.5 md:space-y-3">
                                {col.links.map(link => (
                                    <li key={link.label}>
                                        <FooterLink
                                            href={link.href}
                                            className="block text-sm text-sbo-gray transition-colors duration-200 hover:text-sbo-cyan"
                                        >
                                            {link.label}
                                        </FooterLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* ── Contact + Social ─────────────────────────────────────────────── */}
                <div
                    className="flex flex-col gap-5 border-t py-6 sm:flex-row sm:items-center sm:justify-between md:py-8"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                    <div className="flex flex-wrap items-center gap-5">
                        <a
                            href="mailto:support@sbrandops.com"
                            className="flex items-center gap-2 text-sm text-sbo-gray transition-colors duration-200 hover:text-sbo-cyan"
                        >
                            <i className="fas fa-envelope text-xs text-sbo-cyan" />
                            support@sbrandops.com
                        </a>
                        <FooterLink
                            href={publicPageToPath('contact')}
                            className="flex items-center gap-2 text-sm text-sbo-gray transition-colors duration-200 hover:text-sbo-cyan"
                        >
                            <i className="fas fa-headset text-xs text-sbo-cyan" />
                            {isArabic ? 'المبيعات والدعم' : 'Sales & Support'}
                        </FooterLink>
                    </div>

                    <div className="flex items-center gap-2">
                        {socialLinks.map(social => (
                            <a
                                key={social.label}
                                href={social.href}
                                aria-label={social.label}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sbo-gray transition-all duration-200 hover:border-sbo-cyan/30 hover:bg-sbo-cyan/10 hover:text-sbo-cyan"
                            >
                                <i className={`${social.icon} text-sm`} />
                            </a>
                        ))}
                    </div>
                </div>

                {/* ── Trust Badges ─────────────────────────────────────────────────── */}
                <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t py-4 sm:gap-x-6"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                    {[
                        { icon: 'fa-lock', text: 'SSL Secured' },
                        { icon: 'fa-shield-halved', text: 'Data Encrypted' },
                        { icon: 'fa-user-shield', text: 'GDPR Compliant' },
                        { icon: 'fa-circle-check', text: '99.9% Uptime' },
                        { icon: 'fa-language', text: 'Arabic-First' },
                    ].map(badge => (
                        <div key={badge.text} className="flex items-center gap-1.5">
                            <i className={`fas ${badge.icon} text-[10px] text-sbo-cyan`} />
                            <span className="text-xs text-sbo-gray">{badge.text}</span>
                        </div>
                    ))}
                </div>

                {/* ── Bottom bar ───────────────────────────────────────────────────── */}
                <div
                    className="flex flex-col gap-4 border-t py-5 md:flex-row md:items-center md:justify-between md:py-6"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                    <span className="text-xs text-sbo-gray">
                        © 2026 SBrandOps. All rights reserved.
                    </span>
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="text-xs text-sbo-gray">Powered by SMA Marketing</span>
                        <a
                            href="mailto:support@sbrandops.com"
                            className="text-xs text-sbo-gray transition-colors duration-200 hover:text-sbo-cyan"
                        >
                            support@sbrandops.com
                        </a>
                        <div
                            className="flex items-center gap-0.5 rounded-lg px-1.5 py-1"
                            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
                        >
                            <button
                                onClick={() => setLanguage('ar')}
                                className={`rounded px-2 py-0.5 text-xs font-medium transition-all duration-200 ${language === 'ar' ? 'text-white' : 'text-sbo-gray hover:text-white'
                                    }`}
                                style={language === 'ar' ? { background: 'rgba(37,99,235,0.35)' } : undefined}
                            >
                                AR
                            </button>
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                            <button
                                onClick={() => setLanguage('en')}
                                className={`rounded px-2 py-0.5 text-xs font-medium transition-all duration-200 ${language === 'en' ? 'text-white' : 'text-sbo-gray hover:text-white'
                                    }`}
                                style={language === 'en' ? { background: 'rgba(37,99,235,0.35)' } : undefined}
                            >
                                EN
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </footer>
    );
};

export default SiteFooter;
