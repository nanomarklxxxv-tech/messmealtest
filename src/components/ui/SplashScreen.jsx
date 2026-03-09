import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

export const SplashScreen = ({ onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 2500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            key="splash"
            className="fixed inset-0 flex flex-col items-center justify-center z-[100] bg-[#0A0A0B]"
            exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
        >
            <div className="relative">
                {/* Glow Effect */}
                <motion.div
                    className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
                />

                <motion.img
                    layoutId="logo"
                    src="/pwa.png"
                    alt="MessMeal Logo"
                    className="w-48 h-48 md:w-64 md:h-64 object-contain relative z-10 drop-shadow-[0_0_30px_rgba(0,87,255,0.3)]"
                    style={{
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        imageRendering: 'auto'
                    }}
                    initial={{ scale: 0.5, rotateY: 90, opacity: 0 }}
                    animate={{ scale: 1, rotateY: 0, opacity: 1 }}
                    transition={{
                        duration: 1.2,
                        ease: [0.16, 1, 0.3, 1],
                        scale: { type: "spring", damping: 15, stiffness: 100 }
                    }}
                    onError={(e) => { e.target.src = '/pwa-512x512.png'; }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="mt-8 text-center"
            >
                <h1 className="text-4xl md:text-5xl tracking-tight text-white mb-2 normal-case">
                    <span className="font-brand-mess font-bold text-[#0057FF]">Mess</span>
                    <span className="font-brand-meal">Meal</span>
                </h1>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-[#0057FF] bg-[#0057FF]/10 px-4 py-1.5 rounded-full border border-[#0057FF]/20">
                    eat on time be on time
                </p>
            </motion.div>
        </motion.div>
    );
};
