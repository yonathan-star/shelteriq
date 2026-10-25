import { uiCopy } from '../lib/uiCopy.js';
import { PrivacyControls } from './PrivacyControls.jsx';
import { releaseCopy } from "../lib/releaseCopy.js";
import { services } from "../data/services.js";
export function HomePage({ onUserMode, onOutreachMode, onPrevention, onDisaster, onPlan, language="en" }) {
  const L=releaseCopy(language),U=uiCopy(language);
  return (
    <div className="home-page">
      <div className="home-content">
        <div className="home-logo">
          <span className="home-logo-mark">ShelterIQ</span>
        </div>

        <div className="home-stat-block">
          <div className="home-stat">
            <span className="home-stat-num">{services.length}</span>
            <span className="home-stat-label">{U.directory}</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat">
            <span className="home-stat-num">3</span>
            <span className="home-stat-label">{U.languages}</span>
          </div>
        </div>

        <p className="home-purpose">
          {U.purpose}
        </p>

        <div className="home-ctas">
          <button className="home-cta-primary" onClick={onPrevention}>{L.prevention}</button>
          <button className="home-cta-secondary" onClick={onDisaster}>{L.disaster}</button>
          <button className="home-cta-secondary" onClick={onPlan}>{L.plan}</button>
          <button className="home-cta-primary" onClick={onUserMode}>
            {U.find}
          </button>
          <button className="home-cta-secondary" onClick={onOutreachMode}>
            {U.worker}
          </button>
        </div>

        <div className="home-emergency">
          <p>{U.danger}</p>
          <a href="tel:911" className="home-emergency-link">{U.emergency}</a>
          <span className="home-emergency-sep">·</span>
          <a href="tel:9545634357" className="home-emergency-link">
            {U.helpline} 954-563-4357
          </a>
        </div>
        <PrivacyControls language={language}/>
      </div>
    </div>
  );
}
