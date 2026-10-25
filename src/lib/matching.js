import { uiCopy } from './uiCopy.js';
import { services } from "../data/services.js";
import { getDistanceMiles } from "./geo.js";
import { matchesRequirements } from "./localLookup.js";

export function getServiceById(id) {
  return services.find(s => s.id === id) || null;
}

export function enrichResults(matchIds, reasons, userCoords, language='en') {
  return matchIds
    .map(id => {
      const service = getServiceById(id);
      if (!service) return null;
      const distance =
        userCoords && service.coords
          ? getDistanceMiles(userCoords, service.coords)
          : null;
      return {
        ...service,
        reason: reasons[id] || "",
        reasonLanguage:language,
        distance: distance ? parseFloat(distance.toFixed(1)) : null
      };
    })
    .filter(Boolean);
}

// Area lat boundaries for Broward County
const AREA_LAT = { south: [0, 26.07], central: [26.07, 26.20], north: [26.20, 99] };

function inArea(service, area) {
  if(service.area&&area&&area!=='unsure')return service.area===area;
  if (!area || area === "unsure" || !service.coords) return true;
  const [min, max] = AREA_LAT[area] || [0, 99];
  return service.coords.lat >= min && service.coords.lat < max;
}

function buildReason(language) { return uiCopy(language).match; }

export function filterServices(need, who, area, userCoords, directory=services, language="en") {
  // Only exclude services that are purely outreach/mobile with no fixed location
  const base = directory.filter(s => s.publicStatus !== "closed").filter(s => s.coords !== null || s.type.some(t => t !== "outreach"));

  let filtered = base.filter(s => {
    if (need === "shelter" && !matchesRequirements(s, "shelter")) return false;
    if (need && need !== "other") {
      if (need === "veteran" && !s.eligibility.veterans) return false;
      if (need === "youth" && s.eligibility.maxAge === null) return false;
      if (!["veteran", "youth"].includes(need) && !s.type.includes(need)) return false;
    }
    if (who === "family" && !s.eligibility.families) return false;
    return true;
  });

  // Area filter — fall back to county-wide if no area matches
  const areaFiltered = filtered.filter(s => inArea(s, area));
  if (areaFiltered.length > 0) filtered = areaFiltered;

  // Sort: walk-ins first, then by distance
  filtered.sort((a, b) => {
    if (a.walkin !== b.walkin) return a.walkin ? -1 : 1;
    if (userCoords && a.coords && b.coords) {
      return getDistanceMiles(userCoords, a.coords) - getDistanceMiles(userCoords, b.coords);
    }
    return 0;
  });

  return filtered.slice(0, 5).map(s => ({
    ...s,
    reason: buildReason(language),
    reasonLanguage:language,
    distance: userCoords && s.coords ? parseFloat(getDistanceMiles(userCoords, s.coords).toFixed(1)) : null,
  }));
}
