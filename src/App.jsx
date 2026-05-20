import { useState } from "react";
import { ChatInterface } from "./components/ChatInterface";
import { ResultsPanel } from "./components/ResultsPanel";
import { MapView } from "./components/MapView";
import { OutreachMode } from "./components/OutreachMode";
import { LanguageToggle } from "./components/LanguageToggle";
import { OfflineBanner } from "./components/OfflineBanner";
import { useGeolocation } from "./hooks/useGeolocation";

export default function App() {
  const [language, setLanguage] = useState("en");
  const [view, setView] = useState("chat");
  const [results, setResults] = useState([]);
  const { coords } = useGeolocation();

  const handleResults = (enrichedResults) => {
    setResults(enrichedResults);
    setView("results");
  };

  const handleReset = () => {
    setResults([]);
    setView("chat");
  };

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
            onClick={() =>
              setView(v => (v === "outreach" ? "chat" : "outreach"))
            }
            className="btn-mode"
          >
            {view === "outreach" ? "User mode" : "Outreach"}
          </button>
        </div>
      </header>

      <OfflineBanner />

      {view !== "outreach" && (
        <div className="nav-tabs">
          {["chat", "results", "map"].map(tab => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`nav-tab ${view === tab ? "active" : ""}`}
            >
              {tab === "chat"
                ? "Intake"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}

      <main className="app-main">
        {view === "chat" && (
          <div className="tab-content scroll-panel">
            <ChatInterface language={language} onResults={handleResults} />
          </div>
        )}
        {view === "results" && (
          <div className="tab-content scroll-panel">
            <ResultsPanel
              results={results}
              onReset={handleReset}
              language={language}
            />
          </div>
        )}
        {view === "map" && (
          <div className="tab-content map-panel">
            <MapView
              services={results.length > 0 ? results : []}
              userCoords={coords}
            />
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
