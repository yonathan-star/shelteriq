import { localLookup, localAnswer } from "./localLookup.js";

async function requestAI(action, input) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/assist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...input }), signal: controller.signal,
    });
    if (!response.ok) throw new Error("AI service unavailable");
    const payload = await response.json();
    if (!("result" in payload)) throw new Error("Invalid AI response");
    return payload.result;
  } finally { clearTimeout(timer); }
}

function buildLocalCallScript(service, need, who, language = "en") {
  const opening = language === "es"
    ? `Hola, llamo sobre ${need || "refugio"}.`
    : language === "ht"
      ? `Bonjou, m ap rele pou ${need || "abri"}.`
      : `Hi, I'm calling about ${need || "shelter"}.`;
  const identity = who === "family"
    ? (language === "es" ? "Estoy con niños y necesito saber si aceptan familias." :
      language === "ht" ? "Mwen ak timoun epi mwen bezwen konnen si nou aksepte fanmi." :
      "I'm with children and need to know if you accept families.")
    : (language === "es" ? "Necesito saber si hay espacio disponible hoy." :
      language === "ht" ? "Mwen bezwen konnen si gen plas ki disponib jodi a." :
      "I need to know if you have space available today.");
  const details = service.walkin
    ? (language === "es" ? "¿Puedo llegar sin cita y qué debo llevar?" :
      language === "ht" ? "Èske mwen ka vini san randevou, epi kisa mwen dwe pote?" :
      "Can I come in without an appointment, and what should I bring?")
    : (language === "es" ? "¿Debo llamar antes de llegar y qué documentos necesitan?" :
      language === "ht" ? "Èske mwen dwe rele anvan mwen vini, epi ki dokiman nou bezwen?" :
      "Do I need to call ahead before coming, and what documents do you need?");
  return `${opening} ${identity} ${details}`.trim();
}


export async function runComplexIntake(situation, language = "en", memorySummary = null) {
  try { return await requestAI("intake", { situation, language, memorySummary }); }
  catch { return localLookup(situation, language, memorySummary); }
}
export async function generateCallScript(service, need, who, language = "en") {
  try { return await requestAI("call", { serviceId: service.id, need, who, language }); }
  catch { return buildLocalCallScript(service, need, who, language); }
}
export async function answerFollowUp(question, matchedServices, language = "en") {
  try { return await requestAI("question", { question, serviceIds: matchedServices.map(s => s.id), language }); }
  catch { return localAnswer(question, matchedServices, language); }
}
export async function runOutreachLookup(query, language = "en") {
  try { return await requestAI("outreach", { query, language }); }
  catch { return localLookup(query, language); }
}
