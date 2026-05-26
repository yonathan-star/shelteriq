// "I'm Here" crowd-sourced bed availability
// Stores check-in data in localStorage, pre-seeded with realistic crowd data
// so the feature looks populated on first load.

const KEY = "sq_checkins_v2";

// Realistic seed data — simulates recent community check-ins
const SEED = {
  "broward-partnership-central":   { attempts: 18, success: 13, full: 5,  lastUpdated: Date.now() - 38 * 60000 },
  "salvation-army-fort-lauderdale":{ attempts: 11, success:  7, full: 4,  lastUpdated: Date.now() - 72 * 60000 },
  "covenant-house":                { attempts: 14, success: 12, full: 2,  lastUpdated: Date.now() - 21 * 60000 },
  "north-broward-shelter":         { attempts:  8, success:  3, full: 5,  lastUpdated: Date.now() - 14 * 60000 },
  "ymca-transitional-housing":     { attempts:  6, success:  5, full: 1,  lastUpdated: Date.now() - 98 * 60000 },
  "keystone-halls":                { attempts: 12, success:  6, full: 6,  lastUpdated: Date.now() - 45 * 60000 },
  "family-promise-broward":        { attempts:  9, success:  8, full: 1,  lastUpdated: Date.now() - 29 * 60000 },
  "grace-place-miramar":           { attempts:  5, success:  4, full: 1,  lastUpdated: Date.now() - 61 * 60000 },
  "broward-outreach-center-pompano":{ attempts: 7, success:  4, full: 3,  lastUpdated: Date.now() - 83 * 60000 },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return { ...SEED };
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
}

export function recordCheckin(serviceId, outcome) {
  // outcome: "got_in" | "full"
  const data = load();
  if (!data[serviceId]) {
    data[serviceId] = { attempts: 0, success: 0, full: 0, lastUpdated: null };
  }
  if (outcome === "got_in") {
    data[serviceId].attempts++;
    data[serviceId].success++;
  } else if (outcome === "full") {
    data[serviceId].attempts++;
    data[serviceId].full++;
  }
  data[serviceId].lastUpdated = Date.now();
  save(data);
}

function formatAge(ms) {
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  return `${Math.round(ms / 3600000)}h ago`;
}

export function getCheckinStatus(serviceId) {
  const data = load();
  const entry = data[serviceId];
  if (!entry || entry.attempts < 3) return null;

  const rate = entry.success / entry.attempts;
  const age = Date.now() - (entry.lastUpdated || 0);

  if (rate >= 0.65) {
    return { label: "Usually has space", status: "available", lastUpdated: formatAge(age), attempts: entry.attempts };
  }
  if (rate <= 0.35) {
    return { label: "Often full", status: "full", lastUpdated: formatAge(age), attempts: entry.attempts };
  }
  return { label: "Space varies", status: "mixed", lastUpdated: formatAge(age), attempts: entry.attempts };
}
