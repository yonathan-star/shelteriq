import { useState } from "react";
import { getMemorySummary } from "../lib/triageMemory";

export function MemoryBanner({ onSuggestNext }) {
  const [show, setShow] = useState(() => {
    const summary = getMemorySummary();
    return !!(summary && summary.attemptCount >= 2 && summary.contacted.length === 0);
  });

  if (!show) return null;

  return (
    <div className="memory-banner">
      <span>Still looking? We can try different options.</span>
      <button onClick={() => { setShow(false); onSuggestNext(); }}>
        Find more →
      </button>
    </div>
  );
}
