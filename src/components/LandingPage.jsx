import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    User, Briefcase, Shield, AlertCircle, MessageSquarePlus,
    ArrowLeft, Loader2, X
} from 'lucide-react';
import { DEFAULT_TAGLINE } from '../lib/constants';
import { UnifiedFeedbackModal } from './UnifiedFeedbackModal';
import PrivacyPolicyModal from './PrivacyPolicyModal';

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
    },
    admin: {
        label: 'Admin',
        Icon: Shield,
        accentLight: '#EAB308',
        accentDark: '#EAB308',
        emailPlaceholder: 'admin@vitap.ac.in',
        description: 'Authorized Admin Access',
    }
};

/* ─────────────────────────────────────────────
   AUTH SUB-PAGE (shown after role is selected)
───────────────────────────────────────────── */
const AuthSubPage = ({ role, onBack, onGoogleLogin, loading, error }) => {
    const meta = ROLE_META[role];
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    const { Icon, label, accentLight, description } = meta;

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

                {/* ── Error Banner ── */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3.5 rounded-xl mb-5 text-xs flex items-center gap-2 font-semibold">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* ── Google Sign-In Button ── */}
                <button
                    onClick={() => onGoogleLogin(role)}
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    style={{ background: `linear-gradient(135deg, ${accentLight}, #0057FF)` }}
                >
                    {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    )}
                    {loading ? 'Signing in…' : 'Sign in with Google'}
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
   MOBILE BOTTOM SHEET (for mobile auth flow)
───────────────────────────────────────────── */
const MobileBottomSheet = ({ role, onBack, onGoogleLogin, loading, error }) => {
    const meta = ROLE_META[role];
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    const { Icon, label, accentLight, description } = meta;

    return (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
            <motion.div
                initial={{ translateY: '100%' }}
                animate={{ translateY: isVisible ? 0 : '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
                <div className="p-6 space-y-6">
                    
                    {/* Handle + Close */}
                    <div className="flex items-center justify-between">
                        <div className="w-12 h-1 bg-zinc-300 dark:bg-[#2A2A2A] rounded-full"></div>
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-[#2A2A2A] rounded-lg transition-colors"
                        >
                            <X size={20} className="text-[#0D0D0D] dark:text-white" />
                        </button>
                    </div>

                    {/* Role Header */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-[#2A2A2A] flex items-center justify-center">
                            <Icon size={24} style={{ color: accentLight }} className="dark:text-[#D4F000]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-[#0D0D0D] dark:text-white">{label}</p>
                            <p className="text-xs text-[#6B6B6B] dark:text-[#A0A0A0]">{description}</p>
                        </div>
                    </div>

                    {/* Google Sign-In Button */}
                    <button
                        onClick={() => onGoogleLogin(role)}
                        disabled={loading}
                        className="w-full py-3 rounded-lg font-bold text-sm text-white transition-all hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        style={{ background: `linear-gradient(135deg, ${accentLight}, #0057FF)` }}
                    >
                        {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        {loading ? 'Signing in…' : 'Sign in with Google'}
                    </button>

                    {/* Terms */}
                    <p className="text-center text-[10px] text-[#A0A0A0]">
                        By continuing, you agree to our{' '}
                        <span className="underline cursor-pointer">Terms</span> and{' '}
                        <span className="underline cursor-pointer">Privacy</span>.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   MAIN LANDING PAGE
───────────────────────────────────────────── */
export const LandingPage = ({ onLogin, loading, error, config }) => {
    const PRIVACY_POLICY_VERSION = '1.0'; // Update this when privacy policy changes
    const privacyPolicyKey = `privacy_policy_accepted_v${PRIVACY_POLICY_VERSION}`;
    
    const [isVisible, setIsVisible] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [screen, setScreen] = useState('hero'); // 'hero' | 'roles' | 'auth'
    const [selectedRole, setSelectedRole] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [privacyAccepted, setPrivacyAccepted] = useState(
        localStorage.getItem(privacyPolicyKey) === 'true'
    );
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    const handlePrivacyAccept = () => {
        localStorage.setItem(privacyPolicyKey, 'true');
        setPrivacyAccepted(true);
        setShowPrivacyModal(false);
        // Now show auth screen
        if (!isMobile) {
            setScreen('auth');
            setIsVisible(true);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const roleCards = [
        { id: 'student', Icon: User, label: 'Student', sub: 'View your mess menu', icon: '👤' },
        { id: 'faculty', Icon: Briefcase, label: 'Faculty/Staff', sub: 'Faculty access', icon: '💼' },
        { id: 'admin', Icon: Shield, label: 'Admin', sub: 'Manage the platform', icon: '🛡️' }
    ];

    const handleGetStarted = () => {
        setIsVisible(false);
        setTimeout(() => {
            setScreen('roles');
            setTimeout(() => setIsVisible(true), 50);
        }, 300);
    };

    const handleBack = () => {
        setIsVisible(false);
        setTimeout(() => {
            setScreen('roles');
            setSelectedRole(null);
            setTimeout(() => setIsVisible(true), 50);
        }, 200);
    };

    const handleRoleSelectFunc = (id) => {
        setSelectedRole(id);
        
        // Check if privacy policy has been accepted
        if (!privacyAccepted) {
            // Show privacy policy modal
            setShowPrivacyModal(true);
        } else {
            // Privacy already accepted, proceed to auth
            if (!isMobile) {
                setScreen('auth');
            }
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-page overflow-hidden relative">

            {/* Light-mode soft blue blob */}
            <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-hero blur-[100px] opacity-80 -z-10 dark:opacity-0 pointer-events-none" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-[#0057FF]/5 blur-[80px] opacity-60 -z-10 dark:opacity-0 pointer-events-none" />

            {/* ═══════════════════════════════════════════
                SCREEN 1: HERO/WELCOME
                ═════════════════════════════════════════ */}
            {screen === 'hero' && (
                <div className={`w-full min-h-screen flex flex-col items-center justify-center z-10 transition-all duration-500 px-4 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                    <div className="w-full max-w-sm flex flex-col items-center justify-center gap-2 md:gap-3">
                        
                        {/* Logo Hero - Large & Prominent */}
                        <div className="relative group w-full flex justify-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/20 to-[#0057FF]/20 rounded-full blur-2xl dark:from-[#D4F000]/30 dark:to-[#0057FF]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <img
                                src="/pwa-512x512.png"
                                alt="MessMeal Logo"
                                className="h-32 w-32 sm:h-40 sm:w-40 md:h-48 md:w-48 object-contain relative z-10 drop-shadow-2xl dark:drop-shadow-[0_0_30px_rgba(212,240,0,0.3)]"
                                onError={(e) => { e.target.src = '/pwa-192x192.png'; }}
                            />
                        </div>

                        {/* Additional Image - MESSMEAL1 - Closer to logo */}
                        <div className="relative group w-full flex justify-center -mt-1 md:-mt-2">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/20 to-[#0057FF]/20 rounded-full blur-2xl dark:from-[#D4F000]/30 dark:to-[#0057FF]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <img
                                src="/MESSMEAL1.png"
                                alt="MessMeal Welcome"
                                className="h-auto w-48 sm:w-56 md:w-72 lg:w-80 object-contain relative z-10 drop-shadow-2xl dark:drop-shadow-[0_0_30px_rgba(212,240,0,0.3)]"
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        </div>

                        {/* Welcome Text - Cursive */}
                        <div className="text-center w-full">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0D0D0D] dark:text-white tracking-tight italic"
                                style={{ fontFamily: '"Segoe Print", cursive' }}>
                                Welcome
                            </h1>
                        </div>

                        {/* Get Started Button - Standard Webapp Style (No gap) */}
                        <button
                            onClick={handleGetStarted}
                            disabled={loading}
                            className="w-full sm:w-auto px-8 sm:px-12 py-3 md:py-3.5 text-sm md:text-base font-semibold rounded-xl transition-all duration-300 active:scale-95 mt-2 md:mt-3
                                       bg-[#0057FF] text-white hover:bg-[#0044CC] shadow-md hover:shadow-lg
                                       dark:bg-[#D4F000] dark:text-[#0D0D0D] dark:hover:bg-[#E8FF00]"
                        >
                            <span className="inline-flex items-center gap-2 justify-center">
                                Let's get started
                            </span>
                        </button>

                        {/* Report Button - Minimal spacing */}
                        <div className="mt-3 md:mt-4 pb-28 md:pb-36">
                        </div>
                    </div>

                    {/* Copyright Footer */}
                    <div className="fixed bottom-4 left-0 right-0 flex justify-center">
                        <p className="text-xs text-center text-zinc-600 dark:text-zinc-400">
                            © {new Date().getFullYear()} MessMeal. All rights reserved
                        </p>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
                SCREEN 2: ROLE SELECTION
                ═════════════════════════════════════════ */}
            {screen === 'roles' && (
                <div className={`w-full min-h-screen flex flex-col items-center justify-center z-10 transition-all duration-500 px-4 py-8 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    
                    {/* Back Button */}
                    <div className="w-full max-w-4xl mb-6">
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(() => {
                                    setScreen('hero');
                                    setTimeout(() => setIsVisible(true), 50);
                                }, 200);
                            }}
                            className="flex items-center gap-2 text-sm font-semibold text-[#6B6B6B] dark:text-[#A0A0A0] hover:text-[#0D0D0D] dark:hover:text-white transition-colors group"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                            Back
                        </button>
                    </div>
                    
                    {/* MessMeal Header */}
                    <div className="mb-6 mt-2">
                        <h2 className="text-3xl sm:text-4xl font-black text-[#0D0D0D] dark:text-white tracking-tight">
                            <span className="text-[#0057FF] dark:text-white">Mess</span><span className="text-[#2E7D32] dark:text-[#D4F000]">Meal</span>
                        </h2>
                    </div>
                    
                    {/* Role Cards Grid - Responsive */}
                    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12">
                        {roleCards.map(({ id, Icon, label, sub }) => (
                            <button
                                key={id}
                                onClick={() => handleRoleSelectFunc(id)}
                                disabled={loading}
                                className="group flex flex-col items-center justify-center p-8 md:p-10 cursor-pointer transition-all duration-200 active:scale-[0.98] w-full min-h-64 md:min-h-72 bg-white dark:bg-[#1A1A1A] rounded-2xl md:rounded-3xl border-2 border-zinc-100 dark:border-[#2A2A2A] hover:border-[#0057FF] hover:shadow-lg dark:hover:border-[#D4F000] dark:hover:shadow-[0_0_15px_rgba(212,240,0,0.1)]"
                            >
                                {/* Icon Circle */}
                                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 transition-all duration-200 bg-zinc-100 dark:bg-[#2A2A2A] group-hover:bg-[#0057FF] dark:group-hover:bg-[#D4F000]">
                                    <Icon size={36} className="text-[#0057FF] group-hover:text-white dark:text-[#D4F000] dark:group-hover:text-[#0D0D0D] transition-colors" strokeWidth={2} />
                                </div>
                                
                                {/* Label & Description */}
                                <h2 className="text-lg md:text-xl font-heading font-black text-[#0D0D0D] dark:text-white tracking-tight text-center">
                                    {label}
                                </h2>
                                <p className="text-xs md:text-sm text-[#6B6B6B] dark:text-[#A0A0A0] mt-2 font-medium text-center">
                                    {sub}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Report Bug */}
                    <div className="text-center mb-8">
                        <button
                            onClick={() => setIsFeedbackOpen(true)}
                            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold transition-all text-[#0057FF] bg-[#0057FF]/5 border border-[#0057FF]/20 rounded-xl hover:bg-[#0057FF]/10 dark:text-[#D4F000] dark:bg-[#D4F000]/10 dark:border-[#D4F000]/20 dark:hover:bg-[#D4F000]/20"
                        >
                            <MessageSquarePlus size={16} /> Report
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="text-center opacity-70">
                        <p className="text-[10px] font-bold text-[#0D0D0D] dark:text-white tracking-widest uppercase">
                            {config?.tagline || DEFAULT_TAGLINE}
                        </p>
                    </div>

                    {/* Copyright Footer */}
                    <div className="fixed bottom-4 left-0 right-0 flex justify-center">
                        <p className="text-xs text-center text-zinc-600 dark:text-zinc-400">
                            © {new Date().getFullYear()} MessMeal. All rights reserved
                        </p>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════
                SCREEN 3: AUTH (DESKTOP INLINE)
                ═════════════════════════════════════════ */}
            {screen === 'auth' && !isMobile && selectedRole && (
                <div className={`w-full max-w-md mx-auto z-10 transition-all duration-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <AuthSubPage
                        role={selectedRole}
                        onBack={handleBack}
                        onGoogleLogin={onLogin}
                        loading={loading}
                        error={error}
                    />
                </div>
            )}

            {/* ═════════════════════════════════════════
                MOBILE BOTTOM SHEET FOR AUTH
                ═══════════════════════════════════════ */}
            {isMobile && selectedRole && screen === 'roles' && privacyAccepted && !showPrivacyModal && (
                <MobileBottomSheet
                    role={selectedRole}
                    onBack={handleBack}
                    onGoogleLogin={onLogin}
                    loading={loading}
                    error={error}
                />
            )}

            <UnifiedFeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
            
            <PrivacyPolicyModal 
                isOpen={showPrivacyModal} 
                onAccept={handlePrivacyAccept}
            />
        </div>
    );
};
