import test from "node:test";
import assert from "node:assert/strict";
process.env.SHELTERIQ_DB_PATH=":memory:";
process.env.SHELTERIQ_DEMO="true";
process.env.TZ="America/New_York";
const store=await import("../server/directory-store.js");
const api=await import("../api/hub.js");
const {matchPrevention}=await import("../src/data/prevention.js");
const {calendarText,reminderInstant}=await import("../src/lib/plans.js");
const {siteState}=await import("../src/data/disasterSites.js");
const {activeAlerts,getAlerts}=await import("../server/alerts.js");
test("prevention separates rent from electric-bill resources and excludes closed programs",()=>{
 assert.ok(matchPrevention("utilities").some(p=>p.id==="liheap"));
 assert.ok(!matchPrevention("rent").some(p=>p.id==="liheap"));
 assert.equal(matchPrevention("rent",[{id:"closed",concerns:["rent"],programState:"closed"}]).length,0);
});
test("anonymous correction remains pending and duplicate submission is safe",()=>{
 const before=store.getServices()[0];
 const input={requestId:"test-report-one",serviceId:before.id,field:"hours",suggestedValue:"Demo 10am–4pm",note:"Fictional",evidenceUrl:"https://example.org/"};
 const receipt=store.submitCorrection(input);assert.equal(receipt.state,"submitted");
 assert.deepEqual(store.submitCorrection(input),receipt);
 assert.equal(store.getServices()[0].hours,before.hours);assert.equal(store.correctionQueue().length,1);
});
test("approval is versioned and competing stale approval cannot overwrite it",()=>{
 const second=store.submitCorrection({requestId:"test-report-two",serviceId:"fictional-demo-center",field:"hours",suggestedValue:"Demo different hours",note:"",evidenceUrl:null});
 store.reviewCorrection({id:"test-report-one",expectedVersion:1,decision:"approved",sourceUrl:"https://example.org/",reason:"Fixture verified"},"test-moderator");
 const current=store.getServices()[0];assert.equal(current.version,2);assert.equal(current.hours,"Demo 10am–4pm");
 assert.equal(store.auditHistory()[0].actor,"test-moderator");assert.equal(store.auditHistory()[0].previousValues.version,1);assert.equal(store.auditHistory()[0].newValues.version,2);
 assert.equal(current.verifiedAt,null);assert.ok(current.fieldVerification.hours.verifiedAt);
 assert.throws(()=>store.reviewCorrection({id:second.token,expectedVersion:1,decision:"approved",sourceUrl:"https://example.org/",reason:"Conflict"},"test-moderator"),err=>err.status===409);
 assert.equal(store.getServices()[0].version,2);
});
test("public callers cannot read correction queues or approve records",async()=>{
 const queue=await api.GET(new Request("http://127.0.0.1/api/hub?resource=corrections"));assert.equal(queue.status,401);
 const review=await api.POST(new Request("http://127.0.0.1/api/hub?resource=review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:"test-report-two",decision:"approved",expectedVersion:1,reason:"Unauthorized",sourceUrl:"https://example.org/"})}));assert.equal(review.status,401);
});
test("one request is counted once and small groups suppress denominators",()=>{
 for(let i=0;i<5;i++)store.recordEvent({id:`food-${i}`,requestedNeed:"food",broadArea:"central",eventType:"request",resultsCount:5,language:"en"});
 store.recordEvent({id:"food-0",requestedNeed:"food",broadArea:"central",eventType:"request",resultsCount:5,language:"en"});
 assert.equal(store.metrics().totalRequests,5);
 store.recordEvent({id:"shelter-0",requestedNeed:"shelter",broadArea:"south",eventType:"request",resultsCount:0,language:"en",query:"Must not appear in metrics"});
 const metrics=store.metrics();assert.equal(metrics.totalRequests,null);assert.equal(metrics.lowMatchRequests,null);assert.equal(metrics.counts.find(c=>c.need==="shelter").count,null);assert.ok(metrics.isDemo);assert.ok(!JSON.stringify(metrics).includes("Must not appear"));
});
test("calendar keeps the UTC instant and never exposes sensitive plan details",()=>{
 const text=calendarText({id:"fixture",dueAt:"2026-10-12T19:00:00Z",title:"Eviction and medical appointment"});
 assert.match(text,/DTSTART:20261012T190000Z/);assert.ok(text.includes("BEGIN:VALARM"));assert.ok(!text.includes("Eviction"));
 assert.equal(reminderInstant("2026-03-08T02:30"),null);
 assert.equal(reminderInstant("2026-10-12T15:00"),"2026-10-12T19:00:00.000Z");
});
test("expired storm activation cannot remain verified open",()=>{
 assert.equal(siteState({activationState:"open",verifiedAt:"2026-01-01",statusExpiresAt:"2026-01-02"},Date.parse("2026-10-11")),"unknown");
});
test("updated and cancelled official alerts retire referenced notices",()=>{
 const old={properties:{id:"old",messageType:"Alert",expires:"2027-01-01"}};
 const updated={properties:{id:"new",messageType:"Update",references:[{identifier:"old"}],expires:"2027-01-01"}};
 assert.deepEqual(activeAlerts([old,updated]).map(a=>a.id),["new"]);
 const cancel={properties:{id:"cancel",messageType:"Cancel",references:[{identifier:"new"}]}};
 assert.equal(activeAlerts([old,updated,cancel]).length,0);
});
test("failed weather refresh preserves cached notices and reports stale state",async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;let time=Date.now();
 try{Date.now=()=>time;globalThis.fetch=async()=>Response.json({features:[{properties:{id:"fixture-alert",messageType:"Alert",expires:new Date(time+86400000).toISOString(),event:"Fictional test notice"}}]});
  const first=await getAlerts();assert.equal(first.stale,false);
  time+=360000;globalThis.fetch=async()=>{throw new Error("offline");};
  const second=await getAlerts();assert.equal(second.stale,true);assert.equal(second.items[0].id,"fixture-alert");assert.equal(second.lastSuccessfulRefresh,first.lastSuccessfulRefresh);
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
import { currentWeather } from '../server/hazards.js';
test('hazard map removes expired and cancelled weather notices',()=>{
  const now=Date.parse('2026-10-11T22:00:00Z');
  const features=[{id:'active',properties:{expires:'2026-10-12T00:00:00Z'}},{id:'expired',properties:{expires:'2026-10-11T20:00:00Z'}},{id:'cancelled',properties:{messageType:'Cancel'}}];
  assert.deepEqual(currentWeather(features,now).map(f=>f.id),['active']);
});
