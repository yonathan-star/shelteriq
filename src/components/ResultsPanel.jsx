import { useState } from "react";
import { House, Phone, Send, Loader } from "lucide-react";
import { ServiceCard, SkeletonCard } from "./ServiceCard";
import { answerFollowUp } from "../lib/gemini";

export function ResultsPanel({ results, onReset, language, loading = false, need, who }) {
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sq_qa") || "[]"); } catch { return []; }
  });
  const [qaLoading, setQaLoading] = useState(false);

  const labels = {
    en: {
      title: "Top matches for you",
      reset: "Start over",
      noResultsTitle: "No matches found",
      noResults: "Try describing your situation differently, or call the Broward Homeless Helpline directly.",
      qaHeading: "Ask a question about these services",
      qaPlaceholder: "e.g. Do I need ID? Can I bring my dog?",
      qaSubmit: "Ask",
    },
    es: {
      title: "Mejores opciones para usted",
      reset: "Empezar de nuevo",
      noResultsTitle: "No se encontraron opciones",
      noResults: "Intente describir su situacion de otra manera, o llame directamente a la linea de ayuda.",
      qaHeading: "Haga una pregunta sobre estos servicios",
      qaPlaceholder: "ej. ¿Necesito identificación? ¿Puedo traer mi perro?",
      qaSubmit: "Preguntar",
    },
    ht: {
      title: "Meye opsyon pou ou",
      reset: "Rekomanse",
      noResultsTitle: "Pa gen rezilta",
      noResults: "Eseye dekri sitiyasyon ou yon lot jan, oswa rele liy ed Broward la direkteman.",
      qaHeading: "Poze yon kesyon sou sèvis sa yo",
      qaPlaceholder: "eg. Èske mwen bezwen ID? Èske mwen ka mennen chen mwen?",
      qaSubmit: "Mande",
    },
  };
  const L = labels[language] || labels.en;

  const handleAsk = async () => {
    if (!question.trim() || qaLoading) return;
    const q = question.trim();
    setQuestion("");
    setQaLoading(true);
    const newHistory = [...qaHistory, { role: "user", text: q }];
    setQaHistory(newHistory);
    try {
      const answer = await answerFollowUp(q, results, language);
      const final = [...newHistory, { role: "ai", text: answer }];
      setQaHistory(final);
      localStorage.setItem("sq_qa", JSON.stringify(final));
    } catch {
      const final = [...newHistory, { role: "ai", text: "I couldn't answer that — please call 954-563-4357." }];
      setQaHistory(final);
    }
    setQaLoading(false);
  };

  if (loading) {
    return (
      <div className="results-panel">
        <div className="results-header">
          <h2 className="results-title">{L.title}</h2>
          <button onClick={onReset} className="btn-reset">{L.reset}</button>
        </div>
        <div className="results-list">
          {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><House size={24} /></div>
        <h3>{L.noResultsTitle}</h3>
        <p>{L.noResults}</p>
        <a href="tel:9545634357" className="btn-call">
          <Phone size={16} /><span>Call 954-563-4357</span>
        </a>
        <button onClick={onReset} className="btn-reset">{L.reset}</button>
      </div>
    );
  }

  return (
    <div className="results-panel">
      <div className="results-header">
        <h2 className="results-title">{L.title}</h2>
        <button onClick={onReset} className="btn-reset">{L.reset}</button>
      </div>

      <div className="results-list">
        {results.map((service, i) => (
          <ServiceCard key={service.id} service={service} rank={i + 1} need={need} who={who} language={language} />
        ))}
      </div>

      <div className="qa-section">
        <h3 className="qa-heading">{L.qaHeading}</h3>
        {qaHistory.length > 0 && (
          <div className="qa-history">
            {qaHistory.map((msg, i) => (
              <div key={i} className={`qa-msg qa-${msg.role}`}>
                <p>{msg.text}</p>
              </div>
            ))}
            {qaLoading && (
              <div className="qa-msg qa-ai">
                <Loader size={14} className="spin" />
              </div>
            )}
          </div>
        )}
        <div className="qa-input-row">
          <input
            className="qa-input"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAsk()}
            placeholder={L.qaPlaceholder}
          />
          <button className="qa-submit" onClick={handleAsk} disabled={qaLoading || !question.trim()}>
            {qaLoading ? <Loader size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
