import React, { useRef, useMemo, useEffect } from 'react';
import { format, subDays, addDays } from 'date-fns';

export const DateStrip = ({ selectedDate, onSelectDate, theme = 'orange' }) => {
    const scrollRef = useRef(null);

    const dates = useMemo(() => {
        const d = [];
        const today = new Date();
        for (let i = 15; i > 0; i--) d.push(subDays(today, i));
        d.push(today);
        for (let i = 1; i <= 15; i++) d.push(addDays(today, i));
        return d;
    }, []);

    const isSameDay = (d1, d2String) => d1.toLocaleDateString('en-CA') === d2String;

    const getThemeBackgroundColor = () => {
        const themes = {
            'blue': 'bg-blue-100 dark:bg-blue-900/50',
            'orange': 'bg-orange-100 dark:bg-orange-900/50',
            'green': 'bg-emerald-100 dark:bg-emerald-900/50',
            'purple': 'bg-purple-100 dark:bg-purple-900/50',
            'indigo': 'bg-indigo-100 dark:bg-indigo-900/50'
        };
        return themes[theme] || themes.blue;
    };

    // Auto-scroll to today
    useEffect(() => {
        const t = setTimeout(() => {
            scrollRef.current?.querySelector('[data-today="true"]')?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="relative w-full mb-6">
            {/* Background Layer - Theme Colored */}
            <div className={`absolute inset-0 rounded-3xl -mx-4 sm:-mx-6 md:-mx-8 ${getThemeBackgroundColor()}`} style={{ zIndex: 0 }} />
            
            {/* Date Strip */}
            <div className="relative z-10" ref={scrollRef} style={{ scrollBehavior: 'smooth' }}>
                <div className="flex overflow-x-auto gap-2 sm:gap-3 py-4 sm:py-6 px-4 sm:px-6 snap-x snap-mandatory scrollbar-hide scroll-px-4">
                {dates.map((date, idx) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isToday = isSameDay(date, new Date().toLocaleDateString('en-CA'));

                    return (
                        <button
                            key={idx}
                            data-today={isToday}
                            onClick={() => onSelectDate(date.toLocaleDateString('en-CA'))}
                            className={[
                                'flex-shrink-0 w-16 sm:w-20 h-20 sm:h-24 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-300 snap-center border-2 sm:border-[3px]',
                                isSelected
                                    ? 'bg-[#0057FF] text-white dark:bg-[#D4F000] dark:text-[#0D0D0D] border-[#0057FF] dark:border-[#D4F000] scale-105 shadow-lg'
                                    : [
                                        'bg-white dark:bg-[#1A1A1A] text-[#0D0D0D] dark:text-white',
                                        'border-zinc-300 dark:border-[#2A2A2A]',
                                        'hover:border-[#0057FF] dark:hover:border-[#D4F000] shadow-sm',
                                        isToday ? 'border-[#0057FF] dark:border-[#D4F000]' : '',
                                    ].join(' '),
                            ].join(' ')}
                        >
                            <span className={`text-[7px] sm:text-[8px] font-heading font-black uppercase tracking-wider ${isSelected ? 'opacity-90' : 'opacity-70'}`}>
                                {date.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className={`text-lg sm:text-2xl font-heading font-black my-0.5`}>
                                {date.getDate()}
                            </span>
                            <span className={`text-[8px] sm:text-[9px] font-bold uppercase ${isSelected ? 'opacity-90' : 'opacity-70'}`}>
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            {isToday && (
                                <span className={`text-[6px] sm:text-[7px] font-black mt-0.5 tracking-wider ${isSelected ? 'opacity-80' : 'text-[#0057FF] dark:text-[#D4F000]'}`}>
                                    TODAY
                                </span>
                            )}
                        </button>
                    );
                })}
                </div>
            </div>
        </div>
    );
};
