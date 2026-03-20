import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { collection, addDoc, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { Utensils, User, LogOut, Camera, Shield, MessageSquare, Star, X, CheckCircle2, AlertTriangle, Clock4, Lock as LockIcon, Megaphone, RefreshCw, FileText, Image as ImageIcon, PlusCircle, Bell, BellOff, BellRing } from 'lucide-react';
import { scheduleMealNotifications, clearMealNotifTimers, maybeNotifyNotice, getNotifPermission, requestNotifPermission } from '../lib/notificationService';
import { format, getHours, getMinutes } from 'date-fns';
import { toast } from 'react-hot-toast';

import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { BouncingLogoScreen } from './ui/LoadingScreen';
import { DateStrip } from './DateStrip';
import { MenuGrid } from './MenuGrid';
import { FoodLimitsView } from './FoodLimitsView';
import { ProfileSetupScreen } from './ProfileSetup';
import { SuccessModal } from './ui/SuccessModal';
import { callGemini, getMealStatus, getTimeMinutes, compressImage } from '../lib/utils';
import { DEFAULT_MEAL_TIMINGS, MEAL_ORDER, DEFAULT_RATING_WINDOW, DEFAULT_TAGLINE, MEAL_ACCENTS } from '../lib/constants';
import { UnifiedFeedbackModal } from './UnifiedFeedbackModal';
import { CommitteeChecklist } from './CommitteeChecklist';
import { ClipboardList } from 'lucide-react';

const MENU_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const getMenuFromCache = (cacheKey) => {
    try {
        const cached = localStorage.getItem(
            `menu_cache_${cacheKey}`
        );
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > MENU_CACHE_TTL)
            return null;
        return data;
    } catch {
        return null;
    }
};

const setMenuToCache = (cacheKey, data) => {
    try {
        localStorage.setItem(
            `menu_cache_${cacheKey}`,
            JSON.stringify({
                data,
                timestamp: Date.now()
            })
        );
    } catch {
        // localStorage full — ignore
    }
};

const TOUR_SLIDES = [
    {
        emoji: '👋',
        title: 'Welcome to MessMeal!',
        description: 'Your campus dining companion. ' +
            'View daily menus, rate your meals, ' +
            'and report food issues — all in one place.',
        color: 'from-blue-600 to-indigo-600'
    },
    {
        emoji: '🍽️',
        title: 'View Daily Menu',
        description: 'Tap the MENU tab to see ' +
            'today\'s breakfast, lunch, snacks ' +
            'and dinner. Switch between Day View ' +
            'and Week View.',
        color: 'from-emerald-600 to-teal-600'
    },
    {
        emoji: '⭐',
        title: 'Rate Your Meals',
        description: 'Tap the RATE tab after eating ' +
            'to give stars and feedback. ' +
            'Your ratings help improve food quality.',
        color: 'from-amber-500 to-orange-500'
    },
    {
        emoji: '📸',
        title: 'Report Food Issues',
        description: 'Tap the PROOF tab to report ' +
            'food quality issues with photos. ' +
            'Admins review every complaint.',
        color: 'from-red-500 to-pink-500'
    }
];

