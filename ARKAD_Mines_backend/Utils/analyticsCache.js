const cache = new Map();
const CACHE_TTL = parseInt(process.env.ANALYTICS_CACHE_TTL || '600', 10) * 1000;

export const getCachedAnalytics = (key) => {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
};

export const setCachedAnalytics = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

export const generateCacheKey = (req) => {
  const userId = req.user?.id || 'anonymous';
  const queryHash = JSON.stringify(req.query);
  return `analytics:${userId}:${Buffer.from(queryHash).toString('base64').slice(0, 20)}`;
};
