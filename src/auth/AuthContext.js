import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';

const AuthContext = createContext(null);
const getMyProfile = httpsCallable(functions, 'getMyProfile');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const loadProfile = async (currentUser) => {
    setProfileError('');
    try {
      const result = await getMyProfile();
      setProfile(result.data);
    } catch (error) {
      setProfile(null);
      setProfileError(error?.message || 'Unable to load your profile.');
    }
  };

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    if (currentUser) await loadProfile(currentUser);
    else {
      setProfile(null);
      setProfileError('');
    }
    setLoading(false);
  }), []);

  const value = useMemo(() => ({
    user,
    profile,
    profileError,
    loading,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    register: async ({ displayName, email, password }) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
      await credential.user.getIdToken(true);
      setUser(credential.user);
      await loadProfile(credential.user);
      return credential;
    },
    logout: () => signOut(auth),
    refreshProfile: () => user && loadProfile(user),
  }), [loading, profile, profileError, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
