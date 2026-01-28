"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import frogIcon from "../assets/frog.svg";

const Header = () => {
  const { user, signOut, isAdmin } = useAuth();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("darkMode", darkMode?.toString());
  }, [darkMode]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sidebarOpen]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    setSidebarOpen(false);
    try {
      await signOut();
    } catch (err) {
      // Ignore AbortError - logout still works
      if (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        err.name !== "AbortError"
      ) {
        console.error("Logout error:", err);
      }
    }
    // Always navigate to login after logout attempt
    router.push("/login");
  };

  const handleProfileClick = () => {
    setMobileMenuOpen(false);
    setSidebarOpen(false);
    router.push("/profile");
  };

  // Get display name and initials from email
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
            <Link href="/referrals">referrals</Link>
          </nav>

          <div className="spacer"></div>

          <button
            className="dark-mode-toggle"
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

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

            {/* Sidebar dropdown */}
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
