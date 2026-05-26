import { GoogleGenerativeAI } from "@google/generative-ai";
import { services } from "../data/services.js";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const MODEL = "gemini-2.0-flash";

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
  return `${opening} ${identity} ${details} ${service.noId ? "" : ""}`.trim();
}

function getAreaForService(service) {
  if (!service.coords) return "unknown";
  if (service.coords.lat < 26.07) return "south";
  if (service.coords.lat > 26.20) return "north";
  return "central";
}

function buildLocalOutreachReason(service, matchedTerms) {
  const reasons = [];
  if (matchedTerms.length > 0) reasons.push(`Matches ${matchedTerms.slice(0, 2).join(" and ")}`);
  if (service.walkin) reasons.push("accepts walk-ins");
  if (service.eligibility.noId) reasons.push("works for clients without ID");
  if (service.eligibility.families) reasons.push("can support families");
  if (service.eligibility.veterans) reasons.push("supports veterans");
  return reasons.length > 0
    ? `${reasons.slice(0, 3).join(", ")}.`
    : "Relevant match for this outreach search.";
}

function runLocalOutreachLookup(query) {
  const normalized = query.toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const matchedTermsById = new Map();
  const areaTerms = ["north", "central", "south"];
  const typeKeywords = {
    shelter: ["shelter", "bed", "housing", "sleep"],
    food: ["food", "meal", "meals", "hungry", "pantry"],
    mental_health: ["mental", "depression", "anxiety", "psychiatric", "therapy"],
    substance_abuse: ["substance", "addiction", "drug", "alcohol", "detox", "recovery"],
    medical: ["medical", "doctor", "clinic", "health"],
    legal: ["legal", "lawyer", "court", "eviction", "id"],
    outreach: ["outreach", "street", "mobile"],
  };

  const scored = services.map((service) => {
    let score = 0;
    const matchedTerms = [];

    Object.entries(typeKeywords).forEach(([type, keywords]) => {
      if (keywords.some((keyword) => normalized.includes(keyword)) && service.type.includes(type)) {
        score += 4;
        matchedTerms.push(type.replace("_", " "));
      }
    });

    if (tokens.includes("veteran") && service.eligibility.veterans) {
      score += 4;
      matchedTerms.push("veteran support");
    }
    if ((tokens.includes("family") || tokens.includes("children")) && service.eligibility.families) {
      score += 4;
      matchedTerms.push("family support");
    }
    if ((tokens.includes("youth") || tokens.includes("teen")) && service.eligibility.maxAge !== null) {
      score += 4;
      matchedTerms.push("youth support");
    }
    if (normalized.includes("no id") && service.eligibility.noId) {
      score += 3;
      matchedTerms.push("no ID");
    }
    if (tokens.includes("pet") && service.eligibility.pets) {
      score += 3;
      matchedTerms.push("pets");
    }
    if (tokens.includes("walkin") && service.walkin) {
      score += 2;
      matchedTerms.push("walk-in");
    }
    if ((tokens.includes("male") || tokens.includes("man") || tokens.includes("men")) && service.eligibility.men) {
      score += 1;
    }
    if ((tokens.includes("female") || tokens.includes("woman") || tokens.includes("women")) && service.eligibility.women) {
      score += 1;
    }

    const matchedArea = areaTerms.find((term) => tokens.includes(term));
    if (matchedArea && getAreaForService(service) === matchedArea) {
      score += 2;
      matchedTerms.push(`${matchedArea} county`);
    }

    if (score === 0 && service.type.includes("shelter")) {
      score = service.walkin ? 1.5 : 1;
    }

    matchedTermsById.set(service.id, matchedTerms);
    return { service, score };
  });

  const matches = scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ service }) => service.id);

  const reasons = Object.fromEntries(
    matches.map((id) => {
      const service = services.find((entry) => entry.id === id);
      return [id, buildLocalOutreachReason(service, matchedTermsById.get(id) || [])];
    })
  );

  return { type: "results", data: { matches, reasons } };
}

const COMPLEX_PROMPT = (language = "en", memorySummary = null) => `
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
- If the description is unclear, ask ONE clarifying question

AVAILABLE SERVICES (compact — use id to match):
${JSON.stringify(services.map(s => ({
  id: s.id, name: s.name, type: s.type, walkin: s.walkin,
  gender: s.eligibility.gender, families: s.eligibility.families,
  youth: s.eligibility.youth, noId: s.eligibility.noId,
  pets: s.eligibility.pets, veteran: s.eligibility.veteran,
  area: s.coords ? getAreaForService(s) : "any",
})))}
`;

// Used for complex free-text situations only
export async function runComplexIntake(situation, language = "en", memorySummary = null) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: COMPLEX_PROMPT(language, memorySummary),
    generationConfig: { maxOutputTokens: 400, temperature: 0.2 }
  });

  const result = await model.generateContent(situation);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.type === "results") return { type: "results", data: parsed };
    }
  } catch { /* not JSON — conversational clarification */ }

  return { type: "message", text };
}

// Generates a personalized call script for a specific service
export async function generateCallScript(service, need, who, language = "en") {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    return buildLocalCallScript(service, need, who, language);
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 120, temperature: 0.3 }
  });

  const facts = [
    service.walkin ? "accepts walk-ins" : "requires calling ahead",
    `hours: ${service.hours}`,
    service.eligibility.families ? "accepts families" : "adults only",
    service.eligibility.noId ? "no ID required" : "ID may be needed",
    service.eligibility.pets ? "pets allowed" : "no pets",
  ].join(", ");

  const lang = language === "es" ? "Spanish" : language === "ht" ? "Haitian Creole" : "English";

  const prompt = `Write 2-3 sentences for someone calling ${service.name} (${service.phone}).
They need: ${need || "shelter"}. They are: ${who === "family" ? "a parent with children" : "an individual"}.
Service facts: ${facts}.
Tell them exactly what to say to get help quickly. Plain language only.
Respond in ${lang}.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return buildLocalCallScript(service, need, who, language);
  }
}

// Answers follow-up questions about the matched services
export async function answerFollowUp(question, matchedServices, language = "en") {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 150, temperature: 0.2 }
  });

  const summary = matchedServices.slice(0, 3).map(s => ({
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

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// Outreach worker keyword lookup — genuinely needs AI for flexible matching
export async function runOutreachLookup(query, language = "en") {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    return runLocalOutreachLookup(query);
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 400, temperature: 0.1 }
  });

  const lang = language === "es" ? "Spanish" : language === "ht" ? "Haitian Creole" : "English";

  // Send only the fields needed for matching — keeps the prompt small enough
  // to fit in the free-tier context window without truncation or timeouts.
  const compactDB = services.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    area: getAreaForService(s),
    walkin: s.walkin,
    gender: s.eligibility.gender,
    families: s.eligibility.families,
    youth: s.eligibility.youth,
    noId: s.eligibility.noId,
    pets: s.eligibility.pets,
    veteran: s.eligibility.veteran,
  }));

  const prompt = `You are ShelterIQ, a Broward County homeless service lookup tool for outreach workers.

Query: "${query}"

Match the query to 3-5 services. Consider: type, gender, families, youth, noId, pets, veteran, area (north/central/south), walkin.

Return ONLY this JSON (reasons in ${lang}):
{"type":"results","matches":["id1","id2","id3"],"reasons":{"id1":"one sentence","id2":"one sentence","id3":"one sentence"}}

SERVICES:
${JSON.stringify(compactDB)}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in outreach response");
    return { type: "results", data: JSON.parse(jsonMatch[0]) };
  } catch {
    return runLocalOutreachLookup(query);
  }
}
