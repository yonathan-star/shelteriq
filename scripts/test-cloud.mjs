import assert from 'node:assert/strict';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import * as store from '../server/cloud-store.js';
const sql=store.cloudSQL(),schema='sq_test_'+randomBytes(8).toString('hex');
process.env.SHELTERIQ_DATABASE_SCHEMA=schema;process.env.SHELTERIQ_DEMO='true';
try{
  await sql.query(`CREATE SCHEMA ${schema}`);
  for(const table of ['services','corrections','changes','events','feed_cache','rate_limits','sessions'])await sql.query(`CREATE TABLE ${schema}.${table} (LIKE shelteriq.${table} INCLUDING ALL)`);
  const [fn]=await sql.query("SELECT pg_get_functiondef('shelteriq.review_correction(jsonb,text)'::regprocedure) AS definition");
  await sql.query(fn.definition.replaceAll('shelteriq.',`${schema}.`));
  const service={id:'fictional-cloud-test',name:'Fictional cloud test',version:1,hours:'Demo 9–5',publicStatus:'unknown',isDemo:true};
  await sql.query(`INSERT INTO ${schema}.services VALUES($1,$2::jsonb,1,0)`,[service.id,JSON.stringify(service)]);
  const id=randomUUID();const receipt=await store.submitCorrection({requestId:id,serviceId:service.id,field:'hours',suggestedValue:'Demo 10–4',category:'hours',note:'Fictional test only'});
  assert.equal(receipt.state,'submitted');assert.equal((await store.getServices())[0].version,1);
  assert.equal((await store.submitCorrection({requestId:id,serviceId:service.id,field:'hours',suggestedValue:'Ignored duplicate'})).token,id);
  const second=await store.submitCorrection({serviceId:service.id,field:'hours',suggestedValue:'Demo 11–4'});
  await store.reviewCorrection({id,expectedVersion:1,decision:'approved',sourceUrl:'https://example.org/',reason:'Fictional test'},'test-owner');
  assert.equal((await store.getServices())[0].version,2);assert.equal((await store.auditHistory()).length,1);
  await assert.rejects(store.reviewCorrection({id:second.token,expectedVersion:1,decision:'approved',sourceUrl:'https://example.org/',reason:'Stale test'},'test-owner'),e=>e.status===409);
  const event={id:randomUUID(),eventType:'request',requestedNeed:'shelter',broadArea:'unsure',resultsCount:0,language:'en'};
  await store.recordEvent(event);await store.recordEvent(event);assert.equal((await store.metrics()).counts[0].count,null);
  await store.saveFeed('test',{checkedAt:new Date().toISOString(),data:{features:[]}});assert.ok((await store.loadFeed('test')).checkedAt);
  const hash=createHash('sha256').update(randomUUID()).digest('hex');await store.saveSession(hash,Date.now()+60000);assert.equal(await store.validSession(hash),true);await store.revokeSession(hash);assert.equal(await store.validSession(hash),false);
  assert.equal(await store.checkRate('test',1),true);assert.equal(await store.checkRate('test',1),false);
  console.log('Real Postgres checks passed: persistence, deduplication, atomic approval, stale conflict, audit, metrics suppression, cache, sessions and rate limits.');
}finally{if(!/^sq_test_[a-f0-9]{16}$/.test(schema))throw new Error('Unsafe test cleanup');await sql.query(`DROP SCHEMA ${schema} CASCADE`);}
