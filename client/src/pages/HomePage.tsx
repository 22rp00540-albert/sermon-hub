import { Link } from "react-router-dom";
import { useI18n } from "../context/useI18n";

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="landing">
      <div className="landing-overlay" />
      <div className="global-brand">
        <img className="global-brand-logo" src="/logo.jpeg" alt="Church logo" />
      </div>
      <section className="landing-card">
        <p className="landing-tag">{t("home.tagline")}</p>
        <h1>{t("home.title")}</h1>
        <p className="landing-mini">{t("home.subtitle")}</p>
        <div className="row landing-actions">
          <Link className="btn primary" to="/login?from=home">
            {t("common.login")}
          </Link>
          <Link className="btn" to="/register">
            {t("common.register")}
          </Link>
        </div>
      </section>
      <div className="landing-pills" aria-label="Features">
        <span>{t("home.pill.streaming")}</span>
        <span>{t("home.pill.protected")}</span>
        <span>{t("home.pill.ministry")}</span>
      </div>
    </main>
  );
}
