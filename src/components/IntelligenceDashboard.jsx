import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getIntelligenceSummary } from "../lib/searchIntelligence";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

function buildLocalGapAnalysis(summary) {
  const topTypes = Object.entries(summary.typeFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type.replaceAll("_", " "));
  const topLabel = topTypes.length > 0 ? topTypes.join(", ") : "general support";
  const unmetCount = summary.lowResultSearches.length;
  const unmetLabel = unmetCount > 0
    ? `The clearest unmet needs came from ${unmetCount} search${unmetCount === 1 ? "" : "es"} with weak matches, especially ${summary.lowResultSearches.slice(0, 2).join(" and ")}.`
    : "Most searches still returned usable matches, so the pressure point appears to be capacity and fit rather than a total lack of services.";

  return `Across ${summary.totalSearches} searches over ${summary.sessionMinutes} minute(s), demand clustered around ${topLabel}. ${unmetLabel} Recent activity suggests staff need faster access to flexible placements that can absorb combined barriers without repeated dead ends.`;
}

async function generateGapAnalysis(summary) {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    return buildLocalGapAnalysis(summary);
  }

  const prompt = `You are an analyst for a Broward County homeless outreach team.
Based on this session's search data, write a 3-4 sentence plain-English
gap analysis. Be specific. Identify what types of services are most in
demand and what needs are going unmet. Write as if briefing a supervisor
at the end of a shift. Do not use bullet points. Do not use jargon.

Search data:
- Total searches this session: ${summary.totalSearches}
- Most searched service types: ${JSON.stringify(summary.typeFrequency)}
- Searches with poor results (high need, low supply): ${summary.lowResultSearches.join(" | ")}
- Recent queries: ${summary.recentQueries.join(" | ")}
- Session length: ${summary.sessionMinutes} minutes

Write the gap analysis now:`;

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { maxOutputTokens: 300, temperature: 0.35 }
      });
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error("Gap analysis timed out")), 12000);
        }),
      ]);
      const text = result.response.text()?.trim();
      if (text) return text;
    } catch {
      // Try the next model, then fall back locally below.
    }
  }

  return buildLocalGapAnalysis(summary);
}

export function IntelligenceDashboard() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const summary = getIntelligenceSummary();

  const handleGenerate = async () => {
    if (!summary) return;
    setLoading(true);
    setError(null);
    try {
      const text = await generateGapAnalysis(summary);
      setAnalysis(text);
    } catch {
      setAnalysis(buildLocalGapAnalysis(summary));
      setError("Showing local analysis because AI generation is unavailable.");
    }
    setLoading(false);
  };

  if (!summary) {
    return (
      <div className="intel-empty">
        <p>Run a search to generate a gap analysis.</p>
      </div>
    );
  }

  return (
    <div className="intel-dashboard">
      <div className="intel-stats">
        <div className="intel-stat">
          <span className="intel-stat-val">{summary.totalSearches}</span>
          <span className="intel-stat-lbl">Searches</span>
        </div>
        <div className="intel-stat">
          <span className="intel-stat-val">{summary.lowResultSearches.length}</span>
          <span className="intel-stat-lbl">Unmet needs</span>
        </div>
        <div className="intel-stat">
          <span className="intel-stat-val">{summary.sessionMinutes}m</span>
          <span className="intel-stat-lbl">Session</span>
        </div>
      </div>

      <div className="intel-section">
        <p className="intel-section-label">Most searched tonight</p>
        <div className="intel-type-bars">
          {Object.entries(summary.typeFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => (
              <div key={type} className="intel-type-row">
                <span className="intel-type-name">{type.replace("_", " ")}</span>
                <div className="intel-type-bar-wrap">
                  <div
                    className="intel-type-bar"
                    style={{ width: `${(count / summary.totalSearches) * 100}%` }}
                  />
                </div>
                <span className="intel-type-count">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {summary.lowResultSearches.length > 0 && (
        <div className="intel-section">
          <p className="intel-section-label">Searches with poor matches</p>
          {summary.lowResultSearches.map((q, i) => (
            <div key={i} className="intel-gap-item">
              <span className="intel-gap-dot" />
              <span>{q}</span>
            </div>
          ))}
        </div>
      )}

      <div className="intel-section">
        <p className="intel-section-label">AI gap analysis</p>
        {analysis ? (
          <div className="intel-analysis">
            <p>{analysis}</p>
            <button
              className="intel-regenerate"
              onClick={handleGenerate}
              disabled={loading}
            >
              Regenerate
            </button>
          </div>
        ) : (
          <button
            className="intel-generate-btn"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Generate gap analysis"}
          </button>
        )}
        {error && <p className="intel-error">{error}</p>}
      </div>
    </div>
  );
}
