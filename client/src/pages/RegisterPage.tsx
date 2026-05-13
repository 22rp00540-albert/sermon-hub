import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { CountrySelect } from "../components/CountrySelect";
import { useI18n } from "../context/useI18n";
import { AFRICAN_COUNTRIES, findCountryByName } from "../data/africanCountries";

const DIAL_OPTIONS = [...new Set(AFRICAN_COUNTRIES.map((c) => c.dial))].sort(
  (a, b) => parseInt(a.replace("+", ""), 10) - parseInt(b.replace("+", ""), 10),
);

function buildFullPhone(dial: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
  const code = dial.trim() || "";
  return `${code}${withoutLeadingZero}`;
}

export default function RegisterPage() {
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [dialCode, setDialCode] = useState("+250");
  const [phoneNational, setPhoneNational] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const countryOptions = useMemo(() => AFRICAN_COUNTRIES, []);

  const onCountryChange = (name: string) => {
    setCountry(name);
    const row = findCountryByName(name);
    if (row) setDialCode(row.dial);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const phoneNumber = buildFullPhone(dialCode, phoneNational);
    try {
      const { data } = await api.post("/auth/register", {
        fullName,
        email,
        password,
        country,
        phoneNumber,
      });
      setMessage(data.message ?? t("register.success"));
    } catch (error: any) {
      setMessage(error?.response?.data?.message ?? t("register.failed"));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-overlay" />
      <div className="auth-shell register-shell">
        <form
          className="card form auth-form register-form login-mock-card register-mock-card"
          onSubmit={onSubmit}
        >
          <img className="login-mock-logo" src="/logo.jpeg" alt="Church logo" />
          <input
            placeholder={t("common.fullName")}
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            type="email"
            placeholder={t("common.emailAddress")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={`${t("common.password")} (min 6 chars)`}
              required
              minLength={6}
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

          <CountrySelect
            id="register-country"
            value={country}
            countries={countryOptions}
            onChange={onCountryChange}
          />

          <div className="register-phone-row">
            <select
              id="register-dial"
              className="register-select register-dial-select"
              aria-label="Dial code"
              title="Dial code"
              value={dialCode}
              onChange={(e) => setDialCode(e.target.value)}
              required
            >
              {DIAL_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              id="register-phone"
              type="tel"
              inputMode="numeric"
              className="register-phone-input"
              placeholder={t("common.phoneNumber")}
              required
              minLength={5}
              value={phoneNational}
              onChange={(e) => setPhoneNational(e.target.value)}
              autoComplete="tel-national"
            />
          </div>

          <button className="btn primary auth-btn login-mock-btn" type="submit">
            {t("common.register")}
          </button>
          <div className="login-footer-links" role="navigation" aria-label="Account help">
            <span className="login-footer-register-line">
              <span className="login-footer-muted">{t("register.alreadyRegistered")}</span>{" "}
              <Link to="/login?from=home">{t("register.goToLogin")}</Link>
            </span>
          </div>
        </form>
        {message && <p className="alert">{message}</p>}
      </div>
    </div>
  );
}
