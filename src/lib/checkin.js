import { localStore as localStorage } from './storage.js';
// Visit outcomes saved only on this device. v3 excludes legacy demo reports.
const KEY = "sq_checkins_v3";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return {};
    }
    const value=JSON.parse(raw);return value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([,v])=>v&&Number.isFinite(v.lastUpdated)&&["got_in","full"].includes(v.outcome))):{};
  } catch {
    return {};
  }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
}

export function recordCheckin(serviceId, outcome) {
  // outcome: "got_in" | "full"
  if (!["got_in", "full"].includes(outcome)) return;
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
  data[serviceId].outcome = outcome;
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
  if (!entry || Date.now() - entry.lastUpdated > 86400000) return null;

  const age = Date.now() - entry.lastUpdated;
  return { status: entry.outcome === "got_in" ? "available" : "full", lastUpdated: formatAge(age), attempts: entry.attempts };
}
