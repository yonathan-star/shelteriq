import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
let client;
export function cloudSQL(){return client ||= neon(process.env.DATABASE_URL);}
const query=(text,args=[])=>{const schema=process.env.SHELTERIQ_DATABASE_SCHEMA||'shelteriq';if(!/^(shelteriq|sq_test_[a-f0-9]+)$/.test(schema))throw new Error('Invalid database schema');return cloudSQL().query(text.replaceAll('shelteriq.',`${schema}.`),args);};
export async function getServices(includePrograms=false){const rows=await query('SELECT record FROM shelteriq.services ORDER BY position,id');return rows.map(r=>r.record).filter(s=>includePrograms||s.kind!=='prevention');}
export async function submitCorrection(input){
  const service=(await getServices(true)).find(s=>s.id===input.serviceId);if(!service)throw new Error('Unknown service');
  const id=input.requestId||randomUUID(),now=new Date().toISOString();
  const record={id,serviceId:service.id,category:input.category,field:input.field,suggestedValue:input.suggestedValue,note:input.note,evidenceUrl:input.evidenceUrl,baseVersion:service.version,state:'submitted',createdAt:now};
  await query('INSERT INTO shelteriq.corrections(id,service_id,record,state,created_at) VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(id) DO NOTHING',[id,service.id,JSON.stringify(record),'submitted',now]);
  const [stored]=await query('SELECT record FROM shelteriq.corrections WHERE id=$1',[id]);return {token:id,state:stored.record.state,baseVersion:stored.record.baseVersion};
}
export async function correctionQueue(){return (await query('SELECT record FROM shelteriq.corrections ORDER BY created_at DESC LIMIT 500')).map(r=>r.record);}
export async function auditHistory(){return (await query('SELECT record,applied_at FROM shelteriq.changes ORDER BY applied_at DESC LIMIT 500')).map(r=>({...r.record,appliedAt:r.applied_at}));}
export async function reviewCorrection(input,actor){try{const [row]=await query('SELECT shelteriq.review_correction($1::jsonb,$2) AS record',[JSON.stringify(input),actor]);return row.record;}catch(error){if(error.message?.includes('Version conflict')){const conflict=new Error('Version conflict: reload and submit a correction against the current record.');conflict.status=409;throw conflict;}throw new Error('Review could not be applied',{cause:error});}}
export async function recordEvent(input){const now=new Date().toISOString();const record={id:input.id,requestedNeed:input.requestedNeed,broadArea:input.broadArea,eventType:input.eventType,barrier:input.barrier||null,resultsCount:input.resultsCount??null,referralId:input.referralId||null,serviceId:input.serviceId||null,language:input.language,occurredAt:now,isDemo:process.env.SHELTERIQ_DEMO==='true'};await query('INSERT INTO shelteriq.events(id,record,occurred_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(id) DO NOTHING',[record.id,JSON.stringify(record),now]);return {accepted:true};}
export async function metrics(){
  const since=new Date(Date.now()-90*86400000).toISOString();const demo=process.env.SHELTERIQ_DEMO==='true';
  await query('DELETE FROM shelteriq.events WHERE occurred_at < $1',[since]);
  const rows=await query("SELECT record->>'requestedNeed' AS need, count(*)::int AS count, count(*) FILTER(WHERE (record->>'resultsCount')::int<2)::int AS low FROM shelteriq.events WHERE occurred_at >= $1 AND record->>'eventType'='request' AND (record->>'isDemo')::boolean=$2 GROUP BY record->>'requestedNeed'",[since,demo]);
  const suppressed=rows.some(r=>r.count<5),total=rows.reduce((n,r)=>n+r.count,0),low=rows.reduce((n,r)=>n+r.low,0);
  return {periodStart:since,periodEnd:new Date().toISOString(),isDemo:demo,source:demo?'Demo data — fictional staging activity':'Structured requests recorded by the shared server',counts:rows.map(r=>({need:r.need,count:r.count<5?null:r.count,suppressed:r.count<5})),totalRequests:suppressed?null:total,lowMatchRequests:suppressed||low<5||total-low<5?null:low,threshold:5,coverage:'App activity only; repeat visits may be present. Not countywide prevalence.'};
}
export async function saveFeed(key,record){await query('INSERT INTO shelteriq.feed_cache(id,record) VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET record=EXCLUDED.record',[key,JSON.stringify(record)]);}
export async function loadFeed(key){const [row]=await query('SELECT record FROM shelteriq.feed_cache WHERE id=$1',[key]);return row?.record||null;}
export async function checkRate(key,max){const until=Math.floor(Date.now()/900000);const [row]=await query('INSERT INTO shelteriq.rate_limits(id,bucket,count) VALUES($1,$2,1) ON CONFLICT(id) DO UPDATE SET bucket=EXCLUDED.bucket,count=CASE WHEN shelteriq.rate_limits.bucket=EXCLUDED.bucket THEN shelteriq.rate_limits.count+1 ELSE 1 END RETURNING count',[key,until]);return row.count<=max;}
export async function saveSession(hash,expires){await query('INSERT INTO shelteriq.sessions(id,expires_at) VALUES($1,$2)',[hash,new Date(expires).toISOString()]);}
export async function validSession(hash){const [row]=await query('SELECT id FROM shelteriq.sessions WHERE id=$1 AND expires_at>now()',[hash]);return Boolean(row);}
export async function revokeSession(hash){await query('DELETE FROM shelteriq.sessions WHERE id=$1',[hash]);}
