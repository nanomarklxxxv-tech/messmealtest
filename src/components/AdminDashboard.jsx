import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, writeBatch, getDocs, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { LayoutDashboard, Users, Utensils, Megaphone, FileSpreadsheet, Settings, LogOut, Search, Check, X, Bell, Crown, Save, Calendar, BarChart3, ChevronRight, Menu as MenuIcon, AlertTriangle, Star, ImageIcon, Eye, Download, Shield, User, Clock4, PlusCircle, Trash2, RefreshCw, Globe, MessageSquare, CheckCircle2, Sparkles, ShieldAlert, ShieldCheck, FileText, Menu } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { parseMenuCSV, uploadMenuBatch } from '../lib/menuUtils';

import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Select } from './ui/Select';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { ConfirmModal } from './ui/ConfirmModal';
import { ProfileSetupScreen } from './ProfileSetup';
import { BouncingLogoScreen } from './ui/LoadingScreen';
import { UnifiedFeedbackModal } from './UnifiedFeedbackModal';
import { SuccessModal } from './ui/SuccessModal';
import { DEFAULT_HOSTELS, DEFAULT_MESS_TYPES, MEAL_ORDER, INITIAL_SUPER_ADMIN_EMAIL, DEFAULT_TAGLINE, DEFAULT_MEAL_TIMINGS } from '../lib/constants';

// Utility for CSV to Menu conversion
const excelDateToJSDate = (serial) => {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
};

const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: "Good morning", emoji: "🌅" };
    if (hour >= 12 && hour < 17) return { text: "Good afternoon", emoji: "☀️" };
    if (hour >= 17 && hour < 21) return { text: "Good evening", emoji: "🌆" };
    return { text: "Good night", emoji: "🌙" };
};

