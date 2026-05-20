export function getDistanceMiles(coords1, coords2) {
  if (!coords1 || !coords2) return Infinity;
  const R = 3959;
  const dLat = ((coords2.lat - coords1.lat) * Math.PI) / 180;
  const dLon = ((coords2.lng - coords1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((coords1.lat * Math.PI) / 180) *
      Math.cos((coords2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortByDistance(services, userCoords) {
  return [...services].sort((a, b) => {
    const distA = getDistanceMiles(userCoords, a.coords);
    const distB = getDistanceMiles(userCoords, b.coords);
    return distA - distB;
  });
}
