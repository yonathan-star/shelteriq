import { releaseCopy } from "../lib/releaseCopy.js";
import { services } from "../data/services.js";
export function HomePage({ onUserMode, onOutreachMode, onPrevention, onDisaster, onPlan, language="en" }) {
  const L=releaseCopy(language);
  return (
    <div className="home-page">
      <div className="home-content">
        <div className="home-logo">
          <span className="home-logo-mark">ShelterIQ</span>
          <span className="home-logo-sub">Broward County</span>
        </div>

        <div className="home-stat-block">
          <div className="home-stat">
            <span className="home-stat-num">{services.length}</span>
            <span className="home-stat-label">services in the directory</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat">
            <span className="home-stat-num">3</span>
            <span className="home-stat-label">languages supported</span>
          </div>
        </div>

        <p className="home-purpose">
          Find shelter, food, and services in Broward County — instantly,
          in English, Spanish, or Haitian Creole.
        </p>

        <div className="home-ctas">
          <button className="home-cta-primary" onClick={onPrevention}>{L.prevention}</button>
          <button className="home-cta-secondary" onClick={onDisaster}>{L.disaster}</button>
          <button className="home-cta-secondary" onClick={onPlan}>{L.plan}</button>
          <button className="home-cta-primary" onClick={onUserMode}>
            I need help finding services
          </button>
          <button className="home-cta-secondary" onClick={onOutreachMode}>
            I'm an outreach worker
          </button>
        </div>

        <div className="home-emergency">
          <p>In immediate danger?</p>
          <a href="tel:911" className="home-emergency-link">Call 911</a>
          <span className="home-emergency-sep">·</span>
          <a href="tel:9545634357" className="home-emergency-link">
            Homeless Helpline 954-563-4357
          </a>
        </div>
      </div>
    </div>
  );
}
