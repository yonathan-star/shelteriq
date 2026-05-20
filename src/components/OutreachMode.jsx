import { useState } from "react";
import { runOutreachLookup } from "../lib/gemini";
import { enrichResults } from "../lib/matching";
import { ServiceCard, SkeletonCard } from "./ServiceCard";
import { useGeolocation } from "../hooks/useGeolocation";

export function OutreachMode({ language }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { coords } = useGeolocation();

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await runOutreachLookup(query, language);
      const enriched = enrichResults(
        response.data.matches,
        response.data.reasons,
        coords
      );
      setResults(enriched);
    } catch {
      setError("Search failed. Check your connection and try again.");
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="outreach-panel">
      <div>
        <p className="outreach-header">Outreach Worker Mode</p>
        <div className="outreach-form">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder='e.g. "Veteran, male, substance abuse, no ID"'
            className="outreach-input"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="btn-outreach-search"
          >
            {loading ? "..." : "Search"}
          </button>
        </div>
        {error && (
          <p className="form-error">{error}</p>
        )}
      </div>
      {loading
        ? [0, 1, 2].map(item => <SkeletonCard key={item} />)
        : results.map((service, i) => (
          <ServiceCard key={service.id} service={service} rank={i + 1} language={language} />
        ))}
    </div>
  );
}
