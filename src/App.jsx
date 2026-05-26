import { useState } from "react";
import { IntakeForm } from "./components/IntakeForm";
import { ResultsPanel } from "./components/ResultsPanel";
import { MapView } from "./components/MapView";
import { OutreachMode } from "./components/OutreachMode";
import { LanguageToggle } from "./components/LanguageToggle";
import { OfflineBanner } from "./components/OfflineBanner";
import { HomePage } from "./components/HomePage";
import { CrisisBanner } from "./components/CrisisBanner";
import { filterServices, enrichResults } from "./lib/matching";
import { runComplexIntake } from "./lib/gemini";
import { recordAttempt, resetMemory, getMemorySummary } from "./lib/triageMemory";
import { useGeolocation } from "./hooks/useGeolocation";

// Remove old ChatInterface session storage key — can cause Gemini history errors
sessionStorage.removeItem("shelteriq_greeting");

function loadSavedResults() {
  try { return JSON.parse(localStorage.getItem("sq_results") || "null"); } catch { return null; }
}

export default function App() {
  const [showHome, setShowHome] = useState(true);
  const [language, setLanguage] = useState("en");
  const [view, setView] = useState(() => loadSavedResults() ? "results" : "intake");
  const [results, setResults] = useState(() => loadSavedResults() || []);
  const [intakeMeta, setIntakeMeta] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sq_meta") || "{}"); } catch { return {}; }
  });
  const [loading, setLoading] = useState(false);
  const [crisis, setCrisis] = useState(null); // { type, situation }
  const { coords } = useGeolocation();

  const handleSimpleSubmit = (need, who, area) => {
    const matched = filterServices(need, who, area, coords);
    const meta = { need, who, area };
    setResults(matched);
    setIntakeMeta(meta);
    recordAttempt({ query: `${need} · ${who} · ${area}`, resultsShown: matched });
    localStorage.setItem("sq_results", JSON.stringify(matched));
    localStorage.setItem("sq_meta", JSON.stringify(meta));
    localStorage.removeItem("sq_qa");
    setView("results");
  };

  const handleComplexSubmit = async (situation) => {
    setLoading(true);
    try {
      const response = await runComplexIntake(situation, language);
      if (response.type === "results") {
        const matched = enrichResults(response.data.matches, response.data.reasons, coords);
        recordAttempt({ query: situation.slice(0, 120), resultsShown: matched });
        setResults(matched);
        localStorage.setItem("sq_results", JSON.stringify(matched));
        localStorage.setItem("sq_meta", JSON.stringify({ complex: true }));
        localStorage.removeItem("sq_qa");
        setView("results");
      }
    } catch {
      // Silently fail — user stays on intake
    }
    setLoading(false);
  };

  const handleSuggestNext = async () => {
    const summary = getMemorySummary();
    if (!summary) return;
    setLoading(true);
    try {
      const situation = `I need help finding services. I have already been shown ${summary.alreadyShown.length} options that did not work for me. Please find me different options I have not been shown yet.`;
      const response = await runComplexIntake(situation, language, summary);
      if (response.type === "results") {
        const matched = enrichResults(response.data.matches, response.data.reasons, coords);
        recordAttempt({ query: "suggest-next", resultsShown: matched });
        setResults(matched);
        localStorage.setItem("sq_results", JSON.stringify(matched));
        localStorage.setItem("sq_meta", JSON.stringify({ complex: true }));
        localStorage.removeItem("sq_qa");
        setView("results");
      }
    } catch {
      // Silently fail
    }
    setLoading(false);
  };

  const handleCrisisDetected = (type, situation) => {
    setCrisis({ type, situation });
    setView("crisis");
  };

  const handleCrisisDismiss = () => {
    // After dismissing crisis banner, run the intake as normal
    if (crisis?.situation) {
      handleComplexSubmit(crisis.situation);
    }
    setCrisis(null);
    setView("results");
  };

  const handleReset = () => {
    setResults([]);
    setIntakeMeta({});
    setCrisis(null);
    resetMemory();
    localStorage.removeItem("sq_results");
    localStorage.removeItem("sq_meta");
    localStorage.removeItem("sq_qa");
    setView("intake");
  };

  if (showHome) {
    return (
      <HomePage
        onUserMode={() => setShowHome(false)}
        onOutreachMode={() => { setShowHome(false); setView("outreach"); }}
      />
    );
  }

  const isOutreach = view === "outreach";

  return (
    <div className="app-shell">
      <header>
        <div>
          <span className="logo">ShelterIQ</span>
          <span className="logo-sub">Broward County</span>
        </div>
        <div className="header-actions">
          <LanguageToggle current={language} onChange={setLanguage} />
          <button
            onClick={() => setView(v => v === "outreach" ? (results.length ? "results" : "intake") : "outreach")}
            className="btn-mode"
          >
            {isOutreach ? "User mode" : "Outreach"}
          </button>
        </div>
      </header>

      <OfflineBanner language={language} />

      {!isOutreach && view !== "crisis" && (
        <div className="nav-tabs">
          {[
            { id: "intake", label: "Intake" },
            { id: "results", label: "Results" },
            { id: "map", label: "Map" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`nav-tab ${view === tab.id ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <main className="app-main">
        {view === "crisis" && crisis && (
          <div className="tab-content scroll-panel">
            <CrisisBanner
              crisisType={crisis.type}
              language={language}
              onDismiss={handleCrisisDismiss}
            />
          </div>
        )}
        {view === "intake" && (
          <div className="tab-content scroll-panel">
            <IntakeForm
              language={language}
              onSimpleSubmit={handleSimpleSubmit}
              onComplexSubmit={handleComplexSubmit}
              onCrisisDetected={handleCrisisDetected}
              loading={loading}
            />
          </div>
        )}
        {view === "results" && (
          <div className="tab-content scroll-panel">
            <ResultsPanel
              results={results}
              onReset={handleReset}
              language={language}
              need={intakeMeta.need}
              who={intakeMeta.who}
              onSuggestNext={handleSuggestNext}
            />
          </div>
        )}
        {view === "map" && (
          <div className="tab-content map-panel">
            <MapView services={results.length > 0 ? results : []} userCoords={coords} language={language} />
          </div>
        )}
        {view === "outreach" && (
          <div className="tab-content scroll-panel">
            <OutreachMode language={language} />
          </div>
        )}
      </main>
    </div>
  );
}
