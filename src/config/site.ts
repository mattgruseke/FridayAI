// Edit this file to rebrand the app. Everything user-facing that names the
// product, links in the nav, or picks the default theme reads from here.

export type AccentTheme = {
  id: string;
  label: string;
  hex: string;
};

export type NavItem = {
  href: string;
  label: string;
};

export const siteConfig = {
  name: "My App",
  description: "A Next.js + Supabase starter with auth, a sample feature, and theming.",
  url: "http://localhost:3000",
  footer: "© My App",

  // Signup requires a code from the `invite_codes` table when true.
  inviteOnly: true,

  // Links shown in the header once signed in.
  nav: [
    { href: "/", label: "home" },
    { href: "/items", label: "items" },
  ] satisfies NavItem[],

  // Dark mode is on for new visitors when true.
  defaultDarkMode: true,

  // Accent colors offered by the header color picker. The first entry is the
  // default and must match `--accent` in src/app/theme.css.
  accentThemes: [
    { id: "orange", label: "Orange", hex: "#ff6600" },
    { id: "blue", label: "Blue", hex: "#2563eb" },
    { id: "indigo", label: "Indigo", hex: "#4f46e5" },
    { id: "purple", label: "Purple", hex: "#7c3aed" },
    { id: "red", label: "Red", hex: "#dc2626" },
    { id: "yellow", label: "Yellow", hex: "#d97706" },
    { id: "green", label: "Green", hex: "#16a34a" },
    { id: "dark-green", label: "Dark Green", hex: "#166534" },
  ] satisfies AccentTheme[],
};
