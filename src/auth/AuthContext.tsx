import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { login as apiLogin, refreshAccessToken } from "../api/battery";
import { DEFAULT_BASE_URL } from "../config";
import { Project } from "../types";

// SecureStore keys may only contain alphanumerics, ".", "-" and "_" — no ":".
const KEYS = {
  baseUrl: "battery-passport.base-url",
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
  setBaseUrl: (url: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectProject: (project: Project) => Promise<void>;
  /** Returns a fresh access token, refreshing first if the current one may have expired. */
  ensureAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedBaseUrl, storedAccess, storedRefresh, storedProject] = await Promise.all([
          SecureStore.getItemAsync(KEYS.baseUrl),
          SecureStore.getItemAsync(KEYS.accessToken),
          SecureStore.getItemAsync(KEYS.refreshToken),
          SecureStore.getItemAsync(KEYS.project),
        ]);
        if (storedBaseUrl) setBaseUrlState(storedBaseUrl);
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

  const setBaseUrl = useCallback(async (url: string) => {
    const trimmed = url.trim().replace(/\/+$/, "");
    setBaseUrlState(trimmed);
    await SecureStore.setItemAsync(KEYS.baseUrl, trimmed);
  }, []);

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

  const logout = useCallback(async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setProject(null);
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
      SecureStore.deleteItemAsync(KEYS.project),
    ]);
  }, []);

  const selectProject = useCallback(async (next: Project) => {
    setProject(next);
    await SecureStore.setItemAsync(KEYS.project, JSON.stringify(next));
  }, []);

  const ensureAccessToken = useCallback(async () => {
    if (!refreshToken) throw new ApiError(401, "Not logged in.");
    // Access tokens are short-lived (30 min, see battery/auth.py). Rather than
    // tracking expiry client-side, refresh unconditionally here and let
    // callers use the result immediately — one extra round trip, but it
    // avoids clock-skew bugs from trying to predict expiry locally.
    const refreshed = await refreshAccessToken(baseUrl, refreshToken);
    setAccessToken(refreshed.access);
    await SecureStore.setItemAsync(KEYS.accessToken, refreshed.access);
    return refreshed.access;
  }, [baseUrl, refreshToken]);

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      baseUrl,
      accessToken,
      refreshToken,
      project,
      setBaseUrl,
      login,
      logout,
      selectProject,
      ensureAccessToken,
    }),
    [isLoading, baseUrl, accessToken, refreshToken, project, setBaseUrl, login, logout, selectProject, ensureAccessToken]
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
