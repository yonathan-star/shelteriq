import { useState } from "react";
import { getMemorySummary } from "../lib/triageMemory";

export function MemoryBanner({ onSuggestNext }) {
  const [dismissed, setDismissed] = useState(false);
  const summary = getMemorySummary();
  const show = !dismissed && summary && summary.attemptCount >= 2 && summary.contacted.length === 0;

  if (!show) return null;

  return (
    <div className="memory-banner">
      <span>Still looking? We can try different options.</span>
      <button onClick={() => { setDismissed(true); onSuggestNext(); }}>
        Find more →
      </button>
    </div>
  );
}
