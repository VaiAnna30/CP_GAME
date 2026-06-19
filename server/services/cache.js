const NodeCache = require('node-cache');

// Cache with default TTL of 5 minutes and check period of 2 minutes
const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 120,
  useClones: false,
});

const cacheService = {
  get(key) {
    return cache.get(key);
  },

  set(key, value, ttl) {
    return cache.set(key, value, ttl);
  },

  del(key) {
    return cache.del(key);
  },

  flush() {
    return cache.flushAll();
  },

  has(key) {
    return cache.has(key);
  },

  // Get or set pattern
  async getOrSet(key, fetchFn, ttl = 300) {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const data = await fetchFn();
    cache.set(key, data, ttl);
    return data;
  },

  stats() {
    return cache.getStats();
  },
};

module.exports = cacheService;
