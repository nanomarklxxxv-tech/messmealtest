import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    User, Briefcase, Shield, AlertCircle, MessageSquarePlus,
    ArrowLeft, Mail, Eye, EyeOff, Loader2, Chrome
} from 'lucide-react';
import { DEFAULT_TAGLINE } from '../lib/constants';
import { UnifiedFeedbackModal } from './UnifiedFeedbackModal';

// Per-role meta for the auth sub-page
const ROLE_META = {
    student: {
        label: 'Student',
        Icon: User,
        accentLight: '#2E7D32',
        accentDark: '#D4F000',
        emailPlaceholder: 'name.21bce@vitapstudent.ac.in',
        description: 'Use your @vitapstudent.ac.in email',
    },
    faculty: {
        label: 'Faculty / Staff',
        Icon: Briefcase,
        accentLight: '#0057FF',
        accentDark: '#D4F000',
        emailPlaceholder: 'name@vitap.ac.in',
        description: 'Use your @vitap.ac.in or @vit.ac.in email',
    }
};

/* ─────────────────────────────────────────────
   AUTH SUB-PAGE (shown after role is selected)
───────────────────────────────────────────── */
const AuthSubPage = ({ role, onBack, onGoogleLogin, loading, error }) => {
    const meta = ROLE_META[role];
    const [tab, setTab] = useState('login'); // 'login' | 'signup'
    const [showPw, setShowPw] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    const { Icon, label, accentLight, emailPlaceholder, description } = meta;

    return (
        <div
            className={`w-full max-w-md mx-auto transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
            {/* ── Back button ── */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm font-semibold text-[#6B6B6B] dark:text-[#A0A0A0] hover:text-[#0D0D0D] dark:hover:text-white mb-8 transition-colors group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Change role
            </button>

            {/* ── Logo + role badge ── */}
            <div className="flex items-center gap-3 mb-8">
                <motion.img
                    layoutId="logo"
                    src="/pwa.png"
                    alt="MessMeal"
                    className="h-10 w-10 object-contain"
                    onError={(e) => { e.target.src = '/pwa-512x512.png'; }}
                />
                <div>
                    <span className="text-2xl tracking-tighter font-bold text-[#0D0D0D] dark:text-white block leading-none">
                        <span className="font-brand-mess text-[#0057FF] dark:text-white">Mess</span>
                        <span className="font-brand-meal text-[#2E7D32] dark:text-[#D4F000]">Meal</span>
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Icon size={12} style={{ color: accentLight }} className="dark:text-[#D4F000]" />
                        <span className="text-[11px] font-bold uppercase tracking-widest"
                            style={{ color: accentLight }}
                        >
                            {label} Portal
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Card ── */}
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-zinc-100 dark:border-[#2A2A2A] shadow-lg dark:shadow-[0_4px_32px_rgba(0,0,0,0.4)] p-8">

                {/* Role description */}
                <p className="text-xs text-[#6B6B6B] dark:text-[#A0A0A0] mb-6 font-medium leading-relaxed">
                    {description}
                </p>

                {/* ── Login / Signup Tab Toggle ── */}
                <div className="flex bg-zinc-100 dark:bg-[#111] rounded-xl p-1 mb-7">
                    {['login', 'signup'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === t
                                ? 'bg-white dark:bg-[#2A2A2A] text-[#0D0D0D] dark:text-white shadow-sm'
                                : 'text-[#6B6B6B] dark:text-[#5A5A5A] hover:text-[#0D0D0D] dark:hover:text-white'
                                }`}
                        >
                            {t === 'login' ? 'Login' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                {/* ── Error Banner ── */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3.5 rounded-xl mb-5 text-xs flex items-center gap-2 font-semibold">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* ── Google Sign-In (actual auth) ── */}
                <button
                    onClick={() => onGoogleLogin(role)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-sm border-2 transition-all hover:scale-[1.01] active:scale-[0.99]
                        bg-white dark:bg-[#2A2A2A]
                        border-zinc-200 dark:border-[#3A3A3A]
                        text-[#0D0D0D] dark:text-white
                        hover:border-[#0057FF] dark:hover:border-[#D4F000]
                        hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    )}
                    {loading ? 'Signing in…' : 'Continue with Google'}
                </button>

                {/* ── Divider ── */}
                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-zinc-100 dark:bg-[#2A2A2A]" />
                    <span className="text-[10px] font-bold tracking-widest text-[#A0A0A0] uppercase">or continue with email</span>
                    <div className="flex-1 h-px bg-zinc-100 dark:bg-[#2A2A2A]" />
                </div>

                {/* ── Email field ── */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-[#0D0D0D] dark:text-white mb-1.5">
                            University Email
                        </label>
                        <div className="relative">
                            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
                            <input
                                type="email"
                                placeholder={emailPlaceholder}
                                disabled
                                className="w-full pl-9 pr-4 py-3 rounded-xl bg-zinc-50 dark:bg-[#111] border border-zinc-200 dark:border-[#2A2A2A] text-sm text-[#0D0D0D] dark:text-white placeholder-[#A0A0A0] cursor-not-allowed opacity-60 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[#0D0D0D] dark:text-white mb-1.5">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                placeholder="••••••••"
                                disabled
                                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-[#111] border border-zinc-200 dark:border-[#2A2A2A] text-sm placeholder-[#A0A0A0] cursor-not-allowed opacity-60 outline-none pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(p => !p)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A0A0A0] hover:text-[#6B6B6B] transition-colors"
                            >
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── CTA button (shown but routes through Google as email/password auth is not supported) ── */}
                <button
                    onClick={() => onGoogleLogin(role)}
                    disabled={loading}
                    className="mt-6 w-full py-3.5 rounded-xl font-black text-sm text-white transition-all hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(135deg, ${accentLight}, #0057FF)` }}
                >
                    {loading
                        ? <Loader2 size={16} className="animate-spin mx-auto" />
                        : tab === 'login' ? 'Login with Google' : 'Create Account with Google'
                    }
                </button>

                <p className="text-center text-[10px] text-[#A0A0A0] mt-5 leading-relaxed">
                    By continuing, you agree to our{' '}
                    <span className="underline cursor-pointer hover:text-[#0057FF] dark:hover:text-[#D4F000]">Terms of Service</span>
                    {' '}and{' '}
                    <span className="underline cursor-pointer hover:text-[#0057FF] dark:hover:text-[#D4F000]">Privacy Policy</span>.
                </p>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   MAIN LANDING PAGE
───────────────────────────────────────────── */
export const LandingPage = ({ onLogin, loading, error, config }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null); // null = show role cards

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const roleCards = [
        { id: 'student', Icon: User, label: 'Student', sub: 'View your mess menu' },
        { id: 'faculty', Icon: Briefcase, label: 'Faculty/Staff', sub: 'Faculty access' },
        { id: 'admin', Icon: Shield, label: 'Admin', sub: 'Manage the platform' }
    ];

    // Reset visibility when switching back to role selection
    const handleBack = () => {
        setIsVisible(false);
        setTimeout(() => {
            setSelectedRole(null);
            setTimeout(() => setIsVisible(true), 50);
        }, 200);
    };

    const handleRoleSelect = (id) => {
        setIsVisible(false);
        setTimeout(() => {
            setSelectedRole(id);
            setTimeout(() => setIsVisible(true), 50);
        }, 200);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-page overflow-hidden relative">

            {/* Light-mode soft blue blob */}
            <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-hero blur-[100px] opacity-80 -z-10 dark:opacity-0 pointer-events-none" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[#0057FF]/5 blur-[80px] opacity-60 -z-10 dark:opacity-0 pointer-events-none" />

            {/* ── AUTH SUB-PAGE ─────────────────────────── */}
            {selectedRole ? (
                <div className={`w-full max-w-md mx-auto z-10 transition-all duration-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <AuthSubPage
                        role={selectedRole}
                        onBack={handleBack}
                        onGoogleLogin={onLogin}
                        loading={loading}
                        error={error}
                    />
                </div>
            ) : (
                /* ── ROLE SELECTION PAGE ─────────────────── */
                <div className={`w-full max-w-4xl mx-auto z-10 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                    {/* ── HERO ── */}
                    <div className="text-center mb-14 pt-8">
                        <div className="flex items-center justify-center gap-3 mb-8">
                            <img
                                src="/pwa-512x512.png"
                                alt="MessMeal Logo"
                                className="h-16 w-16 object-contain"
                                onError={(e) => { e.target.src = '/pwa-192x192.png'; }}
                            />
                            <span className="text-5xl md:text-7xl tracking-tighter text-[#0D0D0D] dark:text-white">
                                <span className="font-brand-mess font-bold text-[#0057FF] dark:text-white">Mess</span>
                                <span className="font-brand-meal text-[#2E7D32] dark:text-[#D4F000]">Meal</span>
                            </span>
                        </div>
                    </div>

                    {/* ── ROLE CARDS ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 px-2">
                        {roleCards.map(({ id, Icon, label, sub }) => (
                            <button
                                key={id}
                                onClick={() => handleRoleSelect(id)}
                                disabled={loading}
                                className={[
                                    "group flex flex-col items-center justify-center p-10 py-14 cursor-pointer transition-all duration-200 active:scale-[0.98] w-full",
                                    "bg-white rounded-card shadow-card border-2 border-transparent hover:border-[#0057FF] hover:shadow-blue-glow",
                                    "dark:bg-[#1A1A1A] dark:rounded-card-xl dark:border-2 dark:border-[#2A2A2A] dark:hover:border-[#D4F000] dark:shadow-card-dark dark:hover:shadow-nik-glow",
                                ].join(' ')}
                            >
                                <div className={[
                                    "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-200",
                                    "bg-[#F0F0F0] group-hover:bg-[#0057FF]",
                                    "dark:bg-[#2A2A2A] dark:group-hover:bg-[#D4F000]",
                                ].join(' ')}>
                                    <Icon size={36} className="text-[#0057FF] group-hover:text-white dark:text-[#D4F000] dark:group-hover:text-[#0D0D0D] transition-colors" strokeWidth={2} />
                                </div>
                                <h2 className="text-xl font-heading font-black text-[#0D0D0D] dark:text-white tracking-tight">{label}</h2>
                                <p className="text-xs text-[#6B6B6B] dark:text-[#A0A0A0] mt-1 font-medium">{sub}</p>
                            </button>
                        ))}
                    </div>

                    {/* ── FOOTER ACTIONS ── */}
                    <div className="mt-14 text-center space-y-4">
                        <button
                            onClick={() => setIsFeedbackOpen(true)}
                            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold transition-all
                                       text-[#0057FF] bg-[#0057FF]/5 border border-[#0057FF]/20 rounded-xl hover:bg-[#0057FF]/10
                                       dark:text-[#D4F000] dark:bg-[#D4F000]/10 dark:border-[#D4F000]/20 dark:rounded-pill dark:hover:bg-[#D4F000]/20"
                        >
                            <MessageSquarePlus size={16} /> Report Bug / Feedback
                        </button>

                        {/* Tagline Footer */}
                        <div className="pt-2 opacity-100">
                            <p className="text-[10px] font-bold text-[#0D0D0D] dark:text-white tracking-widest uppercase">
                                {config?.tagline || DEFAULT_TAGLINE}
                            </p>
                        </div>

                    </div>
                </div>
            )}

            <UnifiedFeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </div>
    );
};
