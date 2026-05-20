const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ht", label: "HT" }
];

export function LanguageToggle({ current, onChange }) {
  return (
    <div className="lang-toggle">
      {LANGUAGES.map(lang => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code)}
          className={`lang-btn ${current === lang.code ? "active" : ""}`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
