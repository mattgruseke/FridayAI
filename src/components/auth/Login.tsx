"use client";

import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { signIn, resetPassword } from "@/app/(auth)/actions";
import { getErrorMessage } from "@/lib/errors";
import { siteConfig } from "@/config/site";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams?.get("from") || "/";

  useEffect(() => {
    // Check for verification success
    if (searchParams?.get("verified") === "true") {
      setMessage("Email verified! You can now log in.");
    }

    // Redirect if already authenticated
    if (isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, redirectTo, router, searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      // Use window.location for a full page reload to ensure cookies are picked up
      window.location.href = redirectTo;
    } catch (err) {
      const message = getErrorMessage(err);
      if (message.includes("Email not confirmed")) {
        setError(
          "Please verify your email before logging in. Check your inbox for the verification link."
        );
      } else if (message.includes("Invalid login credentials")) {
        setError("Invalid email or password.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (!email) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    try {
      await resetPassword(email);
      setMessage("Password reset link sent! Check your email.");
      setShowForgotPassword(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-header">
          <Link href="/" className="auth-logo">
            {siteConfig.name}
          </Link>
          <h1>{showForgotPassword ? "Reset Password" : "Log In"}</h1>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <button
              type="button"
              className="auth-link-btn"
              onClick={() => setShowForgotPassword(false)}
            >
              Back to login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>

            <button
              type="button"
              className="auth-link-btn"
              onClick={() => setShowForgotPassword(true)}
            >
              Forgot password?
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            Don&apos;t have an account? <Link href="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
