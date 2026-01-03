import { logger } from './logger';

export const safeJSONParse = (data, defaultValue = null) => {
  if (data == null) return defaultValue;
  if (typeof data !== 'string') return data;
  try {
    const parsed = JSON.parse(data);
    // If it returns a string again (double-encoded), try once more recursively
    return typeof parsed === 'string' ? safeJSONParse(parsed, defaultValue) : parsed;
  } catch (e) {
    logger.error('JSON Parse error:', e, 'Data:', data?.slice ? data.slice(0, 200) : data);
    return defaultValue;
  }
};

export const handleAsyncError = (error, context = '') => {
  logger.error(`Error in ${context}:`, error);
};