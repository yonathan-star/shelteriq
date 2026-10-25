import test from 'node:test';
import assert from 'node:assert/strict';
import { requestRoute, routeInstruction } from '../src/lib/routing.js';
import { directionsUrl } from '../src/lib/mapLinks.js';

test('walking and cycling use distinct routing graphs, and repeated routes are cached', async () => {
 const original=globalThis.fetch, calls=[];
 const fixture={code:'Ok',routes:[{distance:600,duration:450,geometry:{type:'LineString',coordinates:[[-80.15,26.12],[-80.16,26.13]]},legs:[{steps:[{distance:600,maneuver:{type:'turn',modifier:'right',location:[-80.15,26.12]},name:'Main Street'}]}]}]};
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(fixture);};
 try {
  const signal=new AbortController().signal,origin={lat:26.12,lng:-80.15},destination={lat:26.13,lng:-80.16};
  const walk=await requestRoute(origin,destination,'WALKING',signal);
  assert.equal(walk.steps.length,1);await requestRoute(origin,destination,'WALKING',signal);
  await requestRoute(origin,destination,'BICYCLING',signal);
  assert.equal(calls.length,2);assert.match(calls[0].url,/routed-foot/);assert.match(calls[1].url,/routed-bike/);assert.equal(calls[0].options.credentials,'omit');
  assert.equal(new URL(directionsUrl({coords:destination},'BICYCLING')).searchParams.get('travelmode'),'bicycling');
  assert.equal(new URL(directionsUrl({coords:destination},'TRANSIT')).searchParams.get('travelmode'),'transit');
 } finally {globalThis.fetch=original;}
});

test('transit and invalid positions never silently request a driving route', async () => {
 await assert.rejects(requestRoute({lat:26,lng:-80},{lat:27,lng:-80},'TRANSIT'),/Invalid route/);
 await assert.rejects(requestRoute({lat:200,lng:-80},{lat:27,lng:-80},'WALKING'),/Invalid route/);
 const controller=new AbortController();controller.abort();await assert.rejects(requestRoute({lat:26,lng:-80},{lat:27,lng:-80},'DRIVING',controller.signal),{name:'AbortError'});
});

test('missing geometry produces a retryable failure and maneuvers translate', async () => {
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({code:'Ok',routes:[{distance:1,duration:1,geometry:{type:'LineString',coordinates:[[null,null],[null,null]]},legs:[]}]});
 try {await assert.rejects(requestRoute({lat:26.14,lng:-80.15},{lat:26.15,lng:-80.16},'DRIVING'),/No usable route/);}finally{globalThis.fetch=original;}
 assert.equal(routeInstruction({name:'Main Street',maneuver:{type:'turn',modifier:'right'}},'es'),'Gire a la derecha hacia Main Street');
 assert.equal(routeInstruction({maneuver:{type:'arrive'}},'ht'),'Rive nan destinasyon ou');
});
