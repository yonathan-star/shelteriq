import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../api/assist.js";
const request=(body,headers={"Content-Type":"application/json"})=>new Request("http://127.0.0.1:5173/api/assist",{method:"POST",headers,body:JSON.stringify(body)});
test("status endpoint never returns credentials",async()=>{
  const before=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY="test-private-value";
  const data=await GET().json();
  assert.deepEqual(data,{configured:true});
  if(before===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=before;
});
test("only supported app actions are accepted",async()=>assert.equal((await POST(request({action:"arbitrary-prompt",prompt:"anything"}))).status,400));
test("unknown services cannot enter the provider prompt",async()=>assert.equal((await POST(request({action:"call",serviceId:"made-up"}))).status,400));
test("cross-origin requests are rejected",async()=>assert.equal((await POST(request({action:"intake",situation:"shelter"},{"Content-Type":"application/json",Origin:"https://unrelated.example"}))).status,403));
test("non-JSON and oversized inputs are rejected",async()=>{
  assert.equal((await POST(request({},{"Content-Type":"text/plain"}))).status,415);
  assert.equal((await POST(request({action:"intake",situation:"a".repeat(17000)}))).status,413);
});
test("oversized queries and invalid memory are rejected before AI calls",async()=>{
  assert.equal((await POST(request({action:"intake",situation:"a".repeat(3001)}))).status,400);
  assert.equal((await POST(request({action:"intake",situation:"shelter",memorySummary:{alreadyShown:["invented"]}}))).status,400);
});
