import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchProfile, saveProfile, type LocalProfile, EMPTY_PROFILE } from "./data/localData";

/**
 * The extension's stand-in for the web app's AuthContext — same job (who is using this,
 * what did they tell us), minus the account. There is no sign-in here: the profile is a
 * local record so the app can greet you by name and feed your answers to the analysis.
 */

type ProfileCtx = {
  ready: boolean;
  profile: LocalProfile;
  patch: (next: Partial<LocalProfile>) => Promise<LocalProfile>;
  reload: () => void;
};

const Ctx = createContext<ProfileCtx | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<LocalProfile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(false);

  const reload = useCallback(() => {
    fetchProfile()
      .then(setProfile)
      .catch(() => setProfile(EMPTY_PROFILE))
      .finally(() => setReady(true));
  }, []);

  useEffect(reload, [reload]);

  const patch = useCallback(async (next: Partial<LocalProfile>) => {
    const saved = await saveProfile(next);
    setProfile(saved);
    return saved;
  }, []);

  const value = useMemo(() => ({ ready, profile, patch, reload }), [ready, profile, patch, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile outside ProfileProvider");
  return ctx;
}
