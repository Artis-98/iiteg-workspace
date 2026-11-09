import { useEffect, useState } from "react";

/** Light/dark switching. The class goes on <html> so CSS variables in
 *  styles.css can swap without any component re-rendering. */

export type Theme = "dark" | "light";

const KEY = "iiteg-theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

const listeners = new Set<(t: Theme) => void>();

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
  listeners.forEach((fn) => fn(theme));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setLocal] = useState<Theme>("light");

  useEffect(() => {
    const current = getTheme();
    setLocal(current);
    applyTheme(current);
    const fn = (t: Theme) => setLocal(t);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return [theme, setTheme];
}
