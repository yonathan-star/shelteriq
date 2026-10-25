import { randomUUID } from 'node:crypto';
import { cloudSQL } from '../server/cloud-store.js';
import { reviewedFacts,applyReviewedFacts } from '../src/data/reviewedFacts.js';
if(!process.env.DATABASE_URL)throw new Error('Private database configuration required');
const sql=cloudSQL();
for(const id of Object.keys(reviewedFacts)){
 const [row]=await sql.query('SELECT record,version FROM shelteriq.services WHERE id=$1',[id]);
 if(!row)throw new Error('Missing reviewed record');
 if(row.record.reviewBatch==='audit-2026-10-12-final')continue;
 const next={...applyReviewedFacts(row.record,new Date().toISOString()),version:row.version+1,updatedAt:new Date().toISOString(),reviewBatch:'audit-2026-10-12-final'};
 const change={actor:'owner-authorized-source-review',reason:'Field-specific audit correction; availability and other intake details remain unverified',sourceUrl:reviewedFacts[id].source,previousValues:row.record,newValues:next};
 const result=await sql.query('WITH updated AS (UPDATE shelteriq.services SET record=$1::jsonb,version=$2 WHERE id=$3 AND version=$4 RETURNING id) INSERT INTO shelteriq.changes(id,service_id,record,applied_at) SELECT $5,id,$6::jsonb,now() FROM updated RETURNING service_id',[JSON.stringify(next),next.version,id,row.version,randomUUID(),JSON.stringify(change)]);
 if(!result.length)throw new Error('Version conflict; review the newer source record before retrying');
 console.log('Updated reviewed fields: '+id);
}
