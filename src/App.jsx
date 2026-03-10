import React, { useState, useEffect, useRef } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, appId, messaging } from './lib/firebase';
import { getToken } from 'firebase/messaging';
import { ALLOWED_DOMAINS, INITIAL_SUPER_ADMIN_EMAIL } from './lib/constants';
import { Toaster, toast } from 'react-hot-toast';
import { Clock4, Shield } from 'lucide-react';

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
      return saved ? JSON.parse(saved) : { theme: 'orange', darkMode: false, fontScale: 1.0, avatar: 'boy' };
    } catch {
      return { theme: 'orange', darkMode: false, fontScale: 1.0, avatar: 'boy' };
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
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'config', 'settings'), (doc) => {
      if (doc.exists()) {
        setConfig(doc.data());
      }
    });
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

        const superAdminEmail = config?.superAdminEmail || INITIAL_SUPER_ADMIN_EMAIL;
        const isFacultyOrAdmin = currentUser.email.endsWith('@vitap.ac.in') || currentUser.email.endsWith('@vit.ac.in') || currentUser.email.toLowerCase() === superAdminEmail.toLowerCase();
        if (isFacultyOrAdmin) setViewMode('admin');
        else setViewMode('user');

        // Instead of a single getDoc, let's listen to user document so changes (like approval) reflect immediately
        if (unsubscribeUser) unsubscribeUser(); // cleanup old listener if it exists

        unsubscribeUser = onSnapshot(doc(db, 'artifacts', appId, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
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
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
          lastActive: new Date().toISOString(),
          isOnline: true // Optional explicit flag
        });
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
      const email = result.user.email;

      const superAdminEmail = config?.superAdminEmail || INITIAL_SUPER_ADMIN_EMAIL;
      const isSuperAdminEmail = email.toLowerCase() === superAdminEmail.toLowerCase();
      const isAllowedDomain = ALLOWED_DOMAINS.some(domain => email.endsWith(domain));

      // Allow Super Admin to bypass domain restriction
      if (!isAllowedDomain && !isSuperAdminEmail) {
        // We also check if they are an existing admin after the initial domain check fails
        const userRef = doc(db, 'artifacts', appId, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || (userSnap.data().role !== 'admin' && userSnap.data().role !== 'super_admin')) {
          await auth.signOut();
          setAuthError('Please use your VIT-AP email address to sign in.');
          toast.error('Invalid email domain.');
          setActionLoading(false);
          return;
        }
      }

      // Check if user exists
      const userRef = doc(db, 'artifacts', appId, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        let role = 'student';
        let approved = false;

        // Default to auto-approval if config not yet loaded or missing
        const isAutoApprove = config?.autoApproveDomainUsers ?? true;

        if (isSuperAdminEmail) {
          role = 'super_admin';
          approved = true;
        } else if (email.endsWith('@vitapstudent.ac.in')) {
          // Student email domain: always allow student interface without approval gating
          role = 'student';
          approved = true;
        } else if (email.endsWith('@vitap.ac.in') || email.endsWith('@vit.ac.in')) {
          // Faculty/admin-like domains should require explicit approval for admin interface
          role = 'faculty';
          approved = false;
        } else if (isAutoApprove) {
          // Fallback for any other allowed domain when auto-approval is enabled
          approved = true;
        }

        const newUserData = {
          email,
          name: result.user.displayName || email.split('@')[0],
          role,
          approved,
          createdAt: new Date().toISOString()
        };

        await setDoc(userRef, newUserData);
        toast.success("Account created! Please complete your profile.");
      } else {
        const existingData = userSnap.data();
        let currentRole = existingData.role;

        // Force Super Admin role and approval if email matches, even for existing accounts
        if (isSuperAdminEmail && (currentRole !== 'super_admin' || !existingData.approved)) {
          await updateDoc(userRef, { role: 'super_admin', approved: true });
          toast.success("Super Admin access refreshed!");
        }
        // Promote student to faculty if they now have faculty email
        else if (currentRole === 'student' && (email.endsWith('@vitap.ac.in') || email.endsWith('@vit.ac.in'))) {
          await updateDoc(userRef, { role: 'faculty', approved: false });
          toast.success("Account moved to faculty! Awaiting approval.");
        } else {
          toast.success(`Welcome back, ${existingData.name || existingData.email.split('@')[0]}!`);
        }
      }

      // Force viewMode to show restriction if they clicked the wrong portal
      if (intendedRole === 'admin' || intendedRole === 'faculty') setViewMode('admin');
      else if (intendedRole === 'student') setViewMode('user');

    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError(error.message);
        toast.error("Failed to sign in.");
      }
    }
    setActionLoading(false);
  };

  const logout = async () => {
    localStorage.removeItem('isLoggedIn');

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
  const isFacultyDomain = user?.email?.endsWith('@vitap.ac.in') || user?.email?.endsWith('@vit.ac.in') || user?.email?.toLowerCase() === superAdminEmail.toLowerCase();
  const isStudentDomain = user?.email?.endsWith('@vitapstudent.ac.in');
  const isSuperAdminUser = userData?.role === 'super_admin' || (user?.email && user?.email.toLowerCase() === superAdminEmail.toLowerCase());

  const requiresAdminApproval =
    viewMode === 'admin' &&
    !isSuperAdminUser &&
    (userData?.role === 'admin' || userData?.role === 'faculty') &&
    !userData?.approved;

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

            {!user ? (
              <LandingPage
                onLogin={login}
                loading={actionLoading}
                error={authError}
              />
            ) : !userData?.hostel || !userData?.messType ? (
              <ProfileSetupScreen
                user={user}
                userData={userData}
                onComplete={handleProfileComplete}
                config={config}
              />
            ) : viewMode === 'admin' && (isFacultyDomain || userData?.role === 'admin' || userData?.role === 'super_admin') ? (
              requiresAdminApproval ? (
                <UserDashboard
                  user={user}
                  userData={userData}
                  onLogout={logout}
                  onSwitchToAdmin={() => setViewMode('admin')}
                  canSwitchToAdmin={true} // They are already in admin view mode conceptually
                  config={config}
                  settings={settings}
                  updateSettings={updateSettings}
                  isPending={true}
                />
              ) : (
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
              )
            ) : (
              <UserDashboard
                user={user}
                userData={userData}
                onLogout={logout}
                onSwitchToAdmin={() => setViewMode('admin')}
                canSwitchToAdmin={userData?.role === 'admin' || userData?.role === 'super_admin' || isFacultyDomain}
                config={config}
                settings={settings}
                updateSettings={updateSettings}
                isPending={userData?.role === 'faculty' && !userData?.approved} // Student are auto-approved
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