import React from 'react';
import { Utensils, Info, AlertTriangle } from 'lucide-react';
import { MEAL_ORDER, MEAL_ACCENTS } from '../lib/constants';

export const FoodLimitsView = ({ foodLimits, theme = 'orange' }) => {
    if (!foodLimits || typeof foodLimits !== 'string') {
        const hasLimitsObj = foodLimits && typeof foodLimits === 'object';
        const displayContent = hasLimitsObj ? "Traditional per-meal limits are no longer supported. Please update to Unified Service Instructions." : "No service instructions have been published yet.";

        return (
            <div className="flex flex-col items-center justify-center p-14 bg-white dark:bg-[#1A1A1A] rounded-2xl border-2 border-dashed border-[#CCCCCC] dark:border-[#444444] shadow-md">
                <Info className="text-[#6B6B6B] mb-4" size={40} />
                <p className="text-[#0D0D0D] dark:text-[#E0E0E0] font-bold text-lg text-center uppercase tracking-tight">{displayContent}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <div className="px-1 mb-2">
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-black tracking-tighter mb-1
                               text-[#0D0D0D] section-dot
                               dark:text-white dark:uppercase dark:tracking-[-0.04em] dark:section-dot-none">
                    <span className="hidden dark:inline">SERVICE INSTRUCTIONS</span>
                    <span className="dark:hidden">Service Instructions</span>
                </h1>
                <p className="text-xs sm:text-sm text-[#0D0D0D] dark:text-[#A0A0A0] font-bold uppercase tracking-widest opacity-70">
                    Mess Service Quality & Guidelines
                </p>
            </div>

            <div className="bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] border-[4px] border-primary overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-all duration-300 hover:shadow-2xl">
                <div className="p-4 sm:p-6 bg-primary flex justify-between items-center gap-3">
                    <h3 className="text-base sm:text-lg font-black text-white dark:text-[#0D0D0D] uppercase tracking-widest flex items-center gap-2 flex-shrink-0">
                        <Utensils size={20} /> <span className="inline">Official Guidelines</span>
                    </h3>
                    <div className="text-[9px] sm:text-[10px] font-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl tracking-wider uppercase bg-white/20 text-white flex-shrink-0">
                        Standard
                    </div>
                </div>
                <div className="p-4 sm:p-8 md:p-12">
                    <div className="space-y-4 p-4 sm:p-6 md:p-10 rounded-[2rem]
                        bg-amber-500/5 border-2 border-amber-500/10
                        dark:bg-amber-500/10 dark:border-amber-500/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-amber-500/20 p-2.5
                                rounded-xl flex-shrink-0">
                                <AlertTriangle size={18}
                                    className="text-amber-600
                                    dark:text-amber-400" />
                            </div>
                            <p className="text-[9px] sm:text-xs font-black text-amber-600
                                dark:text-amber-400 uppercase tracking-widest">
                                Official Service Instructions
                            </p>
                        </div>
                        <p className="text-[#0D0D0D] dark:text-[#F0F0F0]
                            text-sm sm:text-base md:text-lg font-bold leading-[1.9]
                            whitespace-pre-wrap tracking-tight w-full">
                            {foodLimits}
                        </p>
                        <div className="pt-4 border-t border-amber-500/10
                            dark:border-amber-500/20">
                            <p className="text-[10px] sm:text-[11px] font-black text-zinc-400
                                dark:text-zinc-500 uppercase tracking-widest
                                leading-relaxed">
                                These instructions must be followed strictly
                                by the caterer. Any deviations should be
                                reported via the feedback section.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