export const AdminDashboard = ({ user, userData, onLogout, onSwitchToUser, config, onUpdateConfig, settings, updateSettings }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showBouncingLogo, setShowBouncingLogo] = useState(false);
    const [showMaintenancePopup, setShowMaintenancePopup] = useState(true);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [submitting, setSubmitting] = useState(false);

    // Data states
    const [usersList, setUsersList] = useState([]);
    const [proofs, setProofs] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [reports, setReports] = useState([]);
    const [notices, setNotices] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingProofs, setIsLoadingProofs] = useState(true);
    const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(true);
    const [isLoadingReports, setIsLoadingReports] = useState(true);
    const [isLoadingNotices, setIsLoadingNotices] = useState(true);

    // UI states
    const [searchQuery, setSearchQuery] = useState('');
    const [userFilter, setUserFilter] = useState('all'); // all, pending, students, faculty, admins
    const [feedbackSubTab, setFeedbackSubTab] = useState('ratings'); // ratings, suggestions
    const [selectedImage, setSelectedImage] = useState(null);

    // Proof filters state
    const [proofDateFilter, setProofDateFilter] = useState('');
    const [proofMessTypeFilter, setProofMessTypeFilter] = useState('ALL');
    const [proofHostelFilter, setProofHostelFilter] = useState('ALL');

    // Feedback filters state
    const [feedbackDateFilter, setFeedbackDateFilter] = useState('');
    const [feedbackMessTypeFilter, setFeedbackMessTypeFilter] = useState('ALL');
    const [feedbackHostelFilter, setFeedbackHostelFilter] = useState('ALL');

    // Notice state (targeting)
    const [noticeTitle, setNoticeTitle] = useState('');
    const [noticeMessage, setNoticeMessage] = useState('');
    const [noticeHostels, setNoticeHostels] = useState(['ALL']); // Array of selected hostels
    const [noticeMessTypes, setNoticeMessTypes] = useState(['ALL']); // Array of selected mess types

    // Menu state
    const [menuInputs, setMenuInputs] = useState({ breakfast: '', lunch: '', snacks: '', dinner: '' });
    const [menuDate, setMenuDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [menuHostel, setMenuHostel] = useState(DEFAULT_HOSTELS[0]);
    const [menuType, setMenuType] = useState(DEFAULT_MESS_TYPES[0]);

    // Bulk Upload State
    const [uploadHostel, setUploadHostel] = useState(DEFAULT_HOSTELS[0]);
    const [uploadMessType, setUploadMessType] = useState(DEFAULT_MESS_TYPES[0]);
    const [csvFile, setCsvFile] = useState(null);
    const [uploadingMenu, setUploadingMenu] = useState(false);
    const [csvMonth, setCsvMonth] = useState(new Date().getMonth());
    const [csvYear, setCsvYear] = useState(new Date().getFullYear());

    // Settings / Admin state
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newHostel, setNewHostel] = useState('');
    const [newMessType, setNewMessType] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupHostels, setNewGroupHostels] = useState([]);
    const [newMessGroupName, setNewMessGroupName] = useState('');
    const [newMessGroupTypes, setNewMessGroupTypes] = useState([]);
    const [newTagline, setNewTagline] = useState(config?.tagline || '');
    const [newApiKey, setNewApiKey] = useState(config?.geminiApiKey || '');
    const [newCalorieApiKey, setNewCalorieApiKey] = useState(config?.calorieNinjasApiKey || '');
    const [autoApprove, setAutoApprove] = useState(config?.autoApproveDomainUsers ?? true);
    const [newOwnerEmail, setNewOwnerEmail] = useState('');

    // Timing states
    const [editTimings, setEditTimings] = useState(config?.mealTimings || DEFAULT_MEAL_TIMINGS);
    const [newOverride, setNewOverride] = useState({ mealType: 'Breakfast', startDate: '', endDate: '', start: '', end: '', label: '' });

    // Custom confirm modal state
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, isDestructive: true });
    const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '' });

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: new Date(2000, i).toLocaleString('default', { month: 'long' })
    }));

    const yearOptions = Array.from({ length: 5 }, (_, i) => {
        const y = new Date().getFullYear() - 1 + i;
        return { value: y, label: y.toString() };
    });

    const getHostelOptions = (includeAll = false) => {
        const options = [];
        if (includeAll) {
            options.push({ value: 'ALL', label: 'All Hostels' });
        }
        if (config?.hostelGroups?.length > 0) {
            options.push({
                label: "Hostel Groups",
                options: config.hostelGroups.map(g => ({ value: `GROUP:${g.name}`, label: g.name }))
            });
        }
        options.push({
            label: "Individuals",
            options: (config?.hostels || DEFAULT_HOSTELS).map(h => ({ value: h, label: h }))
        });
        return options;
    };

    const getMessTypeOptions = (includeAll = false) => {
        const options = [];
        if (includeAll) {
            options.push({ value: 'ALL', label: 'All Types' });
        }
        if (config?.messTypeGroups?.length > 0) {
            options.push({
                label: "Mess Groups",
                options: config.messTypeGroups.map(g => ({ value: `GROUP:${g.name}`, label: g.name }))
            });
        }
        options.push({
            label: "Individuals",
            options: (config?.messTypes || DEFAULT_MESS_TYPES).map(m => ({ value: m, label: m }))
        });
        return options;
    };

    const isSuperAdmin = userData?.role === 'super_admin' ||
        user?.email === INITIAL_SUPER_ADMIN_EMAIL ||
        user?.email === config?.superAdminEmail;

    // Sync autoApprove state when config changes
    useEffect(() => {
        if (config?.autoApproveDomainUsers !== undefined) {
            setAutoApprove(config.autoApproveDomainUsers);
        }
    }, [config]);

    // Live Clock Effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch users
    useEffect(() => {
        setIsLoadingUsers(true);
        const q = query(collection(db, 'artifacts', appId, 'users'));
        const unsub = onSnapshot(q, (snap) => {
            setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoadingUsers(false);
        }, (error) => {
            console.error("Users sync error:", error);
            toast.error("Failed to sync users");
            setIsLoadingUsers(false);
        });
        return () => unsub();
    }, [user]);

    // Fetch proofs (complaints)
    useEffect(() => {
        if (activeTab !== 'proofs' && activeTab !== 'dashboard') return;
        setIsLoadingProofs(true);
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'proofs'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setProofs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoadingProofs(false);
        }, (error) => {
            console.error('Proofs sync error:', error);
            setIsLoadingProofs(false);
        });
        return () => unsub();
    }, [activeTab, user]);

    // Fetch feedbacks (ratings)
    useEffect(() => {
        if (activeTab !== 'feedback' && activeTab !== 'dashboard') return;
        setIsLoadingFeedbacks(true);
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'ratings'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoadingFeedbacks(false);
        }, (error) => {
            console.error('Feedbacks sync error:', error);
            setIsLoadingFeedbacks(false);
        });
        return () => unsub();
    }, [activeTab, user]);

    // Fetch reports (suggestions/bugs from student/faculty)
    useEffect(() => {
        if (activeTab !== 'feedback' && activeTab !== 'dashboard') return;
        setIsLoadingReports(true);
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'feedback_reports'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoadingReports(false);
        }, (error) => {
            console.error('Reports sync error:', error);
            setIsLoadingReports(false);
        });
        return () => unsub();
    }, [activeTab, user]);

    // Update time every minute for greeting
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch notices
    useEffect(() => {
        setIsLoadingNotices(true);
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'notices'), orderBy('createdAt', 'desc'), limit(20));
        const unsub = onSnapshot(q, (snap) => {
            setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoadingNotices(false);
        }, (error) => {
            console.error('Notices sync error:', error);
            setIsLoadingNotices(false);
        });
        return () => unsub();
    }, [user]);

    // Fetch existing menu for editing
    useEffect(() => {
        if (activeTab !== 'menus') return;
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'menus'),
            where('date', '==', menuDate),
            where('hostel', '==', menuHostel),
            where('messType', '==', menuType),
            limit(1)
        );
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const data = snap.docs[0].data();
                setMenuInputs({
                    breakfast: data.breakfast || '',
                    lunch: data.lunch || '',
                    snacks: data.snacks || '',
                    dinner: data.dinner || ''
                });
            } else {
                setMenuInputs({ breakfast: '', lunch: '', snacks: '', dinner: '' });
            }
        }, (error) => console.log('Menu fetch error:', error));
        return () => unsub();
    }, [activeTab, menuDate, menuHostel, menuType, user]);

    // --- Actions ---

    const handleToggleGroupHostel = (hostel) => {
        setNewGroupHostels(prev =>
            prev.includes(hostel) ? prev.filter(h => h !== hostel) : [...prev, hostel]
        );
    };

    const handleToggleGroupMessType = (type) => {
        setNewMessGroupTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const addHostelGroup = async () => {
        const name = newGroupName.trim();
        if (!name || newGroupHostels.length === 0) return;
        try {
            const currentGroups = config?.hostelGroups || [];
            if (currentGroups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
                toast.error("A group with this name already exists.");
                return;
            }
            const updatedGroups = [...currentGroups, { name, hostels: newGroupHostels }];

            // Trigger success modal BEFORE re-renders if possible, but definitely before state reset
            setSuccessModal({
                isOpen: true,
                title: "Group Created!",
                message: `Hostel group "${name}" has been successfully created.`
            });

            await onUpdateConfig({ hostelGroups: updatedGroups });
            setNewGroupName('');
            setNewGroupHostels([]);
            toast.success("Hostel group added!");
        } catch (e) {
            toast.error("Failed to add hostel group.");
        }
    };

    const addMessTypeGroup = async () => {
        const name = newMessGroupName.trim();
        if (!name || newMessGroupTypes.length === 0) return;
        try {
            const currentGroups = config?.messTypeGroups || [];
            if (currentGroups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
                toast.error("A group with this name already exists.");
                return;
            }
            const updatedGroups = [...currentGroups, { name, types: newMessGroupTypes }];

            setSuccessModal({
                isOpen: true,
                title: "Group Created!",
                message: `Mess group "${name}" has been successfully created.`
            });

            await onUpdateConfig({ messTypeGroups: updatedGroups });
            setNewMessGroupName('');
            setNewMessGroupTypes([]);
            toast.success("Mess group added!");
        } catch (e) {
            toast.error("Failed to add mess type group.");
        }
    };

    const deleteHostelGroup = async (groupName) => {
        try {
            const currentGroups = config?.hostelGroups || [];
            const updatedGroups = currentGroups.filter(g => g.name !== groupName);
            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), { hostelGroups: updatedGroups }, { merge: true });
            setSuccessModal({
                isOpen: true,
                title: "Group Deleted",
                message: `The hostel group "${groupName}" has been successfully removed.`
            });
            toast.success("Hostel group deleted!");
        } catch (e) {
            toast.error("Failed to delete group.");
        }
    };

    const deleteMessTypeGroup = async (groupName) => {
        try {
            const currentGroups = config?.messTypeGroups || [];
            const updatedGroups = currentGroups.filter(g => g.name !== groupName);
            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), { messTypeGroups: updatedGroups }, { merge: true });
            setSuccessModal({
                isOpen: true,
                title: "Group Deleted",
                message: `The mess type group "${groupName}" has been successfully removed.`
            });
            toast.success("Mess type group deleted!");
        } catch (e) {
            toast.error("Failed to delete group.");
        }
    };

    const approveUser = async (userId) => {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'users', userId), { approved: true });
            setSuccessModal({
                isOpen: true,
                title: "User Approved!",
                message: "This user can now access the relevant portals and features."
            });
            toast.success("User approved!");
        } catch { toast.error("Failed to approve user"); }
    };

    const revokeUser = (userId) => {
        setConfirmModal({
            isOpen: true,
            title: "Revoke Access",
            message: "Are you sure you want to revoke this user's access? They will no longer be able to log in.",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await updateDoc(doc(db, 'artifacts', appId, 'users', userId), { approved: false });
                    setSuccessModal({
                        isOpen: true,
                        title: "Access Revoked!",
                        message: "The user's access has been successfully restricted."
                    });
                    toast.success("User access revoked.");
                } catch { toast.error("Failed to revoke access"); }
            }
        });
    };

    const addAdmin = async () => {
        if (!newAdminEmail.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/add-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newAdminEmail.trim() })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error adding admin');

            setSuccessModal({
                isOpen: true,
                title: "Admin Added!",
                message: `User "${newAdminEmail}" has been granted admin privileges.`
            });
            toast.success(data.message);
            setNewAdminEmail('');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const transferOwnership = (newEmail) => {
        if (!newEmail.trim()) return;
        setConfirmModal({
            isOpen: true,
            title: "Transfer Ownership",
            message: `Are you sure you want to transfer Super Admin privileges to ${newEmail}? You will lose these privileges.`,
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setSubmitting(true);
                try {
                    const res = await fetch('/api/admin/transfer-ownership', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newEmail: newEmail.trim() })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Error transferring ownership');

                    setSuccessModal({
                        isOpen: true,
                        title: "Ownership Transferred!",
                        message: `Super Admin privileges have been successfully transferred to "${newEmail}".`
                    });
                    toast.success(data.message);
                } catch (err) {
                    toast.error(err.message);
                } finally {
                    setSubmitting(false);
                }
            }
        });
    };

    const updateTimings = async () => {
        try {
            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), {
                mealTimings: editTimings,
                updatedAt: serverTimestamp()
            }, { merge: true });
            await onUpdateConfig({ mealTimings: editTimings });
            setSuccessModal({
                isOpen: true,
                title: "Timings Updated!",
                message: "Standard meal timings have been updated for all students."
            });
            toast.success("Permanent timings updated successfully!");
        } catch (err) { toast.error("Error updating timings"); }
    };

    const addTimingOverride = async () => {
        if (!newOverride.startDate || !newOverride.endDate || !newOverride.start || !newOverride.end) {
            toast.error("Please fill all override fields");
            return;
        }

        try {
            const overrides = config?.timingOverrides || [];
            const updatedOverrides = [...overrides, { ...newOverride, id: Date.now().toString() }];

            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), {
                timingOverrides: updatedOverrides,
                updatedAt: serverTimestamp()
            }, { merge: true });
            await onUpdateConfig({ timingOverrides: updatedOverrides });
            setNewOverride({ mealType: 'Breakfast', startDate: '', endDate: '', start: '', end: '', label: '' });
            setSuccessModal({
                isOpen: true,
                title: "Override Added!",
                message: `Timing override for ${newOverride.mealType} has been successfully applied.`
            });
            toast.success("Temporary override added!");
        } catch (err) { toast.error("Error adding override"); }
    };

    const deleteTimingOverride = async (id) => {
        try {
            const updatedOverrides = (config?.timingOverrides || []).filter(o => o.id !== id);
            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), {
                timingOverrides: updatedOverrides,
                updatedAt: serverTimestamp()
            }, { merge: true });
            await onUpdateConfig({ timingOverrides: updatedOverrides });
            toast.success("Override removed");
        } catch (err) { toast.error("Error removing override"); }
    };

    const addConfigItem = async (type) => {
        const val = type === 'hostel' ? newHostel.trim().toUpperCase() : newMessType.trim().toUpperCase();
        if (!val) return;
        try {
            const key = type === 'hostel' ? 'hostels' : 'messTypes';
            const currentArr = config?.[key] || (type === 'hostel' ? DEFAULT_HOSTELS : DEFAULT_MESS_TYPES);
            const updated = [...new Set([...currentArr, val])];

            // Set success modal BEFORE awaiting potentially disruptive re-renders
            setSuccessModal({
                isOpen: true,
                title: "Item Added!",
                message: `New ${type === 'hostel' ? 'Hostel' : 'Mess Type'} "${val}" has been added to the system configuration.`
            });

            await onUpdateConfig({ [key]: updated });
            if (type === 'hostel') setNewHostel('');
            else setNewMessType('');
            toast.success(`${type} added successfully!`);
        } catch (e) { toast.error(`Failed to add ${type}`); }
    };

    const deleteConfigItem = (type, itemToDelete) => {
        setConfirmModal({
            isOpen: true,
            title: `Delete ${type}`,
            message: `Are you sure you want to delete "${itemToDelete}"?`,
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    const key = type === 'hostel' ? 'hostels' : 'messTypes';
                    const currentArr = config?.[key] || (type === 'hostel' ? DEFAULT_HOSTELS : DEFAULT_MESS_TYPES);
                    const updated = currentArr.filter(i => i !== itemToDelete);

                    setSuccessModal({
                        isOpen: true,
                        title: "Item Deleted",
                        message: `"${itemToDelete}" has been successfully removed from ${type === 'hostel' ? 'hostels' : 'mess types'}.`
                    });

                    await onUpdateConfig({ [key]: updated });
                    toast.success(`${type} deleted.`);
                } catch (e) { toast.error(`Failed to delete ${type}`); }
            }
        });
    };

    const updateTagline = async () => {
        if (!newTagline.trim()) return;
        try {
            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), { tagline: newTagline.trim() }, { merge: true });
            await onUpdateConfig({ tagline: newTagline.trim() });
            setSuccessModal({
                isOpen: true,
                title: "Tagline Updated!",
                message: `The institutional tagline has been updated to: "${newTagline}"`
            });
            toast.success("Tagline updated successfully!");
        } catch (e) { toast.error("Failed to update tagline"); }
    };

    const updateApiKey = async (type) => {
        try {
            const field = type === 'gemini' ? 'geminiApiKey' : 'calorieNinjasApiKey';
            const val = type === 'gemini' ? newApiKey.trim() : newCalorieApiKey.trim();
            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), { [field]: val }, { merge: true });
            await onUpdateConfig({ [field]: val });
            setSuccessModal({
                isOpen: true,
                title: "API Key Updated!",
                message: `${type === 'gemini' ? 'Gemini AI' : 'CalorieNinjas'} API key has been securely updated.`
            });
            toast.success(`${type === 'gemini' ? 'Gemini' : 'CalorieNinjas'} API Key updated successfully!`);
        } catch (e) { toast.error("Failed to update API Key"); }
    };

    const toggleAutoApproval = async () => {
        try {
            const newValue = !autoApprove;
            await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), { autoApproveDomainUsers: newValue }, { merge: true });
            await onUpdateConfig({ autoApproveDomainUsers: newValue });
            setAutoApprove(newValue);
            setSuccessModal({
                isOpen: true,
                title: "Preference Updated!",
                message: `Auto-approval for permitted domains is now ${newValue ? 'ENABLED' : 'DISABLED'}.`
            });
            toast.success(`User auto-approval is now ${newValue ? 'Enabled' : 'Disabled'}`);
        } catch (e) { toast.error("Failed to update approval setting"); }
    };

    const getTargetHostels = (selection) => {
        if (selection === 'ALL') return config?.hostels || DEFAULT_HOSTELS;
        if (selection.startsWith('GROUP:')) {
            const groupName = selection.split(':')[1];
            const group = (config?.hostelGroups || []).find(g => g.name === groupName);
            return group ? group.hostels : [];
        }
        return [selection];
    };

    const getTargetMessTypes = (selection) => {
        if (selection === 'ALL') return config?.messTypes || DEFAULT_MESS_TYPES;
        if (selection.startsWith('GROUP:')) {
            const groupName = selection.split(':')[1];
            const group = (config?.messTypeGroups || []).find(g => g.name === groupName);
            return group ? group.types : [];
        }
        return [selection];
    };

    const matchesSelection = (value, selection, groups, groupProperty) => {
        if (selection === 'ALL') return true;
        if (selection.startsWith('GROUP:')) {
            const groupName = selection.split(':')[1];
            const group = (groups || []).find(g => g.name === groupName);
            if (!group) return false;
            return group[groupProperty].includes(value);
        }
        return value === selection;
    };

    const createNotice = async () => {
        if (!noticeTitle.trim() || !noticeMessage.trim()) return;
        // Capture title before state reset for the modal message
        const capturedTitle = noticeTitle.trim();
        try {
            // Flatten target hostels from selections
            let finalHostels = [];
            if (noticeHostels.includes('ALL')) {
                finalHostels = ['ALL'];
            } else {
                noticeHostels.forEach(h => {
                    finalHostels = [...finalHostels, ...getTargetHostels(String(h).trim().toUpperCase())];
                });
                finalHostels = [...new Set(finalHostels.map(x => String(x).trim().toUpperCase()))];
            }

            // Flatten target mess types from selections
            let finalMessTypes = [];
            if (noticeMessTypes.includes('ALL')) {
                finalMessTypes = ['ALL'];
            } else {
                noticeMessTypes.forEach(t => {
                    finalMessTypes = [...finalMessTypes, ...getTargetMessTypes(String(t).trim().toUpperCase())];
                });
                finalMessTypes = [...new Set(finalMessTypes.map(x => String(x).trim().toUpperCase()))];
            }

            // Show modal BEFORE any awaits that could trigger re-renders
            setSuccessModal({
                isOpen: true,
                title: "Broadcast Published!",
                message: `Your notice "${capturedTitle}" has been successfully sent to all target students.`
            });

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notices'), {
                title: noticeTitle,
                message: noticeMessage,
                targetHostels: finalHostels,
                targetMessTypes: finalMessTypes,
                createdAt: serverTimestamp()
            });
            setNoticeTitle('');
            setNoticeMessage('');
            setNoticeHostels(['ALL']);
            setNoticeMessTypes(['ALL']);
            toast.success("Notice published!");
        } catch (err) { toast.error("Error creating notice"); }
    };

    const deleteNotice = (id) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Notice",
            message: "Are you sure you want to delete this notice? This action cannot be undone.",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notices', id));
                    setSuccessModal({
                        isOpen: true,
                        title: "Notice Deleted",
                        message: "The notice has been successfully removed and will no longer be visible to students."
                    });
                    toast.success("Notice deleted");
                } catch { toast.error("Failed to delete notice"); }
            }
        });
    };

    const resolveReport = async (id) => {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'feedback_reports', id), {
                status: 'Resolved',
                resolvedAt: serverTimestamp(),
                resolvedBy: user.uid
            });
            toast.success("Report marked as resolved");
        } catch { toast.error("Failed to update report"); }
    };

    const updateMenuSession = async (session) => {
        try {
            const targetHostels = getTargetHostels(menuHostel);
            const targetMessTypes = getTargetMessTypes(menuType);

            if (targetHostels.length === 0 || targetMessTypes.length === 0) {
                return toast.error("No valid targets found in selection");
            }

            // Show success modal immediately before the loop of writes
            setSuccessModal({
                isOpen: true,
                title: "Menu Updated! ✓",
                message: `Successfully updating ${session} for ${targetHostels.length} hostel(s) on ${menuDate}. Changes will reflect shortly.`
            });

            for (const rawHostel of targetHostels) {
                const hostel = String(rawHostel).trim().toUpperCase();
                for (const rawMType of targetMessTypes) {
                    const mType = String(rawMType).trim().toUpperCase();
                    const docId = `${hostel}_${mType}_${menuDate}`;
                    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'menus', docId);
                    const data = {
                        date: menuDate,
                        hostel: hostel,
                        messType: mType,
                        [session.toLowerCase()]: menuInputs[session.toLowerCase()],
                        updatedAt: serverTimestamp(),
                        updatedBy: user.uid
                    };
                    await setDoc(docRef, data, { merge: true });
                }
            }
            toast.success(`${session} updated successfully!`);
        } catch { toast.error(`Failed to update ${session}`); }
    };

    const processCSV = async () => {
        if (!csvFile) return;

        const fileName = csvFile.name?.toLowerCase() || '';
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
            toast.error("Please upload a .csv or .xlsx file.");
            setCsvFile(null);
            return;
        }

        setUploadingMenu(true);
        try {
            const processedMenu = await parseMenuCSV(csvFile, csvMonth, csvYear);

            const targetHostels = getTargetHostels(uploadHostel);
            const targetMessTypes = getTargetMessTypes(uploadMessType);

            if (targetHostels.length === 0 || targetMessTypes.length === 0) {
                setUploadingMenu(false);
                return toast.error("No valid targets found");
            }

            const totalDocs = await uploadMenuBatch(processedMenu, targetHostels, targetMessTypes, user.uid);

            // Show success modal before setCsvFile(null) to avoid any re-render race
            setSuccessModal({
                isOpen: true,
                title: "Bulk Upload Complete! ✓",
                message: `Successfully uploaded menu for ${targetHostels.length} hostel(s) and ${targetMessTypes.length} mess type(s). ${totalDocs} records created/updated.`
            });
            toast.success(`Menu uploaded! ${totalDocs} records updated.`);
            setCsvFile(null);
        } catch (error) {
            console.error(error);
            toast.error("Error parsing or uploading CSV/Excel file");
        } finally {
            setUploadingMenu(false);
        }
    };

    const resolveProof = async (id) => {
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'proofs', id), { status: 'Resolved' });
            setSuccessModal({
                isOpen: true,
                title: "Complaint Resolved!",
                message: "The report has been marked as resolved in the system gallery."
            });
            toast.success("Complaint marked as resolved");
        } catch { toast.error("Failed to resolve complaint"); }
    };

    const downloadImage = (imageUrl, filename) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename || 'complaint-image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Derived stats
    const stats = React.useMemo(() => ({
        totalUsers: usersList.length,
        students: usersList.filter(u => u.role === 'student').length,
        faculty: usersList.filter(u => u.role === 'faculty').length,
        pendingUsers: usersList.filter(u => u.approved === false).length,
        pendingProofs: proofs.filter(p => !p.status || p.status.toLowerCase() === 'pending').length,
        pendingReports: reports.filter(r => !r.status || r.status.toLowerCase() === 'pending').length,
        avgRating: feedbacks.length > 0
            ? (feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / feedbacks.length).toFixed(1)
            : 'N/A'
    }), [usersList, proofs, feedbacks, reports]);

    const filteredProofs = proofs.filter(p => {
        const matchesDate = !proofDateFilter || p.date === proofDateFilter;
        const matchesMessType = matchesSelection(p.messType, proofMessTypeFilter, config?.messTypeGroups, 'types');
        const matchesHostel = matchesSelection(p.hostel, proofHostelFilter, config?.hostelGroups, 'hostels');
        return matchesDate && matchesMessType && matchesHostel;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const downloadAllProofs = () => {
        const downloads = [];
        filteredProofs.forEach(p => {
            (p.images || []).forEach(img => downloads.push({ url: img, name: `proof_${p.studentName}_${p.date}_${Math.random().toString(36).substr(2, 5)}` }));
        });

        if (downloads.length === 0) return toast.error("No files found to download");
        if (downloads.length > 20) {
            if (!confirm(`You are about to download ${downloads.length} files. Your browser may ask for permission. Continue?`)) return;
        }

        downloads.forEach((d, i) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = d.url;
                const isZip = !d.url.startsWith('data:image/');
                link.download = `${d.name}.${isZip ? 'zip' : 'png'}`;
                link.click();
            }, i * 300);
        });
        toast.success(`Starting ${downloads.length} downloads...`);
    };

    const filteredUsers = usersList.filter(u => {
        if (userFilter === 'pending') return !u.approved;
        if (userFilter === 'students') return u.role === 'student';
        if (userFilter === 'faculty') return u.role === 'faculty';
        if (userFilter === 'admins') return u.role === 'admin' || u.role === 'super_admin';
        return true;
    });

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'menus', label: 'Menu Management', icon: Calendar },
        { id: 'notices', label: 'Notices', icon: Megaphone },
        { id: 'feedback', label: 'Feedback', icon: Star },
        { id: 'proofs', label: 'Proofs Gallery', icon: ImageIcon },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'profile', label: 'Profile', icon: User }
    ];

    const updateAdminProfile = async (updates) => {
        try {
            setShowBouncingLogo(true);
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
            toast.success("Profile updated!");
        } catch (e) {
            console.error("Admin profile update failed:", e);
            toast.error("Failed to update profile. Please try again.");
        }
    };

    const handleBouncingLogoComplete = () => {
        setShowBouncingLogo(false);
        setShowProfileEdit(false);
    };

    if (showBouncingLogo) {
        return <BouncingLogoScreen onComplete={handleBouncingLogoComplete} />;
    }

    if (showProfileEdit) {
        return <ProfileSetupScreen user={user} userData={userData} onComplete={updateAdminProfile} theme={settings?.darkMode ? 'purple' : 'orange'} config={config} />;
    }

    const checkMaintenanceStatus = () => {
        if (!config) return { lock: false };

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-11
        const day = now.getDate(); // 1-31

        const maintenance = config.maintenance || {};

        // 1. Bi-Annual Ratings Reset (Dec 31 & Jun 30)
        // Reset happens for previous period if now >= July 1 (for Jan-Jun) or now >= Jan 1 (for Jul-Dec)
        let ratingsResetNeeded = false;
        let ratingsPeriod = "";
        let ratingsDeadline = null;

        if (month >= 6) { // July to Dec
            ratingsDeadline = "June 30";
            if (!maintenance.lastRatingsReset || new Date(maintenance.lastRatingsReset) < new Date(year, 5, 30)) {
                ratingsResetNeeded = true;
                ratingsPeriod = "January - June " + year;
            }
        } else { // Jan to June
            ratingsDeadline = "December 31";
            if (!maintenance.lastRatingsReset || new Date(maintenance.lastRatingsReset) < new Date(year - 1, 11, 31)) {
                ratingsResetNeeded = true;
                ratingsPeriod = "July - December " + (year - 1);
            }
        }

        // 2. Monthly Proofs Reset (1st of every month)
        let proofsResetNeeded = false;
        let proofsPeriod = "";
        const firstOfMonth = new Date(year, month, 1);
        if (day >= 1) { // It's the 1st or later
            if (!maintenance.lastProofsReset || new Date(maintenance.lastProofsReset) < firstOfMonth) {
                // If it's explicitly the 1st, or we are past the 1st and haven't reset
                proofsResetNeeded = true;
                const prevMonth = new Date(year, month - 1, 1);
                proofsPeriod = prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
            }
        }

        return {
            lock: ratingsResetNeeded || proofsResetNeeded,
            ratingsResetNeeded,
            ratingsPeriod,
            ratingsDeadline,
            proofsResetNeeded,
            proofsPeriod
        };
    };

    const maintenanceStatus = checkMaintenanceStatus();

    const handleMaintenanceCleanup = async (type) => {
        try {
            setShowBouncingLogo(true);
            const maintenance = config.maintenance || {};

            if (type === 'ratings') {
                // Download CSV
                const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'ratings'));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (data.length > 0) exportToExcel(data, `MessMeal_Ratings_Backup_${maintenanceStatus.ratingsPeriod.replace(/ /g, '_')}`);

                // Delete all ratings
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();

                // Update config
                await onUpdateConfig({
                    maintenance: {
                        ...maintenance,
                        lastRatingsReset: serverTimestamp()
                    }
                });
                setSuccessModal({
                    isOpen: true,
                    title: "Ratings Cleared!",
                    message: `All ratings for the period ${maintenanceStatus.ratingsPeriod} have been backed up and cleared.`
                });
                toast.success("Ratings cleared successfully!");
            } else if (type === 'proofs') {
                // Download CSV
                const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'proofs'));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (data.length > 0) exportToExcel(data, `MessMeal_Proofs_Backup_${maintenanceStatus.proofsPeriod.replace(/ /g, '_')}`);

                // Delete records AND Storage Files (simulated delete records)
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();

                // Update config
                await onUpdateConfig({
                    maintenance: {
                        ...maintenance,
                        lastProofsReset: serverTimestamp()
                    }
                });
                setSuccessModal({
                    isOpen: true,
                    title: "Proofs Cleared!",
                    message: `All complaint proofs for the period ${maintenanceStatus.proofsPeriod} have been backed up and cleared.`
                });
                toast.success("Proofs cleared successfully!");
            }
        } catch (error) {
            console.error(error);
            toast.error("Cleanup failed. Please try again.");
        } finally {
            setShowBouncingLogo(false);
        }
    };


    const handleAllMaintenanceCleanup = async () => {
        if (!maintenanceStatus.ratingsResetNeeded && !maintenanceStatus.proofsResetNeeded) {
            toast.success("No maintenance required at the moment.");
            return;
        }
        try {
            setShowBouncingLogo(true);
            if (maintenanceStatus.ratingsResetNeeded) {
                await handleMaintenanceCleanup('ratings');
            }
            if (maintenanceStatus.proofsResetNeeded) {
                await handleMaintenanceCleanup('proofs');
            }
        } finally {
            setShowBouncingLogo(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': {
                const greeting = getGreeting();
                return (
                    <div className="space-y-8">
                        {/* Welcome Banner */}
                        <div className="relative overflow-hidden p-8 rounded-3xl bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#D946EF] text-white shadow-xl">
                            {/* Decorative background icon */}
                            <div className="absolute right-[-20px] top-[-20px] opacity-10 rotate-12">
                                <Settings size={200} />
                            </div>

                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <h1 className="text-4xl md:text-5xl font-heading font-black tracking-tight mb-2 flex items-center gap-3">
                                        {greeting.text}, {userData?.name?.split(' ')[0] || 'Admin'} {greeting.emoji}
                                    </h1>
                                    <div className="flex items-center gap-3 text-white/80 font-medium">
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                                            <Shield size={14} className="text-white" />
                                            <span className="text-xs uppercase tracking-wider font-bold">
                                                {isSuperAdmin ? 'Super Admin' : 'Admin'}
                                            </span>
                                        </div>
                                        <span className="text-white/40">|</span>
                                        <span className="text-sm opacity-90">
                                            Managing {isSuperAdmin ? 'All Hostels (MH-1 to LH-7)' : (userData?.hostel || 'Hostel')}
                                        </span>
                                    </div>
                                </div>

                                <div className="hidden lg:flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
                                    <div className="flex flex-col items-end">
                                        <p className="text-2xl font-black tracking-tighter leading-none">
                                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mt-1">
                                            {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Clock4 size={20} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                            {[
                                { label: 'Total Users', value: stats.totalUsers, icon: Users, hero: true, loading: isLoadingUsers },
                                { label: 'Students', value: stats.students, icon: User, iconColor: 'text-blue-500 dark:text-blue-400', badgeBg: 'bg-blue-50 dark:bg-blue-900/30', loading: isLoadingUsers },
                                { label: 'Pending Approval', value: stats.pendingUsers, icon: Clock4, iconColor: 'text-amber-500', badgeBg: 'bg-amber-50 dark:bg-amber-900/30', loading: isLoadingUsers },
                                { label: 'Avg Rating', value: stats.avgRating, icon: Star, iconColor: 'text-purple-500 dark:text-purple-400', badgeBg: 'bg-purple-50 dark:bg-purple-900/30', loading: isLoadingFeedbacks }
                            ].map((stat, i) => (
                                stat.hero ? (
                                    /* Hero card — accent colored */
                                    <div key={stat.label} className="p-5 rounded-2xl flex flex-col transition-transform hover:-translate-y-1 duration-200
                                        bg-[#2E7D32] dark:bg-[#7C3AED] text-white shadow-lg relative overflow-hidden">
                                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                            <span className="flex h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
                                            <span className="text-[7px] font-black uppercase tracking-widest opacity-80">Live</span>
                                        </div>
                                        <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                                            <stat.icon size={22} className="text-white" />
                                        </div>
                                        <p className="text-4xl font-heading font-black tracking-tight">
                                            {stat.loading ? <div className="h-10 w-16 bg-white/20 animate-pulse rounded-lg" /> : stat.value}
                                        </p>
                                        <p className="text-xs font-bold uppercase tracking-widest mt-1 text-white/70">{stat.label}</p>
                                    </div>
                                ) : (
                                    /* Regular cards */
                                    <div key={stat.label} className="p-5 rounded-2xl flex flex-col transition-transform hover:-translate-y-1 duration-200
                                        bg-white dark:bg-[#16162A] border border-[#EEEEEE] dark:border-[#1E1E35] shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none relative">
                                        {stat.label === 'Pending Approval' && stat.value > 0 && (
                                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                                <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                <span className="text-[7px] font-black uppercase tracking-widest text-amber-500">Live</span>
                                            </div>
                                        )}
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${stat.badgeBg}`}>
                                            <stat.icon size={20} className={stat.iconColor} />
                                        </div>
                                        <p className="text-4xl font-heading font-black tracking-tight text-[#0D0D0D] dark:text-[#F0F0FF]">
                                            {stat.loading ? <div className="h-10 w-16 bg-zinc-200 dark:bg-white/10 animate-pulse rounded-lg" /> : stat.value}
                                        </p>
                                        <p className="text-xs font-bold uppercase tracking-widest mt-1 text-[#6B6B6B] dark:text-[#8B8BAD]">{stat.label}</p>
                                    </div>
                                )
                            ))}
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Recent Feedback Card */}
                            <div className="flex flex-col h-[380px] bg-white dark:bg-[#16162A] rounded-2xl border border-[#EEEEEE] dark:border-[#1E1E35] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-[#F0F0FF] text-base">Recent Feedback</h3>
                                    <button onClick={() => setActiveTab('feedback')} className="text-xs font-bold text-[#2E7D32] dark:text-[#7C3AED] hover:underline">View All</button>
                                </div>
                                <div className="space-y-2 overflow-y-auto flex-grow scrollbar-hide pr-1">
                                    {isLoadingFeedbacks ? (
                                        [1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-[#F7F7F7] dark:bg-[#1E1E35] animate-pulse rounded-xl" />)
                                    ) : feedbacks.slice(0, 5).map(f => (
                                        <div key={f.id} className="flex items-center gap-3 p-3 bg-[#F7F7F7] dark:bg-[#1E1E35] rounded-xl transition-colors hover:bg-[#EEEEEE] dark:hover:bg-[#1E1E2E]">
                                            <div className="flex">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star key={star} size={12} className={star <= f.rating ? 'text-amber-400 fill-amber-400' : 'text-[#E4E4E4] dark:text-[#1E1E35]'} />
                                                ))}
                                            </div>
                                            <span className="text-sm font-semibold text-[#0D0D0D] dark:text-[#F0F0FF] flex-1 truncate">{f.mealType}</span>
                                            <span className="text-xs font-bold text-[#6B6B6B] dark:text-[#8B8BAD] truncate max-w-[80px]">{f.studentName?.split(' ')[0]}</span>
                                        </div>
                                    ))}
                                    {feedbacks.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-[#A0A0A0] space-y-2">
                                            <Star size={30} className="opacity-30" />
                                            <p className="text-xs font-bold uppercase tracking-widest">No feedback yet</p>
                                        </div>
                                    )}
                                </div>

                                {/* Pending Issues Card */}
                                <div className="flex flex-col h-[380px] bg-white dark:bg-[#16162A] rounded-2xl border border-[#EEEEEE] dark:border-[#1E1E35] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-[#F0F0FF] text-base">Pending Issues</h3>
                                        <button onClick={() => setActiveTab('proofs')} className="text-xs font-bold text-[#2E7D32] dark:text-[#7C3AED] hover:underline">View All</button>
                                    </div>
                                    <div className="space-y-3 overflow-y-auto flex-grow scrollbar-hide pr-1">
                                        {isLoadingProofs ? (
                                            [1, 2, 3].map(i => <div key={i} className="h-20 w-full bg-[#FFF8E1] dark:bg-[#2A2210] animate-pulse rounded-xl border border-[#F57F17]/20" />)
                                        ) : proofs.filter(p => p.status === 'Pending').slice(0, 5).map(p => (
                                            <div key={p.id} className="p-3 rounded-xl border transition-colors bg-[#FFF8E1] border-[#F57F17]/20 dark:bg-[#2A2210] dark:border-[#FBBF24]/20 hover:border-[#F57F17]/40 dark:hover:border-[#FBBF24]/40">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-semibold text-[#F57F17] dark:text-[#FBBF24] text-sm mb-0.5">{p.session} · {p.date}</p>
                                                        <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#8B8BAD]">{p.studentName}</p>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FFF8E1] dark:bg-[#2A2210] text-[#F57F17] dark:text-[#FBBF24] border border-[#F57F17]/30 dark:border-[#FBBF24]/30">Pending</span>
                                                </div>
                                            </div>
                                        ))}
                                        {proofs.filter(p => p.status === 'Pending').length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-[#A0A0A0] space-y-2">
                                                <Check size={28} className="opacity-40 text-[#2E7D32] dark:text-[#4ADE80]" />
                                                <p className="text-xs font-bold uppercase tracking-widest">All issues resolved</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>  {/* end space-y-8 */}
                    </div>
                );
            }

            case 'menus':
                return (
                    <div className="space-y-8 max-w-4xl">
                        <Card className="border border-success/30 bg-success/10  shadow-[0_0_15px_rgba(34,197,94,0.05)]">
                            <h3 className="font-heading font-semibold text-success mb-2 flex items-center gap-3 text-lg tracking-tight">
                                <FileSpreadsheet size={24} /> Bulk Upload CSV/Excel
                            </h3>
                            <p className="text-sm text-success/80 mb-6 font-medium">
                                Expected Columns: Date, Breakfast, Lunch, Snacks, Dinner.
                            </p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <Select
                                    label="Month"
                                    value={csvMonth}
                                    onChange={(val) => setCsvMonth(Number(val))}
                                    options={monthOptions}
                                />
                                <Select
                                    label="Year"
                                    value={csvYear}
                                    onChange={(val) => setCsvYear(Number(val))}
                                    options={yearOptions}
                                />
                                <Select
                                    label="Target"
                                    value={uploadHostel}
                                    onChange={setUploadHostel}
                                    options={getHostelOptions()}
                                />
                                <Select
                                    label="Mess Type"
                                    value={uploadMessType}
                                    onChange={setUploadMessType}
                                    options={getMessTypeOptions()}
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <label className="flex-1 w-full flex items-center justify-center p-4 border border-dashed border-success/40 rounded-xl cursor-pointer hover:bg-success/10 dark:hover:bg-success/20 transition-colors bg-zinc-50 dark:bg-black/20 backdrop-blur-sm">
                                    <input
                                        type="file"
                                        accept=".csv, .xlsx"
                                        onChange={(e) => setCsvFile(e.target.files[0])}
                                        className="hidden"
                                    />
                                    <span className="text-sm font-semibold text-success">
                                        {csvFile ? csvFile.name : 'Choose File to Upload'}
                                    </span>
                                </label>
                                {csvFile && (
                                    <Button onClick={processCSV} loading={uploadingMenu} className="w-full sm:w-auto py-4 px-8 bg-success text-white hover:bg-green-600">
                                        Confirm
                                    </Button>
                                )}
                            </div>
                        </Card>

                        <Card className="bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 shadow-sm">
                            <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white mb-6 flex items-center gap-3 text-lg tracking-tight">
                                <Calendar size={24} className="text-[#2E7D32] dark:text-[#7C3AED]" /> Manual Entry
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                <div>
                                    <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">Date</label>
                                    <input
                                        type="date"
                                        value={menuDate}
                                        onChange={(e) => setMenuDate(e.target.value)}
                                        className="w-full p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white transition-colors"
                                    />
                                </div>
                                <Select
                                    label="Target"
                                    value={menuHostel}
                                    onChange={setMenuHostel}
                                    options={getHostelOptions()}
                                />
                                <Select
                                    label="Mess Type"
                                    value={menuType}
                                    onChange={setMenuType}
                                    options={getMessTypeOptions()}
                                />
                            </div>
                            <div className="space-y-6">
                                {MEAL_ORDER.map(meal => {
                                    const mealColors = {
                                        Breakfast: 'bg-primary/10 border-primary/20 text-primary-light',
                                        Lunch: 'bg-green-500/10 border-green-500/20 text-green-400',
                                        Snacks: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
                                        Dinner: 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                    };
                                    const mealBtnColors = {
                                        Breakfast: 'bg-primary text-white hover:brightness-110 shadow-lg shadow-primary/20 border-primary/20',
                                        Lunch: 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20 border-green-600/20',
                                        Snacks: 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20 border-orange-600/20',
                                        Dinner: 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/20 border-purple-600/20'
                                    };
                                    return (
                                        <div key={meal} className={`p-4 border rounded-2xl backdrop-blur-lg shadow-inner ${mealColors[meal]}`}>
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="font-heading font-semibold tracking-wide drop-shadow-sm">{meal}</span>
                                                <Button
                                                    onClick={() => updateMenuSession(meal)}
                                                    className={`text-xs py-2 px-5 font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${mealBtnColors[meal]}`}
                                                    icon={Save}
                                                >
                                                    Save {meal}
                                                </Button>
                                            </div>
                                            <textarea
                                                value={menuInputs[meal.toLowerCase()]}
                                                onChange={(e) => setMenuInputs({ ...menuInputs, [meal.toLowerCase()]: e.target.value })}
                                                placeholder={`Enter ${meal} menu items...`}
                                                className="w-full p-4 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl h-28 resize-none outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                            />
                                        </div>
                                    )
                                })}
                            </div>


                        </Card >
                    </div >
                );

            case 'notices': {
                const allHostels = (config?.hostels || DEFAULT_HOSTELS);
                const allMessTypes = (config?.messTypes || DEFAULT_MESS_TYPES);
                const allGroups = (config?.hostelGroups || []);

                return (
                    <div className="space-y-8 max-w-4xl">
                        <Card className="bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 shadow-sm p-6 rounded-[32px]">
                            <h3 className="font-heading font-black text-[#0D0D0D] dark:text-white mb-6 flex items-center gap-3 text-xl tracking-tight">
                                <PlusCircle size={28} className="text-[#2E7D32] dark:text-[#7C3AED]" /> Create New Notice
                            </h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] ml-1">Title</label>
                                    <input
                                        type="text"
                                        value={noticeTitle}
                                        onChange={(e) => setNoticeTitle(e.target.value)}
                                        placeholder="Urgent Menu Change / Water Supply Update..."
                                        className="w-full p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl outline-none focus:border-[#2E7D32] dark:focus:border-[#7C3AED] focus:ring-4 focus:ring-[#2E7D32]/5 text-zinc-900 dark:text-white placeholder-zinc-400 transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] ml-1">Message Body</label>
                                    <textarea
                                        value={noticeMessage}
                                        onChange={(e) => setNoticeMessage(e.target.value)}
                                        placeholder="Write your announcement here..."
                                        className="w-full p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl h-36 resize-none outline-none focus:border-[#2E7D32] dark:focus:border-[#7C3AED] focus:ring-4 focus:ring-[#2E7D32]/5 text-zinc-900 dark:text-white placeholder-zinc-400 transition-all shadow-inner"
                                    />
                                </div>

                                <div className="space-y-6 p-6 bg-zinc-50 dark:bg-black/20 rounded-3xl border border-zinc-200 dark:border-white/5">
                                    {/* Targeted Hostels */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">Target Hostels</label>
                                            <button
                                                onClick={() => setNoticeHostels(['ALL'])}
                                                className="text-[10px] font-black text-[#2E7D32] dark:text-[#A78BFA] uppercase tracking-widest hover:underline"
                                            >
                                                Broadcast to All
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => {
                                                    if (noticeHostels.includes('ALL')) return;
                                                    setNoticeHostels(['ALL']);
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${noticeHostels.includes('ALL')
                                                    ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-md shadow-[#2E7D32]/20'
                                                    : 'bg-white dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/30'
                                                    }`}
                                            >
                                                All Hostels
                                            </button>
                                            {allGroups.map(group => (
                                                <button
                                                    key={group.name}
                                                    onClick={() => {
                                                        const selection = `GROUP:${group.name}`;
                                                        let next = noticeHostels.includes('ALL') ? [] : [...noticeHostels];
                                                        if (next.includes(selection)) {
                                                            next = next.filter(h => h !== selection);
                                                        } else {
                                                            next.push(selection);
                                                        }
                                                        setNoticeHostels(next.length === 0 ? ['ALL'] : next);
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${noticeHostels.includes(`GROUP:${group.name}`)
                                                        ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-md shadow-[#2E7D32]/20'
                                                        : 'bg-white dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/30'
                                                        }`}
                                                >
                                                    {group.name}
                                                </button>
                                            ))}
                                            {allHostels.map(hostel => (
                                                <button
                                                    key={hostel}
                                                    onClick={() => {
                                                        let next = noticeHostels.includes('ALL') ? [] : [...noticeHostels];
                                                        if (next.includes(hostel)) {
                                                            next = next.filter(h => h !== hostel);
                                                        } else {
                                                            next.push(hostel);
                                                        }
                                                        setNoticeHostels(next.length === 0 ? ['ALL'] : next);
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${noticeHostels.includes(hostel)
                                                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                                        : 'bg-white dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10 hover:border-primary/30'
                                                        }`}
                                                >
                                                    {hostel}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Targeted Mess Types */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">Target Mess Types</label>
                                            <button
                                                onClick={() => setNoticeMessTypes(['ALL'])}
                                                className="text-[10px] font-black text-[#2E7D32] dark:text-[#A78BFA] uppercase tracking-widest hover:underline"
                                            >
                                                Select All
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setNoticeMessTypes(['ALL'])}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${noticeMessTypes.includes('ALL')
                                                    ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-md shadow-[#2E7D32]/20'
                                                    : 'bg-white dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/30'
                                                    }`}
                                            >
                                                All Types
                                            </button>
                                            {allMessTypes.map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => {
                                                        let next = noticeMessTypes.includes('ALL') ? [] : [...noticeMessTypes];
                                                        if (next.includes(type)) {
                                                            next = next.filter(t => t !== type);
                                                        } else {
                                                            next.push(type);
                                                        }
                                                        setNoticeMessTypes(next.length === 0 ? ['ALL'] : next);
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${noticeMessTypes.includes(type)
                                                        ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-md shadow-[#2E7D32]/20'
                                                        : 'bg-white dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/30'
                                                        }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={createNotice}
                                    disabled={!noticeTitle.trim() || !noticeMessage.trim()}
                                    className="w-full py-5 text-lg bg-[#2E7D32] dark:bg-[#7C3AED] text-white hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-[#2E7D32]/20 dark:shadow-[#7C3AED]/20 font-black"
                                >
                                    Publish Broadcast
                                </Button>
                            </div>
                        </Card>

                        <div className="space-y-4">
                            <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white tracking-tight text-lg mb-2">Active Notices</h3>
                            {notices.map(notice => (
                                <Card key={notice.id} className="flex justify-between items-start border border-zinc-200 dark:border-[#2E7D32]/30 bg-white dark:bg-[#16162A]/50 hover:bg-zinc-50 dark:hover:bg-[#16162A]/80 transition-colors">
                                    <div>
                                        <h4 className="font-heading font-bold text-[#2E7D32] dark:text-[#A78BFA] text-lg tracking-tight">{notice.title}</h4>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 whitespace-pre-wrap leading-relaxed max-w-2xl">{notice.message}</p>
                                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-4">
                                            {notice.createdAt?.toDate?.().toLocaleDateString?.() || 'Recently'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => deleteNotice(notice.id)}
                                        className="text-error hover:bg-error/20 p-3 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </Card>
                            ))}
                            {notices.length === 0 && (
                                <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-3xl  ">
                                    <Megaphone size={40} className="mx-auto text-zinc-600 mb-4" />
                                    <p className="text-zinc-400 font-medium tracking-wide">No active notices.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
            case 'feedback':
                return (
                    <div className="space-y-6 max-w-7xl">
                        {/* Sub-tab Toggle */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex gap-2 p-1 bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 rounded-2xl w-fit shadow-sm">
                                <button
                                    onClick={() => setFeedbackSubTab('ratings')}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${feedbackSubTab === 'ratings'
                                        ? 'bg-[#2E7D32] dark:bg-[#7C3AED] text-white shadow-md'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-[#2E7D32] dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'
                                        }`}
                                >
                                    <Star size={16} /> Meal Ratings
                                </button>
                                <button
                                    onClick={() => setFeedbackSubTab('suggestions')}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 relative ${feedbackSubTab === 'suggestions'
                                        ? 'bg-[#2E7D32] dark:bg-[#7C3AED] text-white shadow-md'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-[#2E7D32] dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'
                                        }`}
                                >
                                    <MessageSquare size={16} /> Suggestions & Bugs
                                    {stats.pendingReports > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 bg-error text-white text-[8px] font-black items-center justify-center rounded-full border-2 border-white dark:border-[#16162A]">
                                            {stats.pendingReports}
                                        </span>
                                    )}
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {feedbackSubTab === 'ratings' ? (
                                    <Button variant="secondary" onClick={() => exportToExcel(feedbacks, 'student_feedback')} disabled={feedbacks.length === 0} className="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 hover:bg-zinc-200 dark:hover:bg-white/20 font-bold shadow-none">
                                        <FileSpreadsheet size={16} className="mr-2" />
                                        Export Ratings
                                    </Button>
                                ) : (
                                    <Button variant="secondary" onClick={() => exportToExcel(reports, 'suggestions_bugs')} disabled={reports.length === 0} className="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 hover:bg-zinc-200 dark:hover:bg-white/20 font-bold shadow-none">
                                        <FileSpreadsheet size={16} className="mr-2" />
                                        Export Reports
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white dark:bg-[#16162A] p-5 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-sm">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 ml-1">Filter by Date</label>
                                <input
                                    type="date"
                                    value={feedbackDateFilter}
                                    onChange={(e) => setFeedbackDateFilter(e.target.value)}
                                    className="w-full p-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#2E7D32] dark:focus:border-[#7C3AED] text-zinc-900 dark:text-white transition-all shadow-inner"
                                />
                            </div>
                            <Select
                                label="Filter by Hostel"
                                value={feedbackHostelFilter}
                                onChange={setFeedbackHostelFilter}
                                options={getHostelOptions(true)}
                            />
                            <Select
                                label="Filter by Mess"
                                value={feedbackMessTypeFilter}
                                onChange={setFeedbackMessTypeFilter}
                                options={getMessTypeOptions(true)}
                            />
                            <div className="flex items-end">
                                <Button
                                    variant="secondary"
                                    onClick={() => { setFeedbackDateFilter(''); setFeedbackHostelFilter('ALL'); setFeedbackMessTypeFilter('ALL'); }}
                                    className="w-full py-3 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-error bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-white/10"
                                >
                                    <RefreshCw size={14} className="mr-2" /> Reset Filters
                                </Button>
                            </div>
                        </div>

                        {feedbackSubTab === 'ratings' ? (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {feedbacks.filter(f => {
                                    const fDate = (f.date || f.feedbackDate || '');
                                    const dateStr = fDate.length > 10 ? fDate.slice(0, 10) : fDate;
                                    const matchDate = !feedbackDateFilter || dateStr === feedbackDateFilter;
                                    const matchHostel = matchesSelection(f.hostel, feedbackHostelFilter, config?.hostelGroups, 'hostels');
                                    const matchType = matchesSelection(f.messType, feedbackMessTypeFilter, config?.messTypeGroups, 'types');
                                    return matchDate && matchHostel && matchType;
                                }).map(f => (
                                    <Card key={f.id} className="flex flex-col bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/30 transition-all shadow-sm group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-black/40 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 shadow-inner">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star
                                                        key={star}
                                                        size={14}
                                                        className={star <= f.rating ? 'text-warning fill-warning' : 'text-zinc-300 dark:text-zinc-600'}
                                                    />
                                                ))}
                                                <span className="text-xs font-black text-zinc-700 dark:text-white ml-1">{f.rating}</span>
                                            </div>
                                            <Badge variant="secondary" className="bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/20 font-bold">{f.mealType}</Badge>
                                        </div>
                                        <div className="mb-4">
                                            <p className="font-heading font-black text-[#0D0D0D] dark:text-white text-base tracking-tight">{f.studentName || 'Anonymous Student'}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{f.hostel}</p>
                                                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{f.messType}</p>
                                            </div>
                                        </div>
                                        {f.comment && (
                                            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4 italic line-clamp-3">"{f.comment}"</p>
                                        )}
                                        <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                                            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">{f.date}</p>
                                        </div>
                                    </Card>
                                ))}
                                {feedbacks.length === 0 && (
                                    <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-200 dark:border-white/5 rounded-[40px] bg-white/50 dark:bg-transparent backdrop-blur-sm">
                                        <Star size={40} className="mx-auto text-zinc-300 mb-4 opacity-50" />
                                        <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em]">No feedback yet</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {reports.filter(r => {
                                    const rDate = r.createdAt?.toDate ? r.createdAt.toDate().toISOString() : '';
                                    const dateStr = rDate.length > 10 ? rDate.slice(0, 10) : rDate;
                                    const matchDate = !feedbackDateFilter || dateStr === feedbackDateFilter;
                                    const matchHostel = matchesSelection(r.hostel, feedbackHostelFilter, config?.hostelGroups, 'hostels');
                                    const matchType = matchesSelection(r.messType, feedbackMessTypeFilter, config?.messTypeGroups, 'types');
                                    return matchDate && matchHostel && matchType;
                                }).map(r => (
                                    <Card key={r.id} className="flex flex-col bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/30 transition-all shadow-sm group">
                                        <div className="flex justify-between items-start mb-4">
                                            <Badge variant={r.status === 'Resolved' ? 'success' : 'warning'} className="font-black text-[9px] px-2 py-0.5">
                                                {r.status ? r.status.toUpperCase() : 'PENDING'}
                                            </Badge>
                                            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                                {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                            </div>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 truncate mb-1">{r.email}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-black text-[#2E7D32] dark:text-[#A78BFA] uppercase tracking-widest">{r.hostel}</p>
                                                <span className="text-zinc-300 dark:text-zinc-700">/</span>
                                                <p className="text-xs font-black text-[#2E7D32] dark:text-[#A78BFA] uppercase tracking-widest">{r.messType}</p>
                                            </div>
                                        </div>
                                        <div className="bg-zinc-50 dark:bg-black/20 p-4 rounded-2xl border border-zinc-100 dark:border-white/5 mb-4 flex-1">
                                            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                                                {r.description}
                                            </p>
                                        </div>
                                        {r.proofImage && (
                                            <button
                                                onClick={() => setSelectedImage(r.proofImage)}
                                                className="mb-4 flex items-center gap-2 text-xs font-bold text-primary hover:underline shadow-none"
                                            >
                                                <ImageIcon size={14} /> View Attached Screenshot
                                            </button>
                                        )}
                                        <div className="mt-auto">
                                            {r.status !== 'Resolved' ? (
                                                <Button
                                                    onClick={() => resolveReport(r.id)}
                                                    variant="secondary"
                                                    className="w-full py-2.5 bg-[#2E7D32]/5 border-[#2E7D32]/20 hover:bg-[#2E7D32]/10 text-[#2E7D32] shadow-none font-bold text-xs"
                                                >
                                                    <CheckCircle2 size={14} className="mr-2" /> Mark as Resolved
                                                </Button>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 py-2 px-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                    <CheckCircle2 size={14} className="text-zinc-400" />
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Case Resolved</span>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                                {reports.length === 0 && (
                                    <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-200 dark:border-white/5 rounded-[40px] bg-white/50 dark:bg-transparent backdrop-blur-sm">
                                        <MessageSquare size={40} className="mx-auto text-zinc-300 mb-4 opacity-50" />
                                        <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em]">No suggestions or bugs reported</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );

            case 'proofs':
                return (
                    <div className="space-y-6 max-w-7xl">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
                            <h3 className="text-xl font-heading font-bold text-[#0D0D0D] dark:text-white tracking-tight flex items-center gap-3">
                                <ImageIcon className="text-error" size={24} /> Proofs Gallery
                                <Badge variant="secondary" className="ml-2 bg-error/10 text-error border-error/20 font-black">{filteredProofs.length}</Badge>
                            </h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={downloadAllProofs}
                                    disabled={filteredProofs.length === 0}
                                    className="bg-[#2E7D32]/10 text-[#2E7D32] border-[#2E7D32]/20 hover:bg-[#2E7D32]/20 shadow-none font-bold"
                                >
                                    <Download size={16} className="mr-2" />
                                    Download All {filteredProofs.length > 0 && `(${filteredProofs.length})`}
                                </Button>
                                <Button variant="secondary" onClick={() => exportToExcel(filteredProofs, 'complaint_proofs')} disabled={filteredProofs.length === 0} className="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 hover:bg-zinc-200 dark:hover:bg-white/20 shadow-none font-bold">
                                    <FileSpreadsheet size={16} className="mr-2" />
                                    Export Excel
                                </Button>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white dark:bg-[#16162A] p-5 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-sm">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 ml-1">Filter by Date</label>
                                <input
                                    type="date"
                                    value={proofDateFilter}
                                    onChange={(e) => setProofDateFilter(e.target.value)}
                                    className="w-full p-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#2E7D32] dark:focus:border-[#7C3AED] text-zinc-900 dark:text-white transition-all"
                                />
                            </div>
                            <Select
                                label="Filter by Hostel"
                                value={proofHostelFilter}
                                onChange={setProofHostelFilter}
                                options={getHostelOptions(true)}
                            />
                            <Select
                                label="Filter by Mess"
                                value={proofMessTypeFilter}
                                onChange={setProofMessTypeFilter}
                                options={getMessTypeOptions(true)}
                            />
                            <div className="flex items-end">
                                <Button
                                    variant="secondary"
                                    onClick={() => { setProofDateFilter(''); setProofHostelFilter('ALL'); setProofMessTypeFilter('ALL'); }}
                                    className="w-full py-3 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-error bg-zinc-50 dark:bg-black/20 border-zinc-200 dark:border-white/10"
                                >
                                    <RefreshCw size={14} className="mr-2" /> Reset Filters
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredProofs.map(proof => (
                                <Card key={proof.id} className="overflow-hidden p-0 flex flex-col bg-white dark:bg-[#16162A] transition-all border-zinc-200 dark:border-white/10 shadow-sm hover:border-[#2E7D32]/30 group/card">
                                    {proof.images && proof.images.length > 0 ? (
                                        <div className="relative group border-b border-zinc-200 dark:border-white/10 h-60 overflow-hidden">
                                            {/* Scrollable Gallery for Multiple Images */}
                                            <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-zinc-100 dark:bg-black/40 h-full">
                                                {proof.images.map((img, idx) => (
                                                    <div key={idx} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center p-2 relative">
                                                        {img.startsWith('data:image/') ? (
                                                            <>
                                                                <img
                                                                    src={img}
                                                                    alt={`Proof ${idx + 1}`}
                                                                    className="w-full h-full object-contain"
                                                                />
                                                                {/* Individual Actions Overlay */}
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                                                    <button
                                                                        onClick={() => setSelectedImage(img)}
                                                                        className="p-2.5 bg-white/20 hover:bg-white/40 text-white rounded-xl backdrop-blur-md transition-all hover:scale-110 pointer-events-auto"
                                                                        title="View Full Screen"
                                                                    >
                                                                        <Eye size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => downloadImage(img, `proof-${proof.studentName}-${idx}.png`)}
                                                                        className="p-2.5 bg-white/20 hover:bg-white/40 text-white rounded-xl backdrop-blur-md transition-all hover:scale-110 pointer-events-auto"
                                                                        title="Download Individual"
                                                                    >
                                                                        <Download size={18} />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center text-zinc-500">
                                                                <FileText size={48} className="mb-2 text-primary" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">ZIP FILE</span>
                                                                <button
                                                                    onClick={() => {
                                                                        const link = document.createElement('a');
                                                                        link.href = img;
                                                                        link.download = `proof-${proof.studentName}-${idx}.zip`;
                                                                        link.click();
                                                                    }}
                                                                    className="mt-3 px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-black hover:bg-primary/20 transition-all"
                                                                >
                                                                    DOWNLOAD ZIP
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {proof.images.length > 1 && (
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md">
                                                    {proof.images.map((_, idx) => (
                                                        <div key={idx} className="w-1 h-1 rounded-full bg-white/40" />
                                                    ))}
                                                </div>
                                            )}

                                            <div className="absolute top-3 left-3 pointer-events-none">
                                                <span className="text-white text-[9px] font-black uppercase bg-black/50 px-2 py-1 rounded-md backdrop-blur-md border border-white/10">
                                                    {proof.images.length} FILE{proof.images.length > 1 ? 'S' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full h-60 bg-zinc-100 dark:bg-black/40 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-white/10">
                                            <AlertTriangle size={32} className="mb-3 opacity-20" />
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">No Proof Attached</span>
                                        </div>
                                    )}
                                    <div className="p-5 flex flex-col flex-grow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="font-heading font-black text-[#0D0D0D] dark:text-white text-base tracking-tight">{proof.studentName}</p>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                                                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-white/5 px-2 py-0.5 rounded-md">{proof.session}</span>
                                                    <span className="text-[10px] font-bold text-zinc-500">{proof.date}</span>
                                                </div>
                                            </div>
                                            <Badge variant={proof.status === 'Resolved' ? 'success' : 'warning'} className="font-black text-[9px] px-2 py-0.5">
                                                {proof.status.toUpperCase()}
                                            </Badge>
                                        </div>
                                        {proof.description && (
                                            <div className="relative mt-2">
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed italic line-clamp-3">"{proof.description}"</p>
                                            </div>
                                        )}
                                        <div className="mt-auto pt-6">
                                            {proof.status === 'Pending' ? (
                                                <Button
                                                    onClick={() => resolveProof(proof.id)}
                                                    variant="secondary"
                                                    className="w-full py-2.5 bg-[#2E7D32]/5 border-[#2E7D32]/20 hover:bg-[#2E7D32]/10 text-[#2E7D32] shadow-none font-bold text-xs"
                                                >
                                                    <CheckCircle2 size={14} className="mr-2" /> Mark as Resolved
                                                </Button>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 py-2 px-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                                    <CheckCircle2 size={14} className="text-zinc-400" />
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Case Resolved</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                        {filteredProofs.length === 0 && (
                            <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-white/5 rounded-[40px] bg-white/50 dark:bg-transparent backdrop-blur-sm">
                                <Search size={48} className="mx-auto text-zinc-300 mb-4" />
                                <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em]">No matching proofs found</p>
                                <button
                                    onClick={() => { setProofDateFilter(''); setProofHostelFilter('ALL'); setProofMessTypeFilter('ALL'); }}
                                    className="mt-4 text-xs font-bold text-primary hover:underline"
                                >
                                    Clear all filters
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'users':
                return (
                    <div className="space-y-6 max-w-7xl">
                        <div className="flex flex-wrap gap-2 mb-6 p-2 bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 rounded-2xl w-fit shadow-sm">
                            {[
                                { id: 'all', label: 'All Users' },
                                { id: 'pending', label: 'Pending Approval' },
                                { id: 'students', label: 'Students' },
                                { id: 'faculty', label: 'Faculty' },
                                { id: 'admins', label: 'Admins' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setUserFilter(f.id)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 outline-none ${userFilter === f.id ? 'bg-[#2E7D32] dark:bg-[#7C3AED] text-white shadow-md' : 'text-zinc-500 dark:text-zinc-400 hover:text-[#2E7D32] dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'}`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {isSuperAdmin && (
                            <Card className="bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 shadow-sm">
                                <h3 className="font-heading font-bold text-[#2E7D32] dark:text-[#A78BFA] mb-4 flex items-center gap-3 tracking-tight text-lg">
                                    <Shield size={20} /> Add New Admin
                                </h3>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <input
                                        type="email"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        placeholder="Enter user email..."
                                        className="flex-1 p-4 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-[#2E7D32]/30 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                    />
                                    <Button onClick={addAdmin} disabled={!newAdminEmail.trim()} className="py-4 px-8 min-w-[150px] bg-[#2E7D32] dark:bg-[#7C3AED] text-white hover:opacity-90 shadow-md">
                                        Add Admin
                                    </Button>
                                </div>
                            </Card>
                        )}

                        <Card className="p-0 overflow-hidden bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 shadow-sm">
                            <div className="overflow-x-auto scrollbar-hide">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20">
                                            <th className="p-5 text-xs font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">Name / Email</th>
                                            <th className="p-5 text-xs font-bold text-zinc-400 uppercase tracking-widest">Role</th>
                                            <th className="p-5 text-xs font-bold text-zinc-400 uppercase tracking-widest">Location</th>
                                            <th className="p-5 text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                                            <th className="p-5 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredUsers.map(u => (
                                            <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors bg-transparent group border-b border-zinc-100 dark:border-white/5">
                                                <td className="p-5">
                                                    <div className="font-heading font-bold text-[#0D0D0D] dark:text-white text-base">{u.name || 'N/A'}</div>
                                                    <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">{u.email}</div>
                                                </td>
                                                <td className="p-5">
                                                    <Badge variant={u.role}>
                                                        {u.role.replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="p-5">
                                                    <span className="text-sm font-semibold text-zinc-300">
                                                        {u.hostel ? `${u.hostel} (${u.messType})` : '-'}
                                                    </span>
                                                </td>
                                                <td className="p-5">
                                                    <Badge variant={u.approved ? 'success' : 'warning'}>
                                                        {u.approved ? 'Active' : 'Pending'}
                                                    </Badge>
                                                </td>
                                                <td className="p-5 text-right w-1 min-w-[120px]">
                                                    {!u.approved ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); approveUser(u.id); }}
                                                            className="text-xs py-2 px-4 rounded-xl bg-success/10 text-success border border-success/30 hover:bg-success hover:text-white sm:opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 outline-none font-bold"
                                                        >
                                                            Approve
                                                        </button>
                                                    ) : u.role !== 'super_admin' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); revokeUser(u.id); }}
                                                            className="text-xs py-2 px-4 rounded-xl bg-error/10 text-error border border-error/30 hover:bg-error hover:text-white sm:opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 outline-none font-bold"
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredUsers.length === 0 && (
                                    <div className="text-center py-16">
                                        <Users size={48} className="mx-auto text-zinc-600 mb-4 opacity-50" />
                                        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No users found</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                );

            case 'settings':
                return (
                    <div className="space-y-6 max-w-4xl pb-24">
                        {isSuperAdmin && (
                            <Card className="bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 shadow-sm">
                                <h3 className="font-heading font-bold text-[#2E7D32] dark:text-[#A78BFA] mb-6 flex items-center gap-3 tracking-tight text-lg">
                                    <Crown size={24} /> Super Admin Zone
                                </h3>
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-bold text-primary uppercase tracking-widest">
                                        Transfer Ownership
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <input
                                            type="email"
                                            value={newOwnerEmail}
                                            onChange={(e) => setNewOwnerEmail(e.target.value)}
                                            placeholder="Enter new owner's email..."
                                            className="flex-1 p-4 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-[#2E7D32]/30 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                        />
                                        <Button
                                            onClick={() => transferOwnership(newOwnerEmail)}
                                            className="py-4 px-8 font-bold bg-[#2E7D32] dark:bg-[#7C3AED] text-white hover:opacity-90 shadow-md"
                                        >
                                            Transfer Role
                                        </Button>
                                    </div>
                                    <p className="text-xs text-zinc-400 font-medium mt-2">
                                        WARNING: Transferring ownership will revoke your super admin privileges immediately.
                                    </p>
                                </div>
                            </Card>
                        )}

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Hostels Management */}
                            <Card className="flex flex-col h-[500px] bg-white dark:bg-[#16162A] border-t-4 border-t-[#2E7D32] dark:border-t-[#7C3AED] border border-[#2E7D32]/20 dark:border-[#7C3AED]/20 shadow-sm">
                                <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg tracking-tight mb-6 flex items-center gap-2">
                                    <span className="w-2 h-5 rounded-full bg-[#2E7D32] dark:bg-[#7C3AED] inline-block" />
                                    Manage Hostels
                                </h3>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={newHostel}
                                        onChange={(e) => setNewHostel(e.target.value)}
                                        placeholder="Add hostel..."
                                        className="flex-1 p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                    />
                                    <Button onClick={() => addConfigItem('hostel')} disabled={!newHostel.trim()} variant="secondary" className="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 hover:bg-zinc-200 dark:hover:bg-white/20">
                                        Add
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                                    {(config?.hostels || DEFAULT_HOSTELS).map(h => (
                                        <div key={h} className="flex justify-between items-center bg-zinc-50 dark:bg-black/20 border-l-4 border-l-[#2E7D32] dark:border-l-[#7C3AED] border border-zinc-100 dark:border-white/5 p-3 rounded-xl hover:bg-[#2E7D32]/5 dark:hover:bg-[#7C3AED]/10 transition-colors">
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-200 text-sm">{h}</span>
                                            <button onClick={() => deleteConfigItem('hostel', h)} className="text-error hover:bg-error/20 p-2 rounded-lg transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Mess Types Management */}
                            <Card className="flex flex-col h-[500px] bg-white dark:bg-[#16162A] border-t-4 border-t-orange-500 dark:border-t-pink-500 border border-orange-500/20 dark:border-pink-500/20 shadow-sm">
                                <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg tracking-tight mb-6 flex items-center gap-2">
                                    <span className="w-2 h-5 rounded-full bg-orange-500 dark:bg-pink-500 inline-block" />
                                    Manage Mess Types
                                </h3>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={newMessType}
                                        onChange={(e) => setNewMessType(e.target.value)}
                                        placeholder="Add mess type..."
                                        className="flex-1 p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                    />
                                    <Button onClick={() => addConfigItem('messType')} disabled={!newMessType.trim()} variant="secondary" className="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 hover:bg-zinc-200 dark:hover:bg-white/20">
                                        Add
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                                    {(config?.messTypes || DEFAULT_MESS_TYPES).map(t => (
                                        <div key={t} className="flex justify-between items-center bg-zinc-50 dark:bg-black/20 border-l-4 border-l-orange-500 dark:border-l-pink-500 border border-zinc-100 dark:border-white/5 p-3 rounded-xl hover:bg-orange-500/5 dark:hover:bg-pink-500/10 transition-colors">
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-200 text-sm">{t}</span>
                                            <button onClick={() => deleteConfigItem('messType', t)} className="text-error hover:bg-error/20 p-2 rounded-lg transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Hostel Groups Management */}
                            <Card className="flex flex-col md:col-span-2 bg-white dark:bg-[#16162A] border-t-4 border-t-blue-500 dark:border-t-cyan-400 border border-blue-500/20 dark:border-cyan-400/20 shadow-sm">
                                <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg tracking-tight mb-6 flex items-center gap-2">
                                    <span className="w-2 h-5 rounded-full bg-blue-500 dark:bg-cyan-400 inline-block" />
                                    Manage Hostel Groups
                                </h3>
                                <div className="space-y-4 mb-6">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            placeholder="Group Name (e.g. ALL MH)"
                                            className="flex-1 p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                        />
                                        <Button onClick={addHostelGroup} disabled={!newGroupName.trim() || newGroupHostels.length === 0} variant="secondary" className="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 hover:bg-zinc-200 dark:hover:bg-white/20">
                                            Create Group
                                        </Button>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-2">Select Hostels for this Group</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(config?.hostels || DEFAULT_HOSTELS).map(h => (
                                                <button
                                                    key={h}
                                                    onClick={() => handleToggleGroupHostel(h)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${newGroupHostels.includes(h) ? 'bg-[#2E7D32] dark:bg-[#7C3AED] text-white border-[#2E7D32] dark:border-[#7C3AED] shadow-sm' : 'bg-zinc-100 dark:bg-black/40 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/50 dark:hover:border-[#7C3AED]/50 hover:text-[#2E7D32] dark:hover:text-white'}`}
                                                >
                                                    {newGroupHostels.includes(h) && <Check size={12} className="inline mr-1" strokeWidth={3} />} {h}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {config?.hostelGroups?.map(group => (
                                        <div key={group.name} className="flex justify-between items-center bg-zinc-50 dark:bg-white/5 border-l-4 border-l-blue-500 dark:border-l-cyan-400 border border-zinc-100 dark:border-white/5 p-4 rounded-2xl hover:bg-blue-500/5 dark:hover:bg-cyan-400/10 transition-all">
                                            <div>
                                                <p className="font-heading font-bold text-[#0D0D0D] dark:text-white text-base">{group.name}</p>
                                                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">{group.hostels.join(', ')}</p>
                                            </div>
                                            <button onClick={() => deleteHostelGroup(group.name)} className="text-error hover:bg-error/10 p-2 rounded-lg mt-2 sm:mt-0 transition-colors self-end sm:self-auto">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!config?.hostelGroups || config.hostelGroups.length === 0) && (
                                        <div className="text-center py-6 border-2 border-dashed border-zinc-200 rounded-xl">
                                            <p className="text-sm font-semibold text-zinc-400">No hostel groups created yet.</p>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {/* Mess Type Groups Management */}
                            <Card className="flex flex-col md:col-span-2 bg-white dark:bg-[#16162A] border-t-4 border-t-emerald-500 dark:border-t-teal-400 border border-emerald-500/20 dark:border-teal-400/20 shadow-sm">
                                <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg tracking-tight mb-6 flex items-center gap-2">
                                    <span className="w-2 h-5 rounded-full bg-emerald-500 dark:bg-teal-400 inline-block" />
                                    Manage Mess Type Groups
                                </h3>
                                <div className="space-y-4 mb-6">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newMessGroupName}
                                            onChange={(e) => setNewMessGroupName(e.target.value)}
                                            placeholder="Group Name (e.g. ALL MH VEG)"
                                            className="flex-1 p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                        />
                                        <Button onClick={addMessTypeGroup} disabled={!newMessGroupName.trim() || newMessGroupTypes.length === 0} variant="secondary" className="bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-200 dark:border-white/20 hover:bg-zinc-200 dark:hover:bg-white/20">
                                            Create Group
                                        </Button>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-2">Select Mess Types for this Group</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(config?.messTypes || DEFAULT_MESS_TYPES).map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => handleToggleGroupMessType(t)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${newMessGroupTypes.includes(t) ? 'bg-[#2E7D32] dark:bg-[#7C3AED] text-white border-[#2E7D32] dark:border-[#7C3AED] shadow-sm' : 'bg-zinc-100 dark:bg-black/40 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-[#2E7D32]/50 dark:hover:border-[#7C3AED]/50 hover:text-[#2E7D32] dark:hover:text-white'}`}
                                                >
                                                    {newMessGroupTypes.includes(t) && <Check size={12} className="inline mr-1" strokeWidth={3} />} {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {config?.messTypeGroups?.map(group => (
                                        <div key={group.name} className="flex justify-between items-center bg-zinc-50 dark:bg-white/5 border-l-4 border-l-emerald-500 dark:border-l-teal-400 border border-zinc-100 dark:border-white/5 p-4 rounded-2xl hover:bg-emerald-500/5 dark:hover:bg-teal-400/10 transition-all">
                                            <div>
                                                <p className="font-heading font-bold text-[#0D0D0D] dark:text-white text-base">{group.name}</p>
                                                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">{group.types.join(', ')}</p>
                                            </div>
                                            <button onClick={() => deleteMessTypeGroup(group.name)} className="text-error hover:bg-error/10 p-2 rounded-lg mt-2 sm:mt-0 transition-colors self-end sm:self-auto">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!config?.messTypeGroups || config.messTypeGroups.length === 0) && (
                                        <div className="text-center py-6 border-2 border-dashed border-zinc-200 rounded-xl">
                                            <p className="text-sm font-semibold text-zinc-400">No mess type groups created yet.</p>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {/* Domain Access & Global Approval */}
                            <Card className="flex flex-col md:col-span-2 bg-white dark:bg-[#16162A] border-t-4 border-t-indigo-500 dark:border-t-violet-400 border border-indigo-500/20 dark:border-violet-400/20 shadow-sm">
                                <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg tracking-tight mb-6 flex items-center gap-2">
                                    <ShieldCheck className="text-indigo-500 dark:text-violet-400" size={24} />
                                    Domain Access & Approval Settings
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-black/20 p-5 rounded-2xl border border-zinc-100 dark:border-white/5">
                                        <div className="flex-1">
                                            <p className="font-heading font-bold text-zinc-800 dark:text-white text-base">VIT-AP Domain Auto-Approval</p>
                                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">
                                                When enabled, students and faculty using @vitap.ac.in domains will be approved automatically upon sign up.
                                                When disabled, every new user requires manual approval from an admin.
                                            </p>
                                        </div>
                                        <button
                                            onClick={toggleAutoApproval}
                                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${autoApprove ? 'bg-[#2E7D32] dark:bg-[#7C3AED]' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${autoApprove ? 'translate-x-8' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </div>

                                    <div className="bg-indigo-500/5 dark:bg-violet-400/5 border border-indigo-500/10 dark:border-violet-400/10 p-4 rounded-xl">
                                        <div className="flex gap-3">
                                            <Shield className="text-indigo-400 shrink-0" size={20} />
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                                                <p className="text-indigo-600 dark:text-violet-300 font-bold mb-1 uppercase tracking-wider">Admin Bypass Rule</p>
                                                Standard domain restrictions are now automatically bypassed for designated <span className="text-indigo-600 dark:text-violet-300 font-bold">Admins</span> and the <span className="text-indigo-600 dark:text-violet-300 font-bold">Super Admin</span> to ensure uninterrupted management access from any email provider.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* App Settings */}
                            <Card className="flex flex-col md:col-span-2">
                                <h3 className="font-heading font-semibold text-dark text-lg tracking-tight mb-6 flex items-center gap-2">
                                    <Globe size={20} className="text-primary" /> Application Branding & Integrations
                                </h3>

                                {/* Tagline Config */}
                                <div className="space-y-4 mb-8">
                                    <label className="text-xs font-bold text-mid uppercase tracking-widest block">Homepage Tagline</label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input
                                            type="text"
                                            value={newTagline}
                                            onChange={(e) => setNewTagline(e.target.value)}
                                            placeholder="Enter witty tagline..."
                                            className="flex-1 p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                        />
                                        <Button onClick={updateTagline} disabled={!newTagline.trim()} className="bg-[#2E7D32] dark:bg-[#7C3AED] text-white hover:opacity-90 shadow-md">
                                            Update Tagline
                                        </Button>
                                    </div>
                                    <p className="text-xs text-zinc-500 font-medium mt-1">
                                        This text replaces the default subtitle displayed on the main landing and user dashboard pages.
                                    </p>
                                </div>

                                {/* Gemini Config */}
                                <div className="space-y-4 pt-6 border-t border-zinc-200 dark:border-white/10">
                                    <label className="text-xs font-bold text-[#6B6B6B] dark:text-[#8B8BAD] uppercase tracking-widest block">Gemini AI API Key(s)</label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input
                                            type="password"
                                            value={newApiKey}
                                            onChange={(e) => setNewApiKey(e.target.value)}
                                            placeholder="Enter Gemini API Key(s)..."
                                            className="flex-1 p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] dark:focus:border-[#7C3AED] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                        />
                                        <Button onClick={() => updateApiKey('gemini')} className="bg-[#2E7D32] dark:bg-[#7C3AED] text-white hover:opacity-90 shadow-md">
                                            Save Gemini Key
                                        </Button>
                                    </div>
                                    <p className="text-xs text-zinc-500 font-medium mt-1">
                                        Required for advanced meal analysis and tips. You can paste multiple keys separated by commas.
                                    </p>
                                </div>

                                {/* CalorieNinjas Config */}
                                <div className="space-y-4 pt-6 border-t border-zinc-200 dark:border-white/10">
                                    <label className="text-xs font-bold text-[#6B6B6B] dark:text-[#8B8BAD] uppercase tracking-widest block">CalorieNinjas API Key (Nutrition Data)</label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input
                                            type="password"
                                            value={newCalorieApiKey}
                                            onChange={(e) => setNewCalorieApiKey(e.target.value)}
                                            placeholder="Enter CalorieNinjas API Key..."
                                            className="flex-1 p-3 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl outline-none focus:border-[#2E7D32] dark:focus:border-[#7C3AED] focus:ring-2 focus:ring-[#2E7D32]/20 text-zinc-900 dark:text-white placeholder-zinc-500 transition-colors shadow-inner"
                                        />
                                        <Button onClick={() => updateApiKey('calorie')} className="bg-[#2E7D32] dark:bg-[#7C3AED] text-white hover:opacity-90 shadow-md">
                                            Save Calorie Key
                                        </Button>
                                    </div>
                                    <p className="text-xs text-zinc-500 font-medium mt-1">
                                        Required for primary nutritional data extraction.
                                    </p>
                                </div>

                                {/* Mess Timings Config */}
                                <div className="space-y-6 pt-10 border-t border-zinc-200 dark:border-white/10 mt-10">
                                    <h4 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg flex items-center gap-2">
                                        <Clock4 size={20} className="text-[#2E7D32] dark:text-[#A78BFA]" /> Permanent Mess Timings
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {MEAL_ORDER.map(meal => (
                                            <div key={meal} className="bg-zinc-50 dark:bg-black/20 p-4 rounded-2xl border border-zinc-100 dark:border-white/5">
                                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">{meal}</label>
                                                <div className="space-y-3">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-zinc-500 block mb-1">START</span>
                                                        <input
                                                            type="time"
                                                            value={editTimings[meal]?.start || ''}
                                                            onChange={(e) => setEditTimings(prev => ({ ...prev, [meal]: { ...prev[meal], start: e.target.value } }))}
                                                            className="w-full p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:border-[#2E7D32]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold text-zinc-500 block mb-1">END</span>
                                                        <input
                                                            type="time"
                                                            value={editTimings[meal]?.end || ''}
                                                            onChange={(e) => setEditTimings(prev => ({ ...prev, [meal]: { ...prev[meal], end: e.target.value } }))}
                                                            className="w-full p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:border-[#2E7D32]"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button onClick={updateTimings} className="bg-[#2E7D32] dark:bg-[#7C3AED] text-white w-full sm:w-auto px-10">
                                        Save Permanent Timings
                                    </Button>

                                    {/* Temporary Overrides */}
                                    <div className="pt-10 border-t border-zinc-200 dark:border-white/10">
                                        <h4 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg flex items-center gap-2 mb-6">
                                            <AlertTriangle size={20} className="text-warning" /> Temporary Timing Overrides
                                        </h4>
                                        <div className="bg-zinc-50 dark:bg-black/20 p-6 rounded-3xl border border-zinc-100 dark:border-white/5 space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                                <Select
                                                    label="Meal"
                                                    value={newOverride.mealType}
                                                    onChange={(val) => setNewOverride(prev => ({ ...prev, mealType: val }))}
                                                    options={MEAL_ORDER.map(m => ({ value: m, label: m }))}
                                                />
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={newOverride.startDate}
                                                        onChange={(e) => setNewOverride(prev => ({ ...prev, startDate: e.target.value }))}
                                                        className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#2E7D32]"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">End Date</label>
                                                    <input
                                                        type="date"
                                                        value={newOverride.endDate}
                                                        onChange={(e) => setNewOverride(prev => ({ ...prev, endDate: e.target.value }))}
                                                        className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#2E7D32]"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">New Start</label>
                                                    <input
                                                        type="time"
                                                        value={newOverride.start}
                                                        onChange={(e) => setNewOverride(prev => ({ ...prev, start: e.target.value }))}
                                                        className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#2E7D32]"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">New End</label>
                                                    <input
                                                        type="time"
                                                        value={newOverride.end}
                                                        onChange={(e) => setNewOverride(prev => ({ ...prev, end: e.target.value }))}
                                                        className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#2E7D32]"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <Button onClick={addTimingOverride} className="w-full bg-[#2E7D32] dark:bg-[#7C3AED] text-white py-3">Add</Button>
                                                </div>
                                            </div>

                                            {/* Existing Overrides List */}
                                            <div className="space-y-2 mt-6">
                                                {config?.timingOverrides?.map(o => (
                                                    <div key={o.id} className="flex justify-between items-center bg-white dark:bg-white/5 p-4 rounded-2xl border border-zinc-200 dark:border-white/10">
                                                        <div>
                                                            <span className="text-xs font-black text-[#2E7D32] dark:text-[#A78BFA] uppercase tracking-widest">{o.mealType}</span>
                                                            <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
                                                                {o.start} - {o.end}
                                                            </p>
                                                            <p className="text-[10px] text-zinc-500 font-medium">
                                                                {o.startDate} to {o.endDate}
                                                            </p>
                                                        </div>
                                                        <button onClick={() => deleteTimingOverride(o.id)} className="text-error hover:bg-error/10 p-2 rounded-xl transition-colors">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {(!config?.timingOverrides || config.timingOverrides.length === 0) && (
                                                    <p className="text-center text-xs text-zinc-400 font-medium py-4 italic">No active overrides</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* System Maintenance & Demo Data */}
                            <Card className="flex flex-col md:col-span-2 mt-6 bg-white dark:bg-[#16162A] border border-amber-500/20 dark:border-amber-300/20">
                                <h3 className="font-heading font-bold text-[#0D0D0D] dark:text-white text-lg tracking-tight mb-4 flex items-center gap-2">
                                    <ShieldAlert className="text-amber-500" size={20} />
                                    System Maintenance & Demo Tools
                                </h3>
                                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-4">
                                    Use these tools at the end of each cycle to clean up old ratings/proofs, or quickly seed demo menus. These actions no longer lock the admin interface.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/40 rounded-2xl p-4 flex flex-col gap-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">All Maintenance</h4>
                                        <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
                                            Runs both ratings reset and proofs cleanup if they are due.
                                        </p>
                                        <Button
                                            onClick={handleAllMaintenanceCleanup}
                                            className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5"
                                        >
                                            Run All Maintenance
                                        </Button>
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Ratings Only</h4>
                                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                            Backup and clear rating data for the last period when required.
                                        </p>
                                        <Button
                                            onClick={() => handleMaintenanceCleanup('ratings')}
                                            className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5"
                                        >
                                            Ratings Maintenance
                                        </Button>
                                    </div>

                                    <div className="bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Proofs Only</h4>
                                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                            Backup and clear complaint proofs for the previous month.
                                        </p>
                                        <Button
                                            onClick={() => handleMaintenanceCleanup('proofs')}
                                            className="mt-2 w-full bg-primary hover:bg-primary-dark text-white font-black py-2.5"
                                        >
                                            Proofs Maintenance
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-white/10">
                                    <h4 className="font-heading font-semibold text-[#0D0D0D] dark:text-white mb-2 text-sm tracking-tight flex items-center gap-2">
                                        <Sparkles size={16} className="text-primary" />
                                        Demo Menus for March 8–10
                                    </h4>
                                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-3">
                                        Quickly seed temporary demo menus for all hostels and all mess types on March 8, 9, and 10 of this year.
                                    </p>
                                    <Button
                                        onClick={async () => {
                                            try {
                                                setShowBouncingLogo(true);
                                                const year = new Date().getFullYear();
                                                const demoDays = [8, 9, 10];
                                                const hostels = config?.hostels || DEFAULT_HOSTELS;
                                                const messTypes = config?.messTypes || DEFAULT_MESS_TYPES;

                                                const batch = writeBatch(db);

                                                demoDays.forEach(day => {
                                                    const dateObj = new Date(year, 2, day); // March is 2 (0-based)
                                                    const dateString = dateObj.toLocaleDateString('en-CA');

                                                    hostels.forEach(h => {
                                                        messTypes.forEach(m => {
                                                            const docId = `${h}_${m}_${dateString}`;
                                                            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'menus', docId);
                                                            batch.set(docRef, {
                                                                date: dateString,
                                                                hostel: h,
                                                                messType: m,
                                                                breakfast: 'Demo Breakfast Menu',
                                                                lunch: 'Demo Lunch Menu',
                                                                snacks: 'Demo Snacks Menu',
                                                                dinner: 'Demo Dinner Menu',
                                                                updatedAt: serverTimestamp(),
                                                                updatedBy: user.uid
                                                            }, { merge: true });
                                                        });
                                                    });
                                                });

                                                await batch.commit();
                                                toast.success("Demo menus created for March 8–10.");
                                            } catch (e) {
                                                console.error("Demo menu creation failed:", e);
                                                toast.error("Failed to create demo menus.");
                                            } finally {
                                                setShowBouncingLogo(false);
                                            }
                                        }}
                                        className="bg-primary hover:bg-primary-dark text-white font-black px-6"
                                    >
                                        Create Demo Menus
                                    </Button>
                                </div>
                            </Card>
                        </div >
                    </div >
                );

            case 'profile':
                return (
                    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in mt-4 pb-24">
                        <Card className="bg-white dark:bg-[#16162A] border border-zinc-200 dark:border-white/10 shadow-sm p-8">
                            <div className="flex items-center justify-center flex-col text-center mb-8">
                                <div className="w-24 h-24 rounded-full p-1 border-2 border-[#2E7D32] dark:border-[#7C3AED] relative mb-4 shadow-sm">
                                    <div className="absolute inset-0 border-2 border-[#2E7D32] dark:border-[#7C3AED] rounded-full animate-[spin_4s_linear_infinite] border-t-transparent border-l-transparent"></div>
                                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${settings?.avatar || userData?.avatar || 'boy'}`} alt="Avatar" className="w-full h-full object-cover rounded-full bg-zinc-100 dark:bg-black/40" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-heading font-bold text-[#0D0D0D] dark:text-[#F0F0FF] tracking-tight">{userData?.name}</h3>
                                    <p className="text-[#6B6B6B] dark:text-[#8B8BAD] font-medium my-1">{user?.email}</p>
                                    <Badge variant={userData?.role} className="mt-2">{userData?.role?.toUpperCase()}</Badge>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between p-4 bg-[#F7F7F7] dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-2xl">
                                    <span className="text-sm font-bold text-[#6B6B6B] dark:text-[#8B8BAD] uppercase tracking-widest">Hostel</span>
                                    <span className="text-sm font-semibold text-[#0D0D0D] dark:text-[#F0F0FF]">{userData?.hostel || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between p-4 bg-[#F7F7F7] dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-2xl">
                                    <span className="text-sm font-bold text-[#6B6B6B] dark:text-[#8B8BAD] uppercase tracking-widest">Mess Type</span>
                                    <span className="text-sm font-semibold text-[#0D0D0D] dark:text-[#F0F0FF]">{userData?.messType || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="space-y-4 mt-8 pt-6 border-t border-zinc-200 dark:border-white/10">
                                <h4 className="font-heading font-semibold text-[#0D0D0D] dark:text-[#F0F0FF] mb-2 text-lg tracking-tight text-left">App Settings</h4>

                                <button
                                    onClick={() => setIsFeedbackOpen(true)}
                                    className="w-full flex items-center justify-between p-4 bg-[#F7F7F7] dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-2xl hover:border-[#2E7D32] dark:hover:border-[#7C3AED] transition-colors shadow-sm"
                                >
                                    <span className="text-sm font-bold text-[#0D0D0D] dark:text-white flex items-center gap-2"><MessageSquare size={18} className="text-[#2E7D32] dark:text-[#7C3AED]" /> Report Bug / Feedback</span>
                                </button>

                                {/* Profile Tagline */}
                                <div className="text-center py-2 opacity-100">
                                    <p className="text-[10px] font-bold text-[#0D0D0D] dark:text-white tracking-widest uppercase">
                                        {config?.tagline || DEFAULT_TAGLINE}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-[#F7F7F7] dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-2xl">
                                    <span className="text-sm font-bold text-[#6B6B6B] dark:text-[#8B8BAD] uppercase tracking-widest flex items-center gap-2">
                                        Appearance
                                    </span>
                                    <div className="flex items-center gap-2 bg-zinc-200 dark:bg-black/40 p-1 rounded-full">
                                        <button
                                            onClick={() => updateSettings?.({ darkMode: false })}
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!settings?.darkMode ? 'bg-white text-[#0D0D0D] shadow-sm' : 'text-zinc-500'}`}
                                        >
                                            Light
                                        </button>
                                        <button
                                            onClick={() => updateSettings?.({ darkMode: true })}
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${settings?.darkMode ? 'bg-[#D4F000] text-[#0D0D0D] shadow-sm' : 'text-zinc-500'}`}
                                        >
                                            Dark
                                        </button>
                                    </div>
                                </div>

                                {/* Avatar Selection */}
                                <div className="space-y-2 p-4 bg-[#F7F7F7] dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-2xl flex flex-col items-center">
                                    <label className="text-xs font-bold text-[#6B6B6B] dark:text-[#8B8BAD] uppercase tracking-widest block mb-1">Avatar Selection</label>
                                    <div className="flex gap-6 mt-2">
                                        <button
                                            onClick={() => updateSettings?.({ avatar: 'boy' })}
                                            className={`w-16 h-16 rounded-full transition-all duration-300 ${settings?.avatar === 'boy' ? 'ring-4 ring-[#2E7D32] dark:ring-[#7C3AED] ring-offset-2 dark:ring-offset-black scale-110 shadow-lg' : 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                        >
                                            <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=boy`} alt="Boy Avatar" className="w-full h-full object-cover rounded-full bg-zinc-200 dark:bg-zinc-800" />
                                        </button>
                                        <button
                                            onClick={() => updateSettings?.({ avatar: 'girl' })}
                                            className={`w-16 h-16 rounded-full transition-all duration-300 ${settings?.avatar === 'girl' ? 'ring-4 ring-[#2E7D32] dark:ring-[#7C3AED] ring-offset-2 dark:ring-offset-black scale-110 shadow-lg' : 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                        >
                                            <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=girl`} alt="Girl Avatar" className="w-full h-full object-cover rounded-full bg-zinc-200 dark:bg-zinc-800" />
                                        </button>
                                    </div>
                                </div>

                                {/* Font Scale Slider Redesign */}
                                <div className="space-y-4 p-5 bg-[#F7F7F7] dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-2xl">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-zinc-100 dark:bg-white/5 rounded-lg">
                                                <FileText size={14} className="text-zinc-500" />
                                            </div>
                                            <span className="text-sm font-bold text-[#6B6B6B] dark:text-[#8B8BAD] uppercase tracking-widest">Adjust Text Size</span>
                                        </div>
                                        <span className="text-sm font-black text-[#2E7D32] dark:text-[#7C3AED] bg-white dark:bg-white/5 px-2 py-0.5 rounded-lg border border-black/5 dark:border-white/10">{Math.round(settings?.fontScale * 100)}%</span>
                                    </div>
                                    <div className="relative pt-2 group">
                                        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-zinc-200 dark:bg-black/40 rounded-full overflow-hidden">
                                            <div
                                                className="h-full transition-all duration-300"
                                                style={{
                                                    width: `${((settings?.fontScale - 0.8) / (1.3 - 0.8)) * 100}%`,
                                                    backgroundColor: settings?.darkMode ? '#7C3AED' : '#2E7D32'
                                                }}
                                            />
                                        </div>
                                        <input
                                            type="range"
                                            min="0.8" max="1.3" step="0.05"
                                            value={settings?.fontScale || 1.0}
                                            onChange={(e) => updateSettings?.({ fontScale: parseFloat(e.target.value) })}
                                            className="relative z-10 w-full h-1.5 bg-transparent appearance-none cursor-pointer outline-none slider-admin-premium"
                                        />
                                        <style>{`
                                            .slider-admin-premium::-webkit-slider-thumb {
                                                -webkit-appearance: none;
                                                appearance: none;
                                                width: 22px;
                                                height: 22px;
                                                background: white;
                                                border: 4px solid ${settings?.darkMode ? '#7C3AED' : '#2E7D32'};
                                                border-radius: 50%;
                                                cursor: grab;
                                                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                                transition: all 0.2s ease;
                                            }
                                            .slider-admin-premium::-webkit-slider-thumb:hover {
                                                transform: scale(1.15);
                                            }
                                            .slider-admin-premium::-webkit-slider-thumb:active {
                                                cursor: grabbing;
                                                transform: scale(0.95);
                                            }
                                            .dark .slider-admin-premium::-webkit-slider-thumb {
                                                background: #1A1A1A;
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

                            <Button
                                onClick={() => setShowProfileEdit(true)}
                                className="w-full mt-6 py-4 text-base font-bold bg-[#0D0D0D] dark:bg-white text-white dark:text-[#0D0D0D] border border-[#0D0D0D] dark:border-white hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-md active:scale-[0.98]"
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
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen w-full flex overflow-hidden
                        bg-[#F7F7F7] dark:bg-[#0D0D14]
                        text-[#0D0D0D] dark:text-[#F0F0FF] selection:bg-[#2E7D32]/20 dark:selection:bg-[#7C3AED]/20">

            <OfflineIndicator />

            {/* ── MAINTENANCE REMINDER POPUP (NON-BLOCKING) ───────────── */}
            {maintenanceStatus.lock && showMaintenancePopup && (
                <div className="fixed bottom-5 right-5 z-[90] w-full max-w-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-2xl shadow-2xl p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-amber-500/10">
                                    <ShieldAlert size={20} className="text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-heading font-black text-[#0D0D0D] dark:text-white tracking-tight">
                                        Maintenance due soon
                                    </h3>
                                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                                        Some periodic maintenance tasks are pending. You can continue using the dashboard and run them from Settings when ready.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowMaintenancePopup(false)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white text-xs font-bold uppercase tracking-widest"
                            >
                                Close
                            </button>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <Button
                                onClick={() => {
                                    setActiveTab('settings');
                                    setShowMaintenancePopup(false);
                                }}
                                className="flex-1 py-2 text-xs font-bold"
                            >
                                Go to Maintenance
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setShowMaintenancePopup(false)}
                                className="px-3 py-2 text-[11px] font-bold"
                            >
                                Later
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* Mobile Sidebar Toggle */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 bg-white dark:bg-[#1E1E35] text-[#0D0D0D] dark:text-white p-2 rounded-xl border border-[#EEEEEE] dark:border-[#1E1E2E] shadow-sm"
            >
                <MenuIcon size={22} />
            </button>

            {/* Mobile Sidebar Overlay Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ── SIDEBAR ───────────────────────────────────────── */}
            <aside className={`
                fixed lg:relative inset-y-0 left-0 z-40 w-72
                bg-white dark:bg-[#0D0D0D]
                border-r border-[#E4E4E4] dark:border-[#2A2A2A]
                text-[#0D0D0D] dark:text-white
                flex flex-col shadow-card-md dark:shadow-card-dark
                transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EEEEEE] dark:border-[#1E1E2E]">
                    <motion.img
                        layoutId="logo"
                        src="/pwa.png" alt="MessMeal Logo"
                        className="w-8 h-8 object-contain flex-shrink-0"
                        onError={(e) => { e.target.src = '/pwa-512x512.png'; }}
                    />
                    <div>
                        <h1 className="text-xl tracking-tight text-[#0D0D0D] dark:text-[#F0F0FF] leading-none">
                            <span className="font-brand-mess font-bold text-[#0057FF] dark:text-white">Mess</span>
                            <span className="font-brand-meal text-[#2E7D32] dark:text-[#7C3AED]">Meal</span>
                        </h1>
                        <p className="inline-block text-[7px] font-black uppercase tracking-[0.15em] text-[#0057FF] bg-[#0057FF]/10 px-1.5 py-0.4 rounded -mt-0.5 opacity-100 leading-none">eat on time be on time</p>
                        <p className="text-[10px] text-[#6B6B6B] dark:text-[#8B8BAD] truncate max-w-[140px]">{user?.email}</p>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-hide mt-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#A0A0A0] dark:text-[#8B8BAD] px-4 pt-2 pb-1">MENU</p>
                    {navItems.slice(0, 4).map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setIsSidebarOpen(window.innerWidth >= 1024); }}
                            className={`w-full flex items-center gap-3 py-2.5 rounded-lg transition-all duration-150 outline-none text-sm font-semibold relative ${activeTab === item.id
                                ? 'px-[14px] bg-[#E8F5E9] text-[#1B5E20] dark:bg-[#1E1E35] dark:text-[#F0F0FF] border-l-4 border-[#2E7D32] dark:border-[#7C3AED]'
                                : 'px-[18px] text-[#6B6B6B] dark:text-[#8B8BAD] hover:bg-[#F7F7F7] dark:hover:bg-[#1E1E2E] hover:text-[#0D0D0D] dark:hover:text-[#F0F0FF]'
                                }`}>
                            <item.icon size={15} />
                            <span>{item.label}</span>
                            {item.id === 'proofs' && stats.pendingProofs > 0 && (
                                <span className="ml-auto bg-error text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">{stats.pendingProofs}</span>
                            )}
                            {item.id === 'feedback' && stats.pendingReports > 0 && (
                                <span className="ml-auto bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">{stats.pendingReports}</span>
                            )}
                            {item.id === 'users' && stats.pendingUsers > 0 && (
                                <span className="ml-auto bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">{stats.pendingUsers}</span>
                            )}
                        </button>
                    ))}
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#A0A0A0] dark:text-[#8B8BAD] px-4 pt-4 pb-1">GENERAL</p>
                    {navItems.slice(4).map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setIsSidebarOpen(window.innerWidth >= 1024); }}
                            className={`w-full flex items-center gap-3 py-2.5 rounded-lg transition-all duration-150 outline-none text-sm font-semibold relative ${activeTab === item.id
                                ? 'px-[14px] bg-[#E8F5E9] text-[#1B5E20] dark:bg-[#1E1E35] dark:text-[#F0F0FF] border-l-4 border-[#2E7D32] dark:border-[#7C3AED]'
                                : 'px-[18px] text-[#6B6B6B] dark:text-[#8B8BAD] hover:bg-[#F7F7F7] dark:hover:bg-[#1E1E2E] hover:text-[#0D0D0D] dark:hover:text-[#F0F0FF]'
                                }`}>
                            <item.icon size={15} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-3 border-t border-[#EEEEEE] dark:border-[#1E1E2E] space-y-0.5">
                    <button onClick={onSwitchToUser}
                        className="w-full flex items-center gap-2.5 px-[18px] py-2.5 rounded-lg text-[#6B6B6B] dark:text-[#8B8BAD] hover:bg-[#F7F7F7] dark:hover:bg-[#1E1E2E] hover:text-[#2E7D32] dark:hover:text-[#7C3AED] transition-colors font-semibold text-sm">
                        <LayoutDashboard size={15} /> <span>User View</span>
                    </button>
                    <button onClick={onLogout}
                        className="w-full flex items-center gap-2.5 px-[18px] py-2.5 rounded-lg text-error hover:bg-error/10 transition-colors font-semibold text-sm">
                        <LogOut size={15} /> <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Overlay for mobile — duplicate removed, handled above */}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden z-10 relative bg-[#F7F7F7] dark:bg-[#0D0D14]">
                {/* Top header */}
                <header className="h-14 shrink-0 sticky top-0 z-30
                                   bg-white dark:bg-[#11111C]
                                   border-b border-[#EEEEEE] dark:border-[#1E1E2E]
                                   flex items-center px-4 lg:px-8 justify-between shadow-sm">
                    <div className="flex-1 lg:hidden" />
                    <h2 className="flex items-center gap-2 text-sm font-black text-[#0D0D0D] dark:text-[#F0F0FF] tracking-tight">
                        <div className="p-1.5 rounded-lg bg-[#E8F5E9] dark:bg-[#1E1E35]">
                            {(() => {
                                const ai = navItems.find(t => t.id === activeTab);
                                return ai?.icon ? <ai.icon size={16} className="text-[#2E7D32] dark:text-[#7C3AED]" /> : null;
                            })()}
                        </div>
                        <span className="hidden sm:inline">{navItems.find(t => t.id === activeTab)?.label}</span>
                    </h2>
                    <div className="flex-1 flex justify-center items-center">
                        <div className="bg-zinc-100 dark:bg-[#1E1E35] px-4 py-1.5 rounded-full border border-zinc-200 dark:border-[#1E1E2E] flex items-center gap-3">
                            <Clock4 size={14} className="text-[#2E7D32] dark:text-[#7C3AED]" />
                            <span className="text-xs font-black text-[#0D0D0D] dark:text-[#F0F0FF] tracking-widest tabular-nums uppercase">
                                {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 flex justify-end items-center gap-2">
                        <button onClick={() => window.location.reload()}
                            className="p-2 bg-[#F7F7F7] dark:bg-[#1E1E35] border border-[#EEEEEE] dark:border-[#1E1E2E] rounded-lg text-[#6B6B6B] dark:text-[#8B8BAD] hover:text-[#2E7D32] dark:hover:text-[#7C3AED] transition-colors">
                            <RefreshCw size={15} />
                        </button>
                        <Badge variant={isSuperAdmin ? 'super_admin' : 'admin'}>
                            {isSuperAdmin ? <><Crown size={11} className="mr-1 inline" /> SUPER ADMIN</> : 'ADMIN'}
                        </Badge>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 animate-fade-in pb-32">
                    <div className="max-w-7xl mx-auto">
                        {renderContent()}
                    </div>
                </div>
            </main>

            {/* Full Screen Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <img
                        src={selectedImage}
                        alt="Full view"
                        className="max-w-full max-h-[85vh] object-contain rounded-lg"
                        onClick={e => e.stopPropagation()}
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                downloadImage(selectedImage, 'complaint-image.png');
                            }}
                            className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg flex items-center gap-2 font-medium"
                            title="Download"
                        >
                            <Download size={20} /> <span className="hidden sm:inline">Download</span>
                        </button>
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                {...confirmModal}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            <UnifiedFeedbackModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                initialEmail={user?.email || ''}
                config={config}
            />
            <SuccessModal
                {...successModal}
                onConfirm={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};
