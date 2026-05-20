import { GoogleGenerativeAI } from "@google/generative-ai";
import { services } from "../data/services.js";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const MODEL = "gemini-3.1-flash-lite";

const COMPLEX_PROMPT = (language = "en") => `
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

CRITICAL RULES:
- NEVER invent phone numbers, addresses, or information not in the database
- Check eligibility: gender, age, family status, pets, ID requirements
- If someone is in immediate danger, say: "Please call 911 now"
- If the description is unclear, ask ONE clarifying question

AVAILABLE SERVICES:
${JSON.stringify(services, null, 2)}
`;

// Used for complex free-text situations only
export async function runComplexIntake(situation, language = "en") {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: COMPLEX_PROMPT(language),
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
export async function generateCallScript(service, need, who) {
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

  const prompt = `Write 2-3 sentences for someone calling ${service.name} (${service.phone}).
They need: ${need || "shelter"}. They are: ${who === "family" ? "a parent with children" : "an individual"}.
Service facts: ${facts}.
Tell them exactly what to say to get help quickly. Plain language only.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
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
export async function runOutreachLookup(query) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 300, temperature: 0.1 }
  });

  const prompt = `You are a homeless service lookup tool for Broward County outreach workers.
Given this query: "${query}"
Return matching service IDs from this database as JSON:
{ "type": "results", "matches": ["id1", "id2", "id3"], "reasons": { "id1": "reason", "id2": "reason", "id3": "reason" } }
Return ONLY the JSON object. No other text.
DATABASE: ${JSON.stringify(services, null, 2)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in outreach response");
  return { type: "results", data: JSON.parse(jsonMatch[0]) };
}
