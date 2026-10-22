// Theme preference: "system" follows the OS; "light"/"dark" are pinned via
// data-theme on <html>. Stored per browser (it's a personal display setting).
export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "wm:theme";

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

// Runs before first paint (inlined in the root layout) so a pinned theme
// never flashes the wrong colours.
export const themeBootScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='"light"'||t==='"dark"')document.documentElement.setAttribute('data-theme',JSON.parse(t))}catch(e){}`;
