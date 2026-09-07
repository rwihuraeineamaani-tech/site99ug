/**
 * Appearance for the signed-in system only.
 * The public website never gets these classes.
 */
export type ThemeMode = "dark" | "light" | "system";

export const THEME_KEY = "site99:theme";
const EVENT = "site99:theme-change";

export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" || v === "system" || v === "dark" ? v : "dark";
}

export function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Puts the deck classes on an element (shell root or <body>). */
export function applyThemeClasses(el: HTMLElement, mode: ThemeMode) {
  el.classList.add("deck");
  el.classList.toggle("deck-light", resolveTheme(mode) === "light");
}

export function setTheme(mode: ThemeMode) {
  window.localStorage.setItem(THEME_KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

export function onThemeChange(fn: (mode: ThemeMode) => void) {
  const handler = (e: Event) => fn((e as CustomEvent).detail as ThemeMode);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  system: "Match my device",
};
