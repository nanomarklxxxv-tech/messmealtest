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


    // Auto-scroll to today
    useEffect(() => {
        const t = setTimeout(() => {
            scrollRef.current?.querySelector('[data-today="true"]')?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="relative w-full mb-6">
            <div ref={scrollRef} className="flex overflow-x-auto gap-3 pb-4 px-2 snap-x snap-mandatory scrollbar-hide scroll-px-2" style={{ scrollBehavior: 'smooth' }}>
                {dates.map((date, idx) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isToday = isSameDay(date, new Date().toLocaleDateString('en-CA'));

                    return (
                        <button
                            key={idx}
                            data-today={isToday}
                            onClick={() => onSelectDate(date.toLocaleDateString('en-CA'))}
                            className={[
                                'flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 snap-center border-[4px]',
                                isSelected
                                    ? 'bg-primary text-white dark:text-[#0D0D0D] border-primary scale-110 shadow-[0_8px_24px_rgba(var(--color-primary),0.3)]'
                                    : [
                                        'bg-white dark:bg-[#1A1A1A] text-[#6B6B6B] dark:text-[#A0A0A0]',
                                        'border-zinc-200 dark:border-zinc-800',
                                        'hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] hover:text-[#0D0D0D] dark:hover:text-white shadow-sm',
                                        isToday ? 'border-primary' : '',
                                    ].join(' '),
                            ].join(' ')}
                        >
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'opacity-90' : ''}`}>
                                {date.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className={`text-xl font-heading font-black my-0.5`}>
                                {date.getDate()}
                            </span>
                            <span className={`text-[10px] font-bold uppercase`}>
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            {isToday && (
                                <span className={`text-[8px] font-black mt-1 ${isSelected ? 'opacity-80' : 'text-[#0057FF] dark:text-[#D4F000]'}`}>
                                    TODAY
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
