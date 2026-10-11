import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { services as seed } from "../src/data/services.js";
import { preventionPrograms } from "../src/data/prevention.js";
import * as cloud from './cloud-store.js';
let database;
function db(){
  if(database)return database;
  if(process.env.VERCEL&&!process.env.SHELTERIQ_DB_PATH) throw new Error("Persistent storage required before deployment");
  const path=process.env.SHELTERIQ_DB_PATH||resolve(process.cwd(),".data","directory.sqlite");
  if(path!==":memory:")mkdirSync(dirname(path),{recursive:true});
  database=new DatabaseSync(path); database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  database.exec(`CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,record TEXT NOT NULL,version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS corrections(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,record TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS changes(id TEXT PRIMARY KEY,service_id TEXT NOT NULL,record TEXT NOT NULL,applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,record TEXT NOT NULL,occurred_at TEXT NOT NULL);`);
  const insert=database.prepare("INSERT OR IGNORE INTO services VALUES(?,?,?)");
  const testServices=process.env.SHELTERIQ_DEMO==="true" ? [{id:"fictional-demo-center",name:"Fictional Demo Center — test data",type:["shelter","food"],address:"Fictional address; do not travel",coords:null,phone:"",website:"https://example.org/",hours:"Demo intake 9am–5pm",walkin:true,eligibility:{men:true,women:true,families:true,veterans:false,pets:true,minAge:null,maxAge:null,noId:true},languages:["en","es","ht"],beds:null,version:1,sourceUrl:"https://example.org/",verifiedAt:null,verificationState:"demo",publicStatus:"unknown",isDemo:true,documents:[],intakeRequirements:"Fictional test instructions"}] : seed;
  for(const s of [...testServices,...preventionPrograms.map(p=>({...p,kind:"prevention",version:1}))])insert.run(s.id,JSON.stringify(s),s.version);
  return database;
}
export function getServices(includePrograms=false){if(process.env.DATABASE_URL)return cloud.getServices(includePrograms);return db().prepare("SELECT record FROM services ORDER BY rowid").all().map(r=>JSON.parse(r.record)).filter(s=>includePrograms||s.kind!=="prevention");}
export function submitCorrection(input){
  if(process.env.DATABASE_URL)return cloud.submitCorrection(input);
  const service=getServices(true).find(s=>s.id===input.serviceId); if(!service)throw new Error("Unknown service");
  const id=input.requestId||randomUUID(),now=new Date().toISOString();
  const existing=db().prepare("SELECT record FROM corrections WHERE id=?").get(id);
  if(existing){const old=JSON.parse(existing.record);return {token:old.id,state:old.state,baseVersion:old.baseVersion};}
  const record={id,serviceId:service.id,category:input.category,field:input.field,suggestedValue:input.suggestedValue,note:input.note,evidenceUrl:input.evidenceUrl,baseVersion:service.version,state:"submitted",createdAt:now};
  db().prepare("INSERT INTO corrections VALUES(?,?,?,?,?)").run(id,service.id,JSON.stringify(record),"submitted",now);
  return {token:id,state:"submitted",baseVersion:service.version};
}
export function correctionQueue(){if(process.env.DATABASE_URL)return cloud.correctionQueue();return db().prepare("SELECT record FROM corrections ORDER BY created_at DESC").all().map(r=>JSON.parse(r.record));}
export function auditHistory(){if(process.env.DATABASE_URL)return cloud.auditHistory();return db().prepare("SELECT record,applied_at FROM changes ORDER BY applied_at DESC").all().map(r=>({...JSON.parse(r.record),appliedAt:r.applied_at}));}
export function reviewCorrection(input,actor){
  if(process.env.DATABASE_URL)return cloud.reviewCorrection(input,actor);
  const store=db();store.exec("BEGIN IMMEDIATE");
  try{
    const row=store.prepare("SELECT record,state FROM corrections WHERE id=?").get(input.id);
    if(!row)throw new Error("Correction not found");
    const correction=JSON.parse(row.record);
    if(!["submitted","in_review","needs_information"].includes(row.state))throw new Error("Already reviewed");
    const serviceRow=store.prepare("SELECT record,version FROM services WHERE id=?").get(correction.serviceId);
    if(input.expectedVersion!==serviceRow.version||correction.baseVersion!==serviceRow.version){const error=new Error("Version conflict: reload and submit a correction against the current record.");error.status=409;throw error;}
    const now=new Date().toISOString();
    if(input.decision==="approved"){
      const service=JSON.parse(serviceRow.record);
      const previous={...service};service[correction.field]=correction.suggestedValue;
      service.version++;service.changeSourceUrl=input.sourceUrl;service.updatedAt=now;
      service.fieldVerification={...service.fieldVerification,[correction.field]:{sourceUrl:input.sourceUrl,verifiedAt:now}};
      const updated=store.prepare("UPDATE services SET record=?,version=? WHERE id=? AND version=?").run(JSON.stringify(service),service.version,service.id,serviceRow.version);
      if(updated.changes!==1)throw new Error("Version conflict");
      store.prepare("INSERT INTO changes VALUES(?,?,?,?)").run(randomUUID(),service.id,JSON.stringify({actor,reason:input.reason,sourceUrl:input.sourceUrl,previousValues:previous,newValues:service,correctionId:correction.id}),now);
    }
    correction.state=input.decision;correction.reviewedAt=now;correction.reviewedBy=actor;correction.decisionReason=input.reason;
    store.prepare("UPDATE corrections SET record=?,state=? WHERE id=?").run(JSON.stringify(correction),input.decision,correction.id);
    store.exec("COMMIT");return correction;
  }catch(error){store.exec("ROLLBACK");throw error;}
}
export function recordEvent(input){
  if(process.env.DATABASE_URL)return cloud.recordEvent(input);
  const now=new Date().toISOString();const record={id:input.id,requestedNeed:input.requestedNeed,broadArea:input.broadArea,eventType:input.eventType,barrier:input.barrier||null,resultsCount:input.resultsCount??null,referralId:input.referralId||null,serviceId:input.serviceId||null,language:input.language,occurredAt:now,isDemo:process.env.SHELTERIQ_DEMO==="true"};
  db().prepare("INSERT OR IGNORE INTO events VALUES(?,?,?)").run(record.id,JSON.stringify(record),now);
  return {accepted:true};
}
export function metrics(){
  if(process.env.DATABASE_URL)return cloud.metrics();
  const since=new Date(Date.now()-90*86400000).toISOString();db().prepare("DELETE FROM events WHERE occurred_at<?").run(since);
  const demo=process.env.SHELTERIQ_DEMO==="true";
  const events=db().prepare("SELECT record FROM events WHERE occurred_at>=?").all(since).map(r=>JSON.parse(r.record)).filter(e=>e.isDemo===demo);
  const requests=events.filter(e=>e.eventType==="request");
  const cells={};for(const event of requests){const key=event.requestedNeed;cells[key]=(cells[key]||0)+1;}
  // Fixed coarse cells; suppress totals too when any small cell could be inferred.
  const suppressed=Object.values(cells).some(count=>count<5);
  const values=Object.entries(cells).map(([need,count])=>({need,count:count<5?null:count,suppressed:count<5}));
  const low=requests.filter(e=>e.resultsCount<2).length;
  const lowMatchRequests=suppressed||low<5||requests.length-low<5?null:low;
  return {periodStart:since,periodEnd:new Date().toISOString(),isDemo:demo,source:demo?"Demo data — fictional staging activity":"Structured requests recorded by this server",counts:values,totalRequests:suppressed?null:requests.length,lowMatchRequests,threshold:5,coverage:"App activity only; repeat visits may be present. Not countywide prevalence."};
}
