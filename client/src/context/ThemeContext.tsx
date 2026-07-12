import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ThemeCtx = {
  dark: boolean;
  setDark: (v: boolean) => void;
  toggleDark: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = "pipo-care-dark";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(KEY, dark ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [dark]);

  const setDark = useCallback((v: boolean) => setDarkState(v), []);
  const toggleDark = useCallback(() => setDarkState((d) => !d), []);

  const v = useMemo(() => ({ dark, setDark, toggleDark }), [dark, setDark, toggleDark]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const x = useContext(Ctx);
  if (!x) throw new Error("useTheme outside ThemeProvider");
  return x;
}
