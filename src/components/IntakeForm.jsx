import { useState } from "react";
import { Search, ChevronDown, Loader } from "lucide-react";
import { detectCrisis } from "../lib/crisis";

const LABELS = {
  en: {
    heading: "Find help near you",
    need: "What do you need?",
    whoLabel: "Who are you with?",
    area: "What part of Broward?",
    submit: "Find services",
    complex: "My situation is more complex",
    complexLabel: "Describe your situation",
    complexPlaceholder: "Describe what you need — the AI will read your situation and find the best matches. You can mention family, pets, ID status, veteran status, or anything relevant.",
    complexSubmit: "Find matches for my situation",
    pick: "Select one...",
    needs: [
      { value: "shelter", label: "A place to sleep tonight" },
      { value: "food", label: "Food or meals" },
      { value: "mental_health", label: "Mental health support" },
      { value: "substance_abuse", label: "Substance abuse treatment" },
      { value: "veteran", label: "Veteran services" },
      { value: "youth", label: "Youth services (under 21)" },
      { value: "other", label: "Other / not sure" },
    ],
    who: [
      { value: "alone", label: "Just me" },
      { value: "family", label: "Me + children" },
      { value: "partner", label: "Me + partner (no kids)" },
    ],
    areas: [
      { value: "south", label: "South Broward (Hollywood, Hallandale, Dania)" },
      { value: "central", label: "Central Broward (Fort Lauderdale, Lauderhill)" },
      { value: "north", label: "North Broward (Pompano, Deerfield, Coconut Creek)" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  es: {
    heading: "Encontrar ayuda cerca de usted",
    need: "¿Qué necesita?",
    whoLabel: "¿Con quién está?",
    area: "¿Qué parte de Broward?",
    submit: "Buscar servicios",
    complex: "Mi situación es más compleja",
    complexLabel: "Describa su situación",
    complexPlaceholder: "Describa lo que necesita — la IA leerá su situación y encontrará las mejores opciones.",
    complexSubmit: "Encontrar opciones para mi situación",
    pick: "Seleccione...",
    needs: [
      { value: "shelter", label: "Un lugar para dormir esta noche" },
      { value: "food", label: "Comida o alimentos" },
      { value: "mental_health", label: "Apoyo de salud mental" },
      { value: "substance_abuse", label: "Tratamiento de abuso de sustancias" },
      { value: "veteran", label: "Servicios para veteranos" },
      { value: "youth", label: "Servicios para jóvenes (menores de 21)" },
      { value: "other", label: "Otro / no estoy seguro" },
    ],
    who: [
      { value: "alone", label: "Solo/a" },
      { value: "family", label: "Yo y mis hijos" },
      { value: "partner", label: "Yo y mi pareja (sin hijos)" },
    ],
    areas: [
      { value: "south", label: "Sur de Broward (Hollywood, Hallandale, Dania)" },
      { value: "central", label: "Centro de Broward (Fort Lauderdale, Lauderhill)" },
      { value: "north", label: "Norte de Broward (Pompano, Deerfield, Coconut Creek)" },
      { value: "unsure", label: "No estoy seguro/a" },
    ],
  },
  ht: {
    heading: "Jwenn èd toupre ou",
    need: "Kisa ou bezwen?",
    whoLabel: "Ou avèk ki moun?",
    area: "Ki pati nan Broward?",
    submit: "Jwenn sèvis",
    complex: "Sitiyasyon mwen pi konplèks",
    complexLabel: "Dekri sitiyasyon ou",
    complexPlaceholder: "Dekri sa ou bezwen — AI a pral li sitiyasyon ou epi jwenn pi bon opsyon yo.",
    complexSubmit: "Jwenn opsyon pou sitiyasyon mwen",
    pick: "Chwazi youn...",
    needs: [
      { value: "shelter", label: "Yon kote pou dòmi aswè a" },
      { value: "food", label: "Manje oswa repa" },
      { value: "mental_health", label: "Sipò sante mantal" },
      { value: "substance_abuse", label: "Tretman pou drogue" },
      { value: "veteran", label: "Sèvis veteran" },
      { value: "youth", label: "Sèvis pou jèn (mwens pase 21 an)" },
      { value: "other", label: "Lòt / mwen pa konnen" },
    ],
    who: [
      { value: "alone", label: "Mwen poukont mwen" },
      { value: "family", label: "Mwen ak pitit mwen" },
      { value: "partner", label: "Mwen ak patnè mwen (san pitit)" },
    ],
    areas: [
      { value: "south", label: "Sid Broward (Hollywood, Hallandale, Dania)" },
      { value: "central", label: "Sant Broward (Fort Lauderdale, Lauderhill)" },
      { value: "north", label: "Nò Broward (Pompano, Deerfield, Coconut Creek)" },
      { value: "unsure", label: "Mwen pa konnen" },
    ],
  },
};

export function IntakeForm({ language, onSimpleSubmit, onComplexSubmit, loading, onCrisisDetected }) {
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
                {L.needs.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-icon" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{L.whoLabel || L.who}</label>
            <div className="select-wrap">
              <select
                className="form-select"
                value={who}
                onChange={e => setWho(e.target.value)}
              >
                {L.who.map(o => (
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
                {L.areas.map(o => (
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
            onClick={() => {
              const crisis = detectCrisis(situation);
              if (crisis && onCrisisDetected) {
                onCrisisDetected(crisis, situation);
              } else {
                onComplexSubmit(situation);
              }
            }}
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
