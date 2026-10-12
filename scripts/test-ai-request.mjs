import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWithFallback } from '../server/ai-request.js';

test('provider overload uses the alternate AI model with the original prompt', async () => {
  const primary = { generateContent: async () => { throw Object.assign(new Error('busy'), { status: 503 }); } };
  const fallback = { generateContent: async prompt => ({ answer: prompt }) };
  assert.deepEqual(await generateWithFallback(primary, fallback, 'original'), { answer: 'original' });
});
test('a working primary model does not call the alternate', async () => {
  const primary = { generateContent: async () => 'primary' };
  const fallback = { generateContent: async () => { throw new Error('must not run'); } };
  assert.equal(await generateWithFallback(primary, fallback, 'prompt'), 'primary');
});
test('credential failures are not retried and both-model failures reach the directory fallback', async () => {
  const invalid = { generateContent: async () => { throw Object.assign(new Error('invalid'), { status: 403 }); } };
  const busy = { generateContent: async () => { throw Object.assign(new Error('busy'), { status: 503 }); } };
  const unexpected = { generateContent: async () => { throw new Error('must not run'); } };
  await assert.rejects(generateWithFallback(invalid, unexpected, 'prompt'), /invalid/);
  await assert.rejects(generateWithFallback(busy, busy, 'prompt'), /busy/);
});
