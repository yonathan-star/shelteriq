import { spawn } from 'node:child_process';
import { readFileSync,writeFileSync,unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
const local=parseEnv(readFileSync('.env.local','utf8')),cloud=parseEnv(readFileSync('.env.cloud.local','utf8'));
const token=local.SHELTERIQ_REVIEW_TOKEN||randomBytes(32).toString('base64url');
local.SHELTERIQ_REVIEW_TOKEN=token;local.DATABASE_URL=cloud.DATABASE_URL;
writeFileSync('.env.local',Object.entries(local).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n');
const cli=join(process.env.APPDATA,'npm','node_modules','vercel','dist','index.js');
for(const environment of ['production','preview'])for(const [name,value] of [['GEMINI_API_KEY',local.GEMINI_API_KEY],['GEMINI_MODEL',local.GEMINI_MODEL||'gemini-3.6-flash'],['SHELTERIQ_REVIEW_TOKEN',token]]){
  if(!value)throw new Error(`Missing ${name}`);
  const input='.vercel/env-request.json';writeFileSync(input,JSON.stringify({key:name,value,type:'encrypted',target:[environment]}));
  try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,'api','/v10/projects/prj_O5wcLZlgJIKUCgXnCF4oYRyBL8cJ/env?upsert=true&teamId=team_MZErYSJv3znEdQNQINvSaEfR','--method','POST','--input',input],{stdio:['ignore','pipe','pipe'],windowsHide:true});child.stdout.resume();child.stderr.resume();child.on('exit',code=>code===0?resolve():reject(new Error(`Could not configure ${name} for ${environment}`)));child.on('error',reject);});}finally{unlinkSync(input);}
  console.log(`${name} configured for ${environment}; value hidden.`);
}
