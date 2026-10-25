const profiles = { WALKING: 'foot', BICYCLING: 'bike', DRIVING: 'car' };
const cache = new Map();
let nextRequestAt = 0;

function validPoint(p) {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

export async function requestRoute(origin, destination, mode, signal) {
  signal?.throwIfAborted();
  if (!validPoint(origin) || !validPoint(destination) || !profiles[mode]) throw new Error('Invalid route request');
  const coordinates = `${origin.lng.toFixed(6)},${origin.lat.toFixed(6)};${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`;
  const key = `${mode}:${coordinates}`;
  if (cache.has(key)) return cache.get(key);
  // FOSSGIS permits at most one request per second. Reserve a slot before waiting.
  const delay = Math.max(0, nextRequestAt - Date.now());
  nextRequestAt = Date.now() + delay + 1100;
  if (delay) await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
    signal?.addEventListener('abort', abort, { once: true });
  });
  signal?.throwIfAborted();
  const response = await fetch(`https://routing.openstreetmap.de/routed-${profiles[mode]}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Routing service unavailable');
  const data = await response.json();
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 || !route.geometry.coordinates.every(c => Array.isArray(c) && validPoint({lng:c[0],lat:c[1]})) || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) || !Array.isArray(route.legs) || !route.legs.every(leg => Array.isArray(leg.steps))) throw new Error('No usable route returned');
  const steps = route.legs.flatMap(leg => leg.steps).filter(s => Number.isFinite(s.distance) && Array.isArray(s.maneuver?.location) && validPoint({lng:s.maneuver.location[0],lat:s.maneuver.location[1]}));
  if (!steps.length) throw new Error('No usable directions returned');
  const result = { coordinates: route.geometry.coordinates, distance: route.distance, duration: route.duration, steps };
  if (cache.size >= 20) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

export function routeInstruction(step, language = 'en') {
  const dictionaries = {
    en: { depart: 'Start', arrive: 'Arrive at your destination', turn: 'Turn', continue: 'Continue', merge: 'Merge', fork: 'Keep', roundabout: 'Enter the roundabout', exit: 'take exit', onto: 'onto', left: 'left', right: 'right', straight: 'straight', 'slight left': 'slightly left', 'slight right': 'slightly right', 'sharp left': 'sharply left', 'sharp right': 'sharply right', uturn: 'and make a U-turn' },
    es: { depart: 'Comience', arrive: 'Llegue a su destino', turn: 'Gire', continue: 'Continúe', merge: 'Incorpórese', fork: 'Manténgase', roundabout: 'Entre en la rotonda', exit: 'tome la salida', onto: 'hacia', left: 'a la izquierda', right: 'a la derecha', straight: 'recto', 'slight left': 'levemente a la izquierda', 'slight right': 'levemente a la derecha', 'sharp left': 'fuertemente a la izquierda', 'sharp right': 'fuertemente a la derecha', uturn: 'y dé la vuelta' },
    ht: { depart: 'Kòmanse', arrive: 'Rive nan destinasyon ou', turn: 'Vire', continue: 'Kontinye', merge: 'Antre nan trafik la', fork: 'Kenbe', roundabout: 'Antre nan wonpwen an', exit: 'pran sòti', onto: 'sou', left: 'agoch', right: 'adwat', straight: 'dwat', 'slight left': 'yon ti jan agoch', 'slight right': 'yon ti jan adwat', 'sharp left': 'nèt agoch', 'sharp right': 'nèt adwat', uturn: 'epi fè demi tou' },
  };
  const L = dictionaries[language] || dictionaries.en;
  const m = step?.maneuver || {};
  if (m.type === 'arrive') return L.arrive;
  const action = m.type?.includes('roundabout') || m.type === 'rotary' ? `${L.roundabout}${m.exit ? `, ${L.exit} ${m.exit}` : ''}` : `${L[m.type] || L.continue}${L[m.modifier] ? ` ${L[m.modifier]}` : ''}`;
  return `${action}${step?.name ? ` ${L.onto} ${step.name}` : ''}`;
}
