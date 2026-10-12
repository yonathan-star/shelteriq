import { randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { signActivity,readActivity } from '../server/activity-receipt.js';
import { filterServices } from '../src/lib/matching.js';
import { nodeHandler } from '../server/http-adapter.js';
export default nodeHandler(GET,POST);
import { getServices,submitCorrection,correctionQueue,reviewCorrection,recordEvent,metrics,auditHistory } from "../server/directory-store.js";
import { getAlerts } from "../server/alerts.js";
import { getHazards } from "../server/hazards.js";
import { checkRate,saveSession,validSession,revokeSession } from '../server/cloud-store.js';
export const maxDuration=30;
const sessions=new Map(); const limits=new Map();
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{"Cache-Control":"no-store",...headers}});
const fields=["hours","phone","address","intakeRequirements","publicStatus"];
const needs=["shelter","food","mental_health","substance_abuse","veteran","youth","other","rent","mortgage","utilities","eviction","accommodation"];

function reviewToken(request){return (request.headers.get('cookie')||'').match(/(?:^|;\s*)sq_review=([^;]+)/)?.[1];}
const hashToken=token=>createHash('sha256').update(token).digest('hex');
async function reviewer(request){const token=reviewToken(request);if(!token)return false;if(process.env.DATABASE_URL)return validSession(hashToken(token));const expiry=sessions.get(token);return Boolean(expiry&&expiry>Date.now());}
function string(value,max=1000){if(typeof value!=="string"||!value.trim()||value.length>max)throw new Error("Invalid field");return value.trim();}
function url(value){const parsed=new URL(value);if(parsed.protocol!=="https:")throw new Error("Use an https evidence link");return parsed.href;}
export async function GET(request){
  try{
    const resource=new URL(request.url).searchParams.get("resource");
    switch(resource){
      case "services":{const all=await getServices(true);return json({items:all.filter(s=>s.kind!=='prevention'),programs:all.filter(s=>s.kind==='prevention'),checkedAt:new Date().toISOString()});}
      case "alerts":return json(await getAlerts());
      case "hazards":return json(await getHazards());
      case "session":return json({authenticated:await reviewer(request),localReviewAvailable:process.env.SHELTERIQ_LOCAL_REVIEW==="true"&&!process.env.VERCEL,remoteReviewAvailable:Boolean(process.env.SHELTERIQ_REVIEW_TOKEN)});
      case "corrections":if(!await reviewer(request))return json({error:"Sign in required"},401);return json({items:await correctionQueue()});
      case "audit":if(!await reviewer(request))return json({error:"Sign in required"},401);return json({items:await auditHistory()});
      case "metrics":if(!await reviewer(request))return json({error:"Sign in required"},401);return json(await metrics());
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
    if(process.env.DATABASE_URL?!await checkRate(key,resource==='events'?200:30):limit.count>(resource==="events"?200:30))return json({error:"Too many requests; try later"},429);
    switch(resource){
      case 'activity-ticket':{
        if(!needs.includes(body.requestedNeed)||!['unsure','north','central','south'].includes(body.broadArea))throw new Error('Invalid activity');
        const all=await getServices(true);
        if(body.serviceIds&&(!Array.isArray(body.serviceIds)||body.serviceIds.length>20||body.serviceIds.some(id=>!all.some(s=>s.id===id))))throw new Error('Invalid service references');
        if(body.serviceIds&&['shelter','food','mental_health','substance_abuse','medical','legal'].includes(body.requestedNeed)&&body.serviceIds.some(id=>!all.find(s=>s.id===id).type?.includes(body.requestedNeed)))throw new Error('Service does not match requested need');
        const matches=body.serviceIds?all.filter(s=>body.serviceIds.includes(s.id)&&s.publicStatus!=='closed'):filterServices(body.requestedNeed,['alone','family','partner'].includes(body.who)?body.who:'alone',body.broadArea,null,all.filter(s=>s.kind!=='prevention'));
        const id=randomUUID();const payload={id,requestedNeed:body.requestedNeed,broadArea:body.broadArea,resultsCount:matches.length,language:['en','es','ht'].includes(body.language)?body.language:'en',eventType:'request'};
        return json({id,receipt:signActivity(payload)});
      }
      case "review-login":{
        const host=new URL(request.url).hostname;
        const local=process.env.SHELTERIQ_LOCAL_REVIEW==="true"&&!process.env.VERCEL&&["127.0.0.1","localhost","[::1]"].includes(host);
        let allowed=local;
        if(!allowed&&process.env.SHELTERIQ_REVIEW_TOKEN&&typeof body.token==="string"){
          const expected=Buffer.from(process.env.SHELTERIQ_REVIEW_TOKEN),actual=Buffer.from(body.token);
          allowed=expected.length===actual.length&&timingSafeEqual(expected,actual);
        }
        if(!allowed)return json({error:"Reviewer access not configured"},403);
        const token=randomBytes(32).toString("hex");const expires=Date.now()+3600000;if(process.env.DATABASE_URL)await saveSession(hashToken(token),expires);else sessions.set(token,expires);
        return json({authenticated:true},200,{"Set-Cookie":`sq_review=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${request.url.startsWith("https:")?"; Secure":""}`});
      }
      case "review-logout":{const token=reviewToken(request);if(token){if(process.env.DATABASE_URL)await revokeSession(hashToken(token));else sessions.delete(token);}return json({authenticated:false},200,{"Set-Cookie":"sq_review=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"});}
      case "corrections":{
        if(!fields.includes(body.field))throw new Error("Unsupported correction field");
        const value=string(body.suggestedValue,500);if(body.field==="publicStatus"&&!["open","closed","unknown"].includes(value))throw new Error("Invalid status");
        return json(await submitCorrection({requestId:body.requestId?string(body.requestId,100):undefined,serviceId:string(body.serviceId,100),category:body.field,field:body.field,suggestedValue:value,note:body.note?string(body.note,600):"",evidenceUrl:body.evidenceUrl?url(body.evidenceUrl):null}),201);
      }
      case "review":{
        if(!await reviewer(request))return json({error:"Sign in required"},401);
        if(!["approved","rejected","needs_information","duplicate"].includes(body.decision))throw new Error("Invalid decision");
        return json(await reviewCorrection({id:string(body.id,100),expectedVersion:body.expectedVersion,decision:body.decision,sourceUrl:body.decision==="approved"?url(body.sourceUrl):null,reason:string(body.reason,600)},process.env.DATABASE_URL?'authenticated-owner':'local-owner'));
      }
      case "events":{
        const ticket=readActivity(body.receipt);
        if(!ticket||body.id!==ticket.id)return json({error:'A valid server activity receipt is required'},403);
        if(body.eventType!=='request')return json({error:'Contact outcomes are saved on the device only'},400);
        return json(await recordEvent({id:ticket.id,requestedNeed:ticket.requestedNeed,broadArea:ticket.broadArea,eventType:'request',resultsCount:ticket.resultsCount,language:ticket.language}),201);
      }
      default:return json({error:"Unknown operation"},404);
    }
  }catch(error){return json({error:error.status===409?error.message:"Please check the form fields and try again."},error.status||400);}
}
