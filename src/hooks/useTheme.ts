"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { ACCENT_KEY, DARK_KEY } from "@/lib/theme";

const accents = siteConfig.accentThemes;

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode etc.) — theme still applies for this visit
  }
}

export function useTheme() {
  const [darkMode, setDarkModeState] = useState(siteConfig.defaultDarkMode);
  const [accent, setAccentState] = useState(accents[0].id);

  // Sync from what the init script applied, after hydration.
  useEffect(() => {
    setDarkModeState(document.body.classList.contains("dark-mode"));
    try {
      const saved = localStorage.getItem(ACCENT_KEY);
      if (saved && accents.some((t) => t.id === saved)) setAccentState(saved);
    } catch {
      // ignore
    }
  }, []);

  const setDarkMode = (on: boolean) => {
    setDarkModeState(on);
    document.body.classList.toggle("dark-mode", on);
    save(DARK_KEY, String(on));
  };

  const setAccent = (id: string) => {
    const theme = accents.find((t) => t.id === id);
    if (!theme) return;
    setAccentState(id);
    document.body.style.setProperty("--accent", theme.hex);
    save(ACCENT_KEY, id);
  };

  return { darkMode, setDarkMode, accent, setAccent, accents };
}
