const axios = require('axios');
const Bottleneck = require('bottleneck');
const cache = require('./cache');
const env = require('../config/env');

// Rate limiter: max 1 request per 2 seconds to be safe with CF
const limiter = new Bottleneck({
  minTime: 2000, // minimum 2 seconds between requests
  maxConcurrent: 1, // only 1 concurrent request
});

const cfClient = axios.create({
  baseURL: env.CF_API_BASE,
  timeout: 15000,
});

// Retry logic with exponential backoff
const withRetry = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const isRateLimit =
        error.response?.data?.comment?.includes('limit') ||
        error.response?.status === 429;

      const delay = isRateLimit ? 5000 * (i + 1) : 2000 * (i + 1);
      console.warn(`CF API retry ${i + 1}/${maxRetries} after ${delay}ms:`, error.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const cfApi = {
  async getUserSubmissions(handle, from = 1, count = 30) {
    return withRetry(() =>
      limiter.schedule(async () => {
        const res = await cfClient.get('/user.status', {
          params: { handle, from, count },
        });
        if (res.data.status !== 'OK') {
          throw new Error(`CF API error: ${res.data.comment || 'Unknown error'}`);
        }
        return res.data.result;
      })
    );
  },


  async getUserInfo(handles) {
    const handleStr = Array.isArray(handles) ? handles.join(';') : handles;
    const cacheKey = `cf_user_${handleStr}`;

    return cache.getOrSet(
      cacheKey,
      () =>
        withRetry(() =>
          limiter.schedule(async () => {
            const res = await cfClient.get('/user.info', {
              params: { handles: handleStr },
            });
            if (res.data.status !== 'OK') {
              throw new Error(`CF API error: ${res.data.comment || 'Unknown error'}`);
            }
            return res.data.result;
          })
        ),
      300 // 5 min cache
    );
  },

  async getProblems(tags = '') {
    const cacheKey = `cf_problems_${tags || 'all'}`;

    return cache.getOrSet(
      cacheKey,
      () =>
        withRetry(() =>
          limiter.schedule(async () => {
            const params = {};
            if (tags) params.tags = tags;

            const res = await cfClient.get('/problemset.problems', { params });
            if (res.data.status !== 'OK') {
              throw new Error(`CF API error: ${res.data.comment || 'Unknown error'}`);
            }
            return res.data.result;
          })
        ),
      3600 // 1 hour cache for problems
    );
  },


  async checkVerificationSubmission(handle, contestId, problemIndex, minTimestampSeconds) {
    const submissions = await this.getUserSubmissions(handle, 1, 50);
    return submissions.find(
      (s) =>
        s.problem.contestId === contestId &&
        s.problem.index === problemIndex &&
        s.verdict === 'COMPILATION_ERROR' &&
        s.creationTimeSeconds >= minTimestampSeconds
    );
  },
};

module.exports = cfApi;
