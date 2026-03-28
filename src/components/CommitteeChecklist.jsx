import React, { useState, useEffect, useMemo } from 'react';
import { db, appId } from '../lib/firebase';
import {
    doc, onSnapshot, setDoc, updateDoc, serverTimestamp, getDocs, collection
} from 'firebase/firestore';
import { COMMITTEE_CHECKLISTS, COMMITTEE_ROLES } from
    '../lib/constants';
import { CheckCircle2, XCircle, Clock, Save, Clock4,
    ClipboardList, AlertTriangle, MessageSquare, FileText, X, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
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

    // History state
    const [showHistory, setShowHistory] =
        useState(false);
    const [historyData, setHistoryData] =
        useState([]);
    const [historyLoading, setHistoryLoading] =
        useState(false);
    const [historyTab, setHistoryTab] =
        useState('attendance');
    
    // Default to full current month (1st to today or end of month)
    const getDefaultHistoryDates = () => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const effectiveLastDay = today < lastDay ? today : lastDay;
        
        return {
            from: firstDay.toLocaleDateString('en-CA'),
            to: effectiveLastDay.toLocaleDateString('en-CA')
        };
    };
    
    const defaultDates = getDefaultHistoryDates();
    
    const [historyDateFrom, setHistoryDateFrom] =
        useState(defaultDates.from);
    const [historyDateTo, setHistoryDateTo] =
        useState(defaultDates.to);

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

    const fetchHistory = () => {
        setHistoryLoading(true);
        try {
            // Ensure we have valid date range (use full month if not specified)
            const fromDate = historyDateFrom || defaultDates.from;
            const toDate = historyDateTo || defaultDates.to;
            
            // Real-time listener for history data
            const unsubscribe = onSnapshot(
                collection(db, 'artifacts', appId,
                    'public', 'data', 'checklists'),
                (snap) => {
                    const docs = snap.docs
                        .map(d => ({
                            id: d.id, ...d.data()
                        }))
                        .filter(d =>
                            d.committeeRole === committeeRole
                            && d.hostel === hostel
                            && d.submitted === true
                            && d.date >= fromDate
                            && d.date <= toDate
                        )
                        .sort((a, b) =>
                            a.date.localeCompare(b.date)
                        );
                    setHistoryData(docs);
                    setHistoryLoading(false);
                },
                (e) => {
                    console.error('History fetch failed:', e);
                    toast.error('Failed to load history.');
                    setHistoryLoading(false);
                }
            );
            return unsubscribe;
        } catch (e) {
            console.error('History fetch failed:', e);
            toast.error('Failed to load history.');
            setHistoryLoading(false);
            return () => {};
        }
    };

    // Normalize date to YYYY-MM-DD format
    const normalizeDate = (date) => {
        if (!date) return '';
        if (typeof date === 'string') return date;
        if (date instanceof Date) return date.toLocaleDateString('en-CA');
        return String(date);
    };

    // Generate array of ALL dates - MUST use useMemo to update when historyData changes
    const historyDates = useMemo(() => {
        const dateSet = new Set();
        
        // Add all dates from the range
        const currentDate = new Date(historyDateFrom);
        const endDate = new Date(historyDateTo);
        while (currentDate <= endDate) {
            dateSet.add(currentDate.toLocaleDateString('en-CA'));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Add actual dates from historyData to ensure we have all of them
        if (historyData && historyData.length > 0) {
            historyData.forEach(doc => {
                const normalizedDate = normalizeDate(doc.date);
                if (normalizedDate) dateSet.add(normalizedDate);
            });
        }
        
        const dates = Array.from(dateSet).sort();
        return dates;
    }, [historyData, historyDateFrom, historyDateTo]);

    useEffect(() => {
        let unsubscribe;
        if (showHistory) {
            unsubscribe = fetchHistory();
        }
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [showHistory, historyDateFrom,
        historyDateTo]);

    // Manual refresh function
    const handleRefreshHistory = () => {
        setHistoryLoading(true);
        fetchHistory();
    };

    const exportHistoryCSV = () => {
        if (historyData.length === 0) {
            toast.error('No data to export.');
            return;
        }

        const items = checklist?.daily
            || checklist?.monthly || [];
        const dates = historyDates;
        const meals = checklist?.daily
            ? ['Breakfast', 'Lunch', 'Dinner']
            : ['Monthly'];

        // Sheet 1 — Attendance
        const attendanceRows = items.map(item => {
            const row = {
                'Item ID': item.id,
                'Item': item.text
            };
            dates.forEach(date => {
                const doc = historyData
                    .find(d => normalizeDate(d.date) === normalizeDate(date));
                meals.forEach(meal => {
                    const entry =
                        meal === 'Monthly'
                        ? doc?.items?.[item.id]
                        : doc?.items?.[item.id]
                            ?.[meal];
                    const key = meals.length > 1
                        ? `${date} (${meal.slice(0,1)})`
                        : date;
                    row[key] =
                        entry?.status || '-';
                });
            });
            return row;
        });

        // Sheet 2 — Remarks
        const remarksRows = items.map(item => {
            const row = {
                'Item ID': item.id,
                'Item': item.text
            };
            dates.forEach(date => {
                const doc = historyData
                    .find(d => normalizeDate(d.date) === normalizeDate(date));
                meals.forEach(meal => {
                    const entry =
                        meal === 'Monthly'
                        ? doc?.items?.[item.id]
                        : doc?.items?.[item.id]
                            ?.[meal];
                    const key = meals.length > 1
                        ? `${date} (${meal.slice(0,1)})`
                        : date;
                    row[key] =
                        entry?.remarks || '-';
                });
            });
            return row;
        });

        // Session remarks rows (if exist)
        const sessionRows = [];
        dates.forEach(date => {
            const doc = historyData
                .find(d => normalizeDate(d.date) === normalizeDate(date));
            if (doc?.sessionRemarks) {
                meals.forEach(meal => {
                    const remark =
                        doc.sessionRemarks[meal];
                    if (remark) {
                        sessionRows.push({
                            'Date': date,
                            'Meal': meal,
                            'Overall Remark': remark
                        });
                    }
                });
            }
        });

        const wb = XLSX.utils.book_new();

        const ws1 = XLSX.utils.json_to_sheet(
            attendanceRows
        );
        XLSX.utils.book_append_sheet(
            wb, ws1, 'Attendance'
        );

        const ws2 = XLSX.utils.json_to_sheet(
            remarksRows
        );
        XLSX.utils.book_append_sheet(
            wb, ws2, 'Remarks'
        );

        if (sessionRows.length > 0) {
            const ws3 = XLSX.utils.json_to_sheet(
                sessionRows
            );
            XLSX.utils.book_append_sheet(
                wb, ws3, 'Session Remarks'
            );
        }

        const filename =
            `${COMMITTEE_ROLES[committeeRole]}_` +
            `${hostel}_` +
            `${historyDateFrom}_to_` +
            `${historyDateTo}.xlsx`;

        XLSX.writeFile(wb, filename);
        toast.success('Exported successfully!');
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

            {/* View History Button */}
            <button
                onClick={() => setShowHistory(true)}
                className="mb-4 flex items-center gap-2
                    text-xs font-black text-primary
                    uppercase tracking-widest
                    bg-primary/10 px-4 py-2 rounded-xl
                    hover:bg-primary/20 transition-colors
                    self-start"
            >
                <FileText size={14} />
                View History
            </button>

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

            {/* History Panel Overlay */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/50
                    backdrop-blur-sm z-[100] overflow-y-auto">
                    <div className="min-h-screen flex items-center
                        justify-center p-4">
                        <Card className="w-full max-w-5xl bg-white
                            dark:bg-[#16162A] border border-zinc-200
                            dark:border-white/10">
                            {/* Header */}
                            <div className="flex items-center justify-between
                                mb-6 pb-4 border-b border-zinc-100
                                dark:border-white/5">
                                <div>
                                    <h3 className="text-lg font-black
                                        text-dark dark:text-white
                                        uppercase tracking-widest">
                                        Checklist History
                                    </h3>
                                    <p className="text-xs text-zinc-500
                                        mt-1">
                                        {user?.email} •{' '}
                                        {hostel}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleRefreshHistory}
                                        disabled={historyLoading}
                                        className="flex items-center gap-2
                                            px-4 py-2 rounded-xl
                                            text-xs font-black
                                            bg-blue-500/10
                                            text-blue-600
                                            dark:text-blue-400
                                            hover:bg-blue-500/20
                                            disabled:opacity-50
                                            transition-colors"
                                    >
                                        <Clock4 size={14} />
                                        Refresh
                                    </button>
                                    {historyData.length > 0 && (
                                        <button
                                            onClick={exportHistoryCSV}
                                            disabled={historyLoading}
                                            className="flex items-center gap-2
                                                px-4 py-2 rounded-xl
                                                text-xs font-black
                                                bg-emerald-500/10
                                                text-emerald-600
                                                dark:text-emerald-400
                                                hover:bg-emerald-500/20
                                                transition-colors
                                                disabled:opacity-50"
                                        >
                                            <Download size={14} />
                                            Export CSV
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="flex items-center gap-2
                                            px-4 py-2 rounded-xl
                                            text-xs font-black
                                            bg-zinc-100
                                            dark:bg-white/10
                                            text-zinc-600
                                            dark:text-zinc-400
                                            hover:bg-zinc-200
                                            dark:hover:bg-white/20
                                            transition-colors"
                                    >
                                        <X size={14} />
                                        Close
                                    </button>
                                </div>
                            </div>

                            {/* Date Filters */}
                            <div className="grid grid-cols-1
                                sm:grid-cols-2 gap-4 mb-6 pb-6
                                border-b border-zinc-100
                                dark:border-white/5">
                                <div>
                                    <label className="block text-xs
                                        font-black text-zinc-500
                                        uppercase tracking-widest mb-2">
                                        From Date
                                    </label>
                                    <input
                                        type="date"
                                        value={historyDateFrom}
                                        onChange={(e) =>
                                            setHistoryDateFrom(
                                                e.target.value
                                            )
                                        }
                                        className="w-full p-2 text-sm
                                            bg-white dark:bg-black/40
                                            border border-zinc-200
                                            dark:border-white/10
                                            rounded-xl outline-none
                                            focus:border-primary
                                            focus:ring-2
                                            focus:ring-primary/20
                                            text-dark dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs
                                        font-black text-zinc-500
                                        uppercase tracking-widest mb-2">
                                        To Date
                                    </label>
                                    <input
                                        type="date"
                                        value={historyDateTo}
                                        onChange={(e) =>
                                            setHistoryDateTo(
                                                e.target.value
                                            )
                                        }
                                        className="w-full p-2 text-sm
                                            bg-white dark:bg-black/40
                                            border border-zinc-200
                                            dark:border-white/10
                                            rounded-xl outline-none
                                            focus:border-primary
                                            focus:ring-2
                                            focus:ring-primary/20
                                            text-dark dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Tab Switcher */}
                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() =>
                                        setHistoryTab('attendance')
                                    }
                                    className={`px-4 py-2 rounded-xl
                                        text-xs font-black uppercase
                                        tracking-widest transition-all
                                        ${historyTab === 'attendance'
                                            ? 'bg-primary text-white'
                                            : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    Attendance
                                </button>
                                <button
                                    onClick={() =>
                                        setHistoryTab('remarks')
                                    }
                                    className={`px-4 py-2 rounded-xl
                                        text-xs font-black uppercase
                                        tracking-widest transition-all
                                        ${historyTab === 'remarks'
                                            ? 'bg-primary text-white'
                                            : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    Remarks
                                </button>
                                <button
                                    onClick={() =>
                                        setHistoryTab('session')
                                    }
                                    className={`px-4 py-2 rounded-xl
                                        text-xs font-black uppercase
                                        tracking-widest transition-all
                                        ${historyTab === 'session'
                                            ? 'bg-primary text-white'
                                            : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    Session Remarks
                                </button>
                            </div>

                            {/* Data Grid Table */}
                            <div className="mt-6">
                                {historyLoading ? (
                                    <div className="bg-white dark:bg-[#16162A] rounded-2xl p-12 text-center border border-zinc-200 dark:border-white/10 shadow-sm">
                                        <div className="inline-block animate-spin mb-3">
                                            <Clock4 size={24} className="text-primary" />
                                        </div>
                                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                            Loading history data...
                                        </p>
                                    </div>
                                ) : historyTab === 'session' ? (
                                    // Session Remarks View - show each meal session with remarks
                                    <div className="bg-white dark:bg-[#16162A] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
                                        <div className="overflow-auto max-h-[65vh]">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="sticky top-0 z-20">
                                                    <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-white/5 dark:to-white/10 border-b-2 border-zinc-200 dark:border-white/20">
                                                        <th className="text-left px-5 py-4 font-black text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-200 min-w-[150px] border-r-2 border-zinc-300 dark:border-white/20 sticky left-0 z-30 bg-zinc-50 dark:bg-white/5">
                                                            📅 Date
                                                        </th>
                                                        <th className="text-center px-4 py-4 font-black text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-200 min-w-[80px] bg-blue-50 dark:bg-blue-500/10 border-r border-zinc-200 dark:border-white/10">
                                                            Session
                                                        </th>
                                                        <th className="text-left px-5 py-4 font-black text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-white/5">
                                                            Remarks
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {historyDates.map((date, dateIdx) => {
                                                        const doc = historyData.find(d => normalizeDate(d.date) === normalizeDate(date));
                                                        const sessionRemarks = doc?.sessionRemarks || {};
                                                        const meals = ['Breakfast', 'Lunch', 'Dinner'];
                                                        const remarksForDate = meals.filter(meal => sessionRemarks[meal]);
                                                        
                                                        // If no remarks for this date, show single row with dashes
                                                        if (remarksForDate.length === 0) {
                                                            return (
                                                                <tr key={date} className={`border-b border-zinc-100 dark:border-white/5 ${
                                                                    dateIdx % 2 === 0 
                                                                        ? 'bg-white dark:bg-[#16162A]' 
                                                                        : 'bg-zinc-50/40 dark:bg-white/[0.02]'
                                                                } hover:bg-blue-50 dark:hover:bg-blue-500/10`}>
                                                                    <td className="px-5 py-4 font-bold border-r-2 border-zinc-300 dark:border-white/20 sticky left-0 z-10 bg-inherit min-w-[150px]">
                                                                        <div className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase">
                                                                            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                                                                        </div>
                                                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                                                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-4 text-center bg-blue-50 dark:bg-blue-500/10">
                                                                        <span className="text-zinc-400">—</span>
                                                                    </td>
                                                                    <td className="px-5 py-4 text-left">
                                                                        <span className="text-sm text-zinc-600 dark:text-zinc-300">—</span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }
                                                        
                                                        // Show multiple rows - one per meal with remarks
                                                        return remarksForDate.map((meal, mealIdx) => (
                                                            <tr key={`${date}-${meal}`} className={`border-b border-zinc-100 dark:border-white/5 ${
                                                                (dateIdx * 3 + mealIdx) % 2 === 0 
                                                                    ? 'bg-white dark:bg-[#16162A]' 
                                                                    : 'bg-zinc-50/40 dark:bg-white/[0.02]'
                                                            } hover:bg-blue-50 dark:hover:bg-blue-500/10`}>
                                                                {mealIdx === 0 && (
                                                                    <td rowSpan={remarksForDate.length} className="px-5 py-4 font-bold border-r-2 border-zinc-300 dark:border-white/20 sticky left-0 z-10 bg-inherit min-w-[150px]">
                                                                        <div className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase">
                                                                            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                                                                        </div>
                                                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                                                            {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                <td className={`px-4 py-3 text-center font-bold text-xs uppercase tracking-wider ${
                                                                    meal === 'Breakfast' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                                                    meal === 'Lunch' ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' :
                                                                    'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                                                }`}>
                                                                    {meal.slice(0, 1)}
                                                                </td>
                                                                <td className="px-5 py-3 text-left">
                                                                    <span className="text-sm text-zinc-600 dark:text-zinc-300 break-words">
                                                                        {sessionRemarks[meal] || '—'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ));
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : historyData.length === 0 ? (
                                    <div className="bg-white dark:bg-[#16162A] rounded-2xl p-12 text-center border border-zinc-200 dark:border-white/10 shadow-sm">
                                        <ClipboardList size={32} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                            No submissions found for the selected date range
                                        </p>
                                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                            Try adjusting your date filters
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-[#16162A] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden">
                                        <div className="overflow-auto max-h-[65vh]">
                                            <table className="w-full text-sm border-collapse">
                                                {/* Header 1: Item IDs */}
                                                <thead className="sticky top-0 z-20">
                                                    <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-white/5 dark:to-white/10 border-b border-zinc-200 dark:border-white/20">
                                                        <th className="text-left px-5 py-3 font-black text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-200 border-r-2 border-zinc-300 dark:border-white/20 sticky left-0 z-30 bg-zinc-50 dark:bg-white/5 min-w-[100px]">
                                                            📅 Date
                                                        </th>
                                                        {checklist?.daily?.map(item => (
                                                            <th key={item.id} colSpan="3" className="text-center px-3 py-3 font-black text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-white/10 border-l border-r border-zinc-200 dark:border-white/20">
                                                                {item.id}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                    {/* Header 2: Meal Types (B, L, D) */}
                                                    <tr className="bg-zinc-50 dark:bg-white/5 border-b-2 border-zinc-200 dark:border-white/20">
                                                        <th className="text-left px-5 py-2 font-black text-xs text-zinc-500 dark:text-zinc-400 border-r-2 border-zinc-300 dark:border-white/20 sticky left-0 z-30 bg-zinc-50 dark:bg-white/5"></th>
                                                        {checklist?.daily?.map(item => (
                                                            <React.Fragment key={`${item.id}-meals`}>
                                                                <th className="text-center px-2 py-2 font-bold text-xs text-zinc-600 dark:text-zinc-300 bg-blue-50 dark:bg-blue-500/10 border-r border-zinc-200 dark:border-white/10">B</th>
                                                                <th className="text-center px-2 py-2 font-bold text-xs text-zinc-600 dark:text-zinc-300 bg-green-50 dark:bg-green-500/10 border-r border-zinc-200 dark:border-white/10">L</th>
                                                                <th className="text-center px-2 py-2 font-bold text-xs text-zinc-600 dark:text-zinc-300 bg-orange-50 dark:bg-orange-500/10 border-r border-zinc-200 dark:border-white/10">D</th>
                                                            </React.Fragment>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                {/* Table Body: Dates as Rows */}
                                                <tbody>
                                                    {historyDates.map((date, dateIdx) => (
                                                        <tr key={date} className={`border-b border-zinc-100 dark:border-white/5 ${
                                                            dateIdx % 2 === 0 
                                                                ? 'bg-white dark:bg-[#16162A]' 
                                                                : 'bg-zinc-50/40 dark:bg-white/[0.02]'
                                                        } hover:bg-blue-50 dark:hover:bg-blue-500/10`}>
                                                            {/* Date Column */}
                                                            <td className="px-5 py-3 font-bold border-r-2 border-zinc-300 dark:border-white/20 sticky left-0 z-10 bg-inherit min-w-[100px]">
                                                                <div className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase">
                                                                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                                                                </div>
                                                                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                                                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                                                                </div>
                                                            </td>
                                                            {/* Status Cells for Each Item + Meal */}
                                                            {checklist?.daily?.map(item => {
                                                                const doc = historyData.find(d => normalizeDate(d.date) === normalizeDate(date));
                                                                const entry = doc?.items?.[item.id];
                                                                
                                                                const meals = ['Breakfast', 'Lunch', 'Dinner'];
                                                                const mealStatuses = {};
                                                                
                                                                if (entry) {
                                                                    meals.forEach(meal => {
                                                                        const mealData = entry[meal];
                                                                        // Always initialize meal data, even if empty, to capture remarks
                                                                        mealStatuses[meal] = {
                                                                            status: mealData?.status || '',
                                                                            remarks: mealData?.remarks || ''
                                                                        };
                                                                    });
                                                                }
                                                                
                                                                return (
                                                                    <React.Fragment key={`${item.id}-${date}`}>
                                                                        {meals.map(meal => {
                                                                            const data = mealStatuses[meal];
                                                                            return (
                                                                                <td key={`${item.id}-${meal}-${date}`} className={`px-2 py-3 text-center border-r border-zinc-100 dark:border-white/5 align-middle ${
                                                                                    meal === 'Breakfast' ? 'bg-blue-50 dark:bg-blue-500/5' :
                                                                                    meal === 'Lunch' ? 'bg-green-50 dark:bg-green-500/5' :
                                                                                    'bg-orange-50 dark:bg-orange-500/5'
                                                                                }`}>
                                                                                    {historyTab === 'attendance' ? (
                                                                                        <div className="text-2xl font-black leading-none">
                                                                                            {data?.status === '✓' ? (
                                                                                                <span className="text-emerald-500">✓</span>
                                                                                            ) : data?.status === '✗' ? (
                                                                                                <span className="text-red-500">✗</span>
                                                                                            ) : (
                                                                                                <span className="text-zinc-300 dark:text-zinc-600">–</span>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="min-h-[60px] flex items-center justify-center">
                                                                                            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 max-w-[70px] line-clamp-2 break-words">
                                                                                                {data?.remarks || '—'}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                            );
                                                                        })}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};
