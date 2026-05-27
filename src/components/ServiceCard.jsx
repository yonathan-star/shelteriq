import { useState, useEffect } from "react";
import { Clock, MapPin, Phone, Users, Loader, MessageSquare, Navigation } from "lucide-react";
import { generateCallScript } from "../lib/gemini";
import { recordRejection, recordContact } from "../lib/triageMemory";
import { t } from "../lib/i18n";
import { getCheckinStatus } from "../lib/checkin";
import { CheckInFlow } from "./CheckInFlow";

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

export function ServiceCard({ service, rank, need, who, language = "en", onNavigate }) {
  const [script, setScript] = useState(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [contacted, setContacted] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const L = t(language);

  // Load availability status from crowdsourced check-ins
  const checkinStatus = getCheckinStatus(service.id);

  useEffect(() => {
    const timer = setTimeout(() => setShowFeedback(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleGetScript = async () => {
    if (script || loadingScript) return;
    setLoadingScript(true);
    try {
      const text = await generateCallScript(service, need, who, language);
      setScript(text);
    } catch {
      setScript(L.callAhead);
    }
    setLoadingScript(false);
  };

  const handleNavigate = () => {
    if (!service.coords || !onNavigate) return;
    onNavigate(service);
  };

  return (
    <div className="service-card">
      <div className="service-top">
        <span className={`rank-badge rank-${rank}`}>{rank}</span>
        <div style={{ flex: 1 }}>
          <h3 className="service-name">{service.name}</h3>
          {service.distance != null && (
            <p className="service-distance">{L.miles(service.distance)}</p>
          )}
        </div>
        {checkinStatus && (
          <span className={`checkin-badge checkin-${checkinStatus.status}`}>
            {checkinStatus.status === "available" ? L.checkinAvailable
             : checkinStatus.status === "full" ? L.checkinFull
             : L.checkinMixed}
          </span>
        )}
      </div>

      {service.reason && (
        <p className="reason-box">{service.reason}</p>
      )}

      <div className="type-list">
        {service.type.map(type => (
          <span key={type} className={`type-badge type-${type}`}>
            {L.typeBadge[type] || type}
          </span>
        ))}
      </div>

      <div className="service-meta">
        <p className="meta-row"><MapPin size={14} /><span>{service.address}</span></p>
        <p className="meta-row"><Clock size={14} /><span>{service.hours}</span></p>
        <p className="meta-row">
          <Phone size={14} />
          <span>{service.walkin ? L.walkin : L.callAhead}</span>
        </p>
        {service.eligibility.pets && (
          <p className="meta-row"><Users size={14} /><span>{L.pets}</span></p>
        )}
        {service.eligibility.noId && (
          <p className="meta-row"><Users size={14} /><span>{L.noId}</span></p>
        )}
        {service.beds && (
          <p className="meta-row"><Users size={14} /><span>{L.beds(service.beds)}</span></p>
        )}
      </div>

      {script && (
        <div className="call-script">
          <p className="call-script-label">{L.callScriptLabel}</p>
          <p className="call-script-text">{script}</p>
        </div>
      )}

      {checkinStatus && (
        <p className="checkin-meta">
          {L.checkinReports(checkinStatus.attempts)} · {L.checkinUpdated(checkinStatus.lastUpdated)}
        </p>
      )}

      <div className="card-actions">
        <a
          href={`tel:${service.phone}`}
          className="btn-call"
          onClick={() => { recordContact(service.id); setContacted(true); }}
        >
          <Phone size={16} />
          <span>{L.callBtn(service.phone)}</span>
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
            <span>{loadingScript ? L.generating : L.howToCall}</span>
          </button>
        )}
      </div>

      {service.coords && (
        <button
          className="btn-navigate"
          onClick={handleNavigate}
        >
          <Navigation size={13} />
          <span>{language === "es" ? "Navegar" : language === "ht" ? "Direksyon" : "Navigate"}</span>
        </button>
      )}

      {/* "I'm Here" check-in */}
      {!showCheckin ? (
        <button
          className="btn-checkin"
          onClick={() => setShowCheckin(true)}
        >
          <Navigation size={13} />
          <span>{L.checkinBtn}</span>
        </button>
      ) : (
        <CheckInFlow
          serviceId={service.id}
          serviceName={service.name}
          language={language}
          onClose={() => setShowCheckin(false)}
        />
      )}

      {showFeedback && (
        <div className="card-feedback">
          <button
            className={`card-feedback-btn${rejected ? " rejected" : ""}`}
            onClick={() => { recordRejection(service.id); setRejected(true); }}
          >
            {rejected ? "Marked as didn't work" : "Didn't work"}
          </button>
          <button
            className={`card-feedback-btn${contacted ? " contacted" : ""}`}
            onClick={() => { recordContact(service.id); setContacted(true); }}
          >
            {contacted ? "Marked as called" : "Called"}
          </button>
        </div>
      )}
    </div>
  );
}
