import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OfflineIndicator = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <AnimatePresence>
            {!isOnline && (
                <div className="fixed top-28 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
                    <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -50, opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="bg-red-500/95 dark:bg-red-600/95 backdrop-blur-md text-white px-6 py-2.5 rounded-full flex items-center gap-3 shadow-[0_10px_30px_rgba(239,68,68,0.4)] border border-white/20 pointer-events-auto"
                    >
                        <WifiOff size={18} className="animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight">Offline Mode</span>
                            <span className="text-[8px] font-medium opacity-80 leading-tight">Showing cached information</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
