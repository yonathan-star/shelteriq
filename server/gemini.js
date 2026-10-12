import { safeCallScript } from '../src/lib/callScript.js';
import { checkRate } from './cloud-store.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServices } from "./directory-store.js";
import { localLookup, localAnswer, validateMatches } from "../src/lib/localLookup.js";
import { generateWithFallback } from './ai-request.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const hasAI = Boolean(process.env.GEMINI_API_KEY && !/your_|placeholder|example|here/i.test(process.env.GEMINI_API_KEY));
async function generate(model, prompt) {
  if(process.env.DATABASE_URL){const cap=Math.max(1,Math.min(10000,Number(process.env.SHELTERIQ_AI_DAILY_REQUESTS)||300));if(!await checkRate('ai-global-daily',cap,86400000))throw new Error('Daily allowance reached');}
  const fallbackName = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';
  const fallback = fallbackName === MODEL ? null : genAI.getGenerativeModel({
    model: fallbackName, generationConfig: model.generationConfig,
  });
  return generateWithFallback(model, fallback, prompt);
}

function getAreaForService(service) {
  if(service.area)return service.area;
  if (!service.coords) return "unknown";
  if (service.coords.lat < 26.07) return "south";
  if (service.coords.lat > 26.20) return "north";
  return "central";
}

const COMPLEX_PROMPT = async (language = "en", memorySummary = null) => `
You are ShelterIQ, an AI resource navigator for people experiencing homelessness in Broward County, Florida.

YOUR ONLY JOB is to match the user's situation to services from the database below. Do NOT answer off-topic questions.

LANGUAGE: Respond in ${language === "es" ? "Spanish" : language === "ht" ? "Haitian Creole" : "English"}.

When you have enough information from the user's description, output ONLY this JSON:
{
  "type": "results",
  "matches": ["service-id-1", "service-id-2", "service-id-3"],
  "reasons": {
    "service-id-1": "One sentence why this fits their specific situation.",
    "service-id-2": "One sentence why this fits.",
    "service-id-3": "One sentence why this fits."
  }
}
${memorySummary ? `
SESSION MEMORY (this person has used the app before in this session):
- They have searched ${memorySummary.attemptCount} time(s) already
- Services already shown to them: ${memorySummary.alreadyShown.join(", ")}
- Services they called or engaged with: ${memorySummary.contacted.join(", ")}
- Services they indicated did not work: ${memorySummary.rejected.join(", ")}
- Known barriers: ${memorySummary.barriers.join(", ")}
- They have been searching for ${memorySummary.minutesActive} minutes

IMPORTANT: Do NOT suggest any service in the "already shown" list unless
all other options are exhausted. Prioritize services NOT yet shown.
If they have been searching for more than 10 minutes with multiple
attempts, acknowledge this briefly and express that you will try
harder to find something that works for their specific situation.
` : ""}
CRITICAL RULES:
- NEVER invent phone numbers, addresses, or information not in the database
- Check eligibility: gender, age, family status, pets, ID requirements
- If someone is in immediate danger, say: "Please call 911 now"
- If the description is unclear, return {"type":"message","text":"One clarifying question"}

AVAILABLE SERVICES (compact — use id to match):
${JSON.stringify((await getServices()).filter(s=>s.publicStatus!=="closed").map(s => ({
  id: s.id, name: s.name, type: s.type, walkin: s.walkin,
  men: s.eligibility.men, women: s.eligibility.women, families: s.eligibility.families,
  minAge: s.eligibility.minAge, maxAge: s.eligibility.maxAge, noId: s.eligibility.noId,
  pets: s.eligibility.pets, veterans: s.eligibility.veterans,
  area: s.coords ? getAreaForService(s) : "any",
})))}
`;

// Used for complex free-text situations only
export async function runComplexIntake(situation, language = "en", memorySummary = null) {
  if (!hasAI) return localLookup(situation, language, memorySummary, await getServices());
  try {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: await COMPLEX_PROMPT(language, memorySummary),
    generationConfig: { maxOutputTokens: 2048, temperature: 0.2, responseMimeType: "application/json" }
  });

  const result = await generate(model, situation);
  const text = result.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.type === "message" && typeof parsed.text === "string") return { type: "message", text: parsed.text };
    return validateMatches(parsed, situation, language, memorySummary, await getServices());
  }
  return localLookup(situation, language, memorySummary, await getServices());
  } catch { return localLookup(situation, language, memorySummary, await getServices()); }
}

// Generates a personalized call script for a specific service
export async function generateCallScript(service, need, who, language = "en") {
  return safeCallScript(service, need, who, language);
}

// Answers follow-up questions about the matched services
export async function answerFollowUp(question, matchedServices, language = "en") {
  if (!hasAI) return localAnswer(question, matchedServices, language);
  try {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
  });

  const summary = matchedServices.map(s => ({
    name: s.name, phone: s.phone, hours: s.hours,
    walkin: s.walkin, address: s.address, eligibility: s.eligibility,
  }));

  const prompt = `You are ShelterIQ, a resource navigator for Broward County homeless services.
The user has been matched to these services:
${JSON.stringify(summary, null, 2)}

User question: "${question}"

Rules:
- Answer ONLY from the data above
- If the answer isn't in the data, say: "I don't have that info — call [most relevant phone number]"
- Under 60 words
- Respond in ${language === "es" ? "Spanish" : language === "ht" ? "Haitian Creole" : "English"}`;

  const result = await generate(model, prompt);
  return result.response.text().trim();
  } catch { return localAnswer(question, matchedServices, language); }
}

// Outreach search uses directory matching when AI is unavailable.
export async function runOutreachLookup(query, language = "en") {
  if (!hasAI) {
    return localLookup(query, language, null, await getServices());
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.1, responseMimeType: "application/json" }
  });

  const lang = language === "es" ? "Spanish" : language === "ht" ? "Haitian Creole" : "English";

  // Send only the fields needed for matching — keeps the prompt small enough
  // to fit in the free-tier context window without truncation or timeouts.
  const compactDB = (await getServices()).filter(s=>s.publicStatus!=="closed").map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    area: getAreaForService(s),
    walkin: s.walkin,
    men: s.eligibility.men, women: s.eligibility.women,
    families: s.eligibility.families,
    minAge: s.eligibility.minAge, maxAge: s.eligibility.maxAge,
    noId: s.eligibility.noId,
    pets: s.eligibility.pets,
    veterans: s.eligibility.veterans,
  }));

  const prompt = `You are ShelterIQ, a Broward County homeless service lookup tool for outreach workers.

Query: "${query}"

Match the query to 3-5 services. Consider: type, gender, families, youth, noId, pets, veteran, area (north/central/south), walkin.

Return ONLY this JSON (reasons in ${lang}):
{"type":"results","matches":["id1","id2","id3"],"reasons":{"id1":"one sentence","id2":"one sentence","id3":"one sentence"}}

SERVICES:
${JSON.stringify(compactDB)}`;

  try {
    const result = await generate(model, prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in outreach response");
    return validateMatches(JSON.parse(jsonMatch[0]), query, language, null, await getServices());
  } catch {
    return localLookup(query, language, null, await getServices());
  }
}
