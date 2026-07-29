import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  fetchAuthConfig,
  fetchMe,
  signInAsDevUser,
  signInWithGoogle,
  signOut as apiSignOut,
  updateProfile,
} from "../api";
import type { AuthConfig, ThemeChoice, User } from "../types";

type AuthCtx = {
  /** "loading" until the session cookie has been checked once. */
  status: "loading" | "ready";
  user: User | null;
  config: AuthConfig | null;
  signIn: (googleCredential: string) => Promise<void>;
  signInDev: () => Promise<void>;
  signOut: () => Promise<void>;
  patchProfile: (patch: { displayName?: string; avatar?: string; theme?: ThemeChoice }) => Promise<User>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [user, setUserState] = useState<User | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let alive = true;
    // A 401 here is the normal "not signed in yet" case, not an error worth surfacing.
    Promise.all([
      fetchMe()
        .then((r) => r.user)
        .catch((e) => {
          if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
          return null;
        }),
      fetchAuthConfig().catch(() => null),
    ]).then(([me, cfg]) => {
      if (!alive) return;
      setUserState(me);
      setConfig(cfg);
      setStatus("ready");
    });
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (credential: string) => {
    const { user: u } = await signInWithGoogle(credential);
    setUserState(u);
  }, []);

  const signInDev = useCallback(async () => {
    const { user: u } = await signInAsDevUser();
    setUserState(u);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      setUserState(null);
    }
  }, []);

  const patchProfile = useCallback(
    async (patch: { displayName?: string; avatar?: string; theme?: ThemeChoice }) => {
      const { user: u } = await updateProfile(patch);
      setUserState(u);
      return u;
    },
    []
  );

  const value = useMemo(
    () => ({ status, user, config, signIn, signInDev, signOut, patchProfile, setUser: setUserState }),
    [status, user, config, signIn, signInDev, signOut, patchProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
