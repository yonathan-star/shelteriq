import { Phone, AlertTriangle, ChevronRight } from "lucide-react";
import { CRISIS_RESOURCES } from "../lib/crisis";

const COPY = {
  en: {
    heading: "We see you may be in crisis",
    sub: "Free, confidential help is available right now — 24/7:",
    also: "Shelter results are below when you're ready.",
    dismiss: "Continue to shelter results",
    broward: "Broward Crisis Line",
    browardDesc: "Local mental health crisis line — 24/7",
    browardPhone: "9545340600",
    browardDisplay: "954-534-0600",
  },
  es: {
    heading: "Vemos que puede estar en crisis",
    sub: "Ayuda gratuita y confidencial disponible ahora — 24/7:",
    also: "Los resultados de refugio están abajo cuando esté listo/a.",
    dismiss: "Continuar a los resultados de refugio",
    broward: "Línea de Crisis de Broward",
    browardDesc: "Línea local de salud mental — 24/7",
    browardPhone: "9545340600",
    browardDisplay: "954-534-0600",
  },
  ht: {
    heading: "Nou wè ou ka nan yon kriz",
    sub: "Èd gratis ak konfidansyèl disponib kounye a — 24/7:",
    also: "Rezilta abri yo anba a lè ou pare.",
    dismiss: "Kontinye nan rezilta abri",
    broward: "Liy Kriz Broward",
    browardDesc: "Liy kriz sante mantal lokal — 24/7",
    browardPhone: "9545340600",
    browardDisplay: "954-534-0600",
  },
};

export function CrisisBanner({ crisisType, language = "en", onDismiss }) {
  const resource = CRISIS_RESOURCES[crisisType];
  const L = COPY[language] || COPY.en;

  if (!resource) return null;

  return (
    <div className="crisis-banner">
      <div className="crisis-banner-header">
        <AlertTriangle size={18} className="crisis-alert-icon" />
        <p className="crisis-heading">{L.heading}</p>
      </div>

      <p className="crisis-sub">{L.sub}</p>

      <div className="crisis-cards">
        {/* Primary hotline for this crisis type */}
        <a
          href={`tel:${resource.phone}`}
          className="crisis-card crisis-primary"
          style={{ "--crisis-color": resource.color }}
        >
          <div className="crisis-card-icon">
            <Phone size={16} />
          </div>
          <div className="crisis-card-text">
            <p className="crisis-card-name">{resource.name}</p>
            <p className="crisis-card-desc">{resource.description}</p>
            <p className="crisis-card-phone">{resource.displayPhone}</p>
          </div>
          <ChevronRight size={16} className="crisis-card-arrow" />
        </a>

        {/* Always show 211 */}
        <a href="tel:211" className="crisis-card">
          <div className="crisis-card-icon">
            <Phone size={16} />
          </div>
          <div className="crisis-card-text">
            <p className="crisis-card-name">211 — Broward Helpline</p>
            <p className="crisis-card-desc">Shelter, food & mental health resources — free, 24/7</p>
            <p className="crisis-card-phone">2-1-1</p>
          </div>
          <ChevronRight size={16} className="crisis-card-arrow" />
        </a>

        {/* Local Broward crisis line (only for mental health / suicide) */}
        {crisisType === "suicide" && (
          <a href={`tel:${L.browardPhone}`} className="crisis-card">
            <div className="crisis-card-icon">
              <Phone size={16} />
            </div>
            <div className="crisis-card-text">
              <p className="crisis-card-name">{L.broward}</p>
              <p className="crisis-card-desc">{L.browardDesc}</p>
              <p className="crisis-card-phone">{L.browardDisplay}</p>
            </div>
            <ChevronRight size={16} className="crisis-card-arrow" />
          </a>
        )}
      </div>

      <p className="crisis-also">{L.also}</p>

      <button className="crisis-dismiss" onClick={onDismiss}>
        {L.dismiss}
      </button>
    </div>
  );
}
