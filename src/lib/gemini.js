import { constrainResults } from './searchConstraints.js';
import { services } from '../data/services.js';
import { safeCallScript } from './callScript.js';
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

export async function runComplexIntake(situation, language = "en", memorySummary = null) {
  try { return await requestAI("intake", { situation, language, memorySummary }); }
  catch { return localLookup(situation, language, memorySummary); }
}
export async function generateCallScript(service, need, who, language = "en") {
  try { return await requestAI("call", { serviceId: service.id, need, who, language }); }
  catch { return safeCallScript(service, need, who, language); }
}
export async function answerFollowUp(question, matchedServices, language = "en") {
  try { return await requestAI("question", { question, serviceIds: matchedServices.map(s => s.id), language }); }
  catch { return localAnswer(question, matchedServices, language); }
}
export async function runOutreachLookup(query, language = "en", filters) {
  try { return constrainResults(await requestAI("outreach", { query, language, filters }),filters,services); }
  catch { return constrainResults(localLookup(query, language),filters,services); }
}
