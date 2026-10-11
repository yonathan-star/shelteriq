import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { getServices,submitCorrection,correctionQueue,reviewCorrection,recordEvent,metrics,auditHistory } from "../server/directory-store.js";
import { getAlerts } from "../server/alerts.js";
import { getHazards } from "../server/hazards.js";
export const maxDuration=30;
const sessions=new Map(); const limits=new Map();
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{"Cache-Control":"no-store",...headers}});
const fields=["hours","phone","address","intakeRequirements","publicStatus"];
const needs=["shelter","food","mental_health","substance_abuse","veteran","youth","other","rent","mortgage","utilities","eviction","accommodation"];
const barriers=["closed_intake","full","referral_needed","documents_missing","eligibility_mismatch","transportation","no_response","other"];
function reviewer(request){const cookie=request.headers.get("cookie")||"";const token=cookie.match(/(?:^|;\s*)sq_review=([^;]+)/)?.[1];const expiry=sessions.get(token);return expiry&&expiry>Date.now();}
function string(value,max=1000){if(typeof value!=="string"||!value.trim()||value.length>max)throw new Error("Invalid field");return value.trim();}
function url(value){const parsed=new URL(value);if(parsed.protocol!=="https:")throw new Error("Use an https evidence link");return parsed.href;}
export async function GET(request){
  try{
    const resource=new URL(request.url).searchParams.get("resource");
    switch(resource){
      case "services":return json({items:getServices(),programs:getServices(true).filter(s=>s.kind==="prevention"),checkedAt:new Date().toISOString()});
      case "alerts":return json(await getAlerts());
      case "hazards":return json(await getHazards());
      case "session":return json({authenticated:Boolean(reviewer(request)),localReviewAvailable:process.env.SHELTERIQ_LOCAL_REVIEW==="true"&&!process.env.VERCEL});
      case "corrections":if(!reviewer(request))return json({error:"Sign in required"},401);return json({items:correctionQueue()});
      case "audit":if(!reviewer(request))return json({error:"Sign in required"},401);return json({items:auditHistory()});
      case "metrics":if(!reviewer(request))return json({error:"Sign in required"},401);return json(metrics());
      default:return json({error:"Unknown resource"},404);
    }
  }catch{return json({error:"Service is not configured for persistent storage"},503);}
}
export async function POST(request){
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return json({error:"Origin not allowed"},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"JSON required"},415);
  try{
    const raw=await request.text();if(raw.length>12000)return json({error:"Request too large"},413);
    const body=JSON.parse(raw);const resource=new URL(request.url).searchParams.get("resource");
    const peer=createHash("sha256").update(request.headers.get("x-forwarded-for")||"local").digest("hex");
    const key=resource+peer;const limit=limits.get(key)||{count:0,until:Date.now()+900000};
    if(limit.until<Date.now()){limit.count=0;limit.until=Date.now()+900000;}limit.count++;limits.set(key,limit);
    if(limit.count>(resource==="events"?200:30))return json({error:"Too many requests; try later"},429);
    switch(resource){
      case "review-login":{
        const host=new URL(request.url).hostname;
        const local=process.env.SHELTERIQ_LOCAL_REVIEW==="true"&&!process.env.VERCEL&&["127.0.0.1","localhost","[::1]"].includes(host);
        let allowed=local;
        if(!allowed&&process.env.SHELTERIQ_REVIEW_TOKEN&&typeof body.token==="string"){
          const expected=Buffer.from(process.env.SHELTERIQ_REVIEW_TOKEN),actual=Buffer.from(body.token);
          allowed=expected.length===actual.length&&timingSafeEqual(expected,actual);
        }
        if(!allowed)return json({error:"Reviewer access not configured"},403);
        const token=randomBytes(32).toString("hex");sessions.set(token,Date.now()+3600000);
        return json({authenticated:true},200,{"Set-Cookie":`sq_review=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${request.url.startsWith("https:")?"; Secure":""}`});
      }
      case "review-logout":return json({authenticated:false},200,{"Set-Cookie":"sq_review=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"});
      case "corrections":{
        if(!fields.includes(body.field))throw new Error("Unsupported correction field");
        const value=string(body.suggestedValue,500);if(body.field==="publicStatus"&&!["open","closed","unknown"].includes(value))throw new Error("Invalid status");
        return json(submitCorrection({requestId:body.requestId?string(body.requestId,100):undefined,serviceId:string(body.serviceId,100),category:body.field,field:body.field,suggestedValue:value,note:body.note?string(body.note,600):"",evidenceUrl:body.evidenceUrl?url(body.evidenceUrl):null}),201);
      }
      case "review":{
        if(!reviewer(request))return json({error:"Sign in required"},401);
        if(!["approved","rejected","needs_information","duplicate"].includes(body.decision))throw new Error("Invalid decision");
        return json(reviewCorrection({id:string(body.id,100),expectedVersion:body.expectedVersion,decision:body.decision,sourceUrl:body.decision==="approved"?url(body.sourceUrl):null,reason:string(body.reason,600)},"local-owner"));
      }
      case "events":{
        if(!needs.includes(body.requestedNeed)||!["north","central","south","unsure"].includes(body.broadArea)||!["request","contacted","connected","unsuccessful"].includes(body.eventType))throw new Error("Invalid event");
        if(body.barrier&&!barriers.includes(body.barrier))throw new Error("Invalid barrier");
        if(body.isDemo)return json({error:"Demo data is excluded"},400);
        return json(recordEvent({id:string(body.id,100),requestedNeed:body.requestedNeed,broadArea:body.broadArea,eventType:body.eventType,barrier:body.barrier,resultsCount:Number.isInteger(body.resultsCount)?Math.max(0,Math.min(100,body.resultsCount)):null,referralId:body.referralId?string(body.referralId,100):null,serviceId:body.serviceId?string(body.serviceId,100):null,language:["en","es","ht"].includes(body.language)?body.language:"en"}),201);
      }
      default:return json({error:"Unknown operation"},404);
    }
  }catch(error){return json({error:error.status===409?error.message:"Please check the form fields and try again."},error.status||400);}
}
