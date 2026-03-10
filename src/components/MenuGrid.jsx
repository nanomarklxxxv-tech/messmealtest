import React from 'react';
import { Utensils, Clock4, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { getMealStatus, format12H } from '../lib/utils';
import { MEAL_ORDER, DEFAULT_MEAL_TIMINGS, MEAL_ACCENTS } from '../lib/constants';


export const MenuGrid = ({ menu, isLoading, activeTimings, selectedDateStr, nutritionTips, onAnalyze, aiLoading, theme = 'orange' }) => {
    if (isLoading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="px-1 py-2 mb-2">
                    <div className="h-12 w-40 bg-[#E4E4E4] dark:bg-[#2A2A2A] rounded-xl animate-pulse mb-3" />
                    <div className="h-5 w-56 bg-[#E4E4E4] dark:bg-[#2A2A2A] rounded animate-pulse" />
                </div>
                <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white dark:bg-[#1A1A1A] rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 p-6 shadow-md flex flex-col h-52 animate-pulse">
                            <div className="h-6 w-24 bg-[#E4E4E4] dark:bg-[#2A2A2A] rounded-full mb-6" />
                            <div className="space-y-3 flex-grow">
                                <div className="h-4 bg-[#F0F0F0] dark:bg-[#2A2A2A] rounded w-3/4" />
                                <div className="h-4 bg-[#F0F0F0] dark:bg-[#2A2A2A] rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!menu) {
        return (
            <div className="flex flex-col items-center justify-center p-14 bg-white dark:bg-[#1A1A1A] rounded-2xl border-2 border-dashed border-[#CCCCCC] dark:border-[#444444] shadow-md">
                <Utensils className="text-[#6B6B6B] mb-4" size={40} />
                <p className="text-[#0D0D0D] dark:text-[#E0E0E0] font-bold text-lg text-center uppercase tracking-tight">No menu active for this date.</p>
            </div>
        );
    }

    if (menu === 'CLOSED') {
        return (
            <div className="flex flex-col items-center justify-center p-14 bg-error/5 dark:bg-error/10 rounded-2xl border-2 border-error/20 shadow-md">
                <div className="bg-error/10 p-4 rounded-full mb-4">
                    <Utensils className="text-error" size={40} />
                </div>
                <h2 className="text-error font-black text-3xl text-center uppercase tracking-tighter mb-2">MESS CLOSED</h2>
                <p className="text-dark dark:text-[#E0E0E0] font-bold text-lg text-center uppercase tracking-tight opacity-70">The mess is closed for today.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── HEADING ─────────────────────────────────── */}
            <div className="px-1 mb-2">
                <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tighter mb-1
                               text-[#0D0D0D] section-dot
                               dark:text-white dark:uppercase dark:tracking-[-0.04em] dark:section-dot-none">
                    <span className="hidden dark:inline">MENU</span>
                    <span className="dark:hidden">Menu</span>
                </h1>
                <p className="text-sm text-[#0D0D0D] dark:text-[#A0A0A0] font-bold uppercase tracking-widest opacity-70">
                    {format(new Date(selectedDateStr), 'EEEE, MMMM do, yyyy')}
                </p>
            </div>

            {/* ── MEAL CARDS ──────────────────────────────── */}
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {MEAL_ORDER.map(meal => {
                    const status = getMealStatus(meal, activeTimings, selectedDateStr);
                    const timing = activeTimings?.[meal] || DEFAULT_MEAL_TIMINGS[meal];
                    const IconComponent = timing?.icon || Utensils;
                    const menuItem = menu[meal.toLowerCase()] || "Menu not updated.";
                    const accent = MEAL_ACCENTS[meal] || MEAL_ACCENTS.Breakfast;

                    let cardCls = "";
                    let statusBadge = "";
                    let statusText = status;

                    if (status === 'ONGOING') {
                        statusText = "ONGOING 😋";
                        cardCls = "scale-[1.02] z-10 shadow-[0_12px_40px_rgba(var(--color-primary),0.2)] dark:shadow-[0_12px_40px_rgba(var(--color-primary),0.15)] ring-4 ring-white/50 dark:ring-black/20";
                        statusBadge = "bg-white text-primary dark:bg-[#0D0D0D] dark:text-primary";
                    } else if (status === 'COMPLETED') {
                        statusText = "Closed";
                        cardCls = "opacity-80 grayscale-[0.6] shadow-sm";
                        statusBadge = "bg-white/20 text-white/70";
                    } else {
                        // UPCOMING
                        statusText = `OPENS ${format12H(timing?.start)}`;
                        cardCls = "shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]";
                        statusBadge = "bg-white/20 text-white";
                    }

                    const primaryBorder = "border-primary";
                    const primaryBg = "bg-primary";

                    return (
                        <div key={meal} className={`rounded-[2.5rem] border-[4px] overflow-hidden transition-all duration-300 hover:shadow-2xl flex flex-col h-full bg-white dark:bg-[#1A1A1A] ${primaryBorder} ${cardCls}`}>
                            {/* Header row: solid primary color */}
                            <div className={`p-5 flex justify-between items-center ${primaryBg}`}>
                                <h3 className="text-sm font-black text-white dark:text-[#0D0D0D] uppercase tracking-widest flex items-center gap-2">
                                    <IconComponent size={16} /> {meal}
                                </h3>
                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl tracking-wider uppercase ${statusBadge}`}>
                                    {statusText}
                                </span>
                            </div>

                            {/* Menu content */}
                            <div className="p-7 flex-grow">
                                <div className="mb-4">
                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${accent.labelCls}`}>
                                        Menu Content
                                    </span>
                                </div>
                                <p className="text-[#0D0D0D] dark:text-[#F0F0F0] text-[16px] font-black leading-[1.6] whitespace-pre-wrap tracking-tight">
                                    {String(menuItem)}
                                </p>
                            </div>

                            {/* Timing row */}
                            <div className="px-7 pb-7 mt-auto space-y-4">
                                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${timing?.isOverride ? 'bg-amber-500/10 border-2 border-amber-500/30' : 'bg-zinc-100 dark:bg-[#2A2A2A]'}`}>
                                    <Clock4 size={15} className={timing?.isOverride ? 'text-amber-500' : 'text-[#6B6B6B] dark:text-[#A0A0A0]'} />
                                    <span className={`text-xs font-black tracking-tight ${timing?.isOverride ? 'text-amber-600 dark:text-amber-400' : 'text-[#6B6B6B] dark:text-[#A0A0A0]'}`}>
                                        {format12H(timing?.start)} – {format12H(timing?.end)}
                                        {timing?.isOverride && <span className="ml-2 text-[10px] opacity-80">(OVERRIDE)</span>}
                                    </span>
                                </div>

                                {nutritionTips?.[meal] ? (
                                    <div className="bg-[#0057FF]/5 dark:bg-[#D4F000]/5 p-3 rounded-xl text-xs text-[#0057FF] dark:text-[#D4F000] border border-[#0057FF]/10 dark:border-[#D4F000]/10 leading-relaxed font-medium">
                                        <Sparkles size={11} className="inline mr-1.5" />
                                        {String(nutritionTips[meal])}
                                        <div className="mt-2 pt-2 border-t border-current opacity-30 text-[10px] italic">
                                            Disclaimer: Nutrition analyzer data is not 100% accurate.
                                        </div>
                                    </div>
                                ) : onAnalyze && menu[meal.toLowerCase()] && status !== 'COMPLETED' && (
                                    <button
                                        onClick={() => onAnalyze(meal, menu[meal.toLowerCase()])}
                                        disabled={aiLoading === meal}
                                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl transition-all
                                                   text-[#0057FF] hover:bg-[#0057FF]/5
                                                   dark:text-[#D4F000] dark:hover:bg-[#D4F000]/5"
                                    >
                                        <Sparkles size={13} />
                                        {aiLoading === meal ? "Analyzing..." : "Analyze Nutrition"}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

