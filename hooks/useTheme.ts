import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY } from "./themeScript";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const listeners = new Set<() => void>();
let currentTheme: Theme | null = null;

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

function applyTheme(theme: Theme) {
  const resolved = resolve(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    currentTheme = isTheme(event.newValue) ? event.newValue : "system";
    applyTheme(currentTheme);
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getThemeSnapshot(): Theme {
  if (currentTheme === null) currentTheme = readStoredTheme();
  return currentTheme;
}

function subscribeSystem(listener: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** Persists and applies a theme. Safe to call outside React (e.g. from an event handler). */
export function setTheme(theme: Theme) {
  currentTheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the theme still applies for this session.
  }
  applyTheme(theme);
  emit();
}

/**
 * Shared theme state. Every component calling this hook sees the same value,
 * so a toggle in the shell and the picker in Settings stay in sync.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "system" as Theme);
  const prefersDark = useSyncExternalStore(subscribeSystem, systemPrefersDark, () => false);
  const resolvedTheme: ResolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  // During hydration `theme` is the server snapshot ("system"), so apply the
  // stored value rather than the rendered one to keep the no-flash script's class.
  useEffect(() => {
    applyTheme(getThemeSnapshot());
  }, [theme, prefersDark]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme]);

  return { theme, resolvedTheme, setTheme, toggleTheme };
}

