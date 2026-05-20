const memory = {
  attempts: [],
  knownBarriers: [],
  servicesRejected: [],
  servicesContacted: [],
  sessionStart: Date.now()
};

export function recordAttempt({ query, resultsShown }) {
  memory.attempts.push({
    timestamp: Date.now(),
    query,
    resultsShown: resultsShown.map(s => s.id),
    feedback: null
  });
}

export function recordBarrier(barrier) {
  if (!memory.knownBarriers.includes(barrier)) {
    memory.knownBarriers.push(barrier);
  }
}

export function recordRejection(serviceId) {
  if (!memory.servicesRejected.includes(serviceId)) {
    memory.servicesRejected.push(serviceId);
  }
}

export function recordContact(serviceId) {
  if (!memory.servicesContacted.includes(serviceId)) {
    memory.servicesContacted.push(serviceId);
  }
}

export function getMemorySummary() {
  if (memory.attempts.length === 0) return null;
  return {
    attemptCount: memory.attempts.length,
    alreadyShown: [...new Set(memory.attempts.flatMap(a => a.resultsShown))],
    rejected: memory.servicesRejected,
    contacted: memory.servicesContacted,
    barriers: memory.knownBarriers,
    minutesActive: Math.round((Date.now() - memory.sessionStart) / 60000)
  };
}

export function resetMemory() {
  memory.attempts.length = 0;
  memory.knownBarriers.length = 0;
  memory.servicesRejected.length = 0;
  memory.servicesContacted.length = 0;
  memory.sessionStart = Date.now();
}
