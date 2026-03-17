import React, { useState, useEffect, useRef } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, appId, messaging } from './lib/firebase';
import { getToken } from 'firebase/messaging';
import { INITIAL_SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAILS } from './lib/constants';
import { Toaster, toast } from 'react-hot-toast';
import { Shield } from 'lucide-react';

// Components
import { LandingPage } from './components/LandingPage';
import { ProfileSetupScreen } from './components/ProfileSetup';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { InstallAppModal } from './components/ui/InstallAppModal';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { SplashScreen } from './components/ui/SplashScreen';
import { motion, AnimatePresence } from 'framer-motion';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-red-500 bg-white min-h-screen">
          <h1 className="text-3xl font-bold">Application Error</h1>
          <pre className="mt-4 p-4 bg-red-50 text-sm overflow-auto text-left">
            {this.state.error?.toString()}{"\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [config, setConfig] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false); // true when non-VIT email signed in
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('messmeal_skip_splash');
    } catch {
      return true;
    }
  });

  const [viewMode, setViewMode] = useState('user'); // 'user' or 'admin'

  // Settings & Theme
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('messmeal_settings');
      return saved ? JSON.parse(saved) : { theme: 'blue', darkMode: false, fontScale: 1.0, avatar: 'boy' };
    } catch {
      return { theme: 'blue', darkMode: false, fontScale: 1.0, avatar: 'boy' };
    }
  });

  const updateSettings = (updates) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('messmeal_settings', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    // Remove all possible theme classes
    const themeClasses = ['theme-orange', 'theme-blue', 'theme-green', 'theme-purple', 'theme-indigo'];
    themeClasses.forEach(cls => root.classList.remove(cls));
    root.classList.remove('dark');

    // Apply current preferences
    if (settings.theme) root.classList.add(`theme-${settings.theme}`);
    if (settings.darkMode) root.classList.add('dark');
    root.style.fontSize = `${settings.fontScale * 16}px`;
  }, [settings.theme, settings.darkMode, settings.fontScale]);

  // Fetch Config
  useEffect(() => {
    let unsub = null;
    if (user) {
      unsub = onSnapshot(doc(db, 'artifacts', appId, 'config', 'settings'), (doc) => {
        if (doc.exists()) {
          setConfig(doc.data());
        }
      });
    } else {
      setConfig(null); // Clear config on logout
    }
    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  const onUpdateConfig = async (updates) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'config', 'settings'), updates, { merge: true });
      // toast.success("Settings updated"); // Dashboard already shows toast
    } catch (e) {
      console.error("Config update error:", e);
      toast.error("Failed to update global settings");
    }
  };

  // Auth & User Data Lifecycle
  useEffect(() => {
    let unsubscribeUser = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        localStorage.setItem('isLoggedIn', 'true');
        setUser(currentUser);

        // Instead of a single getDoc, let's listen to user document so changes reflect immediately
        if (unsubscribeUser) unsubscribeUser(); // cleanup old listener if it exists

        unsubscribeUser = onSnapshot(doc(db, 'artifacts', appId, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            // If super_admin, set admin view (handles page refresh)
            if (data.role === 'super_admin') setViewMode('admin');
          } else {
            setUserData(null);
          }
          setAuthLoading(false);
        }, (err) => {
          setAuthLoading(false);
        });
      } else {
        localStorage.removeItem('isLoggedIn');
        setUser(null);
        setUserData(null);
        setIsBlocked(false);
        setAuthLoading(false);
        if (unsubscribeUser) {
          unsubscribeUser();
          unsubscribeUser = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Request FCM Token
  useEffect(() => {
    if (user && userData && messaging && !userData.fcmToken) {
      const requestPermission = async () => {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const token = await getToken(messaging);
            if (token) {
              await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), { fcmToken: token }, { merge: true });
            }
          }
        } catch (error) {
          console.error("Error getting FCM token:", error);
        }
      };
      requestPermission();
    }
  }, [user, userData]);

  // Track user activity for real-time online status
  useEffect(() => {
    if (!user?.uid) return;

    const updateActivity = async () => {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
          lastActive: new Date().toISOString(),
          isOnline: true // Optional explicit flag
        }, { merge: true });
      } catch (e) {
        console.error("Failed to update activity:", e);
      }
    };

    updateActivity();
    const interval = setInterval(updateActivity, 2 * 60 * 1000); // Every 2 minutes

    return () => clearInterval(interval);
  }, [user?.uid]);

  const login = async (intendedRole) => {
    setAuthError(null);
    setActionLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email.toLowerCase();

      const superAdminEmail = (config?.superAdminEmail || INITIAL_SUPER_ADMIN_EMAIL).toLowerCase();
      const superAdminEmails = SUPER_ADMIN_EMAILS.map(e => e.toLowerCase());

      const isStudentDomain = email.endsWith('@vitapstudent.ac.in');
      const isFacultyDomain = email.endsWith('@vitap.ac.in') || email.endsWith('@vit.ac.in');
      const isSuperAdminEmail = superAdminEmails.includes(email) || email === superAdminEmail;

      // RULE 4: Non-VIT email — hard block, no Firestore doc created
      if (!isStudentDomain && !isFacultyDomain && !isSuperAdminEmail) {
        await signOut(auth);
        setIsBlocked(true);
        setActionLoading(false);
        return;
      }

      setIsBlocked(false);

      const userRef = doc(db, 'artifacts', appId, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // First login — create doc
        let role = 'student';
        if (isSuperAdminEmail) role = 'super_admin';
        else if (isFacultyDomain) role = 'faculty';

        await setDoc(userRef, {
          email,
          name: result.user.displayName || email.split('@')[0],
          role,
          approved: true,
          createdAt: new Date().toISOString()
        });
        toast.success('Account created! Welcome.');

        // RULE 3: Super admin goes directly to admin view
        if (role === 'super_admin') setViewMode('admin');
        else setViewMode('user');
      } else {
        const existingData = userSnap.data();

        if (!existingData.email) {
          await updateDoc(userRef, { email });
        }

        if (!existingData.role) {
          const fixedRole = isStudentDomain ? 'student' :
                            isFacultyDomain ? 'faculty' : 'student';
          await updateDoc(userRef, {
            role: fixedRole,
            approved: true
          });
        }

        // Force refresh super_admin role if email matches
        if (isSuperAdminEmail && (existingData.role !== 'super_admin' || !existingData.approved)) {
          await updateDoc(userRef, { role: 'super_admin', approved: true });
          setViewMode('admin');
          toast.success('Super Admin access refreshed!');
        } else if (existingData.role === 'revoked') {
          // Handled in the render section
          toast.error('Your access has been revoked. Contact the administrator.');
        } else if (existingData.role === 'super_admin') {
          setViewMode('admin');
          toast.success(`Welcome back, ${existingData.name || email.split('@')[0]}!`);
        } else if (existingData.role === 'admin' && existingData.adminApproved) {
          // Approved admin — start in user view but can switch
          setViewMode('user');
          toast.success(`Welcome back, ${existingData.name || email.split('@')[0]}!`);
        } else {
          setViewMode('user');
          toast.success(`Welcome back, ${existingData.name || email.split('@')[0]}!`);
        }
      }
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError(error.message);
        toast.error('Failed to sign in.');
      }
    }
    setActionLoading(false);
  };

  const logout = async () => {
    localStorage.removeItem('isLoggedIn');
    setIsBlocked(false);
    await signOut(auth);
    setViewMode('user');
  };


  const handleProfileComplete = async (profileData) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), profileData, { merge: true });
      toast.success("Profile saved!");
    } catch (e) {
      toast.error("Failed to save profile.");
    }
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  // Pre-calculate session variables
  const superAdminEmail = config?.superAdminEmail || INITIAL_SUPER_ADMIN_EMAIL;
  const isSuperAdminUser = userData?.role === 'super_admin' || (user?.email && user?.email.toLowerCase() === superAdminEmail.toLowerCase());
  const canSwitchToAdmin = isSuperAdminUser || userData?.adminApproved === true;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen
            key="splash"
            onComplete={() => {
              setShowSplash(false);
              try {
                sessionStorage.setItem('messmeal_skip_splash', '1');
              } catch {
                // ignore
              }
            }}
          />
        ) : (
          <motion.div
            key="main-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="h-full flex flex-col"
          >
            <Toaster position="top-center" reverseOrder={false} />

            {/* 1. No user → LandingPage */}
            {!user ? (
              <LandingPage
                onLogin={login}
                loading={actionLoading}
                error={authError}
              />
            ) : /* 2. Non-VIT email hard block */
            isBlocked ? (
              <div className="min-h-screen bg-page flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#1A1A1A] p-8 rounded-[2rem] shadow-xl max-w-md w-full text-center border border-error/20">
                  <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Shield className="text-error" size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-dark dark:text-white mb-2 uppercase tracking-tight">Access Restricted</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8 leading-relaxed">
                    Only VIT-AP institutional emails are allowed.<br />
                    Please use your @vitapstudent.ac.in or @vitap.ac.in email to sign in.
                  </p>
                  <button
                    onClick={async () => { await signOut(auth); setIsBlocked(false); }}
                    className="w-full py-4 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-dark dark:text-white font-black rounded-2xl transition-all uppercase tracking-widest text-sm"
                  >
                    Try Again
                  </button>
                </motion.div>
              </div>
            ) : /* 3. Revoked user */
            userData?.role === 'revoked' ? (
              <div className="min-h-screen bg-page flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#1A1A1A] p-8 rounded-[2rem] shadow-xl max-w-md w-full text-center border border-error/20">
                  <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Shield className="text-error" size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-dark dark:text-white mb-2 uppercase tracking-tight">Access Denied</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8 leading-relaxed">
                    Contact the mess admin. Your access has been restricted.
                  </p>
                  <button onClick={logout} className="w-full py-4 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-dark dark:text-white font-black rounded-2xl transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                    Logout from {user.email}
                  </button>
                </motion.div>
              </div>
            ) : /* 4. Profile setup needed */
            !userData?.hostel || !userData?.messType ? (
              <ProfileSetupScreen
                user={user}
                userData={userData}
                onComplete={handleProfileComplete}
                config={config}
              />
            ) : /* 5. Admin dashboard */
            viewMode === 'admin' && (isSuperAdminUser || userData?.adminApproved === true) ? (
              <ErrorBoundary>
                <AdminDashboard
                  user={user}
                  userData={userData}
                  onLogout={logout}
                  onSwitchToUser={() => setViewMode('user')}
                  config={config}
                  onUpdateConfig={onUpdateConfig}
                  settings={settings}
                  updateSettings={updateSettings}
                />
              </ErrorBoundary>
            ) : /* 6. User dashboard (all approved users) */
            (
              <UserDashboard
                user={user}
                userData={userData}
                onLogout={logout}
                onSwitchToAdmin={() => setViewMode('admin')}
                canSwitchToAdmin={canSwitchToAdmin}
                config={config}
                settings={settings}
                updateSettings={updateSettings}
                isPending={false}
              />
            )}
            <InstallAppModal />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;