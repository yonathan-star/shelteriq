// Keep both attempts within the browser's request deadline.
async function attempt(model, prompt, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await model.generateContent(prompt, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function generateWithFallback(primary, fallback, prompt, timeoutMs = 6500) {
  try { return await attempt(primary, prompt, timeoutMs); }
  catch (error) {
    const transient = [429, 500, 502, 503, 504].includes(error.status) || error.name === 'AbortError';
    if (!fallback || !transient) throw error;
    return attempt(fallback, prompt, timeoutMs);
  }
}
