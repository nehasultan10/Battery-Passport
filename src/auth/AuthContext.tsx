import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { login as apiLogin, refreshSession, serverLogout } from "../api/battery";
import { BASE_URL } from "../config";
import { clearAllLocalData } from "../storage/scanHistory";
import { Project } from "../types";

// SecureStore keys may only contain alphanumerics, ".", "-" and "_" — no ":".
const KEYS = {
  accessToken: "battery-passport.access-token",
  refreshToken: "battery-passport.refresh-token",
  project: "battery-passport.project",
};

interface AuthState {
  isLoading: boolean;
  baseUrl: string;
  accessToken: string | null;
  refreshToken: string | null;
  project: Project | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectProject: (project: Project) => Promise<void>;
  /** Returns a fresh access token, refreshing first if the current one may have expired. */
  ensureAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const baseUrl = BASE_URL;
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedAccess, storedRefresh, storedProject] = await Promise.all([
          SecureStore.getItemAsync(KEYS.accessToken),
          SecureStore.getItemAsync(KEYS.refreshToken),
          SecureStore.getItemAsync(KEYS.project),
        ]);
        if (storedAccess) setAccessToken(storedAccess);
        if (storedRefresh) setRefreshToken(storedRefresh);
        if (storedProject) setProject(JSON.parse(storedProject));
      } catch (err) {
        // Unreadable/corrupt stored session: fall through to the login screen
        // rather than leaving the app stuck on the loading state.
        console.warn("Failed to restore saved session", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    // Revoke the refresh token server-side first (best effort - an offline
    // phone must still be able to sign out locally).
    if (refreshToken) serverLogout(baseUrl, refreshToken).catch(() => undefined);
    setAccessToken(null);
    setRefreshToken(null);
    setProject(null);
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
      SecureStore.deleteItemAsync(KEYS.project),
      // Cached passports / scan history belong to the signed-in user and
      // project; never leave them behind for whoever uses the phone next.
      clearAllLocalData(),
    ]);
  }, [baseUrl, refreshToken]);

  const login = useCallback(
    async (username: string, password: string) => {
      const tokens = await apiLogin(baseUrl, username, password);
      setAccessToken(tokens.access);
      setRefreshToken(tokens.refresh);
      await Promise.all([
        SecureStore.setItemAsync(KEYS.accessToken, tokens.access),
        SecureStore.setItemAsync(KEYS.refreshToken, tokens.refresh),
      ]);
    },
    [baseUrl]
  );

  const selectProject = useCallback(
    async (next: Project) => {
      // Different project => different batteries; drop what the previous one cached.
      if (project && project.slug !== next.slug) await clearAllLocalData();
      setProject(next);
      await SecureStore.setItemAsync(KEYS.project, JSON.stringify(next));
    },
    [project]
  );

  // One refresh at a time: several screens failing with 401 together must not
  // each burn the refresh token.
  const refreshInFlight = useRef<Promise<string> | null>(null);

  const ensureAccessToken = useCallback(async () => {
    if (!refreshToken) throw new ApiError(401, "Not logged in.");
    if (refreshInFlight.current) return refreshInFlight.current;

    const run = (async () => {
      try {
        // Refresh tokens rotate: persist the new one, the old one is now dead.
        const refreshed = await refreshSession(baseUrl, refreshToken);
        setAccessToken(refreshed.access);
        setRefreshToken(refreshed.refresh);
        await Promise.all([
          SecureStore.setItemAsync(KEYS.accessToken, refreshed.access),
          SecureStore.setItemAsync(KEYS.refreshToken, refreshed.refresh),
        ]);
        return refreshed.access;
      } catch (err) {
        // Refresh token expired/revoked (14 days, or account disabled): the
        // session is over. Signing out flips the navigator back to Login.
        if (err instanceof ApiError && err.status === 401) {
          await logout();
          throw new ApiError(401, "Your session has expired. Please sign in again.");
        }
        throw err;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = run;
    return run;
  }, [baseUrl, refreshToken, logout]);

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      baseUrl,
      accessToken,
      refreshToken,
      project,
      login,
      logout,
      selectProject,
      ensureAccessToken,
    }),
    [isLoading, baseUrl, accessToken, refreshToken, project, login, logout, selectProject, ensureAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/**
 * Runs `fn` with the current access token; on a 401 it refreshes once and
 * retries. Use for any authenticated API call.
 */
export async function withAuthRetry<T>(auth: AuthState, fn: (accessToken: string) => Promise<T>): Promise<T> {
  if (!auth.accessToken) throw new ApiError(401, "Not logged in.");
  try {
    return await fn(auth.accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const fresh = await auth.ensureAccessToken();
      return fn(fresh);
    }
    throw err;
  }
}
