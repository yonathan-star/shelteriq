// Run: node scripts/geocode.mjs
// Uses OpenStreetMap Nominatim (free, no API key needed)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const TO_GEOCODE = [
  { id: "broward-partnership-central",       address: "920 NW 7th Ave, Fort Lauderdale, FL 33311" },
  { id: "covenant-house",                    address: "733 Breakers Ave, Fort Lauderdale, FL 33304" },
  { id: "salvation-army-fort-lauderdale",    address: "1445 W Broward Blvd, Fort Lauderdale, FL 33312" },
  { id: "keystone-halls",                    address: "910 NW 2nd Ave, Fort Lauderdale, FL 33311" },
  { id: "lifenet4families",                  address: "4020 N Federal Hwy, Pompano Beach, FL 33064" },
  { id: "henderson-behavioral",              address: "1953 NW 7th Ave, Fort Lauderdale, FL 33311" },
  { id: "mission-united-veterans",           address: "5890 S Pine Island Rd, Davie, FL 33328" },
  { id: "legal-aid-broward",                 address: "491 N State Rd 7, Plantation, FL 33317" },
  { id: "broward-outreach-center-pompano",   address: "1420 SW 2nd Ct, Pompano Beach, FL 33069" },
  { id: "broward-outreach-center-hollywood", address: "2056 Scott St, Hollywood, FL 33020" },
  { id: "cathedral-of-faith-food-pantry",    address: "3200 NW 46th St, Fort Lauderdale, FL 33309" },
  { id: "feeding-south-florida-pompano",     address: "2501 SW 32nd Terrace, Pembroke Park, FL 33009" },
  { id: "emmanuel-meal-program",             address: "300 SW 3rd Ave, Fort Lauderdale, FL 33312" },
  { id: "broward-health-homeless-care",      address: "1608 SE 3rd Ave, Fort Lauderdale, FL 33316" },
  { id: "care-resource-ft-lauderdale",       address: "3011 NE 38th St, Fort Lauderdale, FL 33308" },
  { id: "nova-university-clinic",            address: "3301 College Ave, Davie, FL 33314" },
  { id: "ymca-transitional-housing",         address: "3200 NW 13th Ave, Fort Lauderdale, FL 33309" },
  { id: "family-promise-broward",            address: "3400 NW 9th Ave, Oakland Park, FL 33309" },
  { id: "islamic-relief-food",               address: "2440 N State Rd 7, Lauderhill, FL 33313" },
  { id: "vitas-healthcare-palliative",       address: "201 SW 2nd Ave, Fort Lauderdale, FL 33301" },
  { id: "substance-abuse-treatment-center",  address: "1011 SW 2nd Ave, Fort Lauderdale, FL 33312" },
  { id: "chrysalis-health",                  address: "4360 N Federal Hwy, Fort Lauderdale, FL 33308" },
  { id: "north-broward-shelter",             address: "546 S Military Trl, Deerfield Beach, FL 33442" },
  { id: "grace-place-miramar",               address: "6700 Miramar Pkwy, Miramar, FL 33023" },
  { id: "jewish-family-service-broward",     address: "5890 S Pine Island Rd, Davie, FL 33328" },
  { id: "va-medical-center-miami",           address: "9800 W Commercial Blvd, Tamarac, FL 33351" },
  { id: "assurance-learning-center",         address: "1300 N Andrews Ave, Fort Lauderdale, FL 33311" },
];

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: { "User-Agent": "ShelterIQ-geocoder/1.0" } });
  const data = await res.json();
  if (data.length > 0) {
    return {
      lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
      lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
    };
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log(`Geocoding ${TO_GEOCODE.length} addresses via OpenStreetMap...\n`);
const results = {};

for (const { id, address } of TO_GEOCODE) {
  process.stdout.write(`  ${id.slice(0, 42).padEnd(42)} `);
  const coords = await geocode(address);
  if (coords) {
    results[id] = coords;
    console.log(`${coords.lat}, ${coords.lng}`);
  } else {
    console.log(`FAILED — will keep existing`);
  }
  await sleep(1100); // Nominatim requires max 1 req/sec
}

// Patch services.js
let source = fs.readFileSync(path.join(root, "src/data/services.js"), "utf8");
let updated = 0;

for (const [id, coords] of Object.entries(results)) {
  const idIdx = source.indexOf(`id: "${id}"`);
  if (idIdx === -1) { console.warn(`\nCould not find id: "${id}"`); continue; }
  const segment = source.slice(idIdx, idIdx + 400);
  const match = segment.match(/coords: \{ lat: [-\d.]+, lng: [-\d.]+ \}/);
  if (!match) { console.warn(`\nNo coords line found for ${id}`); continue; }
  const newStr = `coords: { lat: ${coords.lat}, lng: ${coords.lng} }`;
  source = source.slice(0, idIdx) + source.slice(idIdx).replace(match[0], newStr);
  updated++;
}

fs.writeFileSync(path.join(root, "src/data/services.js"), source, "utf8");
console.log(`\n✅ Done — updated ${updated}/${TO_GEOCODE.length} services in services.js`);
