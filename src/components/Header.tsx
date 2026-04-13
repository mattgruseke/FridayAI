"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import frogIcon from "../assets/frog.svg";
import { canAccessNetwork } from "../lib/beta";
import api from "../api/client";

type Notification = {
  id: string;
  type: string;
  message: string;
  action_url?: string;
  is_dismissed: boolean;
  is_completed: boolean;
  created_at: string;
};

const COLOR_THEMES = [
  { id: 'orange',     label: 'Orange',     hex: '#ff6600' },
  { id: 'blue',       label: 'Blue',       hex: '#2563eb' },
  { id: 'indigo',     label: 'Indigo',     hex: '#4f46e5' },
  { id: 'purple',     label: 'Purple',     hex: '#7c3aed' },
  { id: 'red',        label: 'Red',        hex: '#dc2626' },
  { id: 'yellow',     label: 'Yellow',     hex: '#d97706' },
  { id: 'green',      label: 'Green',      hex: '#16a34a' },
  { id: 'dark-green', label: 'Dark Green', hex: '#166534' },
];

const Header = () => {
  const { user, signOut, isAdmin } = useAuth();
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  const [colorTheme, setColorTheme] = useState(() => {
    if (typeof window === 'undefined') return 'orange';
    return localStorage.getItem('colorTheme') || 'orange';
  });

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_dismissed).length;

  useEffect(() => {
    if (!user) return;
    api.notifications.getAll().then((data) => setNotifications(data as Notification[])).catch(() => {});
  }, [user]);

  async function handleDismissNotif(id: string) {
    await api.notifications.dismiss(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_dismissed: true } : n))
    );
  }

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("darkMode", darkMode?.toString());
  }, [darkMode]);

  useEffect(() => {
    COLOR_THEMES.forEach(t => document.body.classList.remove(`theme-${t.id}`));
    if (colorTheme !== 'orange') {
      document.body.classList.add(`theme-${colorTheme}`);
    }
    localStorage.setItem('colorTheme', colorTheme);
  }, [colorTheme]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node)
      ) {
        setColorPickerOpen(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    setSidebarOpen(false);
    await signOut();
    window.location.href = "/login";
  };

  const handleProfileClick = () => {
    setMobileMenuOpen(false);
    setSidebarOpen(false);
    router.push("/profile");
  };

  const displayName = user?.email?.split("@")[0] || "user";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="header">
        <div className="header-inner">
          <Link href="/" className="logo active">
            <Image src={frogIcon} alt="GigFrog" width={24} height={24} />
            GigFrog
          </Link>

          {/* Desktop nav */}
          <nav className="nav desktop-nav">
            <Link href="/pipeline">pipeline</Link>
            <Link href="/leads">leads</Link>
            <Link href="/lists">lists</Link>
            {canAccessNetwork(user?.id) && <Link href="/network">network</Link>}
            <Link href="/referrals">referrals</Link>
          </nav>

          <div className="spacer"></div>

          {/* Notifications bell */}
          {user && (
            <div className="notif-wrap" ref={notifRef}>
              <button
                className="notif-btn"
                onClick={() => setNotifOpen((o) => !o)}
                title="Notifications"
                aria-label="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">Notifications</div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.is_dismissed ? "notif-item--read" : "notif-item--unread"}`}
                      >
                        <div className="notif-item-body">
                          {n.action_url ? (
                            <Link
                              href={n.action_url}
                              className="notif-item-msg"
                              onClick={() => setNotifOpen(false)}
                            >
                              {n.message}
                            </Link>
                          ) : (
                            <span className="notif-item-msg">{n.message}</span>
                          )}
                        </div>
                        {!n.is_dismissed && (
                          <button
                            className="notif-dismiss-btn"
                            onClick={() => handleDismissNotif(n.id)}
                            title="Dismiss"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* iOS-style dark mode toggle */}
          <button
            className={`theme-toggle ${darkMode ? 'theme-toggle--on' : ''}`}
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="theme-toggle__thumb">
              {darkMode ? (
                // Moon
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                // Sun
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>
                  <line x1="12" y1="2"  x2="12" y2="5"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
                  <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
                  <line x1="2"  y1="12" x2="5"  y2="12"/>
                  <line x1="19" y1="12" x2="22" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
                  <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </span>
          </button>

          {/* Color theme picker */}
          <div className="color-picker-wrap" ref={colorPickerRef}>
            <button
              className="color-picker-btn"
              onClick={() => setColorPickerOpen(o => !o)}
              title="Change color theme"
              aria-label="Change color theme"
            >
              {/* Palette / color-wheel icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="8.5"  cy="7"   r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="6.5"  cy="12"  r="1.5" fill="currentColor" stroke="none"/>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.042a1.8 1.8 0 0 1 1.8-1.8h2.157C19.482 16.345 22 13.769 22 10.5 22 5.799 17.523 2 12 2z"/>
              </svg>
            </button>

            {colorPickerOpen && (
              <div className="color-picker-dropdown">
                {COLOR_THEMES.map(theme => (
                  <button
                    key={theme.id}
                    className={`color-swatch ${colorTheme === theme.id ? 'color-swatch--active' : ''}`}
                    style={{ background: theme.hex }}
                    onClick={() => { setColorTheme(theme.id); setColorPickerOpen(false); }}
                    title={theme.label}
                    aria-label={theme.label}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop avatar */}
          <div className="avatar-container desktop-only" ref={sidebarRef}>
            <button
              className="avatar-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={displayName}
            >
              {initials}
              {isAdmin && <span className="avatar-admin-dot"></span>}
            </button>

            {sidebarOpen && (
              <div className="sidebar-dropdown">
                <div className="sidebar-header">
                  <span className="sidebar-email">{user?.email}</span>
                  {isAdmin && <span className="admin-badge">admin</span>}
                </div>
                <div className="sidebar-divider"></div>
                <button className="sidebar-item" onClick={handleProfileClick}>
                  Profile
                </button>
                <button
                  className="sidebar-item sidebar-logout"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="mobile-menu-btn mobile-only"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <span className={`hamburger ${mobileMenuOpen ? "open" : ""}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <span className="mobile-menu-email">{user?.email}</span>
              {isAdmin && <span className="admin-badge">admin</span>}
            </div>
            <div className="mobile-menu-divider"></div>
            <nav className="mobile-nav">
              <Link href="/pipeline" onClick={() => setMobileMenuOpen(false)}>
                Pipeline
              </Link>
              <Link href="/leads" onClick={() => setMobileMenuOpen(false)}>
                Leads
              </Link>
              <Link href="/lists" onClick={() => setMobileMenuOpen(false)}>
                Lists
              </Link>
              {canAccessNetwork(user?.id) && (
                <Link href="/network" onClick={() => setMobileMenuOpen(false)}>
                  Network
                </Link>
              )}
              <Link href="/referrals" onClick={() => setMobileMenuOpen(false)}>
                Referrals
              </Link>
            </nav>
            <div className="mobile-menu-divider"></div>
            <button className="mobile-menu-item" onClick={handleProfileClick}>
              Profile
            </button>
            <button
              className="mobile-menu-item mobile-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
