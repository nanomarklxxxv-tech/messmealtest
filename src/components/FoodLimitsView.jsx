import React from 'react';
import { Utensils, Info, AlertTriangle } from 'lucide-react';
import { MEAL_ORDER, MEAL_ACCENTS } from '../lib/constants';

export const FoodLimitsView = ({ foodLimits, theme = 'orange' }) => {
    if (!foodLimits) {
        return (
            <div className="flex flex-col items-center justify-center p-14 bg-white dark:bg-[#1A1A1A] rounded-2xl border-2 border-dashed border-[#CCCCCC] dark:border-[#444444] shadow-md">
                <Info className="text-[#6B6B6B] mb-4" size={40} />
                <p className="text-[#0D0D0D] dark:text-[#E0E0E0] font-bold text-lg text-center uppercase tracking-tight">No food limits have been set yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="px-1 mb-2">
                <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tighter mb-1
                               text-[#0D0D0D] section-dot
                               dark:text-white dark:uppercase dark:tracking-[-0.04em] dark:section-dot-none">
                    <span className="hidden dark:inline">FOOD LIMITS</span>
                    <span className="dark:hidden">Food Limits</span>
                </h1>
                <p className="text-sm text-[#0D0D0D] dark:text-[#A0A0A0] font-bold uppercase tracking-widest opacity-70">
                    Standard Portions & Special Instructions
                </p>
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                {MEAL_ORDER.map(meal => {
                    const limit = foodLimits[meal];
                    const accent = MEAL_ACCENTS[meal] || MEAL_ACCENTS.Breakfast;

                    return (
                        <div key={meal} className="bg-white dark:bg-[#1A1A1A] rounded-[2.5rem] border-[4px] border-primary overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-all duration-300 hover:shadow-2xl">
                            <div className="p-6 bg-primary flex justify-between items-center">
                                <h3 className="text-lg font-black text-white dark:text-[#0D0D0D] uppercase tracking-widest flex items-center gap-2">
                                    <Utensils size={20} /> {meal}
                                </h3>
                                <div className={`text-[10px] font-black px-3 py-1.5 rounded-xl tracking-wider uppercase bg-white/20 text-white`}>
                                    Daily Guide
                                </div>
                            </div>
                            <div className="p-8">
                                {limit ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/5 border-2 border-amber-500/10 dark:bg-amber-500/10 dark:border-amber-500/20">
                                            <div className="bg-amber-500/20 p-2 rounded-xl mt-1">
                                                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <p className="text-[#0D0D0D] dark:text-[#F0F0F0] text-lg font-bold leading-relaxed whitespace-pre-wrap tracking-tight">
                                                {limit}
                                            </p>
                                        </div>
                                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-center pt-2">
                                            These instructions apply every day unless specifically updated by the admin.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                        <Utensils size={32} className="text-zinc-400 mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-widest">No specific limits for {meal}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
