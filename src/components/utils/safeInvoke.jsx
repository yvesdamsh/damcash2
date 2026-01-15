import { base44 } from '@/api/base44Client';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function safeInvoke(functionName, payload = {}, options = {}) {
  const { retries = 0, fallbackData = null, logErrors = true, retryDelayMs = 300 } = options || {};
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await base44.functions.invoke(functionName, payload);
      return res; // { data, status, headers }
    } catch (e) {
      if (logErrors) console.warn(`[safeInvoke] ${functionName} failed (attempt ${attempt+1}/${retries+1})`, e?.message || e);
      if (attempt === retries) {
        return { data: fallbackData, status: 200, headers: {} };
      }
      await sleep(retryDelayMs);
      attempt++;
    }
  }
  return { data: fallbackData, status: 200, headers: {} };
}