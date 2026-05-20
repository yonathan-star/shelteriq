const searchLog = [];

export function logSearch({ query, resultsCount, serviceTypes }) {
  searchLog.push({
    timestamp: Date.now(),
    query,
    resultsCount,
    serviceTypes: serviceTypes || [],
    hadGoodMatch: resultsCount >= 2
  });
}

export function getIntelligenceSummary() {
  if (searchLog.length < 2) return null;

  const typeFrequency = {};
  const lowResultSearches = [];

  searchLog.forEach(entry => {
    entry.serviceTypes.forEach(t => {
      typeFrequency[t] = (typeFrequency[t] || 0) + 1;
    });
    if (!entry.hadGoodMatch) {
      lowResultSearches.push(entry.query);
    }
  });

  return {
    totalSearches: searchLog.length,
    typeFrequency,
    lowResultSearches,
    recentQueries: searchLog.slice(-5).map(e => e.query),
    sessionMinutes: Math.round((Date.now() - searchLog[0].timestamp) / 60000)
  };
}

export function clearSearchLog() {
  searchLog.length = 0;
}
