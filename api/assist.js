import { getServices } from "../server/directory-store.js";
import { nodeHandler } from '../server/http-adapter.js';
import { checkRate } from '../server/cloud-store.js';
import { createHash } from 'node:crypto';
export default nodeHandler(GET,POST);
import { runComplexIntake, generateCallScript, answerFollowUp, runOutreachLookup } from "../server/gemini.js";

export const maxDuration = 30;
const headers = { "Cache-Control": "no-store" };
function json(data, status=200) { return Response.json(data,{status,headers}); }
function text(value, max=3000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid input");
  return value.trim();
}
async function ids(value) {
  const services=await getServices();
  if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== "string" || !services.some(s => s.id === id))) throw new Error("Invalid service IDs");
  return [...new Set(value)];
}
async function memory(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid memory");
  return {
    attemptCount: Math.min(100,Math.max(0,Number(value.attemptCount)||0)),
    alreadyShown: await ids(value.alreadyShown || []), rejected: await ids(value.rejected || []), contacted: await ids(value.contacted || []),
    barriers: Array.isArray(value.barriers) ? value.barriers.slice(0,10).map(v=>text(v,200)) : [],
    minutesActive: Math.min(1440,Math.max(0,Number(value.minutesActive)||0)),
  };
}
export function GET() {
  return json({configured: Boolean(process.env.GEMINI_API_KEY && !/your_|placeholder|example/i.test(process.env.GEMINI_API_KEY))});
}
export async function POST(request) {
  const origin=request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({error:"Origin not allowed"},403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({error:"JSON required"},415);
  try {
    if(process.env.DATABASE_URL){const peer=createHash('sha256').update(request.headers.get('x-forwarded-for')||'unknown').digest('hex');if(!await checkRate('ai-'+peer,60))return json({error:'Too many searches; try again later'},429);}
    const raw=await request.text();
    if (raw.length > 16000) return json({error:"Request too large"},413);
    const input=JSON.parse(raw);
    if (!input || typeof input !== "object") return json({error:"Invalid request"},400);
    const services=await getServices();
    const language=["en","es","ht"].includes(input.language) ? input.language : "en";
    let result;
    switch(input.action) {
      case "intake": result=await runComplexIntake(text(input.situation),language,await memory(input.memorySummary)); break;
      case "outreach": result=await runOutreachLookup(text(input.query),language); break;
      case "call": {
        const service=services.find(s=>s.id===input.serviceId);
        if (!service) return json({error:"Unknown service"},400);
        const need=typeof input.need === "string" && input.need.length < 80 ? input.need : "shelter";
        const who=["alone","family","partner"].includes(input.who) ? input.who : "alone";
        result=await generateCallScript(service,need,who,language); break;
      }
      case "question": result=await answerFollowUp(text(input.question,1000),(await ids(input.serviceIds)).map(id=>services.find(s=>s.id===id)),language); break;
      default: return json({error:"Unknown action"},400);
    }
    return json({result});
  } catch {
    // Do not log request contents or provider credentials.
    console.warn("ShelterIQ assist: request could not be processed");
    return json({error:"Request could not be processed"},400);
  }
}
