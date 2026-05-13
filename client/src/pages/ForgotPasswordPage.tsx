import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useI18n } from "../context/useI18n";

const SEND_COOLDOWN_SEC = 60;

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sendCooldownSeconds, setSendCooldownSeconds] = useState(0);
  const [resetSuccessful, setResetSuccessful] = useState(false);

  const cooldownActive = sendCooldownSeconds > 0;

  useEffect(() => {
    if (!cooldownActive) return;
    const id = window.setInterval(() => {
      setSendCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownActive]);

  const applyCooldownFromError = (msg: string) => {
    if (/60\s*second/i.test(msg) || /wait.*before requesting/i.test(msg)) {
      setSendCooldownSeconds(SEND_COOLDOWN_SEC);
    }
  };

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (cooldownActive) return;
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/auth/forgot-password/request", { email });
      setCodeRequested(true);
      setSendCooldownSeconds(SEND_COOLDOWN_SEC);
      setMessage(data?.message || "Reset code sent. Check your email.");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Failed to send reset code";
      setError(msg);
      applyCooldownFromError(msg);
    }
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/auth/forgot-password/reset", {
        email,
        code,
        newPassword,
        confirmPassword,
      });
      setMessage(data?.message || "Password reset successful.");
      setResetSuccessful(true);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      const msg =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? "New password and confirmation must each be at least 6 characters."
            : "Failed to reset password";
      setError(msg);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-overlay" />
      <div className="auth-shell login-shell">
        <form
          className="card form auth-form login-mock-card"
          onSubmit={resetSuccessful ? (e) => e.preventDefault() : codeRequested ? resetPassword : requestCode}
        >
          <img className="login-mock-logo" src="/logo.jpeg" alt="Church logo" />
          <h3 className="forgot-title">{t("forgot.title")}</h3>
          <p className="muted centered forgot-subtitle">
            {t("forgot.subtitle")}
          </p>

          <input
            type="email"
            placeholder={t("common.emailAddress")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={codeRequested}
          />

          {codeRequested && !resetSuccessful && (
            <>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <input
                type="password"
                placeholder="New password (min 6 characters)"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                placeholder="Confirm new password (min 6 characters)"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <p className="muted centered login-mock-note" style={{ margin: 0 }}>
                Use at least 6 characters. Both fields must match.
              </p>
            </>
          )}

          {resetSuccessful && (
            <p className="muted centered forgot-subtitle forgot-success-hint" style={{ marginBottom: 4 }}>
              {t("forgot.resetSuccess")}
            </p>
          )}

          {resetSuccessful ? (
            <Link
              to="/login?from=home"
              className="btn primary auth-btn login-mock-btn forgot-success-login-link"
            >
              {t("forgot.goToLogin")}
            </Link>
          ) : (
            <button
              className="btn primary auth-btn login-mock-btn"
              type="submit"
              disabled={!codeRequested && cooldownActive}
            >
              {codeRequested
                ? t("forgot.resetPassword")
                : cooldownActive
                  ? `${t("forgot.wait")} ${sendCooldownSeconds}s`
                  : t("forgot.sendCode")}
            </button>
          )}

          {!codeRequested && (
            <p className="muted centered login-mock-note">
              {t("forgot.backToLogin")} <Link to="/login?from=home">{t("common.login")}</Link>
            </p>
          )}
          {codeRequested && !resetSuccessful && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCodeRequested(false);
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
                setMessage("");
                setError("");
                setResetSuccessful(false);
              }}
            >
              {t("forgot.startOver")}
            </button>
          )}
        </form>
        {message && <p className="alert forgot-alert-success">{message}</p>}
        {error && <p className="alert">{error}</p>}
      </div>
    </div>
  );
}
