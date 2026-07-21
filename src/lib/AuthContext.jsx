import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { api } from '@/api';
import { waitForSession, getSharedSupabase } from '@/lib/supabase';

const usePythonBackend = import.meta.env.VITE_USE_PYTHON_BACKEND === 'true';
const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const mounted = useRef(true);
  const isAuthenticatedRef = useRef(false);

  const checkUserAuth = useCallback(async () => {
    try {
      // Only show the global auth spinner on first load — soft refreshes must not
      // remount RequireAuth children (that caused PropertyVisits infinite spinner).
      if (!isAuthenticatedRef.current) {
        setIsLoadingAuth(true);
      }
      const currentUser = await api.auth.me();
      if (!mounted.current) return;
      setUser(currentUser);
      setIsAuthenticated(true);
      isAuthenticatedRef.current = true;
    } catch (error) {
      console.error('User auth check failed:', error);
      if (!mounted.current) return;
      setIsAuthenticated(false);
      setUser(null);
      isAuthenticatedRef.current = false;
    } finally {
      if (mounted.current) setIsLoadingAuth(false);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setAuthError(null);

    if (usePythonBackend || useSupabase) {
      const session = await waitForSession();
      if (session) {
        await checkUserAuth();
      } else {
        setIsAuthenticated(false);
        setUser(null);
        isAuthenticatedRef.current = false;
        setIsLoadingAuth(false);
      }
      return;
    }

    setIsAuthenticated(false);
    setIsLoadingAuth(false);
  }, [checkUserAuth]);

  useEffect(() => {
    mounted.current = true;
    checkAppState();

    const client = getSharedSupabase();
    if (!client) return undefined;

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsAuthenticated(false);
        isAuthenticatedRef.current = false;
        setIsLoadingAuth(false);
        return;
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'INITIAL_SESSION' ||
        event === 'USER_UPDATED'
      ) {
        if (session) {
          checkUserAuth();
        }
      }
    });

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      client.auth.getSession().then(({ data: { session } }) => {
        if (session) checkUserAuth();
      });
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkAppState, checkUserAuth]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    isAuthenticatedRef.current = false;
    if (shouldRedirect) {
      api.auth.logout(typeof window !== 'undefined' ? window.location.href : undefined);
    } else {
      api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(typeof window !== 'undefined' ? window.location.href : undefined);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      logout,
      navigateToLogin,
      checkAppState,
      refreshUser: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
