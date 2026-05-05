// src/App.js
import React, { useEffect, useState, useRef, createContext } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

// Public pages
import LandingPage from './landing/LandingPage';
import Login from './auth/Login';
import ForgotPassword from './auth/ForgotPassword';

// Protected pages
import Home from './home/Home';
import Account from './account';
import ChangePassword from './account/ChangePassword';
import Settings from './settings/Settings';
import AdminUsers from './admin/AdminUsers';
import AdminNewUser from './admin/AdminNewUser';
import AdminUserDetail from './admin/AdminUserDetail';
import AdminShows from './admin/AdminShows';
import Profile from './profile/Profile';
import Updates from './updates/Updates';
import ShowWorkspace from './shows/ShowWorkspace';
import ShowMembers from './shows/ShowMembers';
import ShowModules from './shows/ShowModules';
import ShowInventory from './shows/ShowInventory';
import ShowScheduling from './shows/ShowScheduling';
import ShowArtists from './shows/ShowArtists';
import ShowAi3DModel from './shows/ShowAi3DModel';

// Route guard
import ProtectedRoute from './ProtectedRoute';

// App-wide user context (used by Home, etc.)
export const UserContext = createContext(null);
export const NoticeContext = createContext({ notify: () => {} });

function AppRoutes({ user }) {
  return (
    <>
      <ScrollRestoration />
      <Routes>
        {/* Public */}
        <Route path="/" element={user ? <Navigate to="/shows" /> : <LandingPage />} />
        <Route path="/signin" element={!user ? <Login /> : <Navigate to="/shows" />} />
        <Route path="/signup" element={<Navigate to="/signin" replace />} />
        <Route path="/forgot" element={<ForgotPassword />} />

        {/* Protected */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Navigate to="/shows" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId"
          element={
            <ProtectedRoute>
              <Navigate to="workspace" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId/workspace"
          element={
            <ProtectedRoute>
              <ShowWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId/members"
          element={
            <ProtectedRoute>
              <ShowMembers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId/modules"
          element={
            <ProtectedRoute>
              <ShowModules />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId/scheduling/*"
          element={
            <ProtectedRoute>
              <ShowScheduling />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId/inventory"
          element={
            <ProtectedRoute>
              <ShowInventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId/artists"
          element={
            <ProtectedRoute>
              <ShowArtists />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:showId/ai-3d-model"
          element={
            <ProtectedRoute>
              <ShowAi3DModel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/updates"
          element={
            <ProtectedRoute>
              <Updates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/new"
          element={
            <ProtectedRoute>
              <AdminNewUser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:uid"
          element={
            <ProtectedRoute>
              <AdminUserDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/shows"
          element={
            <ProtectedRoute>
              <AdminShows />
            </ProtectedRoute>
          }
        />
        <Route
          path="/more"
          element={
            <ProtectedRoute>
              <Navigate to="/settings" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to={user ? '/shows' : '/'} />} />
      </Routes>
    </>
  );
}

function ScrollRestoration() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);      // raw Firebase Auth user
  const [appUser, setAppUser] = useState(null);                // canonical /users/{uid} doc
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [notice, setNotice] = useState(null);
  const noticeTimerRef = useRef(null);
  const profileUnsubRef = useRef(null);

  const notify = (text, type = 'info') => {
    if (!text) return;
    setNotice({ text, type });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      setCheckingAuth(false);

      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      if (!u) {
        setAppUser(null);
        setCheckingProfile(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', u.uid);
        let userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          const now = serverTimestamp();
          await setDoc(userRef, {
            uid: u.uid,
            email: u.email ?? null,
            firstName: '',
            lastName: '',
            systemRole: 'user',
            primaryAuthUid: u.uid,
            createdAt: now,
            updatedAt: now,
          }, { merge: true });
          userSnap = await getDoc(userRef);
        }

        profileUnsubRef.current = onSnapshot(
          userRef,
          async (snap) => {
            let data = snap.exists() ? snap.data() || {} : {};
            const updates = {};

            const ensuredFirst = typeof data.firstName === 'string' ? data.firstName : '';
            const ensuredLast = typeof data.lastName === 'string' ? data.lastName : '';
            if (ensuredFirst !== data.firstName) updates.firstName = ensuredFirst;
            if (ensuredLast !== data.lastName) updates.lastName = ensuredLast;

            if (Object.keys(updates).length) {
              const now = serverTimestamp();
              updates.updatedAt = now;
              try {
                await setDoc(userRef, updates, { merge: true });
                data = { ...data, ...updates };
              } catch (writeErr) {
                console.error('Failed to normalize user profile:', writeErr);
              }
            }

            const finalData = {
              ...data,
              firstName: typeof data.firstName === 'string' ? data.firstName : '',
              lastName: typeof data.lastName === 'string' ? data.lastName : '',
              systemRole: typeof data.systemRole === 'string' ? data.systemRole : 'user',
            };

            setAppUser({ id: u.uid, firebaseUid: u.uid, email: u.email ?? null, ...finalData });
            setCheckingProfile(false);
          },
          (err) => {
            console.error('Failed to load app user profile:', err);
            setAppUser({ id: u.uid, firebaseUid: u.uid, email: u.email ?? null });
            setCheckingProfile(false);
          }
        );
      } catch (err) {
        console.error('Failed to load app user profile:', err);
        setAppUser({ id: u.uid, firebaseUid: u.uid, email: u.email ?? null });
        setCheckingProfile(false);
      }
    });

    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (profileUnsubRef.current) profileUnsubRef.current();
      unsub();
    };
  }, []);

  if (checkingAuth || checkingProfile) return null; // could render a loader if you prefer

  return (
    <Router>
      <NoticeContext.Provider value={{ notify }}>
        <UserContext.Provider value={appUser}>
          {notice ? (
            <div className={`global-notice ${notice.type}`}>
              <span>{notice.text}</span>
            </div>
          ) : null}
          <AppRoutes user={firebaseUser} />
        </UserContext.Provider>
      </NoticeContext.Provider>
    </Router>
  );
}

export default App;
