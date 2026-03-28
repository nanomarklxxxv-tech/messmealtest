import React, { useState, useEffect } from 'react';
import { db, appId } from '../lib/firebase';
import {
    doc, onSnapshot, setDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { COMMITTEE_CHECKLISTS, COMMITTEE_ROLES } from
    '../lib/constants';
import { CheckCircle2, XCircle, Clock, Save, Clock4,
    ClipboardList, AlertTriangle, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export const CommitteeChecklist = ({ user, userData, config }) => {
    const committeeRole = userData?.committeeRole;
    const checklist = COMMITTEE_CHECKLISTS[committeeRole];
    const hostel = userData?.hostel || 'GENERAL';

    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentMonth = `${new Date().getFullYear()}-${
        String(new Date().getMonth() + 1).padStart(2, '0')
    }`;

    // Daily checklist state
    const [dailyData, setDailyData] = useState({});
    const [dailySubmitted, setDailySubmitted] = useState(false);
    const [lastEditedBy, setLastEditedBy] = useState(null);
    const [lastEditedAt, setLastEditedAt] = useState(null);
    const [saving, setSaving] = useState(false);

    // Monthly checklist state (menu_daily committee only)
    const [monthlyData, setMonthlyData] = useState({});
    const [monthlySubmitted, setMonthlySubmitted] =
        useState(false);

    const dailyDocId =
        `${committeeRole}_${hostel}_${todayStr}`;
    const monthlyDocId =
        `${committeeRole}_${hostel}_monthly_${currentMonth}`;

    const [currentTime, setCurrentTime] = useState(
        new Date()
    );

    const isDailyLocked = (() => {
        const now = new Date();
        const currentDayStr =
            now.toLocaleDateString('en-CA');
        if (currentDayStr > todayStr) return true;
        const totalSeconds =
            now.getHours() * 3600 +
            now.getMinutes() * 60 +
            now.getSeconds();
        return totalSeconds >= 86399;
    })();

    const isMonthlyLocked = monthlySubmitted &&
        (() => {
            const now = new Date();
            const totalSeconds =
                now.getHours() * 3600 +
                now.getMinutes() * 60 +
                now.getSeconds();
            return totalSeconds >= 86399;
        })();

    const DEFAULT_TIMINGS = {
        Breakfast: { start: '07:30' },
        Lunch:     { start: '12:30' },
        Snacks:    { start: '16:30' },
        Dinner:    { start: '19:30' }
    };

    const isMealWindowOpen = (meal) => {
        if (isDailyLocked) return false;
        const timings = config?.mealTimings
            || DEFAULT_TIMINGS;
        const timing = timings[meal];
        if (!timing?.start) return true;
        const now = new Date();
        const [h, m] = timing.start
            .split(':').map(Number);
        const mealMinutes = h * 60 + m;
        const nowMinutes =
            now.getHours() * 60 + now.getMinutes();
        return nowMinutes >= mealMinutes - 30;
    };

    const getMealOpensAt = (meal) => {
        const timings = config?.mealTimings
            || DEFAULT_TIMINGS;
        const timing = timings[meal];
        if (!timing?.start) return null;
        const [h, m] = timing.start
            .split(':').map(Number);
        const openH = m >= 30
            ? h
            : h - 1;
        const openM = m >= 30
            ? m - 30
            : m + 30;
        return `${String(openH).padStart(2, '0')}:${String(openM).padStart(2, '0')}`;
    };


    // Real-time listener for daily checklist
    useEffect(() => {
        if (!committeeRole || !checklist?.daily) return;
        const ref = doc(db, 'artifacts', appId,
            'public', 'data', 'checklists', dailyDocId);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setDailyData(data || {});
                setDailySubmitted(data.submitted || false);
                setLastEditedBy(data.lastEditedBy || null);
                setLastEditedAt(data.lastEditedAt || null);
            }
        });
        return () => unsub();
    }, [committeeRole, hostel, todayStr]);

    // Real-time listener for monthly checklist
    useEffect(() => {
        if (!committeeRole || !checklist?.monthly) return;
        const ref = doc(db, 'artifacts', appId,
            'public', 'data', 'checklists', monthlyDocId);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setMonthlyData(data.items || {});
                setMonthlySubmitted(data.submitted || false);
            }
        });
        return () => unsub();
    }, [committeeRole, hostel, currentMonth]);

    useEffect(() => {
        const checkAutoLock = async () => {
            const now = new Date();
            const totalSeconds =
                now.getHours() * 3600 +
                now.getMinutes() * 60 +
                now.getSeconds();

            // At exactly 11:59:59 PM auto-submit
            // whatever is filled
            if (totalSeconds >= 86399) {
                const todayStr =
                    new Date().toLocaleDateString('en-CA');

                // Auto-submit daily checklist
                if (checklist?.daily && !isDailyLocked) {
                    const ref = doc(db, 'artifacts', appId,
                        'public', 'data', 'checklists',
                        dailyDocId);
                    try {
                        await setDoc(ref, {
                            submitted: true,
                            autoSubmitted: true,
                            submittedBy:
                                userData?.name ||
                                user?.email ||
                                'Auto-submitted',
                            submittedAt: serverTimestamp()
                        }, { merge: true });
                    } catch (e) {
                        console.error(
                            'Auto-submit failed:', e
                        );
                    }
                }

                // Auto-submit monthly checklist
                // (only menu_daily committee)
                if (checklist?.monthly && !isMonthlyLocked) {
                    const now = new Date();
                    const lastDayOfMonth = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                    ).getDate();

                    // Auto-submit monthly on last day
                    // of the month at 11:59:59 PM
                    if (now.getDate() === lastDayOfMonth) {
                        const ref = doc(db, 'artifacts',
                            appId, 'public', 'data',
                            'checklists', monthlyDocId);
                        try {
                            await setDoc(ref, {
                                submitted: true,
                                autoSubmitted: true,
                                submittedBy:
                                    userData?.name ||
                                    user?.email ||
                                    'Auto-submitted',
                                submittedAt: serverTimestamp()
                            }, { merge: true });
                        } catch (e) {
                            console.error(
                                'Monthly auto-submit failed:',
                                e
                            );
                        }
                    }
                }
            }
        };

        // Check every second near midnight
        // (only run checks after 11 PM to save resources)
        const now = new Date();
        if (now.getHours() >= 23) {
            const interval = setInterval(
                checkAutoLock, 1000
            );
            return () => clearInterval(interval);
        }
    }, [userData, user, dailyDocId, monthlyDocId,
        checklist]);

    useEffect(() => {
        const now = new Date();
        if (now.getHours() < 23) return;
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Auto-save field change to Firestore immediately
    const updateDailyField = async (
        itemId, meal, field, value
    ) => {
        if (isDailyLocked) return;
        const ref = doc(db, 'artifacts', appId,
            'public', 'data', 'checklists', dailyDocId);
        const key = `items.${itemId}.${meal}.${field}`;
        try {
            // Ensure document exists first
            await setDoc(ref, {
                committeeRole,
                hostel,
                date: todayStr,
                submitted: false
            }, { merge: true });

            await updateDoc(ref, {
                [key]: value,
                lastEditedBy: userData?.name || user?.email,
                lastEditedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error('Auto-save failed:', e);
        }
    };

    const updateMonthlyField = async (itemId, field, value) => {
        if (isMonthlyLocked) return;
        const ref = doc(db, 'artifacts', appId,
            'public', 'data', 'checklists', monthlyDocId);
        const key = `items.${itemId}.${field}`;
        try {
            // Ensure document exists first
            await setDoc(ref, {
                committeeRole,
                hostel,
                month: currentMonth,
                submitted: false
            }, { merge: true });

            await updateDoc(ref, {
                [key]: value,
                lastEditedBy: userData?.name || user?.email,
                lastEditedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error('Auto-save failed:', e);
        }
    };

    const updateSessionRemark = async (meal, value) => {
        if (isDailyLocked) return;
        const ref = doc(db, 'artifacts', appId,
            'public', 'data', 'checklists',
            dailyDocId);
        try {
            await setDoc(ref, {
                committeeRole,
                hostel,
                date: todayStr,
                submitted: false
            }, { merge: true });

            await updateDoc(ref, {
                [`sessionRemarks.${meal}`]: value,
                lastEditedBy:
                    userData?.name || user?.email,
                lastEditedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error(
                'Session remark save failed:', e
            );
        }
    };

    // Validate before final submit
    const validateAndSubmitDaily = async () => {
        const items = checklist.daily;
        for (const item of items) {
            for (const meal of
                ['Breakfast', 'Lunch', 'Dinner']
            ) {
                const entry =
                    dailyData?.items?.[item.id]?.[meal] || {};
                if (entry.status === '✗' &&
                    !entry.remarks?.trim()
                ) {
                    toast.error(
                        `Remarks required for ${item.id}
                        (${meal}) marked as ✗`
                    );
                    return;
                }
            }
        }
        setSaving(true);
        try {
            const ref = doc(db, 'artifacts', appId,
                'public', 'data', 'checklists', dailyDocId);
            await setDoc(ref, {
                submitted: true,
                submittedBy: userData?.name || user?.email,
                submittedAt: serverTimestamp()
            }, { merge: true });
            toast.success('Daily checklist submitted! ✅');
        } catch {
            toast.error('Submission failed. Try again.');
        }
        setSaving(false);
    };

    const validateAndSubmitMonthly = async () => {
        const items = checklist.monthly || [];
        for (const item of items) {
            const entry = monthlyData[item.id] || {};
            if (entry.status === '✗' &&
                !entry.remarks?.trim()
            ) {
                toast.error(
                    `Remarks required for ${item.id}
                    marked as ✗`
                );
                return;
            }
        }
        setSaving(true);
        try {
            const ref = doc(db, 'artifacts', appId,
                'public', 'data', 'checklists', monthlyDocId);
            await setDoc(ref, {
                submitted: true,
                submittedBy: userData?.name || user?.email,
                submittedAt: serverTimestamp()
            }, { merge: true });
            toast.success('Monthly checklist submitted! ✅');
        } catch {
            toast.error('Submission failed. Try again.');
        }
        setSaving(false);
    };

    if (!committeeRole || !checklist) {
        return (
            <div className="p-8 text-center text-zinc-400">
                <ClipboardList size={40}
                    className="mx-auto mb-4 opacity-30" />
                <p className="font-bold text-sm uppercase
                    tracking-widest">
                    No committee role assigned
                </p>
                <p className="text-xs mt-2">
                    Contact your super admin to get assigned
                    to a committee.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-24">

            {/* Auto-lock Countdown Banner */}
            {(() => {
                const now = currentTime;
                if (now.getHours() < 23) return null;
                const minutesLeft = 59 - now.getMinutes();
                const secondsLeft = 59 - now.getSeconds();
                return (
                    <div className="w-full bg-red-500/10 border
                        border-red-500/30 rounded-2xl p-4 flex
                        items-center gap-3 mb-4">
                        <AlertTriangle size={18}
                            className="text-red-500 flex-shrink-0" />
                        <p className="text-sm font-bold text-red-600
                            dark:text-red-400">
                            ⚠ Checklist auto-locks in{' '}
                            {minutesLeft}m {secondsLeft}s.
                            Any unfilled items will be
                            auto-submitted as is.
                        </p>
                    </div>
                );
            })()}

            {/* Header */}
            <div className="flex items-center
                justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-heading
                        font-black text-dark dark:text-white
                        tracking-tight">
                        {COMMITTEE_ROLES[committeeRole]}
                    </h2>
                    <p className="text-xs font-bold
                        text-zinc-400 uppercase tracking-widest
                        mt-1">
                        {hostel} · {todayStr}
                    </p>
                </div>
                {lastEditedBy && (
                    <div className="text-[11px] font-bold
                        text-zinc-400 bg-zinc-100
                        dark:bg-white/5 px-3 py-2 rounded-xl">
                        Last edited by {lastEditedBy}
                        {lastEditedAt && (
                            <span className="ml-1 opacity-60">
                                · {new Date(lastEditedAt)
                                    .toLocaleTimeString([],
                                    { hour: '2-digit',
                                      minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Monthly Checklist (menu_daily only) */}
            {checklist.monthly && (
                <Card className="bg-white dark:bg-[#16162A]
                    border border-zinc-200 dark:border-white/10">
                    <div className="flex items-center
                        justify-between mb-6">
                        <h3 className="font-heading font-black
                            text-lg text-dark dark:text-white
                            tracking-tight flex items-center
                            gap-2">
                            <ClipboardList size={20}
                                className="text-primary" />
                            Monthly Checklist —{' '}
                            {new Date().toLocaleString(
                                'default',
                                { month: 'long',
                                  year: 'numeric' }
                            )}
                        </h3>
                        {monthlySubmitted && (
                            <span className="text-[10px]
                                font-black text-emerald-600
                                bg-emerald-50 dark:bg-emerald-900/20
                                px-3 py-1.5 rounded-full uppercase
                                tracking-wider">
                                ✓ Submitted — Editable until 11:59 PM
                            </span>
                        )}
                    </div>

                    <div className="space-y-4">
                        {checklist.monthly.map(item => {
                            const entry =
                                monthlyData[item.id] || {};
                            const now = new Date();
                            const isAfterMidnight =
                                now.getHours() === 23 &&
                                now.getMinutes() === 59 &&
                                now.getSeconds() >= 59;
                            const isPastToday = (() => {
                                const todayStr =
                                    new Date().toLocaleDateString('en-CA');
                                return checklist.date
                                    ? checklist.date < todayStr
                                    : false;
                            })();
                            const isLocked = isAfterMidnight || isPastToday;
                            return (
                                <div key={item.id}
                                    className="p-4 rounded-2xl
                                    bg-zinc-50 dark:bg-black/20
                                    border border-zinc-100
                                    dark:border-white/5">
                                    <div className="flex
                                        items-start gap-3 mb-3">
                                        <span className="text-[10px]
                                            font-black text-primary
                                            bg-primary/10 px-2 py-1
                                            rounded-lg uppercase
                                            tracking-wider
                                            flex-shrink-0">
                                            {item.id}
                                        </span>
                                        <p className="text-sm
                                            font-medium text-dark
                                            dark:text-white
                                            leading-relaxed flex-1">
                                            {item.text}
                                        </p>
                                    </div>
                                    <div className="flex gap-3
                                        items-start">
                                        <div className="flex gap-2">
                                            <button
                                                disabled={isLocked}
                                                onClick={() =>
                                                    updateMonthlyField(
                                                        item.id,
                                                        'status', '✓'
                                                    )
                                                }
                                                className={`px-4 py-2
                                                    rounded-xl text-sm
                                                    font-black transition-all
                                                    ${entry.status === '✓'
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-zinc-200 dark:bg-white/10 text-zinc-500'
                                                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                ✓
                                            </button>
                                            <button
                                                disabled={isLocked}
                                                onClick={() =>
                                                    updateMonthlyField(
                                                        item.id,
                                                        'status', '✗'
                                                    )
                                                }
                                                className={`px-4 py-2
                                                    rounded-xl text-sm
                                                    font-black transition-all
                                                    ${entry.status === '✗'
                                                        ? 'bg-red-500 text-white'
                                                        : 'bg-zinc-200 dark:bg-white/10 text-zinc-500'
                                                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                ✗
                                            </button>
                                        </div>
                                        {entry.status === '✗' && (
                                            <input
                                                type="text"
                                                disabled={isLocked}
                                                value={
                                                    entry.remarks || ''
                                                }
                                                onChange={(e) =>
                                                    updateMonthlyField(
                                                        item.id,
                                                        'remarks',
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Remarks (required)"
                                                className="flex-1 p-2
                                                    text-sm bg-white
                                                    dark:bg-black/40
                                                    border border-red-300
                                                    dark:border-red-500/30
                                                    rounded-xl outline-none
                                                    focus:border-red-500
                                                    text-dark dark:text-white
                                                    placeholder-red-300"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {!isMonthlyLocked && (
                        <Button
                            onClick={validateAndSubmitMonthly}
                            loading={saving}
                            className="w-full mt-6 py-4 font-black
                                uppercase tracking-widest"
                        >
                            <Save size={16} className="mr-2" />
                            Submit Monthly Checklist
                            (Editable until end of month)
                        </Button>
                    )}
                </Card>
            )}

            {/* Daily Checklist */}
            {checklist.daily && (
                <Card className="bg-white dark:bg-[#16162A]
                    border border-zinc-200 dark:border-white/10">
                    <div className="flex items-center
                        justify-between mb-6">
                        <h3 className="font-heading font-black
                            text-lg text-dark dark:text-white
                            tracking-tight flex items-center
                            gap-2">
                            <Clock size={20}
                                className="text-primary" />
                            Daily Checklist — {todayStr}
                        </h3>
                        {dailySubmitted && (
                            <span className="text-[10px]
                                font-black text-emerald-600
                                bg-emerald-50 dark:bg-emerald-900/20
                                px-3 py-1.5 rounded-full uppercase
                                tracking-wider">
                                ✓ Submitted — Editable until 11:59 PM
                            </span>
                        )}
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-4 gap-2 mb-4
                        px-2">
                        <div className="text-[10px] font-black
                            text-zinc-400 uppercase tracking-widest
                            col-span-1">
                            Item
                        </div>
                        {['Breakfast', 'Lunch', 'Dinner'].map(
                            meal => (
                                <div key={meal}
                                    className="text-[10px] font-black
                                    text-zinc-400 uppercase
                                    tracking-widest text-center">
                                    {meal}
                                </div>
                            )
                        )}
                    </div>

                    <div className="space-y-3">
                        {checklist.daily.map(item => {
                            const now = new Date();
                            const isAfterMidnight =
                                now.getHours() === 23 &&
                                now.getMinutes() === 59 &&
                                now.getSeconds() >= 59;
                            const isPastToday = (() => {
                                const todayStr =
                                    new Date().toLocaleDateString('en-CA');
                                return checklist.date
                                    ? checklist.date < todayStr
                                    : false;
                            })();
                            const isLocked = isAfterMidnight || isPastToday;
                            return (
                                <div key={item.id}
                                    className="p-4 rounded-2xl
                                    bg-zinc-50 dark:bg-black/20
                                    border border-zinc-100
                                    dark:border-white/5">
                                    <div className="flex
                                        items-start gap-2 mb-3">
                                        <span className="text-[10px]
                                            font-black text-primary
                                            bg-primary/10 px-2 py-1
                                            rounded-lg uppercase
                                            tracking-wider
                                            flex-shrink-0">
                                            {item.id}
                                        </span>
                                        <p className="text-sm
                                            font-medium text-dark
                                            dark:text-white
                                            leading-relaxed">
                                            {item.text}
                                        </p>
                                    </div>

                                    {['Breakfast', 'Lunch',
                                        'Dinner'].map(meal => {
                                        const entry =
                                            dailyData?.items?.[item.id]
                                                ?.[meal] || {};
                                        return (
                                            <div key={meal}
                                                className="mb-3">
                                                <p className="text-[10px]
                                                    font-black
                                                    text-zinc-400
                                                    uppercase
                                                    tracking-widest
                                                    mb-1.5">
                                                    {meal}
                                                </p>
                                                {!isMealWindowOpen(meal) ? (
                                                    <div className="flex flex-col
                                                        items-center justify-center
                                                        py-4 gap-1">
                                                        <Clock4 size={16}
                                                            className="text-zinc-400" />
                                                        <p className="text-[10px] font-black
                                                            text-zinc-400 uppercase
                                                            tracking-widest text-center">
                                                            Opens at<br />
                                                            {getMealOpensAt(meal)}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex
                                                        gap-2 items-start">
                                                        <div className="flex gap-2">
                                                            <button
                                                                disabled={
                                                                    isLocked
                                                                }
                                                                onClick={() =>
                                                                    updateDailyField(
                                                                        item.id,
                                                                        meal,
                                                                        'status',
                                                                        '✓'
                                                                    )
                                                                }
                                                                className={`px-4
                                                                    py-2 rounded-xl
                                                                    text-sm font-black
                                                                    transition-all
                                                                    ${entry.status === '✓'
                                                                        ? 'bg-emerald-500 text-white'
                                                                        : 'bg-zinc-200 dark:bg-white/10 text-zinc-500'
                                                                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                            >
                                                                ✓
                                                            </button>
                                                            <button
                                                                disabled={
                                                                    isLocked
                                                                }
                                                                onClick={() =>
                                                                    updateDailyField(
                                                                        item.id,
                                                                        meal,
                                                                        'status',
                                                                        '✗'
                                                                    )
                                                                }
                                                                className={`px-4
                                                                    py-2 rounded-xl
                                                                    text-sm font-black
                                                                    transition-all
                                                                    ${entry.status === '✗'
                                                                        ? 'bg-red-500 text-white'
                                                                        : 'bg-zinc-200 dark:bg-white/10 text-zinc-500'
                                                                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                            >
                                                                ✗
                                                            </button>
                                                        </div>
                                                        {entry.status ===
                                                            '✗' && (
                                                            <input
                                                                type="text"
                                                                disabled={
                                                                    isLocked
                                                                }
                                                                value={
                                                                    entry.remarks
                                                                    || ''
                                                                }
                                                                onChange={(e) =>
                                                                    updateDailyField(
                                                                        item.id,
                                                                        meal,
                                                                        'remarks',
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="Remarks (required)"
                                                                className="flex-1
                                                                    p-2 text-sm
                                                                    bg-white
                                                                    dark:bg-black/40
                                                                    border
                                                                    border-red-300
                                                                    dark:border-red-500/30
                                                                    rounded-xl
                                                                    outline-none
                                                                    focus:border-red-500
                                                                    text-dark
                                                                    dark:text-white
                                                                    placeholder-red-300"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* Overall Session Remarks */}
                    <div className="mt-6 pt-6 border-t
                        border-zinc-100 dark:border-white/5">
                        <h4 className="text-xs font-black
                            text-zinc-500 uppercase tracking-widest
                            mb-4 flex items-center gap-2">
                            <MessageSquare size={14} />
                            Overall Session Remarks (Optional)
                        </h4>
                        <div className="grid grid-cols-1
                            sm:grid-cols-3 gap-4">
                            {['Breakfast', 'Lunch', 'Dinner'].map(
                                meal => (
                                <div key={meal}>
                                    <label className="block
                                        text-[10px] font-black
                                        text-zinc-400 uppercase
                                        tracking-widest mb-2">
                                        {meal}
                                    </label>
                                    <textarea
                                        disabled={isDailyLocked}
                                        value={
                                            dailyData
                                                ?.sessionRemarks
                                                ?.[meal] || ''
                                        }
                                        onChange={(e) =>
                                            updateSessionRemark(
                                                meal,
                                                e.target.value
                                            )}
                                        placeholder={
                                            `Overall remarks for ${meal}...`}
                                        rows={3}
                                        className={`w-full p-3 min-h-[80px]
                                            text-sm bg-zinc-50
                                            dark:bg-black/20 border
                                            border-zinc-200
                                            dark:border-white/10
                                            rounded-xl outline-none
                                            focus:border-primary
                                            focus:ring-2
                                            focus:ring-primary/20
                                            text-dark dark:text-white
                                            placeholder-zinc-400
                                            resize-none transition-all
                                            ${isDailyLocked
                                                ? 'opacity-60 cursor-not-allowed'
                                                : ''
                                            }`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {!isDailyLocked && (
                        <Button
                            onClick={validateAndSubmitDaily}
                            loading={saving}
                            className="w-full mt-6 py-4 font-black
                                uppercase tracking-widest"
                        >
                            <Save size={16} className="mr-2" />
                            Submit & Continue Editing Until 11:59 PM
                        </Button>
                    )}
                </Card>
            )}
        </div>
    );
};