export const UserDashboard = ({ user, userData, onLogout, onSwitchToAdmin, canSwitchToAdmin, config, settings, updateSettings, isPending = false }) => {
    const [activeTab, setActiveTab] = useState('menu');
    const [viewType, setViewType] = useState('daily'); // 'daily' or 'limits'
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [menu, setMenu] = useState(null);
    const [isLoadingMenu, setIsLoadingMenu] = useState(true);
    const [ratings, setRatings] = useState({});
    const [submittedRatings, setSubmittedRatings] = useState({});
    const [notices, setNotices] = useState([]);
    const [isLoadingNotices, setIsLoadingNotices] = useState(true);
    const [nutritionTips, setNutritionTips] = useState({});
    const [aiLoading, setAiLoading] = useState(null);
    const [proofFiles, setProofFiles] = useState([]); // Array of strings (base64)
    const [userActivity, setUserActivity] = useState([]);

    const [complaintText, setComplaintText] = useState('');
    const [complaintSession, setComplaintSession] = useState('Breakfast');
    const [complaintDate, setComplaintDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [submitting, setSubmitting] = useState(false);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showBouncingLogo, setShowBouncingLogo] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [showNotices, setShowNotices] = useState(false);
    const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '' });
    const [showChecklist, setShowChecklist] = useState(false);
    const isFirstNoticeLoad = React.useRef(true);
    const isSubmittingRef = React.useRef(false);
    const [dismissedNotices, setDismissedNotices] =
        useState(() => {
            try {
                const key = `dismissed_notices_${user?.uid || 'guest'}`;
                const stored = localStorage.getItem(key);
                return stored ? JSON.parse(stored) : [];
            } catch { return []; }
        });

    // Notification preferences (persisted in localStorage per user)
    const notifStorageKey = user?.uid ? `notifPrefs_${user.uid}` : null;
    const [notifPrefs, setNotifPrefsRaw] = useState(() => {
        if (!user?.uid) return { mealNotif: true, noticeNotif: true };
        try {
            const stored = localStorage.getItem(`notifPrefs_${user.uid}`);
            return stored ? JSON.parse(stored) : { mealNotif: true, noticeNotif: true };
        } catch { return { mealNotif: true, noticeNotif: true }; }
    });

    const setNotifPrefs = (updates) => {
        const next = { ...notifPrefs, ...updates };
        setNotifPrefsRaw(next);
        if (notifStorageKey) localStorage.setItem(notifStorageKey, JSON.stringify(next));
    };

    const [systemNotifPermission, setSystemNotifPermission] = useState(() => getNotifPermission());

    const [submittingMeal, setSubmittingMeal] = useState(null);
    const [submittingAll, setSubmittingAll] = useState(false);
    const [ratingComments, setRatingComments] = useState({});
    const [editRegId, setEditRegId] = useState(
        userData?.registrationId || ''
    );
    const [regIdError, setRegIdError] = useState('');
    const [showTour, setShowTour] = useState(false);
    const [tourStep, setTourStep] = useState(0);

    // ── In-app notification bell ──────────────────────────────────────────
    const [inAppNotifs, setInAppNotifs] = useState(() => {
        try {
            const key = `messmeal_notifs_${user?.uid || 'guest'}`;
            const stored = localStorage.getItem(key);
            if (!stored) return [];
            const all = JSON.parse(stored);
            const now = Date.now();
            return all.filter(n => now - n.timestamp < 24 * 60 * 60 * 1000);
        } catch { return []; }
    });
    const [showNotifPanel, setShowNotifPanel] = useState(false);

    const isFaculty = userData?.role === 'faculty';
    const theme = isFaculty ? 'purple' : settings?.theme || 'blue';

    const saveNotifs = (notifs) => {
        try {
            const key = `messmeal_notifs_${user?.uid || 'guest'}`;
            const now = Date.now();
            const fresh = notifs.filter(n => now - n.timestamp < 24 * 60 * 60 * 1000);
            localStorage.setItem(key, JSON.stringify(fresh));
            setInAppNotifs(fresh);
        } catch {}
    };

    const addNotif = (type, title, message, customId) => {
        const id = customId || `${type}_${Date.now()}`;
        const notif = { id, type, title, message, timestamp: Date.now(), read: false };
        setInAppNotifs(prev => {
            const updated = [notif, ...prev];
            try {
                const key = `messmeal_notifs_${user?.uid || 'guest'}`;
                const now = Date.now();
                const fresh = updated.filter(n => now - n.timestamp < 24 * 60 * 60 * 1000);
                localStorage.setItem(key, JSON.stringify(fresh));
                return fresh;
            } catch { return updated; }
        });
    };

    const activeTimings = useMemo(() => {
        // Base timings: Default -> Config Permanent
        const base = { ...DEFAULT_MEAL_TIMINGS, ...(config?.mealTimings || {}) };

        // Apply overrides for selectedDate
        const overrides = config?.timingOverrides || [];
        const activeOverrides = overrides.filter(o =>
            selectedDate >= o.startDate && selectedDate <= o.endDate
        );

        const result = { ...base };
        activeOverrides.forEach(o => {
            if (result[o.mealType]) {
                result[o.mealType] = { ...result[o.mealType], start: o.start, end: o.end, isOverride: true };
            }
        });

        return result;
    }, [config, selectedDate]);

    const profileCompletion = useMemo(() => {
        if (!userData) return { percent: 0, missing: [] };
        const fields = [
            {
                key: 'name',
                label: 'Full Name',
                done: !!userData.name?.trim()
            },
            {
                key: 'hostel',
                label: 'Hostel',
                done: !!userData.hostel
            },
            {
                key: 'messType',
                label: 'Mess Type',
                done: !!userData.messType
            },
            {
                key: 'registrationId',
                label: userData.role === 'faculty'
                    ? 'Employee ID'
                    : 'Registration Number',
                done: !!userData.registrationId?.trim()
            },
            {
                key: 'avatar',
                label: 'Avatar',
                done: !!userData.avatar
            }
        ];
        const done = fields.filter(f => f.done).length;
        const percent = Math.round(
            (done / fields.length) * 100
        );
        const missing = fields
            .filter(f => !f.done)
            .map(f => f.label);
        return { percent, missing };
    }, [userData]);

    useEffect(() => {
        if (!user?.uid) return;
        const key = `messmeal_tour_${user.uid}`;
        const seen = localStorage.getItem(key);
        if (!seen) setShowTour(true);
    }, [user?.uid]);

    const dismissTour = () => {
        localStorage.setItem(
            `messmeal_tour_${user.uid}`, '1'
        );
        setShowTour(false);
        setTourStep(0);
    };

    const dismissNotice = (noticeId) => {
        const key = `dismissed_notices_${user?.uid || 'guest'}`;
        const updated = [...dismissedNotices, noticeId];
        setDismissedNotices(updated);
        localStorage.setItem(key, JSON.stringify(updated));
    };

    useEffect(() => {
        const h = (userData?.hostel || '').trim().toUpperCase();
        const m = (userData?.messType || '').trim().toUpperCase();
        if (!h || !m || !selectedDate) return;

        setIsLoadingMenu(true);
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const dayNumber = dateObj.getDate();

        const docId = `${h}_${m}_${year}_${month}`;
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'menus', docId);

        // Mess Closure check
        const closureRef = doc(db, 'artifacts', appId, 'public', 'data', 'mess_closures', `${h}_${m}_${selectedDate}`);

        let menuData = null;
        let closureData = null;

        const syncMenu = () => {
            if (closureData && closureData.isClosed) {
                setMenu('CLOSED');
                setIsLoadingMenu(false);
                return;
            }

            if (menuData) {
                const dayMenu = menuData.days?.find(d => d.dates?.includes(dayNumber));
                if (dayMenu) {
                    setMenu({
                        breakfast: Array.isArray(dayMenu.breakfast) ? dayMenu.breakfast.join('\n') : dayMenu.breakfast || '',
                        breakfast_notes: dayMenu.breakfast_notes || '',
                        lunch: Array.isArray(dayMenu.lunch) ? dayMenu.lunch.join('\n') : dayMenu.lunch || '',
                        lunch_notes: dayMenu.lunch_notes || '',
                        snacks: Array.isArray(dayMenu.snacks) ? dayMenu.snacks.join('\n') : dayMenu.snacks || '',
                        snacks_notes: dayMenu.snacks_notes || '',
                        dinner: Array.isArray(dayMenu.dinner) ? dayMenu.dinner.join('\n') : dayMenu.dinner || '',
                        dinner_notes: dayMenu.dinner_notes || '',
                        reason: ''
                    });
                } else {
                    setMenu(null);
                }
            } else {
                setMenu(null);
            }
            setIsLoadingMenu(false);
        };

        const cacheKey = `${userData.hostel}_${userData.messType}_${year}_${month}`;
        const cached = getMenuFromCache(cacheKey);
        if (cached) {
            menuData = cached;
            syncMenu();
        }

        const unsubMenu = onSnapshot(docRef, (snap) => {
            menuData = snap.exists() ? snap.data() : null;
            if (menuData) {
                setMenuToCache(cacheKey, menuData);
            }
            syncMenu();
            // In-app notification: menu updated for today
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (selectedDate === todayStr && menuData) {
                const menuNotifKey = `menu_updated_${todayStr}_${userData?.hostel}_${userData?.messType}`;
                setInAppNotifs(prev => {
                    if (prev.some(n => n.id === menuNotifKey)) return prev;
                    const notif = {
                        id: menuNotifKey,
                        type: 'menu',
                        title: 'Menu Updated',
                        message: `Today's menu for ${userData?.hostel} is now available.`,
                        timestamp: Date.now(),
                        read: false
                    };
                    const updated = [notif, ...prev];
                    try {
                        const key = `messmeal_notifs_${user?.uid || 'guest'}`;
                        const now = Date.now();
                        const fresh = updated.filter(n => now - n.timestamp < 24 * 60 * 60 * 1000);
                        localStorage.setItem(key, JSON.stringify(fresh));
                        return fresh;
                    } catch { return updated; }
                });
            }
        });

        const unsubClosure = onSnapshot(closureRef, (snap) => {
            closureData = snap.exists() ? snap.data() : null;
            syncMenu();
        });

        return () => {
            unsubMenu();
            unsubClosure();
        };
    }, [selectedDate, userData?.hostel, userData?.messType]);

    // Fetch ratings - Move outside tab guard
    useEffect(() => {
        if (!user?.uid) return;
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'ratings'),
            where('studentId', '==', user.uid),
            where('date', '==', selectedDate)
        );
        const unsub = onSnapshot(q, (snap) => {
            const userRatings = {};
            snap.docs.forEach(doc => {
                const data = doc.data();
                userRatings[data.mealType] = { id: doc.id, ...data };
            });
            setSubmittedRatings(userRatings);
        }, (err) => {
            console.error("Ratings fetch error:", err);
        });
        return () => unsub();
    }, [user?.uid, selectedDate]);

    // Fetch notices
    useEffect(() => {
        if (!userData?.hostel) return;
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'notices'), orderBy('createdAt', 'desc'), limit(20));
        setIsLoadingNotices(true);
        const unsub = onSnapshot(q, (snap) => {
            const allNotices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const h = (userData?.hostel || "").trim().toUpperCase();
            const m = (userData?.messType || "").trim().toUpperCase();
            const today = new Date().toLocaleDateString('en-CA');
            const relevant = allNotices.filter(n => {
                // Expiry Check
                if (n.expiresAt && n.expiresAt < today) return false;

                const targetHostels = Array.isArray(n.targetHostels) ? n.targetHostels.map(x => String(x).trim().toUpperCase()) : (n.hostel ? [String(n.hostel).trim().toUpperCase()] : ['ALL']);
                const targetMessTypes = Array.isArray(n.targetMessTypes) ? n.targetMessTypes.map(x => String(x).trim().toUpperCase()) : (n.messType ? [String(n.messType).trim().toUpperCase()] : ['ALL']);
                return (targetHostels.includes('ALL') || targetHostels.includes(h)) &&
                    (targetMessTypes.includes('ALL') || targetMessTypes.includes(m));
            });
            setNotices(relevant);
            // Fire notice notifications for relevant new notices — skip first load to avoid flooding
            if (!isFirstNoticeLoad.current) {
                relevant.forEach(notice => maybeNotifyNotice(notice, notifPrefs));
            }
            isFirstNoticeLoad.current = false;
            // In-app notifications for new notices
            setInAppNotifs(prev => {
                const existingIds = prev.map(n => n.id);
                const toAdd = relevant
                    .filter(notice => !existingIds.includes(`notice_${notice.id}`))
                    .map(notice => ({
                        id: `notice_${notice.id}`,
                        type: 'notice',
                        title: notice.title,
                        message: notice.message,
                        timestamp: Date.now(),
                        read: false
                    }));
                if (toAdd.length === 0) return prev;
                const updated = [...toAdd, ...prev];
                try {
                    const key = `messmeal_notifs_${user?.uid || 'guest'}`;
                    const now = Date.now();
                    const fresh = updated.filter(n => now - n.timestamp < 24 * 60 * 60 * 1000);
                    localStorage.setItem(key, JSON.stringify(fresh));
                    return fresh;
                } catch { return updated; }
            });
            setIsLoadingNotices(false);
        }, (err) => {
            console.error("Notices fetch error:", err);
            toast.error("Failed to sync notices");
            setIsLoadingNotices(false);
        });

        return () => unsub();
    }, [userData?.hostel, userData?.messType]);


    // Fetch user-specific complaints/proofs
    useEffect(() => {
        if (!user?.uid || activeTab !== 'complaints') return;
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'proofs'),
            where('studentId', '==', user.uid),
            limit(15)
        );
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => b.createdAt - a.createdAt);
            setUserActivity(data);
        }, (err) => console.error("Activity fetch error:", err));
        return () => unsub();
    }, [user?.uid, activeTab]);

    // ── Schedule meal-time notifications whenever menu or timings change ──
    useEffect(() => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        if (selectedDate !== todayStr) return; // Only schedule for today
        if (!menu) return;
        scheduleMealNotifications({ activeTimings, menu, notifPrefs });
        return () => clearMealNotifTimers();
    }, [menu, activeTimings, notifPrefs, selectedDate]);

    // 6 PM Notification Reminder for Committee
    useEffect(() => {
        if (!userData?.committeeRole || systemNotifPermission !== 'granted') return;
        const checkTime = () => {
            const now = new Date();
            if (now.getHours() === 18 && now.getMinutes() === 0) {
                new Notification('Committee Reminder 📋', {
                    body: 'Time to complete your daily mess checklist!',
                    icon: '/pwa.png'
                });
            }
        };
        const interval = setInterval(checkTime, 60000);
        return () => clearInterval(interval);
    }, [userData?.committeeRole, systemNotifPermission]);

    // ── Request notification permission once after login (if never asked) ──
    useEffect(() => {
        if (!user) return;
        const alreadyAsked = localStorage.getItem(`notifAsked_${user.uid}`);
        if (!alreadyAsked && getNotifPermission() === 'default') {
            // Delay to not block the page load
            const t = setTimeout(async () => {
                const result = await requestNotifPermission();
                setSystemNotifPermission(result);
                localStorage.setItem(`notifAsked_${user.uid}`, '1');
            }, 3000);
            return () => clearTimeout(t);
        }
    }, [user]);

    // Sync registration ID when userData changes
    useEffect(() => {
        if (userData?.registrationId) {
            setEditRegId(userData.registrationId);
        }
    }, [userData?.registrationId]);

    // ── Midnight ratings lock: lock previous day ratings at new day (00:00) ──
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                // Reset local star selections (not submitted ones — those are in Firestore)
                setRatings({});
                // Move to today's date in case user is still on yesterday's page
                setSelectedDate(now.toLocaleDateString('en-CA'));
            }
        };
        const interval = setInterval(tick, 60000); // check every minute
        return () => clearInterval(interval);
    }, []);

    // ── Close notification panel on outside click ──
    useEffect(() => {
        if (!showNotifPanel) return;
        const handler = (e) => {
            if (!e.target.closest('[data-notif-panel]')) {
                setShowNotifPanel(false);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [showNotifPanel]);

    const saveRegId = async () => {
        const val = editRegId.trim().toUpperCase();
        if (userData?.role !== 'faculty') {
            const regPattern = /^\d{2}[A-Z]{3}\d{4,5}$/;
            if (!val) {
                setRegIdError(
                    'Registration number is required.'
                );
                return;
            }
            if (!regPattern.test(val)) {
                setRegIdError(
                    'Invalid format. Use format like 23BCEXXXXX'
                );
                return;
            }
        } else {
            if (!val) {
                setRegIdError('Employee ID is required.');
                return;
            }
        }
        try {
            await updateDoc(
                doc(db, 'artifacts', appId,
                    'users', user.uid),
                { registrationId: val }
            );
            toast.success('Registration ID saved!');
            setRegIdError('');
        } catch {
            toast.error('Failed to save. Please try again.');
        }
    };

    const submitMealRating = async (meal) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        if (isPending) {
            isSubmittingRef.current = false;
            return toast.error("Please wait for account approval to submit ratings.");
        }
        if (!ratings[meal]) {
            isSubmittingRef.current = false;
            return;
        }

        const todayStr = new Date().toLocaleDateString('en-CA');
        if (selectedDate !== todayStr) {
            isSubmittingRef.current = false;
            toast.error("You can only submit ratings for today");
            return;
        }

        setSubmittingAll(true);
        try {
            const existingQuery = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'ratings'),
                where('studentId', '==', user.uid),
                where('date', '==', selectedDate),
                where('mealType', '==', meal)
            );
            const existingSnap = await getDocs(existingQuery);
            if (!existingSnap.empty) {
                toast.error(`You have already rated ${meal} for today.`);
                setSubmittingAll(false);
                return;
            }

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'ratings'), {
                studentId: user.uid,
                registrationId: userData?.registrationId || '',
                studentName: userData.name,
                hostel: userData.hostel,
                studyingYear: userData?.studyingYear || '',
                messType: userData.messType,
                date: selectedDate,
                mealType: meal,
                rating: ratings[meal],
                comment: ratingComments[meal] || '',
                createdAt: serverTimestamp()
            });

            setRatings(prev => {
                const updated = { ...prev };
                delete updated[meal];
                return updated;
            });
            setRatingComments(prev => {
                const updated = { ...prev };
                delete updated[meal];
                return updated;
            });
            setSuccessModal({
                isOpen: true,
                title: "Rating Submitted! ✓",
                message: `Your ${meal} rating has been recorded. Thank you!`
            });
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("Failed to submit rating.");
        } finally {
            setSubmittingAll(false);
            isSubmittingRef.current = false;
        }
    };

    // Remove submitAllRatings completely as requested


    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (proofFiles.length + files.length > 5) {
            return toast.error("Maximum 5 files allowed");
        }

        const newFiles = [];
        for (const file of files) {
            try {
                if (file.type.startsWith('image/')) {
                    const compressed = await compressImage(file);
                    newFiles.push(compressed);
                } else if (file.name.endsWith('.zip') || file.type === 'application/zip') {
                    if (file.size > 2 * 1024 * 1024) {
                        toast.error(`${file.name} is too large (>2MB)`);
                        continue;
                    }
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(file);
                    });
                    newFiles.push(base64);
                } else {
                    toast.error(`Unsupported file type: ${file.name}`);
                }
            } catch (err) {
                console.error("Upload error:", err);
                toast.error(`Error processing ${file.name}`);
            }
        }
        setProofFiles(prev => [...prev, ...newFiles]);
    };

    const removeProofFile = (index) => {
        setProofFiles(prev => prev.filter((_, i) => i !== index));
    };

    const submitComplaint = async () => {
        if (isPending) return toast.error("Please wait for account approval to submit reports.");
        if (!complaintText.trim() && proofFiles.length === 0) return toast.error("Please provide details or upload an image");
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'proofs'), {
                studentId: user.uid,
                registrationId: userData?.registrationId || '',
                studentName: userData.name,
                hostel: userData.hostel?.trim().toUpperCase() || '',
                messType: userData.messType?.trim().toUpperCase() || '',
                studyingYear: userData?.studyingYear || '',
                date: complaintDate,
                session: complaintSession,
                description: complaintText,
                images: proofFiles, // Store as an array now
                status: 'Pending',
                createdAt: serverTimestamp()
            });
            setComplaintText('');
            setProofFiles([]);
            setSuccessModal({
                isOpen: true,
                title: "Complaint Submitted! ✓",
                message: "Your complaint has been received. Admin will review it shortly."
            });
        } catch {
            toast.error("Failed to submit complaint");
        }
        setSubmitting(false);
    };

    const handleNutritionAnalysis = async (meal, menuText) => {
        setAiLoading(meal);
        try {
            if (!config?.geminiApiKey) {
                setNutritionTips(prev => ({
                    ...prev,
                    [meal]: 'Nutrition analysis not configured. Admin must add a Gemini API key in Settings.'
                }));
                setAiLoading(null);
                return;
            }

            const geminiPrompt = `You are a nutrition expert familiar with Indian college mess food.
Analyze this meal: "${menuText}"

Give a response in exactly this format:
Est. [X] kcal | P: [X]g, C: [X]g, F: [X]g
💡 [One friendly health tip about this meal in 1 sentence]

Base estimates on typical Indian college serving sizes.
Keep the health tip short, practical and encouraging.`;

            const result = await callGemini(geminiPrompt, config.geminiApiKey);
            setNutritionTips(prev => ({ ...prev, [meal]: result }));
        } catch (e) {
            setNutritionTips(prev => ({
                ...prev,
                [meal]: 'Nutrition service temporarily unavailable.'
            }));
        }
        setAiLoading(null);
    };

    const updateProfile = async (updates) => {
        try {
            setShowBouncingLogo(true);
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
            toast.success("Profile updated!");
        } catch (e) {
            console.error("User profile update failed:", e);
            toast.error("Failed to update profile. Please try again.");
        }
    };

    const handleBouncingLogoComplete = () => {
        setShowBouncingLogo(false);
        setShowProfileEdit(false);
    };

    const isRatingAllowed = (meal) => {
        const timing = activeTimings[meal];
        if (!timing) return false;
        const todayStr =
            new Date().toLocaleDateString('en-CA');
        if (selectedDate > todayStr) return false;
        if (selectedDate < todayStr) return false;
        if (selectedDate === todayStr) {
            const now = new Date();
            const currentMinutes =
                now.getHours() * 60 + now.getMinutes();
            const startMinutes =
                getTimeMinutes(timing.start);
            return currentMinutes >= startMinutes;
        }
        return false;
    };

    if (showBouncingLogo) {
        return <BouncingLogoScreen onComplete={handleBouncingLogoComplete} />;
    }

    if (showProfileEdit) {
        return <ProfileSetupScreen
            user={user}
            userData={userData}
            onComplete={(data) => {
                if (isPending) {
                    toast.error("Profile updates are disabled while pending approval.");
                    return;
                }
                updateProfile(data);
            }}
            theme={theme}
            config={config}
            isReadOnly={isPending}
        />;
    }

    return (
        <div className="min-h-screen w-full bg-page text-dark dark:text-white relative overflow-hidden selection:bg-primary/20">

            <OfflineIndicator />

            {/* ── HEADER ─────────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-white dark:bg-[#0D0D0D] border-b border-[#E4E4E4] dark:border-[#2A2A2A] px-4 py-3 shadow-card">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <motion.img
                            layoutId="logo"
                            src="/pwa.png"
                            alt="Logo"
                            className="w-9 h-9 rounded-xl object-contain"
                            onError={(e) => { e.target.src = '/pwa-512x512.png'; }}
                        />
                        <div>
                            <h1 className="text-xl tracking-tight text-[#0D0D0D] dark:text-white leading-none">
                                <span className="font-brand-mess font-bold text-[#0057FF] dark:text-white">Mess</span>
                                <span className="font-brand-meal text-[#0057FF] dark:text-[#D4F000]">Meal</span>
                            </h1>
                            <p className="inline-block text-[7px] font-black uppercase tracking-[0.15em] text-[#0057FF] bg-[#0057FF]/10 px-1.5 py-0.4 rounded -mt-0.5 opacity-100 leading-none">eat on time be on time</p>
                            <p className="text-[10px] text-[#6B6B6B] dark:text-[#A0A0A0] font-medium">{userData?.hostel} · {userData?.messType}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canSwitchToAdmin && (
                            <button
                                onClick={onSwitchToAdmin}
                                className="bg-[#F0F0F0] hover:bg-[#E4E4E4] dark:bg-[#2A2A2A] dark:hover:bg-[#333] border border-[#E4E4E4] dark:border-[#2A2A2A] px-3 py-1.5 rounded-xl dark:rounded-pill flex items-center gap-1.5 text-xs font-bold transition-all text-[#0D0D0D] dark:text-white"
                            >
                                <Shield size={14} className="text-[#0057FF] dark:text-[#D4F000]" /> <span className="hidden sm:inline">Admin</span>
                            </button>
                        )}
                        <div className="relative" data-notif-panel>
                            <button
                                onClick={() => setShowNotifPanel(p => !p)}
                                className="bg-[#F0F0F0] hover:bg-[#E4E4E4] dark:bg-[#2A2A2A] dark:hover:bg-[#333] border border-[#E4E4E4] dark:border-[#2A2A2A] p-2 rounded-xl dark:rounded-pill transition-all text-[#6B6B6B] dark:text-[#A0A0A0] relative"
                                title="Notifications"
                            >
                                <Bell size={16} />
                                {inAppNotifs.some(n => !n.read) && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-[#0D0D0D]" />
                                )}
                            </button>

                            {showNotifPanel && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#1A1A2E] rounded-2xl shadow-2xl border border-zinc-200 dark:border-white/10 z-50 overflow-hidden">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5">
                                        <h3 className="font-heading font-black text-sm text-dark dark:text-white">Notifications</h3>
                                        <div className="flex items-center gap-2">
                                            {inAppNotifs.length > 0 && (
                                                <button
                                                    onClick={() => { saveNotifs([]); setShowNotifPanel(false); }}
                                                    className="text-[10px] font-black text-zinc-400 hover:text-error uppercase tracking-widest"
                                                >
                                                    Clear all
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setShowNotifPanel(false)}
                                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Notification list */}
                                    <div className="max-h-80 overflow-y-auto">
                                        {inAppNotifs.length === 0 ? (
                                            <div className="py-8 text-center">
                                                <Bell size={24} className="mx-auto text-zinc-300 mb-2" />
                                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No notifications</p>
                                            </div>
                                        ) : (
                                            inAppNotifs.map(notif => (
                                                <div
                                                    key={notif.id}
                                                    className={`px-4 py-3 border-b border-zinc-50 dark:border-white/5 last:border-0 cursor-pointer ${!notif.read ? 'bg-blue-50/50 dark:bg-white/5' : ''}`}
                                                    onClick={() => {
                                                        const updated = inAppNotifs.map(n =>
                                                            n.id === notif.id ? { ...n, read: true } : n
                                                        );
                                                        saveNotifs(updated);
                                                    }}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${notif.type === 'notice' ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-blue-100 dark:bg-blue-500/10'}`}>
                                                            {notif.type === 'notice'
                                                                ? <Megaphone size={12} className="text-amber-500" />
                                                                : <Utensils size={12} className="text-primary" />
                                                            }
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-black text-dark dark:text-white mb-0.5">{notif.title}</p>
                                                            <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{notif.message}</p>
                                                            <p className="text-[10px] text-zinc-400 font-bold mt-1">
                                                                {(() => {
                                                                    const diff = Date.now() - notif.timestamp;
                                                                    const mins = Math.floor(diff / 60000);
                                                                    const hrs = Math.floor(mins / 60);
                                                                    if (hrs > 0) return `${hrs}h ago`;
                                                                    if (mins > 0) return `${mins}m ago`;
                                                                    return 'Just now';
                                                                })()}
                                                            </p>
                                                        </div>
                                                        {!notif.read && (
                                                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                // soft refresh: re-trigger menu and notices without full page reload
                                setSelectedDate(new Date().toLocaleDateString('en-CA'));
                                toast.success("Data refreshed");
                            }}
                            className="bg-[#F0F0F0] hover:bg-[#E4E4E4] dark:bg-[#2A2A2A] dark:hover:bg-[#333] border border-[#E4E4E4] dark:border-[#2A2A2A] p-2 rounded-xl dark:rounded-pill transition-all text-[#6B6B6B] dark:text-[#A0A0A0]"
                            title="Refresh data"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button
                            onClick={onLogout}
                            className="bg-[#F0F0F0] hover:bg-[#E4E4E4] dark:bg-[#2A2A2A] dark:hover:bg-[#333] border border-[#E4E4E4] dark:border-[#2A2A2A] p-2 rounded-xl dark:rounded-pill transition-all text-[#6B6B6B] dark:text-[#A0A0A0] hover:text-error dark:hover:text-error"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 pb-32">
                {showChecklist ? (
                    <div className="animate-fade-in">
                        <button
                            onClick={() => setShowChecklist(false)}
                            className="mb-8 flex items-center gap-2 text-primary
                                font-bold hover:underline"
                        >
                            ← Back to Dashboard
                        </button>
                        <CommitteeChecklist user={user} userData={userData} />
                    </div>
                ) : (
                    <>
                        {isPending && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 mt-4 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 flex items-center gap-5 shadow-sm"
                    >
                        <div className="p-3 bg-amber-500 rounded-2xl text-white">
                            <Clock4 size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest mb-1">Account Pending Approval</h3>
                            <p className="text-xs font-medium text-amber-500/70 leading-relaxed">
                                You can view menus and notices now. Interactive features like ratings and reports will be enabled once an administrator approves your account.
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* Faculty Admin Request Banner */}
                {userData?.role === 'faculty' && userData?.adminApproved !== true && userData?.adminRequested !== true && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-4 mt-2 bg-blue-500/10 border border-blue-500/20 rounded-[2rem] p-5 flex items-center gap-5 shadow-sm"
                    >
                        <div className="p-3 bg-blue-500 rounded-2xl text-white flex-shrink-0">
                            <Shield size={22} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Want admin access?</p>
                            <p className="text-xs text-blue-500/70 dark:text-blue-400/70">Request admin access and wait for approval from the super admin.</p>
                        </div>
                        <button
                            onClick={async () => {
                                try {
                                    const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
                                    await updateDoc(userRef, { adminRequested: true });
                                    toast.success('Request sent! Wait for super admin approval.');
                                } catch (e) {
                                    toast.error('Failed to send request.');
                                }
                            }}
                            className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all uppercase tracking-wider"
                        >
                            Request Admin Access
                        </button>
                    </motion.div>
                )}

                {userData?.role === 'faculty' && userData?.adminRequested === true && userData?.adminApproved !== true && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-4 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm"
                    >
                        <div className="p-3 bg-amber-500 rounded-2xl text-white flex-shrink-0">
                            <Clock4 size={20} />
                        </div>
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                            ⏳ Admin access request pending approval...
                        </p>
                    </motion.div>
                )}

                {userData && !userData.registrationId && (
                    <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                Please add your{' '}
                                {userData.role === 'faculty' ? 'Employee ID' : 'Registration Number'}{' '}
                                to complete your profile.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowProfileEdit(true)}
                            className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/20 px-3 py-1.5 rounded-xl hover:bg-amber-500/30 transition-colors flex-shrink-0"
                        >
                            Add Now
                        </button>
                    </div>
                )}

                {activeTab === 'menu' && (
                    <div className="space-y-8">
                        {/* Notice Board */}
                        {notices.filter(n =>
                            !dismissedNotices.includes(n.id)
                        ).length > 0 && (
                            <div className="space-y-2 mb-4">
                                {notices
                                    .filter(n =>
                                        !dismissedNotices.includes(n.id)
                                    )
                                    .map(notice => (
                                    <div key={notice.id}
                                        className="bg-warning/5
                                        border-l-4 border-warning
                                        rounded-2xl p-4 relative
                                        overflow-hidden shadow-sm">
                                        <div className="flex
                                            items-start gap-3 pr-8">
                                            <div className="bg-warning/20
                                                p-2 rounded-xl
                                                flex-shrink-0">
                                                <Megaphone
                                                    className="text-warning"
                                                    size={16} />
                                            </div>
                                            <div className="flex-1
                                                min-w-0">
                                                <h4 className="font-heading
                                                    font-black text-dark
                                                    dark:text-white text-sm
                                                    tracking-tight mb-1">
                                                    {notice.title}
                                                </h4>
                                                <p className="text-xs
                                                    text-zinc-600
                                                    dark:text-zinc-300
                                                    leading-relaxed">
                                                    {notice.message}
                                                </p>
                                                {notice.expiresAt && (
                                                    <p className="text-[10px]
                                                        font-bold
                                                        text-amber-500
                                                        mt-1 uppercase
                                                        tracking-widest">
                                                        Expires:{' '}
                                                        {new Date(
                                                            notice.expiresAt
                                                            + 'T00:00:00'
                                                        ).toLocaleDateString(
                                                            [], {
                                                            day: 'numeric',
                                                            month: 'short'
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() =>
                                                dismissNotice(notice.id)}
                                            className="absolute top-3
                                                right-3 p-1.5 rounded-lg
                                                text-zinc-400
                                                hover:text-zinc-600
                                                dark:hover:text-white
                                                hover:bg-black/5
                                                dark:hover:bg-white/10
                                                transition-colors"
                                            title="Dismiss"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end mb-4">
                            <div className="bg-[#F0F0F0] dark:bg-[#1A1A1A] border border-[#E4E4E4] dark:border-[#2A2A2A] p-1 rounded-pill inline-flex shadow-sm">
                                <button
                                    onClick={() => setViewType('daily')}
                                    className={`px-5 py-2 rounded-pill text-xs font-black uppercase tracking-widest transition-all duration-300 ${viewType === 'daily'
                                        ? 'bg-[#0057FF] text-white dark:bg-[#D4F000] dark:text-[#0D0D0D] shadow-md scale-105'
                                        : 'text-[#6B6B6B] dark:text-[#A0A0A0] hover:text-[#0D0D0D] dark:hover:text-white'
                                        }`}
                                >
                                    Daily Menu
                                </button>
                                <button
                                    onClick={() => setViewType('limits')}
                                    className={`px-5 py-2 rounded-pill text-xs font-black uppercase tracking-widest transition-all duration-300 ${viewType === 'limits'
                                        ? 'bg-[#0057FF] text-white dark:bg-[#D4F000] dark:text-[#0D0D0D] shadow-md scale-105'
                                        : 'text-[#6B6B6B] dark:text-[#A0A0A0] hover:text-[#0D0D0D] dark:hover:text-white'
                                        }`}
                                >
                                    Food Limits
                                </button>
                            </div>
                        </div>

                        {viewType === 'daily' ? (
                            <>
                                <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} theme={theme} />
                                <MenuGrid
                                    menu={menu}
                                    isLoading={isLoadingMenu}
                                    activeTimings={activeTimings}
                                    selectedDateStr={selectedDate}
                                    nutritionTips={nutritionTips}
                                    onAnalyze={handleNutritionAnalysis}
                                    aiLoading={aiLoading}
                                    theme={theme}
                                />
                            </>
                        ) : (
                            <FoodLimitsView 
                                foodLimits={config?.foodLimits} 
                                theme={theme} 
                            />
                        )}
                    </div>
                )}

                {activeTab === 'feedback' && (
                    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in mt-4 pb-24">
                        <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} theme={theme} />
                        <Card>
                            <h3 className="text-xl font-heading font-semibold text-dark dark:text-white mb-6 tracking-tight flex items-center justify-between">
                                <span className="flex items-center gap-3">
                                    <Star className="text-primary fill-primary" size={24} />
                                    Rate {selectedDate === new Date().toLocaleDateString('en-CA') ? "Today's" : format(new Date(selectedDate), 'MMM d')} Meals
                                </span>
                            </h3>

                            <div className="space-y-4">
                                {MEAL_ORDER.map((meal) => {
                                    const mealSubmitted = submittedRatings[meal];
                                    const allowed = isRatingAllowed(meal);
                                    let message = "";
                                    if (!allowed) {
                                        const now = new Date();
                                        const sel = new Date(selectedDate);
                                        now.setHours(0, 0, 0, 0); sel.setHours(0, 0, 0, 0);
                                        if (sel > now) message = "Upcoming";
                                        else if (sel < now) message = "Expired";
                                        else message = "Not Started";
                                    }

                                    const currentRating = ratings[meal] || 0;
                                    const accent = MEAL_ACCENTS[meal] || MEAL_ACCENTS.Breakfast;
                                    const primaryBorder = "border-primary";
                                    const primaryBg = "bg-primary";

                                    return (
                                        <div key={meal} className={`rounded-[2rem] border-[4px] overflow-hidden transition-all duration-500 scale-[0.98] hover:scale-100 ${primaryBorder} ${mealSubmitted ? 'bg-primary/10 shadow-[0_8px_32px_rgba(var(--color-primary),0.2)]' :
                                            !allowed ? 'bg-zinc-100 dark:bg-[#1A1A1A] opacity-60' :
                                                'bg-white dark:bg-[#0D0D0D] shadow-md'
                                            }`}>
                                            {/* Header */}
                                            <div className={`px-5 py-4 flex items-center justify-between ${primaryBg}`}>
                                                <h4 className="font-heading font-black text-white dark:text-[#0D0D0D] tracking-tight text-lg uppercase">{meal}</h4>
                                                <div className="flex items-center gap-2">
                                                    {/* Timing status badge */}
                                                    {(() => {
                                                        const timing = activeTimings[meal];
                                                        if (!timing) return null;
                                                        const todayStr =
                                                            new Date().toLocaleDateString('en-CA');
                                                        if (selectedDate !== todayStr) return null;
                                                        const now = new Date();
                                                        const currentMinutes =
                                                            now.getHours() * 60 + now.getMinutes();
                                                        const startMinutes = getTimeMinutes(timing.start);

                                                        if (currentMinutes < startMinutes) {
                                                            return (
                                                                <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
                                                                    OPENS {timing.start}
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="bg-white/30 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                                                                ONGOING
                                                            </span>
                                                        );
                                                    })()}
                                                    {mealSubmitted && (
                                                        <span className="bg-white/20 text-white dark:text-black text-[10px] font-black px-3 py-1.5 rounded-full uppercase">
                                                            SUBMITTED
                                                        </span>
                                                    )}
                                                    {!allowed && !mealSubmitted && (
                                                        <span className="bg-black/10 text-white/70 text-[10px] font-black px-3 py-1.5 rounded-full uppercase mr-1">
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${accent.labelCls}`}>
                                                        Session Rating
                                                    </span>
                                                </div>
                                                {mealSubmitted && <span className="text-[10px] text-primary font-black px-3 py-1.5 rounded-xl bg-primary/20 flex items-center gap-1.5 uppercase tracking-widest"><CheckCircle2 size={12} /> Rated {mealSubmitted.rating}/5</span>}
                                            </div>

                                            {!mealSubmitted && allowed && (
                                                <div className="flex flex-col gap-4 px-6 pb-6">
                                                    <div className="flex gap-2 justify-center">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                onClick={() => setRatings(prev => ({ ...prev, [meal]: star }))}
                                                                className={`transition-transform hover:scale-110 focus:outline-none ${star <= currentRating ? 'scale-110 drop-shadow-sm' : ''}`}
                                                            >
                                                                <Star
                                                                    size={32}
                                                                    className={`${star <= currentRating ? 'text-primary fill-primary' : 'text-zinc-600/30'} transition-transform duration-300`}
                                                                />
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {currentRating > 0 && (
                                                        <>
                                                            <textarea
                                                                value={ratingComments[meal] || ''}
                                                                onChange={(e) => setRatingComments(prev => ({ ...prev, [meal]: e.target.value }))}
                                                                placeholder="Add a comment... (optional)"
                                                                className="w-full mt-3 p-3 text-sm bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl resize-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                                                rows={2}
                                                            />
                                                            <Button
                                                                onClick={() => submitMealRating(meal)}
                                                                className="w-full mt-3 py-3 text-xs font-black uppercase tracking-widest"
                                                                disabled={submittingAll}
                                                                loading={submittingAll}
                                                            >
                                                                Submit {meal} Rating
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5 text-center">
                                <p className="text-sm font-bold text-zinc-400 flex items-center justify-center gap-2">
                                    <LockIcon size={14} /> Ratings are locked — you can only rate today's meals
                                </p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'complaints' && (
                    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in mt-4 pb-24">
                        <Card>
                            <h3 className="text-xl font-heading font-semibold text-dark dark:text-white mb-6 tracking-tight flex items-center gap-3">
                                <Camera className="text-primary" size={24} /> Add Food Proof
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Session</label>
                                    <select
                                        value={complaintSession}
                                        onChange={(e) => setComplaintSession(e.target.value)}
                                        className="w-full border border-black/10 dark:border-white/10 rounded-xl p-3 bg-page focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark dark:text-white font-medium appearance-none"
                                    >
                                        {MEAL_ORDER.map(m => <option key={m} value={m} className="bg-zinc-900">{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        value={complaintDate}
                                        onChange={(e) => setComplaintDate(e.target.value)}
                                        max={new Date().toLocaleDateString('en-CA')}
                                        className="w-full border border-black/10 dark:border-white/10 rounded-xl p-3 bg-page focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark dark:text-white font-medium"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Description</label>
                                    <textarea
                                        value={complaintText}
                                        onChange={(e) => setComplaintText(e.target.value)}
                                        placeholder="Describe the issue with the food..."
                                        rows={3}
                                        className="w-full border border-black/10 dark:border-white/10 rounded-xl p-3 bg-page focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark dark:text-white placeholder-zinc-500 resize-none font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Photo / File Proof (Max 5)</label>

                                    <div className="flex gap-3 mb-4">
                                        {/* Camera Capture */}
                                        <div className="flex-1 relative group">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handleImageUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                title="Take a photo"
                                            />
                                            <div className="bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-2xl py-6 flex flex-col items-center justify-center transition-all group-hover:scale-[1.02]">
                                                <Camera size={28} className="text-primary mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-primary">Snap Photo</span>
                                            </div>
                                        </div>

                                        {/* Gallery Picker */}
                                        <div className="flex-1 relative group">
                                            <input
                                                type="file"
                                                accept="image/*,.zip"
                                                multiple
                                                onChange={handleImageUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                title="Pick from gallery"
                                            />
                                            <div className="bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-2xl py-6 flex flex-col items-center justify-center transition-all group-hover:scale-[1.02]">
                                                <ImageIcon size={28} className="text-zinc-400 mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400">Add Files</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Previews */}
                                    {proofFiles.length > 0 && (
                                        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                                            {proofFiles.map((file, idx) => (
                                                <div key={idx} className="relative flex-shrink-0 group">
                                                    {file.startsWith('data:image/') ? (
                                                        <img src={file} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-white/10" />
                                                    ) : (
                                                        <div className="w-24 h-24 bg-zinc-900 border border-white/10 rounded-xl flex flex-col items-center justify-center p-2 text-center">
                                                            <FileText size={24} className="text-primary mb-1" />
                                                            <span className="text-[8px] font-bold text-zinc-500 truncate w-full">ZIP Archive</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => removeProofFile(idx)}
                                                        className="absolute -top-1.5 -right-1.5 bg-red-500 box-content p-1 rounded-full shadow-lg hover:scale-110 transition-transform z-20"
                                                    >
                                                        <X size={10} className="text-white font-bold" />
                                                    </button>
                                                </div>
                                            ))}
                                            {/* Slot indicators */}
                                            {Array.from({ length: 5 - proofFiles.length }).map((_, i) => (
                                                <div key={`empty-${i}`} className="w-24 h-24 rounded-xl border border-dashed border-white/5 flex items-center justify-center text-zinc-700">
                                                    <PlusCircle size={16} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    onClick={submitComplaint}
                                    disabled={submitting || (!complaintText.trim() && proofFiles.length === 0)}
                                    loading={submitting}
                                    className="w-full mt-2 py-4 text-base"
                                >
                                    Submit Complaint ({proofFiles.length})
                                </Button>
                            </div>
                        </Card>

                        {/* ── MY ACTIVITY SECTION ────────────────────── */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-lg font-heading font-bold text-dark dark:text-white tracking-tight flex items-center gap-2">
                                    <Clock4 size={20} className="text-primary" /> My Previous Activity
                                </h3>
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">
                                    {userActivity.length} Total
                                </Badge>
                            </div>

                            <div className="grid gap-4 grid-cols-1">
                                {userActivity.map((activity) => (
                                    <div key={activity.id} className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-white/5 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                                        <div className="flex flex-col md:flex-row gap-5">
                                            {/* Preview Image if exists */}
                                            {activity.images && activity.images.length > 0 && (
                                                <div className="w-full md:w-32 h-32 flex-shrink-0 relative rounded-2xl overflow-hidden border border-zinc-100 dark:border-white/10">
                                                    <img
                                                        src={activity.images[0]}
                                                        alt="Proof"
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                    />
                                                    {activity.images.length > 1 && (
                                                        <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-0.5 rounded-pill border border-white/10">
                                                            +{activity.images.length - 1} MORE
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex-grow space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{activity.session}</span>
                                                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{activity.date}</span>
                                                        </div>
                                                        <p className="text-sm font-medium text-dark dark:text-zinc-300 leading-relaxed italic">
                                                            "{activity.description || 'No description provided'}"
                                                        </p>
                                                    </div>
                                                    <div className={`px-2.5 py-1 rounded-pill text-[9px] font-black uppercase tracking-widest border ${activity.status === 'Resolved'
                                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                        }`}>
                                                        {activity.status}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5">
                                                    <span className="text-[9px] text-zinc-400 font-medium">
                                                        Raised on {activity.createdAt?.toDate ? format(activity.createdAt.toDate(), 'MMM do, p') : 'Just now'}
                                                    </span>
                                                    {activity.adminResponse && (
                                                        <div className="flex items-center gap-1.5 text-primary">
                                                            <MessageSquare size={12} />
                                                            <span className="text-[10px] font-bold">Admin Replied</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {userActivity.length === 0 && (
                                    <div className="flex flex-col items-center justify-center p-12 bg-zinc-50 dark:bg-black/20 border-2 border-dashed border-zinc-200 dark:border-white/5 rounded-3xl opacity-60">
                                        <MessageSquare size={32} className="text-zinc-400 mb-3" />
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">No previous activity found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in mt-4 pb-24">
                        {/* Profile Completion Card */}
                        <div className={`p-5 rounded-2xl border-2
                            mb-6 transition-all
                            ${profileCompletion.percent === 100
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30'
                                : 'bg-primary/5 border-primary/20'
                            }`}>
                            <div className="flex items-center gap-4">
                                {/* Circular progress */}
                                <div className="relative w-16 h-16
                                    flex-shrink-0">
                                    <svg className="w-16 h-16
                                        -rotate-90" viewBox="0 0 64 64">
                                        <circle
                                            cx="32" cy="32" r="28"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="6"
                                            className="text-zinc-200
                                                dark:text-white/10"
                                        />
                                        <circle
                                            cx="32" cy="32" r="28"
                                            fill="none"
                                            strokeWidth="6"
                                            strokeLinecap="round"
                                            stroke={
                                                profileCompletion.percent === 100
                                                ? '#10b981'
                                                : 'var(--color-primary,#0057FF)'
                                            }
                                            strokeDasharray={
                                                `${2 * Math.PI * 28}`
                                            }
                                            strokeDashoffset={
                                                `${2 * Math.PI * 28 *
                                                (1 - profileCompletion.percent / 100)}`
                                            }
                                            style={{
                                                transition:
                                                    'stroke-dashoffset 0.5s ease'
                                            }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0
                                        flex items-center justify-center">
                                        <span className={`text-sm
                                            font-black
                                            ${profileCompletion.percent === 100
                                                ? 'text-emerald-600'
                                                : 'text-primary'
                                            }`}>
                                            {profileCompletion.percent}%
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    {profileCompletion.percent === 100 ? (
                                        <>
                                            <p className="font-heading
                                                font-black text-emerald-700
                                                dark:text-emerald-400
                                                tracking-tight">
                                                Profile Complete! ✓
                                            </p>
                                            <p className="text-xs
                                                text-emerald-600/70
                                                dark:text-emerald-400/70
                                                font-medium mt-0.5">
                                                All details are filled in.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-heading
                                                font-black text-dark
                                                dark:text-white
                                                tracking-tight">
                                                Complete Your Profile
                                            </p>
                                            <p className="text-xs
                                                text-zinc-500 font-medium
                                                mt-0.5">
                                                Missing:{' '}
                                                {profileCompletion.missing.join(', ')}
                                            </p>
                                            <button
                                                onClick={() =>
                                                    setShowProfileEdit(true)}
                                                className="mt-2 text-xs
                                                    font-black text-primary
                                                    uppercase tracking-widest
                                                    hover:underline"
                                            >
                                                Complete Now →
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Card>
                            <div className="flex items-center justify-center flex-col text-center mb-8">
                                <div className="w-24 h-24 rounded-full p-1 border-2 border-primary/50 relative mb-4 shadow-sm">
                                    <div className="absolute inset-0 border-2 border-primary rounded-full animate-[spin_4s_linear_infinite] border-t-transparent border-l-transparent"></div>
                                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${settings?.avatar || userData?.avatar || 'boy'}`} alt="Avatar" className="w-full h-full object-cover rounded-full bg-black/20" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-heading font-bold text-dark dark:text-white tracking-tight">{userData?.name}</h3>
                                    <p className="text-mid font-medium my-1">{user?.email}</p>
                                    <Badge variant={userData?.role} className="mt-2">{userData?.role?.toUpperCase()}</Badge>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm">
                                    <span className="text-sm font-bold text-mid uppercase tracking-widest">Hostel</span>
                                    <span className="text-sm font-semibold text-dark dark:text-white">{userData?.hostel}</span>
                                </div>
                                {userData?.hostel &&
                                    config?.hostels &&
                                    !config.hostels.includes(userData.hostel) && (
                                    <p className="text-[11px] text-amber-500
                                        font-bold mt-1">
                                        ⚠ Your hostel ({userData.hostel}) is no
                                        longer in the system. Please update
                                        your profile.
                                    </p>
                                )}
                                <div className="flex justify-between p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm">
                                    <span className="text-sm font-bold text-mid uppercase tracking-widest">Mess Type</span>
                                    <span className="text-sm font-semibold text-dark dark:text-white">{userData?.messType}</span>
                                </div>
                                {userData?.messType &&
                                    config?.messTypes &&
                                    !config.messTypes.includes(userData.messType) && (
                                    <p className="text-[11px] text-amber-500
                                        font-bold mt-1">
                                        ⚠ Your mess type ({userData.messType})
                                        is no longer in the system. Please
                                        update your profile.
                                    </p>
                                )}
                                {userData?.role === 'student' && userData?.studyingYear && (
                                    <div className="flex justify-between p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm">
                                        <span className="text-sm font-bold text-mid uppercase tracking-widest">Studying Year</span>
                                        <span className="text-sm font-semibold text-dark dark:text-white">{userData?.studyingYear} Year</span>
                                    </div>
                                )}

                                <div className="space-y-2 pt-2">
                                    <label className="block text-[10px] font-black
                                        text-zinc-500 dark:text-zinc-400 uppercase
                                        tracking-widest ml-1">
                                        {userData?.role === 'faculty'
                                            ? 'Employee ID' : 'Registration Number'}
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={editRegId}
                                            onChange={(e) => {
                                                setEditRegId(
                                                    e.target.value.toUpperCase()
                                                );
                                                setRegIdError('');
                                            }}
                                            placeholder={userData?.role === 'faculty'
                                                ? 'e.g. EMP1234'
                                                : 'e.g. 23BCEXXXXX'}
                                            className="flex-1 p-3 bg-zinc-100
                                                dark:bg-black/40 border border-zinc-200
                                                dark:border-white/10 rounded-xl outline-none
                                                focus:border-primary focus:ring-2
                                                focus:ring-primary/20 text-zinc-900
                                                dark:text-white font-bold
                                                transition-colors"
                                        />
                                        <Button
                                            onClick={saveRegId}
                                            className="px-6 py-3 text-xs font-black
                                                uppercase tracking-widest"
                                        >
                                            Save
                                        </Button>
                                    </div>
                                    {regIdError && (
                                        <p className="text-[11px] text-red-500 font-bold ml-1">
                                            {regIdError}
                                        </p>
                                    )}
                                    {userData?.role !== 'faculty' && (
                                        <p className="text-[10px] text-zinc-400
                                            font-medium italic ml-1">
                                            Format: 23BCEXXXXX
                                            (2 digits + 3 letters + 4-5 digits)
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 mt-8 pt-6 border-t border-black/10 dark:border-white/10">
                                <h4 className="font-heading font-semibold text-dark dark:text-white mb-2 text-lg tracking-tight">App Settings</h4>

                                <button
                                    onClick={() => setIsFeedbackOpen(true)}
                                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl hover:border-primary/50 transition-colors shadow-sm"
                                >
                                    <span className="text-sm font-bold text-dark dark:text-white flex items-center gap-2"><MessageSquare size={18} className="text-primary" /> Report Bug / Feedback</span>
                                </button>

                                {userData?.committeeRole && (
                                    <button
                                        onClick={() => setShowChecklist(true)}
                                        className="w-full flex items-center justify-between p-4
                                            bg-primary/5 dark:bg-primary/10 border
                                            border-primary/20 rounded-2xl
                                            hover:bg-primary/10 transition-colors shadow-sm"
                                    >
                                        <span className="text-sm font-bold text-primary
                                            flex items-center gap-2">
                                            <ClipboardList size={18} />
                                            Mess Committee Checklist
                                        </span>
                                        <span className="text-[10px] font-black
                                            bg-primary text-white dark:text-black
                                            px-2 py-0.5 rounded-lg uppercase">
                                            Open
                                        </span>
                                    </button>
                                )}

                                {/* Profile Tagline */}
                                <div className="text-center py-2 opacity-100">
                                    <p className="text-[10px] font-bold text-black dark:text-white tracking-widest uppercase">
                                        {config?.tagline || DEFAULT_TAGLINE}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm">
                                    <span className="text-sm font-bold text-mid uppercase tracking-widest flex items-center gap-2">
                                        Appearance
                                    </span>
                                    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-black/20 p-1 rounded-pill">
                                        <button
                                            onClick={() => updateSettings?.({ darkMode: false })}
                                            className={`px-3 py-1 rounded-pill text-[10px] font-black uppercase tracking-widest transition-all ${!settings?.darkMode ? 'bg-white text-[#0D0D0D] shadow-sm' : 'text-zinc-500'}`}
                                        >
                                            Light
                                        </button>
                                        <button
                                            onClick={() => updateSettings?.({ darkMode: true })}
                                            className={`px-3 py-1 rounded-pill text-[10px] font-black uppercase tracking-widest transition-all ${settings?.darkMode ? 'bg-primary text-dark shadow-sm' : 'text-zinc-500'}`}
                                        >
                                            Dark
                                        </button>
                                    </div>
                                </div>

                                {/* Theme Selector Section */}
                                <div className="p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm space-y-3">
                                    <span className="text-sm font-bold text-mid uppercase tracking-widest block">
                                        Theme Color
                                    </span>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { id: 'blue', col: 'bg-blue-600' },
                                            { id: 'green', col: 'bg-emerald-500' },
                                            { id: 'purple', col: 'bg-purple-500' },
                                            { id: 'indigo', col: 'bg-indigo-500' },
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => updateSettings?.({ theme: t.id })}
                                                className={`h-10 rounded-xl transition-all border-2 ${settings.theme === t.id ? 'border-primary scale-110 shadow-md ring-2 ring-primary/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                            >
                                                <div className={`w-full h-full rounded-lg ${t.col}`} title={t.id} />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Avatar Selection */}
                                <div className="space-y-2 p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl flex flex-col items-center shadow-sm">
                                    <label className="text-xs font-bold text-mid uppercase tracking-widest block mb-1">Avatar Selection</label>
                                    <div className="flex gap-6 mt-2">
                                        <button
                                            onClick={() => updateSettings?.({ avatar: 'boy' })}
                                            className={`w-16 h-16 rounded-full transition-all duration-300 ${settings?.avatar === 'boy' ? 'ring-4 ring-primary ring-offset-2 ring-offset-page scale-110 shadow-glow' : 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                        >
                                            <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=boy`} alt="Boy Avatar" className="w-full h-full object-cover rounded-full bg-slate-100 dark:bg-slate-700" />
                                        </button>
                                        <button
                                            onClick={() => updateSettings?.({ avatar: 'girl' })}
                                            className={`w-16 h-16 rounded-full transition-all duration-300 ${settings?.avatar === 'girl' ? 'ring-4 ring-primary ring-offset-2 ring-offset-page scale-110 shadow-glow' : 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                        >
                                            <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=girl`} alt="Girl Avatar" className="w-full h-full object-cover rounded-full bg-slate-100 dark:bg-slate-700" />
                                        </button>
                                    </div>
                                </div>


                                {/* Font Scale Slider Redesign */}
                                <div className="space-y-4 p-5 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-primary/10 rounded-lg">
                                                <FileText size={14} className="text-primary" />
                                            </div>
                                            <span className="text-sm font-bold text-mid uppercase tracking-widest">Adjust Text Size</span>
                                        </div>
                                        <span className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">{Math.round(settings?.fontScale * 100)}%</span>
                                    </div>
                                    <div className="relative pt-2 group">
                                        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-zinc-100 dark:bg-black/40 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-300"
                                                style={{ width: `${((settings?.fontScale - 0.8) / (1.3 - 0.8)) * 100}%` }}
                                            />
                                        </div>
                                        <input
                                            type="range"
                                            min="0.8" max="1.3" step="0.05"
                                            value={settings?.fontScale || 1.0}
                                            onChange={(e) => updateSettings?.({ fontScale: parseFloat(e.target.value) })}
                                            className="relative z-10 w-full h-1.5 bg-transparent appearance-none cursor-pointer outline-none slider-premium"
                                        />
                                        <style>{`
                                            .slider-premium::-webkit-slider-thumb {
                                                -webkit-appearance: none;
                                                appearance: none;
                                                width: 22px;
                                                height: 22px;
                                                background: white;
                                                border: 4px solid rgba(var(--color-primary), 1);
                                                border-radius: 50%;
                                                cursor: grab;
                                                box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
                                                transition: all 0.2s ease;
                                            }
                                            .slider-premium::-webkit-slider-thumb:hover {
                                                transform: scale(1.15);
                                                box-shadow: 0 6px 16px rgba(var(--color-primary), 0.4);
                                            }
                                            .slider-premium::-webkit-slider-thumb:active {
                                                cursor: grabbing;
                                                transform: scale(0.95);
                                            }
                                            .dark .slider-premium::-webkit-slider-thumb {
                                                background: #1e293b;
                                            }
                                        `}</style>
                                        <div className="flex justify-between mt-3 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                                            <span>Compact</span>
                                            <span>Default</span>
                                            <span>Large</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── PERMISSIONS SECTION ── */}
                            <div className="space-y-3 mt-8 pt-6 border-t border-black/10 dark:border-white/10">
                                <h4 className="font-heading font-semibold text-dark dark:text-white mb-2 text-lg tracking-tight flex items-center gap-2">
                                    <Bell size={18} className="text-primary" /> Notification Permissions
                                </h4>

                                {/* System permission status */}
                                <div className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm
                                    ${systemNotifPermission === 'granted'
                                        ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'
                                        : systemNotifPermission === 'denied'
                                            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                                            : 'bg-white dark:bg-slate-800 border-black/5 dark:border-white/5'
                                    }`}>
                                    <span className="text-sm font-bold flex items-center gap-2">
                                        {systemNotifPermission === 'granted'
                                            ? <BellRing size={16} className="text-green-600" />
                                            : systemNotifPermission === 'denied'
                                                ? <BellOff size={16} className="text-red-500" />
                                                : <Bell size={16} className="text-amber-500" />}
                                        <span className={systemNotifPermission === 'granted' ? 'text-green-700 dark:text-green-300' : systemNotifPermission === 'denied' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}>
                                            Browser Notifications: {systemNotifPermission === 'granted' ? 'Allowed' : systemNotifPermission === 'denied' ? 'Blocked (change in browser settings)' : 'Not yet allowed'}
                                        </span>
                                    </span>
                                    {systemNotifPermission === 'default' && (
                                        <button
                                            onClick={async () => {
                                                const r = await requestNotifPermission();
                                                setSystemNotifPermission(r);
                                                if (user?.uid) localStorage.setItem(`notifAsked_${user.uid}`, '1');
                                            }}
                                            className="text-xs font-bold px-3 py-1.5 bg-[#0057FF] text-white rounded-xl hover:bg-[#0044CC] transition-colors"
                                        >
                                            Allow
                                        </button>
                                    )}
                                </div>

                                {/* Meal notification toggle */}
                                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm">
                                    <div>
                                        <span className="text-sm font-bold text-dark dark:text-white flex items-center gap-2">
                                            <Utensils size={15} className="text-primary" /> Meal Time Notifications
                                        </span>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">Get notified when each mess session opens</p>
                                    </div>
                                    <button
                                        onClick={() => setNotifPrefs({ mealNotif: !notifPrefs.mealNotif })}
                                        disabled={systemNotifPermission !== 'granted'}
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${notifPrefs.mealNotif && systemNotifPermission === 'granted'
                                            ? 'bg-[#0057FF] dark:bg-[#D4F000]'
                                            : 'bg-zinc-300 dark:bg-zinc-600'
                                            } disabled:opacity-40`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifPrefs.mealNotif ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                    </button>
                                </div>

                                {/* Notice notification toggle */}
                                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm">
                                    <div>
                                        <span className="text-sm font-bold text-dark dark:text-white flex items-center gap-2">
                                            <Megaphone size={15} className="text-warning" /> Mess Notice Alerts
                                        </span>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">Get notified when the admin posts a new notice</p>
                                    </div>
                                    <button
                                        onClick={() => setNotifPrefs({ noticeNotif: !notifPrefs.noticeNotif })}
                                        disabled={systemNotifPermission !== 'granted'}
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${notifPrefs.noticeNotif && systemNotifPermission === 'granted'
                                            ? 'bg-[#0057FF] dark:bg-[#D4F000]'
                                            : 'bg-zinc-300 dark:bg-zinc-600'
                                            } disabled:opacity-40`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifPrefs.noticeNotif ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            <Button
                                onClick={() => setShowProfileEdit(true)}
                                className="w-full mt-6 py-4 text-base"
                                variant="secondary"
                            >
                                Edit Profile details
                            </Button>

                            <button
                                onClick={onLogout}
                                className="w-full mt-4 flex items-center justify-center gap-2 py-4 bg-error/10 text-error hover:bg-error/20 active:scale-[0.98] transition-all rounded-2xl font-bold font-heading text-lg border border-error/20"
                            >
                                <LogOut size={22} className="stroke-[2.5]" /> Logout
                            </button>
                        </Card>
                    </div>
                )}

                    </>
                )}
            </main>

            <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-white dark:bg-[#0D0D0D] border border-[#E4E4E4] dark:border-[#2A2A2A] p-1.5 rounded-pill flex justify-between gap-1 shadow-card-md dark:shadow-card-dark z-50 w-[96%] max-w-sm">
                {[
                    { id: 'menu', icon: Utensils, label: 'Menu' },
                    { id: 'feedback', icon: Star, label: 'Rate' },
                    { id: 'complaints', icon: Camera, label: 'Proof' },
                    { id: 'profile', icon: User, label: 'Profile' }
                ].map(({ id, icon: TabIcon, label }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 py-2.5 px-2 rounded-pill flex flex-col items-center gap-1 transition-all duration-200 outline-none ${activeTab === id
                            ? 'bg-[#0057FF] text-white dark:bg-[#D4F000] dark:text-[#0D0D0D] shadow-blue-glow dark:shadow-nik-btn scale-[1.02]'
                            : 'text-[#6B6B6B] dark:text-[#A0A0A0] hover:text-[#0D0D0D] dark:hover:text-white'
                            }`}
                    >
                        <TabIcon size={18} strokeWidth={activeTab === id ? 2.5 : 2} />
                        <span className="text-[9px] font-bold tracking-wide uppercase">{label}</span>
                    </button>
                ))}
            </nav>

            {/* Image Preview Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <img src={selectedImage} alt="Full view" className="max-w-full max-h-full rounded-lg" />
                    <button
                        className="absolute top-4 right-4 text-white p-2"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X size={32} />
                    </button>
                </div>
            )}
            <UnifiedFeedbackModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                initialEmail={user?.email || ''}
                config={config}
            />

            {/* Notification Modal */}
            {showNotices && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNotices(false)}></div>
                    <Card className="relative w-full max-w-lg bg-white dark:bg-[#16162A] border-zinc-200 dark:border-white/10 p-0 overflow-hidden rounded-[32px] animate-scale-in">
                        <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex justify-between items-center bg-zinc-50 dark:bg-black/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Megaphone size={20} className="text-primary" />
                                </div>
                                <h3 className="text-xl font-heading font-black text-[#0D0D0D] dark:text-white tracking-tight">Mess Notices</h3>
                            </div>
                            <button onClick={() => setShowNotices(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                            {notices.length > 0 ? (
                                notices.map((notice) => (
                                    <div key={notice.id} className="p-5 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/5 hover:border-primary/30 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-heading font-black text-primary text-base tracking-tight group-hover:translate-x-1 transition-transform">{notice.title}</h4>
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                                {notice.createdAt?.toDate?.() ? format(notice.createdAt.toDate(), 'MMM d') : 'New'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                                            {notice.message}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <Megaphone size={40} className="mx-auto text-zinc-300 mb-4 opacity-50" />
                                    <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">No active notices</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-zinc-50 dark:bg-black/20 border-t border-zinc-100 dark:border-white/5">
                            <Button onClick={() => setShowNotices(false)} className="w-full font-black py-3">Got it!</Button>
                        </div>
                    </Card>
                </div>
            )}

            <SuccessModal
                isOpen={successModal.isOpen}
                onConfirm={() => setSuccessModal({ ...successModal, isOpen: false })}
                title={successModal.title}
                message={successModal.message}
            />

            {showTour && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
                    <div className="w-full max-w-md bg-white dark:bg-[#1A1A2E] rounded-[2rem] overflow-hidden shadow-2xl">
                        <div className={`bg-gradient-to-br ${TOUR_SLIDES[tourStep].color} p-8 text-center`}>
                            <div className="text-6xl mb-4">
                                {TOUR_SLIDES[tourStep].emoji}
                            </div>
                            <h2 className="text-2xl font-heading font-black text-white tracking-tight">
                                {TOUR_SLIDES[tourStep].title}
                            </h2>
                        </div>
                        <div className="p-6">
                            <p className="text-zinc-600 dark:text-zinc-300 text-base font-medium leading-relaxed text-center mb-6">
                                {TOUR_SLIDES[tourStep].description}
                            </p>
                            <div className="flex justify-center gap-2 mb-6">
                                {TOUR_SLIDES.map((_, i) => (
                                    <div key={i}
                                        className={`h-2 rounded-full transition-all duration-300 ${i === tourStep
                                            ? 'w-6 bg-primary'
                                            : 'w-2 bg-zinc-300 dark:bg-zinc-600'
                                        }`}
                                    />
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={dismissTour}
                                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-zinc-500 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors"
                                >
                                    Skip
                                </button>
                                <button
                                    onClick={() => {
                                        if (tourStep < TOUR_SLIDES.length - 1) {
                                            setTourStep(s => s + 1);
                                        } else {
                                            dismissTour();
                                        }
                                    }}
                                    className="flex-[2] py-3 rounded-2xl text-sm font-black text-white bg-primary hover:bg-primary/90 transition-colors"
                                >
                                    {tourStep < TOUR_SLIDES.length - 1 ? 'Next →' : 'Get Started! 🎉'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
