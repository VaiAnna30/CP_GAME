require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  CF_API_BASE: process.env.CF_API_BASE || 'https://codeforces.com/api',
  CF_POLL_INTERVAL: parseInt(process.env.CF_POLL_INTERVAL) || 3000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};

// Validate required env vars
const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = env;
