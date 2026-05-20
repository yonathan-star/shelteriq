import { useState } from "react";
import { IntakeForm } from "./components/IntakeForm";
import { ResultsPanel } from "./components/ResultsPanel";
import { MapView } from "./components/MapView";
import { OutreachMode } from "./components/OutreachMode";
import { LanguageToggle } from "./components/LanguageToggle";
import { OfflineBanner } from "./components/OfflineBanner";
import { filterServices, enrichResults } from "./lib/matching";
import { runComplexIntake } from "./lib/gemini";
import { useGeolocation } from "./hooks/useGeolocation";

// Remove old ChatInterface session storage key — can cause Gemini history errors
sessionStorage.removeItem("shelteriq_greeting");

function loadSavedResults() {
  try { return JSON.parse(localStorage.getItem("sq_results") || "null"); } catch { return null; }
}

export default function App() {
  const [language, setLanguage] = useState("en");
  const [view, setView] = useState(() => loadSavedResults() ? "results" : "intake");
  const [results, setResults] = useState(() => loadSavedResults() || []);
  const [intakeMeta, setIntakeMeta] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sq_meta") || "{}"); } catch { return {}; }
  });
  const [loading, setLoading] = useState(false);
  const { coords } = useGeolocation();

  const handleSimpleSubmit = (need, who, area) => {
    const matched = filterServices(need, who, area, coords);
    const meta = { need, who, area };
    setResults(matched);
    setIntakeMeta(meta);
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
        setResults(matched);
        localStorage.setItem("sq_results", JSON.stringify(matched));
        localStorage.setItem("sq_meta", JSON.stringify({ complex: true }));
        localStorage.removeItem("sq_qa");
        setView("results");
      }
      // If it came back with a clarifying question we just ignore and let the user retry
    } catch {
      // Silently fail — user stays on intake
    }
    setLoading(false);
  };

  const handleReset = () => {
    setResults([]);
    setIntakeMeta({});
    localStorage.removeItem("sq_results");
    localStorage.removeItem("sq_meta");
    localStorage.removeItem("sq_qa");
    setView("intake");
  };

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

      <OfflineBanner />

      {!isOutreach && (
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
        {view === "intake" && (
          <div className="tab-content scroll-panel">
            <IntakeForm
              language={language}
              onSimpleSubmit={handleSimpleSubmit}
              onComplexSubmit={handleComplexSubmit}
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
            />
          </div>
        )}
        {view === "map" && (
          <div className="tab-content map-panel">
            <MapView services={results.length > 0 ? results : []} userCoords={coords} />
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
