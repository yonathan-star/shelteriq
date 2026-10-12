import { services } from "../data/services.js";

const copy = {
  en: { notice: "AI is unavailable. These are basic directory matches; call to confirm eligibility and availability.", clarify: "Please tell us what you need (shelter, food, or another service), or use the quick form.", reason: "Possible directory match. Call to confirm requirements.", unknown: "The directory does not confirm this. Please call the service to ask.", fallback: "AI is unavailable. Directory information:", none: "No matching information is listed. Call a service to confirm." },
  es: { notice: "La IA no está disponible. Estas opciones vienen del directorio; llame para confirmar los requisitos y la disponibilidad.", clarify: "Díganos qué necesita (refugio, comida u otro servicio), o use el formulario rápido.", reason: "Posible opción del directorio. Llame para confirmar los requisitos.", unknown: "El directorio no confirma esto. Llame al servicio para preguntar.", fallback: "La IA no está disponible. Información del directorio:", none: "No hay información correspondiente. Llame para confirmar." },
  ht: { notice: "AI a pa disponib. Sa yo se rezilta debaz nan anyè a; rele pou konfime kondisyon ak disponiblite.", clarify: "Di nou sa ou bezwen (abri, manje oswa yon lòt sèvis), oswa sèvi ak fòm rapid la.", reason: "Opsyon posib nan anyè a. Rele pou konfime kondisyon yo.", unknown: "Anyè a pa konfime sa. Rele sèvis la pou mande.", fallback: "AI a pa disponib. Enfòmasyon nan anyè a:", none: "Pa gen enfòmasyon ki koresponn. Rele pou konfime." },
};

