import { useState } from "react";
import { Search, ChevronDown, Loader } from "lucide-react";

const NEEDS = [
  { value: "shelter", label: "A place to sleep tonight" },
  { value: "food", label: "Food or meals" },
  { value: "mental_health", label: "Mental health support" },
  { value: "substance_abuse", label: "Substance abuse treatment" },
  { value: "veteran", label: "Veteran services" },
  { value: "youth", label: "Youth services (under 21)" },
  { value: "other", label: "Other / not sure" },
];

const WHO = [
  { value: "alone", label: "Just me" },
  { value: "family", label: "Me + children" },
  { value: "partner", label: "Me + partner (no kids)" },
];

const AREAS = [
  { value: "south", label: "South Broward (Hollywood, Hallandale, Dania)" },
  { value: "central", label: "Central Broward (Fort Lauderdale, Lauderhill)" },
  { value: "north", label: "North Broward (Pompano, Deerfield, Coconut Creek)" },
  { value: "unsure", label: "Not sure" },
];

const LABELS = {
  en: {
    heading: "Find help near you",
    need: "What do you need?",
    who: "Who are you with?",
    area: "What part of Broward?",
    submit: "Find services",
    complex: "My situation is more complex",
    complexLabel: "Describe your situation",
    complexPlaceholder: "Describe what you need — the AI will read your situation and find the best matches. You can mention family, pets, ID status, veteran status, or anything relevant.",
    complexSubmit: "Find matches for my situation",
    pick: "Select one...",
  },
  es: {
    heading: "Encontrar ayuda cerca de usted",
    need: "¿Qué necesita?",
    who: "¿Con quién está?",
    area: "¿Qué parte de Broward?",
    submit: "Buscar servicios",
    complex: "Mi situación es más compleja",
    complexLabel: "Describa su situación",
    complexPlaceholder: "Describa lo que necesita — la IA leerá su situación y encontrará las mejores opciones.",
    complexSubmit: "Encontrar opciones para mi situación",
    pick: "Seleccione...",
  },
  ht: {
    heading: "Jwenn èd toupre ou",
    need: "Kisa ou bezwen?",
    who: "Ou avèk ki moun?",
    area: "Ki pati nan Broward?",
    submit: "Jwenn sèvis",
    complex: "Sitiyasyon mwen pi konplèks",
    complexLabel: "Dekri sitiyasyon ou",
    complexPlaceholder: "Dekri sa ou bezwen — AI a pral li sitiyasyon ou epi jwenn pi bon opsyon yo.",
    complexSubmit: "Jwenn opsyon pou sitiyasyon mwen",
    pick: "Chwazi youn...",
  },
};

export function IntakeForm({ language, onSimpleSubmit, onComplexSubmit, loading }) {
  const L = LABELS[language] || LABELS.en;

  const [need, setNeed] = useState(() => localStorage.getItem("sq_need") || "");
  const [who, setWho] = useState(() => localStorage.getItem("sq_who") || "alone");
  const [area, setArea] = useState(() => localStorage.getItem("sq_area") || "unsure");
  const [complex, setComplex] = useState(false);
  const [situation, setSituation] = useState("");

  const saveAndSubmit = () => {
    localStorage.setItem("sq_need", need);
    localStorage.setItem("sq_who", who);
    localStorage.setItem("sq_area", area);
    onSimpleSubmit(need, who, area);
  };

  const canSubmit = need !== "";

  return (
    <div className="intake-form">
      <h2 className="intake-heading">{L.heading}</h2>

      {!complex ? (
        <>
          <div className="form-group">
            <label className="form-label">{L.need}</label>
            <div className="select-wrap">
              <select
                className="form-select"
                value={need}
                onChange={e => setNeed(e.target.value)}
              >
                <option value="">{L.pick}</option>
                {NEEDS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-icon" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{L.who}</label>
            <div className="select-wrap">
              <select
                className="form-select"
                value={who}
                onChange={e => setWho(e.target.value)}
              >
                {WHO.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-icon" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{L.area}</label>
            <div className="select-wrap">
              <select
                className="form-select"
                value={area}
                onChange={e => setArea(e.target.value)}
              >
                {AREAS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-icon" />
            </div>
          </div>

          <button
            className="btn-submit"
            onClick={saveAndSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? <Loader size={16} className="spin" /> : <Search size={16} />}
            <span>{L.submit}</span>
          </button>

          <button
            className="btn-complex-toggle"
            onClick={() => setComplex(true)}
          >
            {L.complex}
          </button>
        </>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">{L.complexLabel}</label>
            <textarea
              className="form-textarea"
              rows={5}
              placeholder={L.complexPlaceholder}
              value={situation}
              onChange={e => setSituation(e.target.value)}
            />
          </div>

          <button
            className="btn-submit"
            onClick={() => onComplexSubmit(situation)}
            disabled={situation.trim().length < 10 || loading}
          >
            {loading ? <Loader size={16} className="spin" /> : <Search size={16} />}
            <span>{L.complexSubmit}</span>
          </button>

          <button
            className="btn-complex-toggle"
            onClick={() => setComplex(false)}
          >
            ← Back to quick form
          </button>
        </>
      )}
    </div>
  );
}
