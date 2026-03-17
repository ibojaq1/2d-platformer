require('dotenv').config();

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  sportybet: {
    apiBase: process.env.SPORTYBET_API_BASE || 'https://www.sportybet.com/api',
    country: process.env.SPORTYBET_COUNTRY || 'ng',
  },
  nerdytips: {
    baseUrl: process.env.NERDYTIPS_BASE_URL || 'https://www.nerdytips.com',
  },
  db: {
    path: process.env.DB_PATH || './data/betcode.db',
  },
  limits: {
    freeMaxMatches: parseInt(process.env.FREE_MAX_MATCHES, 10) || 5,
    freeMaxSlipsPerDay: parseInt(process.env.FREE_MAX_SLIPS_PER_DAY, 10) || 2,
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    webhookUrl: process.env.WEBHOOK_URL || '',
  },
};
