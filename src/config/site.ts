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

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const siteConfig = {
  name: "Friday",
  description: "Your personal life-management system.",
  url: "http://localhost:3000",

  // Signup requires a code from the `invite_codes` table when true.
  inviteOnly: true,

  // Sidebar nav (and the mobile menu) once signed in.
  nav: [
    {
      label: "Overview",
      items: [
        { href: "/how-friday-works", label: "How Friday works" },
        { href: "/intake", label: "Home intake" },
        { href: "/personal-intake", label: "Personal intake" },
        { href: "/profile", label: "Profile" },
      ],
    },
    {
      label: "Home",
      items: [
        { href: "/", label: "Dashboard" },
        { href: "/brain-dump", label: "Brain Dump" },
        { href: "/calendar", label: "Calendar" },
        { href: "/today", label: "Today" },
      ],
    },
    {
      label: "Lists",
      items: [
        { href: "/tasks", label: "Tasks" },
        { href: "/goals", label: "Goals" },
        { href: "/ideas", label: "Ideas" },
        { href: "/notes", label: "Notes" },
      ],
    },
    {
      label: "Life",
      items: [
        { href: "/restaurants", label: "Restaurants" },
        { href: "/entertainment", label: "Entertainment" },
        { href: "/food", label: "Meals and food" },
      ],
    },
    {
      label: "House",
      items: [
        { href: "/improvements", label: "Capital improvements" },
        { href: "/maintenance", label: "Maintenance" },
        { href: "/providers", label: "Service providers" },
      ],
    },
  ] satisfies NavGroup[],

  // Dark mode is on for new visitors when true.
  defaultDarkMode: true,

  // Accent colors offered by the header color picker. The first entry is the
  // default and must match `--accent` in src/app/theme.css.
  accentThemes: [
    { id: "brass", label: "Brass", hex: "#C4A063" },
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
