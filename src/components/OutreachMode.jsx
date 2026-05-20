import { useState } from "react";
import { runOutreachLookup } from "../lib/gemini";
import { enrichResults } from "../lib/matching";
import { ServiceCard, SkeletonCard } from "./ServiceCard";
import { useGeolocation } from "../hooks/useGeolocation";
import { t } from "../lib/i18n";

export function OutreachMode({ language }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { coords } = useGeolocation();
  const L = t(language);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await runOutreachLookup(query, language);
      const enriched = enrichResults(response.data.matches, response.data.reasons, coords);
      setResults(enriched);
    } catch {
      setError(L.outreachError);
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="outreach-panel">
      <p className="outreach-header">{L.outreachTitle}</p>
      <div className="outreach-form">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={L.outreachPlaceholder}
          className="outreach-input"
        />
        <button onClick={handleSearch} disabled={loading} className="btn-outreach-search">
          {loading ? "..." : L.outreachSearch}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading
        ? [0, 1, 2].map(i => <SkeletonCard key={i} />)
        : results.map((service, i) => (
          <ServiceCard key={service.id} service={service} rank={i + 1} language={language} />
        ))}
    </div>
  );
}
