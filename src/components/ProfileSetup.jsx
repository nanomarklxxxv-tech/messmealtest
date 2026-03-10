import React, { useState } from 'react';
import { User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from './ui/Button';
import { DEFAULT_HOSTELS, DEFAULT_MESS_TYPES } from '../lib/constants';

export const ProfileSetupScreen = ({ user, userData, onComplete, theme = 'orange', config, isReadOnly = false }) => {
    const defaultHostels = config?.hostels || DEFAULT_HOSTELS;
    const defaultMessTypes = config?.messTypes || DEFAULT_MESS_TYPES;

    const [name, setName] = useState(userData?.name || user?.displayName || user?.email?.split('@')[0] || '');
    const [avatar, setAvatar] = useState(userData?.avatar || 'boy');
    const [hostel, setHostel] = useState(userData?.hostel || (config?.hostels?.length > 0 ? config.hostels[0] : (DEFAULT_HOSTELS[0])));
    const [messType, setMessType] = useState(userData?.messType || (config?.messTypes?.length > 0 ? config.messTypes[0] : (DEFAULT_MESS_TYPES[0])));
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [studyingYear, setStudyingYear] = useState(userData?.studyingYear || '1');

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error("Please enter your name");
            return;
        }
        setLoading(true);
        const payload = {
            name: name.trim(),
            hostel: String(hostel).trim().toUpperCase(),
            messType: String(messType).trim().toUpperCase(),
            avatar,
            studyingYear
        };
        await onComplete(payload);
        setLoading(false);
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
                        </div>
                        <Button
                            onClick={() => {
                                if (name.trim()) setStep(2);
                                else toast.error("Please enter your name");
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
                            <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Select Hostel</label>
                            <div className="grid grid-cols-3 gap-3">
                                {defaultHostels.map(h => (
                                    <button
                                        key={h}
                                        onClick={() => !isReadOnly && setHostel(h)}
                                        className={`p-3 rounded-2xl text-sm font-bold transition-all duration-200 border ${isReadOnly ? 'cursor-default' : ''} ${hostel === h ? 'bg-primary/20 text-primary border-primary shadow-sm scale-[1.02]' : 'bg-black/5 dark: text-mid dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-dark dark:hover:text-white border-black/10 dark:border-white/10'}`}
                                    >
                                        {h}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Select Mess Type</label>
                            <div className="grid grid-cols-2 gap-3">
                                {defaultMessTypes.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => !isReadOnly && setMessType(t)}
                                        className={`p-4 rounded-2xl text-sm font-bold transition-all duration-200 border ${isReadOnly ? 'cursor-default' : ''} ${messType === t ? 'bg-primary/20 text-primary border-primary shadow-sm scale-[1.02]' : 'bg-black/5 dark: text-mid dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-dark dark:hover:text-white border-black/10 dark:border-white/10'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Studying Year</label>
                            <div className="flex gap-2">
                                {['1', '2', '3', '4', '5'].map(year => (
                                    <button
                                        key={year}
                                        onClick={() => !isReadOnly && setStudyingYear(year)}
                                        className={`flex-1 p-3 rounded-xl text-sm font-bold transition-all border ${isReadOnly ? 'cursor-default' : ''} ${studyingYear === year ? 'bg-primary/20 text-primary border-primary' : 'bg-black/5 dark:bg-white/5 border-transparent'}`}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button onClick={() => setStep(1)} variant="secondary" className="flex-1">Back</Button>
                            {!isReadOnly && (
                                <Button
                                    onClick={handleSubmit}
                                    className="flex-1"
                                    loading={loading}
                                >
                                    Complete Entry
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
