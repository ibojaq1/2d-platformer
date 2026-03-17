require('dotenv').config();

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  nerdytips: {
    username: process.env.NERDYTIPS_USERNAME,
    password: process.env.NERDYTIPS_PASSWORD,
    baseUrl: process.env.NERDYTIPS_BASE_URL || 'https://nerdytips.com',
  },
  sportybet: {
    phone: process.env.SPORTYBET_PHONE,
    password: process.env.SPORTYBET_PASSWORD,
    baseUrl: process.env.SPORTYBET_BASE_URL || 'https://www.sportybet.com/ng',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    premiumPriceKobo: parseInt(process.env.PREMIUM_PRICE_KOBO, 10) || 300000,
    planCode: process.env.PAYSTACK_PLAN_CODE || '',
  },
  db: {
    path: process.env.DB_PATH || './data/betcode.db',
  },
  limits: {
    freeMaxMatches: parseInt(process.env.FREE_MAX_MATCHES, 10) || 5,
    freeMaxSlipsPerDay: parseInt(process.env.FREE_MAX_SLIPS_PER_DAY, 10) || 2,
  },
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    baseUrl: process.env.SERVER_BASE_URL || 'http://localhost:3000',
  },
};
