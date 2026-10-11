import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { services } from '../src/data/services.js';
import { preventionPrograms } from '../src/data/prevention.js';
import { cloudSQL } from '../server/cloud-store.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const sql=cloudSQL();
const ddl=[
 'CREATE SCHEMA IF NOT EXISTS shelteriq',
 'CREATE TABLE IF NOT EXISTS shelteriq.services(id text PRIMARY KEY,record jsonb NOT NULL,version integer NOT NULL,position integer NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS shelteriq.corrections(id text PRIMARY KEY,service_id text NOT NULL REFERENCES shelteriq.services(id),record jsonb NOT NULL,state text NOT NULL,created_at timestamptz NOT NULL)',
 'CREATE TABLE IF NOT EXISTS shelteriq.changes(id text PRIMARY KEY,service_id text NOT NULL REFERENCES shelteriq.services(id),record jsonb NOT NULL,applied_at timestamptz NOT NULL)',
 'CREATE TABLE IF NOT EXISTS shelteriq.events(id text PRIMARY KEY,record jsonb NOT NULL,occurred_at timestamptz NOT NULL)',
 'CREATE TABLE IF NOT EXISTS shelteriq.feed_cache(id text PRIMARY KEY,record jsonb NOT NULL)',
 'CREATE TABLE IF NOT EXISTS shelteriq.rate_limits(id text PRIMARY KEY,bucket bigint NOT NULL,count integer NOT NULL)',
 'CREATE TABLE IF NOT EXISTS shelteriq.sessions(id text PRIMARY KEY,expires_at timestamptz NOT NULL)',
 `CREATE OR REPLACE FUNCTION shelteriq.review_correction(input jsonb,actor text) RETURNS jsonb LANGUAGE plpgsql AS $$
 DECLARE c jsonb; s jsonb; previous jsonb; v integer; next_state text; now_text text := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 BEGIN
 SELECT record INTO c FROM shelteriq.corrections WHERE id=input->>'id' FOR UPDATE;
 IF c IS NULL THEN RAISE EXCEPTION 'Correction not found'; END IF;
 IF c->>'state' NOT IN ('submitted','in_review','needs_information') THEN RAISE EXCEPTION 'Already reviewed'; END IF;
 SELECT record,version INTO s,v FROM shelteriq.services WHERE id=c->>'serviceId' FOR UPDATE;
 IF v<>(input->>'expectedVersion')::integer OR v<>(c->>'baseVersion')::integer THEN RAISE EXCEPTION 'Version conflict'; END IF;
 next_state:=input->>'decision';
 IF next_state NOT IN ('approved','rejected','needs_information','duplicate') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF next_state='approved' THEN
 IF c->>'field' NOT IN ('hours','phone','address','intakeRequirements','publicStatus') THEN RAISE EXCEPTION 'Invalid field'; END IF;
 previous:=s;
 s:=jsonb_set(s,ARRAY[c->>'field'],c->'suggestedValue') || jsonb_build_object('version',v+1,'changeSourceUrl',input->>'sourceUrl','updatedAt',now_text,'fieldVerification',COALESCE(s->'fieldVerification','{}'::jsonb)||jsonb_build_object(c->>'field',jsonb_build_object('sourceUrl',input->>'sourceUrl','verifiedAt',now_text)));
 UPDATE shelteriq.services SET record=s,version=v+1 WHERE id=c->>'serviceId';
 INSERT INTO shelteriq.changes VALUES(gen_random_uuid()::text,c->>'serviceId',jsonb_build_object('actor',actor,'reason',input->>'reason','sourceUrl',input->>'sourceUrl','previousValues',previous,'newValues',s,'correctionId',c->>'id'),now_text::timestamptz);
 END IF;
 c:=c||jsonb_build_object('state',next_state,'reviewedAt',now_text,'reviewedBy',actor,'decisionReason',input->>'reason');
 UPDATE shelteriq.corrections SET record=c,state=next_state WHERE id=c->>'id';RETURN c;
 END; $$`,
 'REVOKE ALL ON SCHEMA shelteriq FROM PUBLIC',
 'REVOKE ALL ON ALL TABLES IN SCHEMA shelteriq FROM PUBLIC',
 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shelteriq FROM PUBLIC',
];
for(const statement of ddl)await sql.query(statement);
let local;
if(existsSync('.data/directory.sqlite'))local=new DatabaseSync('.data/directory.sqlite',{readOnly:true});
const records=local?local.prepare('SELECT record FROM services ORDER BY rowid').all().map(r=>JSON.parse(r.record)):[...services,...preventionPrograms.map(p=>({...p,kind:'prevention',version:1}))];
for(const [position,record] of records.entries())await sql.query('INSERT INTO shelteriq.services(id,record,version,position) VALUES($1,$2::jsonb,$3,$4) ON CONFLICT(id) DO NOTHING',[record.id,JSON.stringify(record),record.version||1,position]);
if(local){for(const [table,time] of [['corrections','created_at'],['changes','applied_at'],['events','occurred_at']])for(const row of local.prepare(`SELECT * FROM ${table}`).all()){
 const record=JSON.parse(row.record);if(record.isDemo)continue;
 const columns=Object.keys(row),values=columns.map(k=>row[k]);
 const slots=columns.map((k,i)=>`$${i+1}${k==='record'?'::jsonb':k===time?'::timestamptz':''}`);
 await sql.query(`INSERT INTO shelteriq.${table}(${columns.join(',')}) VALUES(${slots.join(',')}) ON CONFLICT(id) DO NOTHING`,values);
}local.close();}
console.log(`Shared schema ready; ${records.length} directory records migrated. Private report contents were not printed.`);
