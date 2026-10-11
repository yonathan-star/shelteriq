import test from "node:test";
import assert from "node:assert/strict";
import { localLookup, localAnswer, validateMatches } from "../src/lib/localLookup.js";
import { services } from "../src/data/services.js";
import { recordCheckin, getCheckinStatus } from "../src/lib/checkin.js";
import { currentWeather,feedStale } from '../src/lib/hazardStatus.js';
test('live weather retires superseded alerts and marks old feeds stale',()=>{
  const now=Date.parse('2026-10-11T23:00:00Z');
  const features=[{id:'old',properties:{id:'old',expires:'2026-10-12T00:00:00Z'}},{id:'new',properties:{messageType:'Update',references:[{identifier:'old'}],expires:'2026-10-12T00:00:00Z'}},{id:'ended',properties:{ends:'2026-10-11T22:59:00Z'}}];
  assert.deepEqual(currentWeather(features,now).map(f=>f.id),['new']);
  assert.equal(feedStale({checkedAt:'2026-10-11T22:57:00Z'},now),true);
  assert.equal(feedStale({checkedAt:'2026-10-11T22:59:30Z'},now),false);
  assert.equal(feedStale({checkedAt:'2026-10-11T22:59:30Z',error:'Unavailable'},now),true);
});
const byId = id => services.find(s => s.id === id);
test("directory fallback honors children, ID and age requirements", () => {
  const result = localLookup("A 35 years old parent with children needs shelter without ID.");
  assert.ok(result.data.matches.length);
  for (const id of result.data.matches) {
    const s = byId(id);
    assert.equal(s.eligibility.families,true);
    assert.equal(s.eligibility.noId,true);
    assert.ok(s.type.includes("shelter"));
    assert.ok(s.eligibility.maxAge === null || s.eligibility.maxAge >= 35);
  }
  assert.equal(result.meta.who,"family");
});
test("pet barrier does not return incompatible shelters", () => {
  const result = localLookup("I need shelter with my dog");
  for (const id of result.data.matches) assert.equal(byId(id).eligibility.pets,true);
});
test("Spanish and Haitian Creole fallback searches recognize needs", () => {
  for (const [query,language] of [["Necesito refugio con hijos sin identificación","es"],["Mwen bezwen abri ak timoun san id","ht"]]) {
    const result=localLookup(query,language);
    assert.equal(result.type,"results");
    assert.ok(result.data.matches.length);
    assert.equal(result.meta.who,"family");
  }
});
test("unsupported requests ask for clarification", () => assert.equal(localLookup("Tell me a joke").type,"message"));
test("ordinary shelter requests do not imply domestic violence or youth eligibility", () => {
  const result=localLookup("I need a place to stay in Hollywood tonight");
  assert.equal(result.meta.area,"south");
  assert.ok(result.data.matches.length);
  for(const id of result.data.matches) {
    assert.ok(!["women-in-distress","domestic-violence-intervention"].includes(id));
    assert.equal(byId(id).eligibility.maxAge,null);
  }
});
test("an adult age is recognized and a child's age does not exclude adult family services", () => {
  const adult=localLookup("I am 35 and need shelter");
  assert.ok(adult.data.matches.every(id=>byId(id).eligibility.maxAge===null||byId(id).eligibility.maxAge>=35));
  const family=localLookup("I need shelter with my 5 year old child");
  assert.ok(family.data.matches.includes("salvation-army-fort-lauderdale"));
});
test("pet constraints do not silently redirect an ordinary family to abuse-specific shelter", () => {
  const result=localLookup("I am a parent with children and need shelter with my dog without ID");
  assert.ok(!result.data.matches.includes("domestic-violence-intervention"));
  const abuse=localLookup("I am fleeing domestic violence and need shelter with my dog without ID");
  assert.ok(abuse.data.matches.includes("domestic-violence-intervention"));
});
test("retry excludes prior and rejected options", () => {
  const first=localLookup("shelter with family");
  const next=localLookup("shelter with family","en",{ alreadyShown:first.data.matches, rejected:[] });
  if (next.type === "results") assert.ok(next.data.matches.every(id => !first.data.matches.includes(id)));
  else assert.match(next.text,/No new options/);
});
test("AI results cannot inject unknown, duplicate or incompatible services", () => {
  const result=validateMatches({type:"results",matches:["not-real","covenant-house","salvation-army-fort-lauderdale","salvation-army-fort-lauderdale"],reasons:{}},"family needs shelter");
  assert.deepEqual(result.data.matches,["salvation-army-fort-lauderdale"]);
  assert.throws(()=>validateMatches({matches:"bad"},"shelter"));
});
test("follow-up sees all results, including the fifth", () => {
  const first=services.filter(s=>!s.eligibility.noId).slice(0,4);
  const fifth=services.find(s=>s.eligibility.noId);
  assert.ok(localAnswer("Do I need ID?",[...first,fifth]).includes(fifth.name));
  assert.ok(localAnswer("Are beds available right now?",[fifth]).includes("does not confirm"));
});
test("legacy fake reports are ignored and local outcomes expire", () => {
  const store = new Map([["sq_checkins_v2",JSON.stringify({test:{attempts:18,success:13,lastUpdated:Date.now()}})]]);
  globalThis.localStorage={ getItem:key=>store.get(key)||null, setItem:(key,value)=>store.set(key,value) };
  assert.equal(getCheckinStatus("test"),null);
  recordCheckin("test","got_in");
  assert.equal(getCheckinStatus("test").status,"available");
  recordCheckin("test","full");
  assert.equal(getCheckinStatus("test").status,"full");
  const data=JSON.parse(store.get("sq_checkins_v3"));
  data.test.lastUpdated=Date.now()-86400001;
  store.set("sq_checkins_v3",JSON.stringify(data));
  assert.equal(getCheckinStatus("test"),null);
});
