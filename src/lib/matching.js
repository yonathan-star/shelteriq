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
