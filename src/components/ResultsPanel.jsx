import { House, Phone } from "lucide-react";
import { ServiceCard, SkeletonCard } from "./ServiceCard";

export function ResultsPanel({ results, onReset, language, loading = false }) {
  const labels = {
    en: {
      title: "Top matches for you",
      reset: "Start over",
      noResultsTitle: "No matches found",
      noResults:
        "Try describing your situation differently, or call the Broward Homeless Helpline directly."
    },
    es: {
      title: "Mejores opciones para usted",
      reset: "Empezar de nuevo",
      noResultsTitle: "No se encontraron opciones",
      noResults:
        "Intente describir su situacion de otra manera, o llame directamente a la linea de ayuda."
    },
    ht: {
      title: "Meye opsyon pou ou",
      reset: "Rekomanse",
      noResultsTitle: "Pa gen rezilta",
      noResults:
        "Eseye dekri sitiyasyon ou yon lot jan, oswa rele liy ed Broward la direkteman."
    }
  };
  const L = labels[language] || labels.en;

  if (loading) {
    return (
      <div className="results-panel">
        <div className="results-header">
          <h2 className="results-title">{L.title}</h2>
          <button onClick={onReset} className="btn-reset">
            {L.reset}
          </button>
        </div>
        <div className="results-list">
          {[0, 1, 2].map(item => (
            <SkeletonCard key={item} />
          ))}
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <House size={24} />
        </div>
        <h3>{L.noResultsTitle}</h3>
        <p>{L.noResults}</p>
        <a href="tel:9545634357" className="btn-call">
          <Phone size={16} />
          <span>Call 954-563-4357</span>
        </a>
        <button onClick={onReset} className="btn-reset">
          {L.reset}
        </button>
      </div>
    );
  }

  return (
    <div className="results-panel">
      <div className="results-header">
        <h2 className="results-title">{L.title}</h2>
        <button onClick={onReset} className="btn-reset">
          {L.reset}
        </button>
      </div>
      <div className="results-list">
        {results.map((service, i) => (
          <ServiceCard key={service.id} service={service} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
