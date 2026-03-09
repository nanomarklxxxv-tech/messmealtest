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
          <h1 className="text-3xl font-bold">Admin Demo Crash</h1>
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
    root.classList.remove('theme-green', 'theme-blue', 'dark');
    if (settings.theme === 'green') root.classList.add('theme-green');
    if (settings.theme === 'blue') root.classList.add('theme-blue');
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
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        localStorage.setItem('isLoggedIn', 'true');
        setUser(currentUser);

        const superAdminEmail = config?.superAdminEmail || INITIAL_SUPER_ADMIN_EMAIL;
        const isFacultyOrAdmin = currentUser.email.endsWith('@vitap.ac.in') || currentUser.email.endsWith('@vit.ac.in') || currentUser.email.toLowerCase() === superAdminEmail.toLowerCase();
        if (isFacultyOrAdmin) setViewMode('admin');
        else setViewMode('user');

        // Instead of a single getDoc, let's listen to user document so changes (like approval) reflect immediately
        const unsubscribeUser = onSnapshot(doc(db, 'artifacts', appId, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            setUserData(null);
          }
          setAuthLoading(false);
        }, (err) => {
          setAuthLoading(false);
        });

        return () => unsubscribeUser(); // Cleanup user listener on auth change
      } else {
        localStorage.removeItem('isLoggedIn');
        setUser(null);
        setUserData(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribeAuth();
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
            ) : requiresAdminApproval ? (
              <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
                <div className="bg-zinc-900 border border-yellow-500/20 shadow-[0_0_40px_rgba(234,179,8,0.05)] p-8 rounded-3xl max-w-md w-full text-center space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500"></div>
                  <Clock4 size={48} className="mx-auto text-yellow-500" />
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight mb-2">Account Pending</h2>
                    <p className="text-sm font-medium text-zinc-400 leading-relaxed">
                      Your account is currently under review by an administrator. You will gain full access to the MessMeal dashboard once approved.
                    </p>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/5 text-white py-3 rounded-xl font-bold transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : isStudentDomain && viewMode === 'admin' && userData?.role !== 'admin' && userData?.role !== 'super_admin' ? (
              <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center shadow-[0_0_40px_rgba(239,68,68,0.05)] max-w-md w-full">
                  <Shield size={48} className="mx-auto text-red-500 mb-4" />
                  <h2 className="text-2xl font-black text-white mb-2">Restricted Access</h2>
                  <p className="text-zinc-400 font-medium leading-relaxed">Students are not permitted to access the Admin Interface.</p>
                  <button onClick={() => setViewMode('user')} className="mt-8 w-full bg-white text-black hover:bg-zinc-200 py-3 rounded-xl font-bold transition-all">Return to Dashboard</button>
                </div>
              </div>
            ) : viewMode === 'admin' && (isFacultyDomain || userData?.role === 'admin' || userData?.role === 'super_admin') ? (
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