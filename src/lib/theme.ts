// Server-safe: imported by the root layout. The client hook is in
// src/hooks/useTheme.ts.
import { siteConfig } from "@/config/site";

export const DARK_KEY = "darkMode";
export const ACCENT_KEY = "colorTheme";
const accents = siteConfig.accentThemes;

// Runs inline before first paint (see src/app/layout.tsx) so the saved theme
// applies on every page, including the auth pages, without a flash.
export const themeInitScript = `(function(){try{
var d=localStorage.getItem(${JSON.stringify(DARK_KEY)});
var dark=d===null?${siteConfig.defaultDarkMode}:d!=="false";
if(dark)document.body.classList.add("dark-mode");
var a=${JSON.stringify(Object.fromEntries(accents.map((t) => [t.id, t.hex])))};
var id=localStorage.getItem(${JSON.stringify(ACCENT_KEY)});
if(id&&a[id])document.body.style.setProperty("--accent",a[id]);
}catch(e){}})();`;
