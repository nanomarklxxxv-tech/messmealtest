import React, { useState } from 'react';
import { User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from './ui/Button';
import { DEFAULT_HOSTELS, DEFAULT_MESS_TYPES } from '../lib/constants';

export const ProfileSetupScreen = ({ user, userData, onComplete, config, isReadOnly = false }) => {
    const defaultHostels = config?.hostels || DEFAULT_HOSTELS;
    const defaultMessTypes = config?.messTypes || DEFAULT_MESS_TYPES;
    
    // Check if user is a super admin
    const isSuperAdmin = userData?.role === 'super_admin';
    
    // Committee users can change their regular hostel, but checklist hostel is locked to assignedCommitteeHostel
    const isCommitteeUser = userData?.committeeRole;
    const hasAssignedCommitteeHostel = userData?.assignedCommitteeHostel ? true : false;
    const hostelLockReason = userData?.hostelLockedReason;
    const isHostelLocked = Boolean(userData?.hostelLockedAt && userData?.role !== 'super_admin');

    const [name] = useState(userData?.name || user?.displayName || user?.email?.split('@')[0] || '');
    const [avatar, setAvatar] = useState(userData?.avatar || 'boy');
    const [hostel, setHostel] = useState(userData?.hostel || (config?.hostels?.length > 0 ? config.hostels[0] : (DEFAULT_HOSTELS[0])));
    const [messType, setMessType] = useState(userData?.messType || (config?.messTypes?.length > 0 ? config.messTypes[0] : (DEFAULT_MESS_TYPES[0])));
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [studyingYear, setStudyingYear] = useState(userData?.studyingYear || '1');
    const [registrationId, setRegistrationId] = useState(userData?.registrationId || '');
    const [registrationIdError, setRegistrationIdError] = useState('');

    const handleSubmit = async () => {
        if (!name.trim() || name.trim().length < 2) {
            toast.error("Please enter a valid name (min. 2 characters)");
            return;
        }
        if (!hostel || !messType) {
            toast.error("Please select hostel and mess type");
            return;
        }
        setLoading(true);
        try {
            // Sanitize and validate all inputs
            const sanitizedName = name.trim().substring(0, 100);
            const sanitizedHostel = String(hostel).trim().toUpperCase().substring(0, 50);
            const sanitizedMessType = String(messType).trim().toUpperCase().substring(0, 50);
            const sanitizedRegId = registrationId.trim().toUpperCase().substring(0, 20);
            
            const payload = {
                name: sanitizedName,
                hostel: sanitizedHostel,
                messType: sanitizedMessType,
                avatar,
                registrationId: sanitizedRegId,
                ...(userData?.role !== 'faculty' && { studyingYear }),
                updatedAt: new Date().toISOString()
            };
            await onComplete(payload);
            toast.success('Profile updated successfully!');
        } catch (error) {
            console.error('Profile submission error:', error);
            // Error toast handled by handleProfileComplete in App.jsx
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-page flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 p-8 rounded-3xl w-full max-w-md shadow-xl">
                <div className="text-center mb-10">
                    <h1 className="font-heading text-4xl font-extrabold text-dark dark:text-white tracking-tighter mb-3">Complete Profile</h1>
                    <p className="text-zinc-500 font-medium">Step {step} of 2</p>
                </div>

                {step === 1 ? (
                    <div className="space-y-8">
                        {/* Avatar Selection floating glass pane */}
                        <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-6 border border-black/5 dark:border-white/5 flex flex-col justify-center items-center gap-4">
                            <label className="text-xs font-bold text-mid uppercase tracking-widest">Select Your Avatar</label>
                            <div className="flex gap-8">
                                <button
                                    onClick={() => !isReadOnly && setAvatar('boy')}
                                    className={`w-20 h-20 rounded-full transition-all duration-300 ${isReadOnly ? 'cursor-default' : ''} ${avatar === 'boy' ? 'ring-4 ring-primary ring-offset-2 ring-offset-page scale-110 shadow-glow' : 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                >
                                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=boy`} alt="Boy Avatar" className="w-full h-full object-cover rounded-full bg-white/10" />
                                </button>
                                <button
                                    onClick={() => !isReadOnly && setAvatar('girl')}
                                    className={`w-20 h-20 rounded-full transition-all duration-300 ${isReadOnly ? 'cursor-default' : ''} ${avatar === 'girl' ? 'ring-4 ring-primary ring-offset-2 ring-offset-page scale-110 shadow-glow' : 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                >
                                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=girl`} alt="Girl Avatar" className="w-full h-full object-cover rounded-full bg-slate-100 dark:bg-white/10" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 opacity-70">Full Name</label>
                                <div className="w-full bg-slate-50 dark:bg-black/20 border-b-2 border-primary/20 text-dark dark:text-white text-lg py-3 px-1 font-bold opacity-80 cursor-not-allowed">
                                    {name}
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-1 font-medium italic">Name is automatically extracted and non-editable.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 opacity-70">Email ID</label>
                                <div className="w-full bg-slate-50 dark:bg-black/20 border-b-2 border-primary/20 text-dark dark:text-white text-lg py-3 px-1 font-bold opacity-80 cursor-not-allowed">
                                    {user?.email}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black
                                    text-primary uppercase tracking-[0.2em]
                                    mb-1 opacity-70">
                                    {userData?.role === 'faculty'
                                        ? 'Employee ID' : 'Registration Number'}
                                </label>
                                <input
                                    type="text"
                                    value={registrationId}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setRegistrationId(val);
                                        setRegistrationIdError('');
                                    }}
                                    placeholder={userData?.role === 'faculty'
                                        ? 'e.g. EMP1234'
                                        : 'e.g. 23BCEXXXXX'}
                                    className="w-full bg-slate-50 dark:bg-black/20
                                        border-b-2 border-primary/40
                                        focus:border-primary text-dark dark:text-white
                                        text-lg py-3 px-1 font-bold outline-none
                                        transition-colors"
                                />
                                {registrationIdError && (
                                    <p className="text-[11px] text-red-500
                                        mt-1 font-bold">
                                        {registrationIdError}
                                    </p>
                                )}
                                {userData?.role !== 'faculty' && (
                                    <p className="text-[10px] text-zinc-400
                                        mt-1 font-medium italic">
                                        Format: 23BCEXXXXX
                                        (2 digits + 3 letters + 4-5 digits)
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button
                            onClick={() => {
                                if (!name.trim()) {
                                    toast.error("Please enter your name");
                                    return;
                                }

                                if (userData?.role !== 'faculty') {
                                    const regPattern = /^\d{2}[A-Z]{3}\d{4,5}$/;
                                    if (!registrationId.trim()) {
                                        setRegistrationIdError(
                                            'Registration number is required.'
                                        );
                                        return;
                                    }
                                    if (!regPattern.test(registrationId.trim())) {
                                        setRegistrationIdError(
                                            'Invalid format. Use format like 23BCEXXXXX'
                                        );
                                        return;
                                    }
                                } else {
                                    if (!registrationId.trim()) {
                                        setRegistrationIdError(
                                            'Employee ID is required.'
                                        );
                                        return;
                                    }
                                }

                                setStep(2);
                            }}
                            className="w-full py-3.5"
                            disabled={!name.trim()}
                        >
                            Continue
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest">Select Hostel</label>
                                {isCommitteeUser && hasAssignedCommitteeHostel && (
                                    <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full flex items-center gap-1">
                                        🔒 Checklist Locked
                                    </span>
                                )}
                            </div>
                            {isCommitteeUser && hasAssignedCommitteeHostel && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 italic bg-amber-50 dark:bg-amber-500/10 p-2 rounded">
                                    ℹ️ You can change your hostel anytime, but your checklist hostel is locked to <strong>{userData?.assignedCommitteeHostel}</strong> (assigned by admin). Only admins can change the checklist hostel.
                                </p>
                            )}
                            {isHostelLocked && (
                                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 italic bg-amber-50 dark:bg-amber-500/10 p-2 rounded">
                                    🔒 Your hostel is locked by an admin. If this looks wrong, contact support.
                                </p>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                                {defaultHostels.map(h => (
                                    <button
                                        key={h}
                                        onClick={() => !isReadOnly && setHostel(h)}
                                        disabled={isReadOnly || isHostelLocked}
                                        className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 border min-h-[44px] flex items-center justify-center ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'} ${hostel === h ? 'bg-primary/20 text-primary border-primary shadow-sm scale-[1.02]' : 'bg-black/5 dark: text-mid dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-dark dark:hover:text-white border-black/10 dark:border-white/10'}`}
                                    >
                                        {h}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Select Mess Type</label>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                {defaultMessTypes.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => !isReadOnly && setMessType(t)}
                                        className={`p-4 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 border min-h-[44px] flex items-center justify-center ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${messType === t ? 'bg-primary/20 text-primary border-primary shadow-sm scale-[1.02]' : 'bg-black/5 dark: text-mid dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-dark dark:hover:text-white border-black/10 dark:border-white/10'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {userData?.role !== 'faculty' && (
                            <div>
                                <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Studying Year</label>
                                <div className="flex gap-1 sm:gap-2">
                                    {['1', '2', '3', '4', '5'].map(year => (
                                        <button
                                            key={year}
                                            onClick={() => !isReadOnly && setStudyingYear(year)}
                                            className={`flex-1 p-3 rounded-xl text-xs sm:text-sm font-bold transition-all border min-h-[44px] flex items-center justify-center ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${studyingYear === year ? 'bg-primary/20 text-primary border-primary' : 'bg-black/5 dark:bg-white/5 border-transparent'}`}
                                        >
                                            {year}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4">
                            <Button onClick={() => setStep(1)} variant="secondary" className="flex-1 min-h-[44px]">Back</Button>
                            {!isReadOnly && (
                                <Button
                                    onClick={handleSubmit}
                                    className="flex-1 min-h-[44px]"
                                    loading={loading}
                                >
                                    Complete Entry
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Copyright Footer */}
            <div className="fixed bottom-4 left-0 right-0 flex justify-center">
                <p className="text-xs text-center text-zinc-600 dark:text-zinc-400">
                    © {new Date().getFullYear()} MessMeal. All rights reserved
                </p>
            </div>
        </div>
    );
};
