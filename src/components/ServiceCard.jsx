import { useState } from "react";
import { Clock, MapPin, Phone, Users, Loader, MessageSquare } from "lucide-react";
import { generateCallScript } from "../lib/gemini";

export function SkeletonCard() {
  return (
    <div className="service-card" aria-hidden="true">
      <div className="service-top">
        <div className="skeleton skeleton-circle" />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-line skeleton-name" />
          <div className="skeleton skeleton-line skeleton-distance" />
        </div>
      </div>
      <div className="skeleton skeleton-reason" />
      <div className="skeleton skeleton-line skeleton-meta" />
      <div className="skeleton skeleton-line skeleton-meta short" />
      <div className="skeleton skeleton-button" />
    </div>
  );
}

export function ServiceCard({ service, rank, need, who, language = "en" }) {
  const [script, setScript] = useState(null);
  const [loadingScript, setLoadingScript] = useState(false);

  const handleGetScript = async () => {
    if (script || loadingScript) return;
    setLoadingScript(true);
    try {
      const text = await generateCallScript(service, need, who, language);
      setScript(text);
    } catch {
      setScript("Unable to generate guidance — please call the number below directly.");
    }
    setLoadingScript(false);
  };

  return (
    <div className="service-card">
      <div className="service-top">
        <span className={`rank-badge rank-${rank}`}>{rank}</span>
        <div>
          <h3 className="service-name">{service.name}</h3>
          {service.distance !== null && (
            <p className="service-distance">{service.distance} miles away</p>
          )}
        </div>
      </div>

      {service.reason && (
        <p className="reason-box">{service.reason}</p>
      )}

      <div className="type-list">
        {service.type.map(t => (
          <span key={t} className={`type-badge type-${t}`}>
            {t.replace("_", " ")}
          </span>
        ))}
      </div>

      <div className="service-meta">
        <p className="meta-row"><MapPin size={14} /><span>{service.address}</span></p>
        <p className="meta-row"><Clock size={14} /><span>{service.hours}</span></p>
        <p className="meta-row">
          <Phone size={14} />
          <span>{service.walkin ? "Walk-in accepted" : "Call ahead / referral required"}</span>
        </p>
        {service.eligibility.pets && (
          <p className="meta-row"><Users size={14} /><span>Pets allowed</span></p>
        )}
        {service.eligibility.noId && (
          <p className="meta-row"><Users size={14} /><span>No ID required</span></p>
        )}
        {service.beds && (
          <p className="meta-row"><Users size={14} /><span>{service.beds} beds</span></p>
        )}
      </div>

      {script && (
        <div className="call-script">
          <p className="call-script-label">What to say when you call:</p>
          <p className="call-script-text">{script}</p>
        </div>
      )}

      <div className="card-actions">
        <a href={`tel:${service.phone}`} className="btn-call">
          <Phone size={16} />
          <span>Call {service.phone}</span>
        </a>
        {!script && (
          <button
            className="btn-script"
            onClick={handleGetScript}
            disabled={loadingScript}
          >
            {loadingScript
              ? <Loader size={14} className="spin" />
              : <MessageSquare size={14} />}
            <span>{loadingScript ? "Generating..." : "How to call"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
