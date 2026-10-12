import { validService } from '../lib/storage.js';
import { detectCrisis } from '../lib/crisis.js';
import { uiCopy } from '../lib/uiCopy.js';
import { sessionStore as sessionStorage } from '../lib/storage.js';
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
    const value=JSON.parse(sessionStorage.getItem(OUTREACH_STATE_KEY) || "{}");return value&&typeof value.query==="string"&&Array.isArray(value.results)&&value.results.every(validService)?value:{};
  } catch {
    return {};
  }
}

export function OutreachMode({ language, onNavigateService, onCrisisDetected }) {
  const savedState = loadOutreachState();
  const R=releaseCopy(language),U=uiCopy(language);
  const [requestedNeed,setRequestedNeed]=useState("other");
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
    const crisis=detectCrisis(query);if(crisis&&onCrisisDetected){onCrisisDetected(crisis,query);return;}
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await runOutreachLookup(query, language,{need:requestedNeed,area:broadArea});
      if (response.type !== "results") { setNotice(response.text); setResults([]); persistState({ results: [] }); return; }
      setNotice(response.notice || "");
      const enriched = enrichResults(response.data.matches, response.data.reasons, coords);
      setResults(enriched);
      persistState({ query, results: enriched });
      logSearch({
        requestedNeed:response.meta?.need||requestedNeed,broadArea:response.meta?.area||broadArea,language,
        resultsCount: enriched.length, serviceIds: enriched.map(s=>s.id),
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
          {U.search}
        </button>
        <button
          className={`outreach-tab${activeTab === "intelligence" ? " active" : ""}`}
          data-tab="intelligence"
          onClick={() => {
            setActiveTab("intelligence");
            persistState({ activeTab: "intelligence" });
          }}
        >
          {U.intelligence}
        </button>
      </div>

      {activeTab === "search" && (
        <>
          <div className="release-panel"><label>{R.need}<select value={requestedNeed} onChange={e=>setRequestedNeed(e.target.value)}>{["shelter","food","mental_health","other"].map(n=><option key={n} value={n}>{L.typeBadge[n]||(n==="other"?(language==="es"?"Otro / no sé":language==="ht"?"Lòt / pa konnen":"Other / not sure"):n)}</option>)}</select></label><label>{R.area}<select value={broadArea} onChange={e=>setBroadArea(e.target.value)}>{["unsure","north","central","south"].map(a=><option key={a} value={a}>{R[a]}</option>)}</select></label></div>
          <div className="outreach-form">
            <input
              aria-label={U.query}
              maxLength={3000}
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
                need={requestedNeed}
                language={language}
                onNavigate={service=>onNavigateService(service,results)}
              />
            ))}
        </>
      )}

      {activeTab === "intelligence" && <IntelligenceDashboard language={language} />}
    </div>
  );
}
