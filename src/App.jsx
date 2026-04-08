import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, appId, getMessagingInstance } from './lib/firebase';
import { getToken } from 'firebase/messaging';
import { INITIAL_SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAILS, WHITELISTED_EMAILS } from './lib/constants';
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
      const systemDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      return saved ? JSON.parse(saved) : {
        theme: 'blue',
        darkMode: systemDark,
        fontScale: 1.0,
        avatar: 'boy'
      };
    } catch {
      const systemDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      return {
        theme: 'blue',
        darkMode: systemDark,
        fontScale: 1.0,
        avatar: 'boy'
      };
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
    const unsub = onSnapshot(
      doc(db, 'artifacts', appId, 'config', 'settings'),
      (snap) => {
        if (snap.exists()) setConfig(snap.data());
      },
      () => {}
    );
    return () => unsub();
  }, []);

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
            // If super_admin or mini_admin, set admin view (handles page refresh)
            if (data.role === 'super_admin') setViewMode('admin');
            if (data.role === 'mini_admin' &&
                data.approved === true &&
                data.adminApproved === true) {
                setViewMode('admin');
            }
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

  // Session timeout: refresh Firebase token on tab visibility change
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          await user.getIdToken(true);
        } catch (error) {
          console.error('Token refresh failed:', error);
          if (
            error.code === 'auth/user-token-expired' ||
            error.code === 'auth/user-not-found'
          ) {
            toast.error('Session expired. Please sign in again.');
            await signOut(auth);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  // Request FCM Token
  useEffect(() => {
    if (user && userData && !userData.fcmToken) {
      const requestPermission = async () => {
        try {
          const messagingInstance = getMessagingInstance();
          if (!messagingInstance) return; // Messaging not available
          
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const token = await getToken(messagingInstance);
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

    const interval = setInterval(updateActivity, 3 * 60 * 1000); // Every 3 minutes

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

      // RULE 1: Block non-institutional emails
      if (!isStudentDomain && !isFacultyDomain && !isSuperAdminEmail) {
        await signOut(auth);
        setIsBlocked(true);
        setActionLoading(false);
        return;
      }

      setIsBlocked(false);

      // RULE 2: Validate intendedRole against email domain & permissions
      if (intendedRole === 'admin') {
        // Only super_admin emails can access admin portal
        if (!isSuperAdminEmail) {
          await signOut(auth);
          setAuthError('Admin access requires authorization. Contact your administrator.');
          toast.error('You do not have admin privileges.');
          setActionLoading(false);
          return;
        }
      } else if (intendedRole === 'faculty') {
        // Only faculty domain emails can access faculty portal
        if (!isFacultyDomain && !isSuperAdminEmail) {
          await signOut(auth);
          setAuthError('Faculty/Staff access requires @vitap.ac.in or @vit.ac.in email.');
          toast.error('Faculty access denied.');
          setActionLoading(false);
          return;
        }
      } else if (intendedRole === 'student') {
        // Only student domain emails can access student portal
        if (!isStudentDomain && !isSuperAdminEmail) {
          await signOut(auth);
          setAuthError('Student access requires @vitapstudent.ac.in email.');
          toast.error('Student access denied.');
          setActionLoading(false);
          return;
        }
      }

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
          adminApproved: false,
          createdAt: new Date().toISOString()
        });
        toast.success('Account created! Welcome.');

        // Set view mode based on role and intendedRole validation
        if (intendedRole === 'admin' && role !== 'super_admin') {
          // User tried to access admin but doesn't have privileges
          setAuthError('You do not have admin privileges. Logging in as regular user.');
          toast.error('Admin access denied.');
          setViewMode('user');
        } else if (role === 'super_admin') {
          setViewMode('admin');
        } else {
          setViewMode('user');
        }
      } else {
        const existingData = userSnap.data();

        if (!existingData.email) {
            await updateDoc(userRef, { email });
        }

        // Fix wrong role for existing users
        // based on their email domain
        const correctRole = isStudentDomain
            ? 'student'
            : isFacultyDomain
                ? 'faculty'
                : null;

        if (correctRole &&
            existingData.role !== 'revoked' &&
            existingData.role !== 'admin' &&
            existingData.role !== 'super_admin' &&
            existingData.role !== 'mini_admin' &&
            existingData.role !== correctRole) {
            await updateDoc(userRef, {
                role: correctRole,
                approved: true
            });
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
          setViewMode('user');
        } else if (existingData.role === 'super_admin') {
          setViewMode('admin');
          toast.success(`Welcome back, ${existingData.name || email.split('@')[0]}!`);
        } else if (intendedRole === 'admin') {
          // User tried to access admin but they're not super_admin and not approved mini_admin
          setAuthError('You do not have admin privileges. Defaulting to user view.');
          toast.error('Admin access denied. You have been logged in as a regular user.');
          setViewMode('user');
        } else {
          // All other users (students, faculty, mini_admin without approval) → user view
          // They can switch to admin via button if they have proper admin role
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
      const updatePayload = {
        ...profileData,
        hostel: String(profileData.hostel || '').trim().toUpperCase(),
        messType: String(profileData.messType || '').trim().toUpperCase(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), updatePayload, { merge: true });
      toast.success("Profile saved!");
      console.log('Profile saved successfully:', updatePayload);
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error("Failed to update profile. Please try again.");
    }
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  // Pre-calculate session variables
  const superAdminEmail = config?.superAdminEmail || INITIAL_SUPER_ADMIN_EMAIL;
  const isSuperAdminUser = userData?.role === 'super_admin' || (user?.email && user?.email.toLowerCase() === superAdminEmail.toLowerCase());
  const canSwitchToAdmin =
      userData?.role === 'super_admin' ||
      (userData?.role === 'mini_admin' && userData?.approved === true && userData?.adminApproved === true);

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
            viewMode === 'admin' && (isSuperAdminUser || (userData?.role === 'mini_admin' && userData?.approved === true && userData?.adminApproved === true)) ? (
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