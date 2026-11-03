/** localStorage key holding the user's theme preference ("light" | "dark" | "system"). */
export const THEME_STORAGE_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Inline script for <head> that applies the stored theme before first paint,
 * so dark-mode users never see a light flash. Kept free of React so the root
 * server layout can import it.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.classList.add(d?"dark":"light");r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
