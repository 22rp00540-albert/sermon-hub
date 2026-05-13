import { useState } from "react";
import { useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/useAuth";
import { useI18n } from "../context/useI18n";

/** Allow only same-origin paths after login (blocks open redirects). */
function sanitizePostLoginPath(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("..") || t.includes("\\")) return null;
  return t;
}

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Keep the landing page as the real entry point.
    if (searchParams.get("from") !== "home") {
      navigate("/", { replace: true });
    }
  }, [navigate, searchParams]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
      if (data.user.role === "ADMIN") {
        navigate("/admin");
      } else {
        const next = sanitizePostLoginPath(searchParams.get("next"));
        navigate(next ?? "/member");
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? t("login.failed"));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-overlay" />
      <div className="auth-shell login-shell">
        <form className="card form auth-form login-mock-card" onSubmit={onSubmit}>
          <img className="login-mock-logo" src="/logo.jpeg" alt="Church logo" />
          <input type="email" placeholder={t("common.emailAddress")} required value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t("common.password")}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              <span className={`password-toggle-icon ${showPassword ? "is-visible" : "is-hidden"}`} aria-hidden="true" />
            </button>
          </div>
          <button className="btn primary auth-btn login-mock-btn" type="submit">
            {t("common.login")}
          </button>
          <div className="login-footer-links" role="navigation" aria-label="Account help">
            <Link to="/forgot-password">{t("common.forgotPassword")}</Link>
            <span className="login-footer-sep" aria-hidden="true">
              |
            </span>
            <span className="login-footer-register-line">
              <span className="login-footer-muted">{t("login.noAccount")}</span>{" "}
              <Link to="/register">{t("login.registerHere")}</Link>
            </span>
          </div>
        </form>
        {message && <p className="alert">{message}</p>}
      </div>
    </div>
  );
}
