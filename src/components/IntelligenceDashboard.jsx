import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getIntelligenceSummary } from "../lib/searchIntelligence";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

async function generateGapAnalysis(summary) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { maxOutputTokens: 300, temperature: 0.4 }
  });

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

  const result = await model.generateContent(prompt);
  return result.response.text();
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
      setError("Could not generate analysis. Check your API key.");
    }
    setLoading(false);
  };

  if (!summary) {
    return (
      <div className="intel-empty">
        <p>Run at least 2 searches to generate a gap analysis.</p>
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
