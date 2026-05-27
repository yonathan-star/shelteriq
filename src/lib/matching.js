import { services } from "../data/services.js";
import { getDistanceMiles } from "./geo.js";

export function getServiceById(id) {
  return services.find(s => s.id === id) || null;
}

export function enrichResults(matchIds, reasons, userCoords) {
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
        distance: distance ? parseFloat(distance.toFixed(1)) : null
      };
    })
    .filter(Boolean);
}

// Area lat boundaries for Broward County
const AREA_LAT = { south: [0, 26.07], central: [26.07, 26.20], north: [26.20, 99] };

function inArea(service, area) {
  if (!area || area === "unsure" || !service.coords) return true;
  const [min, max] = AREA_LAT[area] || [0, 99];
  return service.coords.lat >= min && service.coords.lat < max;
}

function buildReason(service, need, who) {
  const parts = [];
  if (service.walkin) parts.push("walk-ins accepted");
  if (service.hours === "24/7") parts.push("open 24/7");
  if (who === "family" && service.eligibility.families) parts.push("accepts families with children");
  if (service.eligibility.pets) parts.push("pets allowed");
  if (service.eligibility.noId) parts.push("no ID required");
  if (service.beds) parts.push(`${service.beds} beds`);
  return parts.length ? parts.join(" · ") + "." : "Matches your criteria.";
}

/**
 * Keyword-based outreach search — used as a fallback when Gemini is unavailable.
 * Scores every service against the query and returns the top 5.
 */
export function keywordSearch(query, userCoords) {
  const q = query.toLowerCase();

  // Map query words → service fields to boost
  const TYPE_HINTS = {
    shelter: ["shelter"], bed: ["shelter"], sleep: ["shelter"], overnight: ["shelter"],
    food: ["food"], meal: ["food"], hungry: ["food"], eat: ["food"],
    mental: ["mental_health"], "mental health": ["mental_health"], crisis: ["mental_health"],
    substance: ["substance_abuse"], drug: ["substance_abuse"], alcohol: ["substance_abuse"],
    addiction: ["substance_abuse"], detox: ["substance_abuse"],
    veteran: ["veteran"], vet: ["veteran"],
    youth: ["youth"], teen: ["youth"], minor: ["youth"],
    legal: ["legal"], lawyer: ["legal"], court: ["legal"],
    medical: ["medical"], clinic: ["medical"], doctor: ["medical"],
    outreach: ["outreach"],
  };

  const scored = services.map(service => {
    let score = 0;
    const reasons = [];

    // Type matching
    for (const [kw, types] of Object.entries(TYPE_HINTS)) {
      if (q.includes(kw) && types.some(t => service.type.includes(t))) {
        score += 4;
        reasons.push(`matches ${kw}`);
      }
    }

    // Eligibility flags
    if ((q.includes("no id") || q.includes("noid") || q.includes("no identification")) && service.eligibility.noId) {
      score += 3; reasons.push("no ID required");
    }
    if ((q.includes("male") || q.includes("man") || q.includes("men")) && service.eligibility.men) {
      score += 1;
    }
    if ((q.includes("female") || q.includes("woman") || q.includes("women")) && service.eligibility.women) {
      score += 1;
    }
    if ((q.includes("family") || q.includes("children") || q.includes("kids") || q.includes("child")) && service.eligibility.families) {
      score += 3; reasons.push("families accepted");
    }
    if ((q.includes("pet") || q.includes("dog") || q.includes("cat")) && service.eligibility.pets) {
      score += 3; reasons.push("pets allowed");
    }
    if ((q.includes("veteran") || q.includes("vet ") || q.includes("military")) && service.eligibility.veterans) {
      score += 3; reasons.push("veteran eligible");
    }
    if ((q.includes("walk") || q.includes("walk-in") || q.includes("walkin")) && service.walkin) {
      score += 2; reasons.push("walk-in accepted");
    }
    if ((q.includes("24") || q.includes("overnight") || q.includes("night")) && service.hours?.includes("24")) {
      score += 2; reasons.push("open 24/7");
    }

    // Area hints
    if (q.includes("north") && service.coords?.lat > 26.20) score += 2;
    if (q.includes("south") && service.coords?.lat < 26.07) score += 2;
    if (q.includes("central") && service.coords?.lat >= 26.07 && service.coords?.lat <= 26.20) score += 2;
    if (q.includes("fort lauderdale") && service.address?.toLowerCase().includes("fort lauderdale")) score += 2;
    if (q.includes("pompano") && service.address?.toLowerCase().includes("pompano")) score += 2;
    if (q.includes("hollywood") && service.address?.toLowerCase().includes("hollywood")) score += 2;

    return { service, score, reasons };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ service, reasons }) => ({
      ...service,
      reason: reasons.length ? reasons.join(" · ") + "." : "Matches your search.",
      distance: userCoords && service.coords
        ? parseFloat(getDistanceMiles(userCoords, service.coords).toFixed(1))
        : null,
    }));
}

export function filterServices(need, who, area, userCoords) {
  // Only exclude services that are purely outreach/mobile with no fixed location
  const base = services.filter(s => s.coords !== null || s.type.some(t => t !== "outreach"));

  let filtered = base.filter(s => {
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
    reason: buildReason(s, need, who),
    distance: userCoords && s.coords ? parseFloat(getDistanceMiles(userCoords, s.coords).toFixed(1)) : null,
  }));
}
