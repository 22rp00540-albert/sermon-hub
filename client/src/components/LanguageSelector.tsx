import { useI18n } from "../context/useI18n";
import type { LanguageCode } from "../context/I18nContext";

export default function LanguageSelector() {
  const { language, setLanguage, languageOptions, t } = useI18n();

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1000,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid #d6d6d6",
        borderRadius: 8,
        padding: "4px 6px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        maxWidth: 220,
      }}
    >
      <label htmlFor="global-language-select" style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
        {t("common.language")}
      </label>
      <select
        id="global-language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        size={1}
        style={{
          border: "1px solid #c5c5c5",
          borderRadius: 6,
          padding: "3px 24px 3px 8px",
          fontSize: 12,
          height: 30,
          minWidth: 125,
          maxWidth: 150,
          width: 150,
          backgroundColor: "#7f8b9b",
          color: "#fff",
          fontWeight: 600,
          appearance: "auto",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {languageOptions.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