function requirements(query) {
  const q = query.toLowerCase();
  const patterns = {
    shelter: /\b(shelter|bed|housing|sleep|refugio|dormir|abri)\b|dòmi|place to stay|somewhere to stay|place to live/,
    food: /\b(food|meal|meals|hungry|pantry|comida|alimentos|manje)\b/,
    mental_health: /\b(mental|depression|anxiety|therapy|mantal)\b/,
    substance_abuse: /\b(substance|addiction|drug|alcohol|detox|recovery|drogue)\b/,
    medical: /\b(medical|doctor|clinic|klinik)\b|médico/,
    legal: /\b(legal|lawyer|court|eviction|abogado|avoka)\b/,
    outreach: /\b(outreach|mobile)\b/,
  };
  const types = Object.entries(patterns).filter(([,pattern]) => pattern.test(q)).map(([type]) => type);
  const family = /\b(family|families|children|kids|child|hijos|niños|familia|timoun|fanmi)\b/.test(q);
  const veteran = /\b(veteran|veterans|veterano)\b/.test(q);
  const youth = /\b(youth|teen|teenager)\b|jóvenes|jèn/.test(q);
  const noId = /\b(no id|without id|missing id|san id)\b|sin identificación/.test(q);
  const pets = !/\b(no pets|without pets)\b/.test(q) && /\b(pet|pets|dog|cat|mascota|perro|gato|chen)\b/.test(q);
  const male = /\b(male|man|men|hombre)\b/.test(q);
  const female = /\b(female|woman|women|mujer)\b/.test(q);
  // A child's age must not be treated as the adult applicant's age.
  const ageMatch = q.match(/\b(?:i am|i'm|im|soy|tengo)\s+(\d{1,2})\b/) || q.match(/\b(\d{1,2})\s*(?:years? old|year-old|year old|años|an)\s*(?:parent|adult|man|woman|padre|madre)\b/);
  const age = ageMatch ? Number(ageMatch[1]) : null;
  const area = /\b(north|norte|pompano|deerfield|coconut creek)\b|nò/.test(q) ? "north" : /\b(south|sur|sid|hollywood|hallandale|dania|miramar|pembroke)\b/.test(q) ? "south" : /\b(central|centro|sant|fort lauderdale|lauderhill)\b/.test(q) ? "central" : null;
  const domesticViolence = /domestic violence|domestic abuse|fleeing abuse|abusive partner|violencia doméstica|violans domestik/.test(q);
  return { types, family, veteran, youth, noId, pets, male, female, age, area, domesticViolence, recognized: types.length || family || veteran || youth || noId || pets };
}

function eligible(s, r) {
  const e = s.eligibility;
  if (r.types.includes("shelter") && !r.domesticViolence && ["women-in-distress","domestic-violence-intervention"].includes(s.id)) return false;
  if (r.types.includes("shelter") && !r.youth && r.age === null && e.maxAge !== null) return false;
  return s.publicStatus !== "closed" && (!r.types.length || r.types.some(type => s.type.includes(type))) &&
    (!r.family || e.families) && (!r.veteran || e.veterans) &&
    (!r.youth || e.maxAge !== null) && (!r.noId || e.noId) && (!r.pets || e.pets) &&
    (!r.male || e.men) && (!r.female || e.women) &&
    (r.age === null || ((e.minAge === null || r.age >= e.minAge) && (e.maxAge === null || r.age <= e.maxAge)));
}
export function matchesRequirements(service, query) { return eligible(service, requirements(query)); }
function areaOf(s) {
  if(s.area)return s.area;
  return !s.coords ? null : s.coords.lat < 26.07 ? "south" : s.coords.lat >= 26.20 ? "north" : "central";
}
export function localLookup(query, language = "en", memory = null, directory = services) {
  const L = copy[language] || copy.en;
  const r = requirements(query);
  if (!r.recognized) return { type: "message", text: L.clarify };
  const excluded = new Set([...(memory?.alreadyShown || []), ...(memory?.rejected || [])]);
  const candidates = directory.filter(s => eligible(s,r) && !excluded.has(s.id));
  if (!candidates.length && excluded.size) return { type: "message", text: language === "es" ? "No quedan opciones nuevas para esta búsqueda. Puede revisar las anteriores o cambiar sus necesidades." : language === "ht" ? "Pa gen lòt nouvo opsyon pou rechèch sa a. Ou ka revize ansyen rezilta yo oswa chanje bezwen ou." : "No new options remain for this search. You can review the previous results or change your needs." };
  candidates.sort((a,b) => Number(Boolean(r.area) && areaOf(b) === r.area) - Number(Boolean(r.area) && areaOf(a) === r.area) || Number(b.walkin) - Number(a.walkin));
  const matches = candidates.slice(0,5).map(s => s.id);
  return { type: "results", notice: L.notice, meta: { need: r.types[0], who: r.family ? "family" : "alone", area: r.area }, data: { matches, reasons: Object.fromEntries(matches.map(id => [id,L.reason])) } };
}
export function validateMatches(parsed, query, language, memory, directory = services) {
  if (parsed.type !== "results" || !Array.isArray(parsed.matches) || !parsed.reasons || typeof parsed.reasons !== "object") throw new Error("Invalid search response");
  const r = requirements(query);
  const rejected = new Set(memory?.rejected || []);
  const matches = [...new Set(parsed.matches)].filter(id => {
    const s = directory.find(s => s.id === id);
    return s && !rejected.has(id) && eligible(s,r);
  }).slice(0,5);
  if (parsed.matches.length && !matches.length) {
    const fallback=localLookup(query, language, memory, directory);
    if(fallback.type === "results") fallback.notice=language === "es" ? "Las opciones sugeridas no cumplían sus requisitos. Estas opciones se filtraron usando el directorio." : language === "ht" ? "Opsyon yo te sijere yo pa t satisfè kondisyon ou. Nou filtre rezilta sa yo ak anyè a." : "The suggested options did not meet your requirements. These results were filtered using the directory.";
    return fallback;
  }
  // AI ranks IDs; standardized explanations cannot inherit invented availability or intake claims.
  return { type: "results", meta: { need: r.types[0], who: r.family ? "family" : "alone", area: r.area }, data: { matches, reasons: Object.fromEntries(matches.map(id => [id,(copy[language]||copy.en).reason])) } };
}
export function localAnswer(question, matched, language = "en") {
  const L = copy[language] || copy.en;
  const q = question.toLowerCase();
  const named = matched.filter(s => q.includes(s.name.toLowerCase()) || q.includes(s.id));
  const scope = named.length ? named : matched;
  let relevant;
  if (/\b(id|identification)\b|identificación/.test(q)) relevant = scope.filter(s => s.eligibility.noId);
  else if (/\b(pet|pets|dog|cat|mascota|perro|chen)\b/.test(q)) relevant = scope.filter(s => s.eligibility.pets);
  else if (/\b(family|families|children|kids|hijos|niños|timoun|fanmi)\b/.test(q)) relevant = scope.filter(s => s.eligibility.families);
  else if (/\b(walk|appointment|cita|randevou)\b/.test(q)) relevant = scope.filter(s => s.walkin);
  else if (/\b(hour|hours|open|close|horario|abierto)\b|lè/.test(q)) return `${L.fallback}\n${scope.map(s => `${s.name}: ${s.hours} · ${s.phone}`).join("\n")}`;
  else if (/\b(address|where)\b|dirección|dónde|adrès/.test(q)) return `${L.fallback}\n${scope.map(s => `${s.name}: ${s.address} · ${s.phone}`).join("\n")}`;
  else return `${L.unknown}${scope[0] ? ` ${scope[0].phone}` : ""}`;
  return `${L.fallback}\n${relevant.length ? relevant.map(s => `${s.name} · ${s.phone}`).join("\n") : L.none}`;
}
