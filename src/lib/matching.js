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

export function filterServices(need, who, area, userCoords) {
  const base = services.filter(s => !s.type.includes("outreach"));

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
