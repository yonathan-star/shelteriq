import { releaseCopy } from "../lib/releaseCopy";
import { useState } from "react";
import { runOutreachLookup } from "../lib/gemini";
import { enrichResults } from "../lib/matching";
import { logSearch } from "../lib/searchIntelligence";
import { ServiceCard, SkeletonCard } from "./ServiceCard";
import { IntelligenceDashboard } from "./IntelligenceDashboard";
import { useGeolocation } from "../hooks/useGeolocation";
import { t } from "../lib/i18n";

const OUTREACH_STATE_KEY = "sq_outreach_state";

function loadOutreachState() {
  try {
    return JSON.parse(sessionStorage.getItem(OUTREACH_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function OutreachMode({ language, onNavigateService }) {
  const savedState = loadOutreachState();
  const R=releaseCopy(language);
  const [requestedNeed,setRequestedNeed]=useState("shelter");
  const [broadArea,setBroadArea]=useState("unsure");
  const [activeTab, setActiveTab] = useState(savedState.activeTab || "search");
  const [query, setQuery] = useState(savedState.query || "");
  const [results, setResults] = useState(savedState.results || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { coords } = useGeolocation();
  const L = t(language);

  const persistState = (next) => {
    sessionStorage.setItem(OUTREACH_STATE_KEY, JSON.stringify({
      activeTab,
      query,
      results,
      ...next,
    }));
  };

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await runOutreachLookup(query, language);
      if (response.type !== "results") { setNotice(response.text); setResults([]); persistState({ results: [] }); return; }
      setNotice(response.notice || "");
      const enriched = enrichResults(response.data.matches, response.data.reasons, coords);
      setResults(enriched);
      persistState({ query, results: enriched });
      logSearch({
        requestedNeed,broadArea,language,
        resultsCount: enriched.length,
        serviceTypes: enriched.flatMap(s => s.type)
      });
    } catch {
      setError(L.outreachError);
      setResults([]);
      persistState({ query, results: [] });
    } finally { setLoading(false); }
  };

  return (
    <div className="outreach-panel">
      <p className="outreach-header">{L.outreachTitle}</p>

      <div className="outreach-tabs">
        <button
          className={`outreach-tab${activeTab === "search" ? " active" : ""}`}
          data-tab="search"
          onClick={() => {
            setActiveTab("search");
            persistState({ activeTab: "search" });
          }}
        >
          Search
        </button>
        <button
          className={`outreach-tab${activeTab === "intelligence" ? " active" : ""}`}
          data-tab="intelligence"
          onClick={() => {
            setActiveTab("intelligence");
            persistState({ activeTab: "intelligence" });
          }}
        >
          Intelligence
        </button>
      </div>

      {activeTab === "search" && (
        <>
          <div className="release-panel"><label>{R.need}<select value={requestedNeed} onChange={e=>setRequestedNeed(e.target.value)}>{["shelter","food","mental_health","other"].map(n=><option key={n} value={n}>{n.replaceAll("_"," ")}</option>)}</select></label><label>{R.area}<select value={broadArea} onChange={e=>setBroadArea(e.target.value)}>{["unsure","north","central","south"].map(a=><option key={a} value={a}>{R[a]}</option>)}</select></label></div>
          <div className="outreach-form">
            <input
              value={query}
              onChange={e => {
                const nextQuery = e.target.value;
                setQuery(nextQuery);
                persistState({ query: nextQuery });
              }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={L.outreachPlaceholder}
              className="outreach-input"
            />
            <button onClick={handleSearch} disabled={loading} className="btn-outreach-search">
              {loading ? "..." : L.outreachSearch}
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="search-notice" role="status">{notice}</p>}
          {!loading && !notice && results.length === 0 && query && <p>{L.noResultsTitle}</p>}
          {loading
            ? [0, 1, 2].map(i => <SkeletonCard key={i} />)
            : results.map((service, i) => (
              <ServiceCard
                key={service.id}
                service={service}
                rank={i + 1}
                language={language}
                onNavigate={onNavigateService}
              />
            ))}
        </>
      )}

      {activeTab === "intelligence" && <IntelligenceDashboard language={language} />}
    </div>
  );
}
