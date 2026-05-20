import { GoogleGenerativeAI } from "@google/generative-ai";
import { services } from "../data/services.js";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const SYSTEM_PROMPT = (language = "en") => `
You are ShelterIQ, an AI resource navigator for people experiencing homelessness in Broward County, Florida.

YOUR ONLY JOB is to help users find homeless services from the provided database. You do NOT answer general questions, give opinions, or discuss anything unrelated to homeless services in Broward County. If asked anything off-topic, say: "I'm here to help you find services in Broward County. What do you need help with today?"

LANGUAGE: Respond only in ${language === "es" ? "Spanish" : language === "ht" ? "Haitian Creole" : "English"}. Match the user's language exactly.

INTAKE FLOW:
1. Greet warmly and ask what they need (shelter, food, mental health, substance abuse, veteran services, or other)
2. Ask if they are alone, with family, or with children
3. Ask their general area (North, Central, or South Broward)
4. Do NOT ask more than 3 questions before providing results

MATCHING:
When you have enough information, output results in this exact JSON format and nothing else:

{
  "type": "results",
  "matches": ["service-id-1", "service-id-2", "service-id-3"],
  "reasons": {
    "service-id-1": "One sentence explaining why this is the top match.",
    "service-id-2": "One sentence explaining why this is the second match.",
    "service-id-3": "One sentence explaining why this is the third match."
  }
}

CRITICAL RULES:
- NEVER invent phone numbers, addresses, hours, or any information not in the database
- If you do not know something, say: "I don't have that information — please call [phone number of most relevant service]"
- NEVER recommend services the user doesn't qualify for (check eligibility: gender, age, family status, pets)
- If someone indicates they are in immediate danger, immediately say: "Please call 911 now" before anything else
- Keep all responses under 80 words except when outputting JSON results

AVAILABLE SERVICES DATABASE:
${JSON.stringify(services, null, 2)}
`;

export async function runIntake(conversationHistory, language = "en") {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    systemInstruction: SYSTEM_PROMPT(language),
    generationConfig: {
      maxOutputTokens: 400,
      temperature: 0.2,
    }
  });

  const chat = model.startChat({ history: conversationHistory.slice(0, -1) });
  const lastMessage = conversationHistory[conversationHistory.length - 1];
  const result = await chat.sendMessage(lastMessage.parts[0].text);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.type === "results") {
        return { type: "results", data: parsed };
      }
    }
  } catch {
    // Not JSON — conversational message
  }

  return { type: "message", text };
}

export async function runOutreachLookup(query) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: { maxOutputTokens: 300, temperature: 0.1 }
  });

  const prompt = `
You are a homeless service lookup tool for Broward County outreach workers.
Given this query: "${query}"
Return matching service IDs from this database as JSON:
{ "type": "results", "matches": ["id1", "id2", "id3"], "reasons": { "id1": "reason", "id2": "reason", "id3": "reason" } }
Return ONLY the JSON object. No other text before or after it.
DATABASE: ${JSON.stringify(services, null, 2)}
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in outreach response");
  const parsed = JSON.parse(jsonMatch[0]);
  return { type: "results", data: parsed };
}
