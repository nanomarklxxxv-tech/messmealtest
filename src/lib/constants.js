// src/lib/constants.js
import { Coffee, Sun, Moon } from 'lucide-react';

export const INITIAL_SUPER_ADMIN_EMAIL = "messmeal.notifications@gmail.com";
export const SUPER_ADMIN_EMAILS = ["messmeal.notifications@gmail.com", "wardenmh.food@vitap.ac.in"];
export const DEFAULT_TAGLINE = "Made with ❤️ , EAT ON TIME : BE ON TIME";
export const DEFAULT_RATING_WINDOW = 48;

export const ALLOWED_DOMAINS = ['@vitap.ac.in', '@vitapstudent.ac.in', '@vit.ac.in'];

export const DEFAULT_MEAL_TIMINGS = {
    Breakfast: { start: "07:30", end: "09:00", icon: Coffee },
    Lunch: { start: "12:30", end: "14:15", icon: Sun },
    Snacks: { start: "16:45", end: "18:15", icon: Coffee },
    Dinner: { start: "19:15", end: "20:45", icon: Moon }
};

export const DEFAULT_HOSTELS = [
    "MH-1", "MH-2", "MH-3", "MH-4", "MH-5", "MH-6", "MH-7", "MH-8",
    "LH-1", "LH-2", "LH-3", "LH-4", "LH-5", "LH-6", "LH-7"
];
export const DEFAULT_MESS_TYPES = ["VEG", "NON-VEG", "SPL"];
export const MEAL_ORDER = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

export const MEAL_ACCENTS = {
    Breakfast: {
        borderCls: 'border-orange-500/80 dark:border-orange-400/60',
        bgSubtle: 'bg-orange-50/40 dark:bg-orange-950/20',
        iconCls: 'text-orange-600 dark:text-orange-400',
        labelCls: 'bg-orange-100 dark:bg-orange-500/20 text-orange-900 dark:text-orange-100 border border-orange-300 dark:border-orange-500/50',
    },
    Lunch: {
        borderCls: 'border-emerald-500/80 dark:border-emerald-400/60',
        bgSubtle: 'bg-emerald-50/40 dark:bg-emerald-950/20',
        iconCls: 'text-emerald-600 dark:text-emerald-400',
        labelCls: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-500/50',
    },
    Snacks: {
        borderCls: 'border-amber-500/80 dark:border-amber-400/60',
        bgSubtle: 'bg-amber-50/40 dark:bg-amber-950/20',
        iconCls: 'text-amber-600 dark:text-amber-400',
        labelCls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-500/50',
    },
    Dinner: {
        borderCls: 'border-indigo-500/80 dark:border-indigo-400/60',
        bgSubtle: 'bg-indigo-50/40 dark:bg-indigo-950/20',
        iconCls: 'text-indigo-600 dark:text-indigo-400',
        labelCls: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-100 border border-indigo-300 dark:border-indigo-500/50',
    },
};
