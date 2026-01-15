export async function withRateLimitRetry(promiseFactory, opts = {}) {
  const {
    retries = 3,
    baseDelay = 700,
    maxDelay = 6000,
    onRetry,
  } = opts;

  let attempt = 0;
  // Helper sleep with jitter
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // Simple detector for 429 / rate limit errors from SDK / Axios style or message text
  const isRateLimit = (err) => {
    const status = err?.status || err?.response?.status;
    const msg = (err?.message || '').toLowerCase();
    return status === 429 || msg.includes('rate limit') || msg.includes('too many');
  };

  while (true) {
    try {
      const res = await promiseFactory();
      return res;
    } catch (e) {
      if (attempt >= retries || !isRateLimit(e)) {
        throw e;
      }
      attempt += 1;
      const backoff = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.floor(backoff * (0.2 + Math.random() * 0.3)); // 20%-50% jitter
      if (typeof onRetry === 'function') {
        try { onRetry({ attempt, delay: jitter, error: e }); } catch (_) {}
      }
      await sleep(jitter);
    }
  }
}