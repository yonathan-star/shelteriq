import test from 'node:test';
import assert from 'node:assert/strict';
import { directionsUrl,phoneUrl } from '../src/lib/mapLinks.js';
test('directions links encode destinations and do not transmit a visitor location',()=>{const url=new URL(directionsUrl({address:'1445 W Broward Blvd, Fort Lauderdale, FL',coords:{lat:26,lng:-80}}));assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('destination'),'1445 W Broward Blvd, Fort Lauderdale, FL');assert.equal(url.searchParams.has('origin'),false);assert.equal(url.searchParams.get('api'),'1');});
test('phone links reject missing contact details and support formatted numbers',()=>{assert.equal(phoneUrl(''),null);assert.equal(phoneUrl('unknown'),null);assert.equal(phoneUrl('(954) 463-3725'),'tel:9544633725');assert.equal(phoneUrl('+1 954 463 3725'),'tel:+19544633725');});
test('confidential and countywide services do not generate misleading routes',()=>{assert.equal(directionsUrl({address:'Confidential — call for address',coords:null}),null);assert.equal(directionsUrl({address:'Broward County-wide',coords:null}),null);});
