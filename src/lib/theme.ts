// Theme preference: "system" follows the OS; "light"/"dark" are pinned via
// data-theme on <html>. Stored per browser (it's a personal display setting).
// Dark is the default until someone picks otherwise.
export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "wm:theme";
export const DEFAULT_THEME: Theme = "dark";

export function applyTheme(theme: Theme, { animate = false } = {}) {
  const root = document.documentElement;
  if (animate) {
    // Crossfade colours briefly instead of flashing (see .theme-transition).
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 300);
  }
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

// The server renders <html data-theme="dark">; this runs before first paint
// (inlined in the root layout) and applies a saved choice, so no theme ever
// flashes the wrong colours.
export const themeBootScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var r=document.documentElement;if(t==='"light"')r.setAttribute('data-theme','light');else if(t==='"system"')r.removeAttribute('data-theme')}catch(e){}`;
