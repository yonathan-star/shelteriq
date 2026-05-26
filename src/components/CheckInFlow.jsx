import { useState } from "react";
import { MapPin, CheckCircle, XCircle, Heart } from "lucide-react";
import { recordCheckin } from "../lib/checkin";

const COPY = {
  en: {
    heading: "I'm heading here",
    confirm: "Great! Did you get in?",
    yes: "Yes, I got in",
    no: "No, it was full",
    thanks: "Thank you for letting others know!",
    thanksDesc: "Your check-in helps people coming after you.",
    reset: "Back",
  },
  es: {
    heading: "Me dirijo aquí",
    confirm: "¡Bien! ¿Te dejaron entrar?",
    yes: "Sí, entré",
    no: "No, estaba lleno",
    thanks: "¡Gracias por informar a otros!",
    thanksDesc: "Tu reporte ayuda a quienes vienen después.",
    reset: "Atrás",
  },
  ht: {
    heading: "Mwen ap ale la",
    confirm: "Ou antre?",
    yes: "Wi, mwen antre",
    no: "Non, li te plen",
    thanks: "Mèsi pou fè lòt moun konnen!",
    thanksDesc: "Rapò ou ede moun ki vin apre ou.",
    reset: "Retounen",
  },
};

export function CheckInFlow({ serviceId, serviceName, language = "en", onClose }) {
  const [step, setStep] = useState("confirm"); // "confirm" | "done"
  const L = COPY[language] || COPY.en;

  const handleOutcome = (outcome) => {
    recordCheckin(serviceId, outcome);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="checkin-flow checkin-done">
        <Heart size={22} className="checkin-done-icon" />
        <p className="checkin-done-title">{L.thanks}</p>
        <p className="checkin-done-desc">{L.thanksDesc}</p>
        <button className="checkin-reset" onClick={onClose}>{L.reset}</button>
      </div>
    );
  }

  return (
    <div className="checkin-flow">
      <div className="checkin-location">
        <MapPin size={14} />
        <span>{serviceName}</span>
      </div>
      <p className="checkin-question">{L.confirm}</p>
      <div className="checkin-actions">
        <button
          className="checkin-btn checkin-yes"
          onClick={() => handleOutcome("got_in")}
        >
          <CheckCircle size={16} />
          <span>{L.yes}</span>
        </button>
        <button
          className="checkin-btn checkin-no"
          onClick={() => handleOutcome("full")}
        >
          <XCircle size={16} />
          <span>{L.no}</span>
        </button>
      </div>
    </div>
  );
}
