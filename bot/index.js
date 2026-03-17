const config = require('./config');
const { createBot } = require('./telegram');
const { createServer } = require('./server');
const scraper = require('./scraper');
const sportybet = require('./sportybet');

if (!config.telegram.token) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Copy .env.example to .env and fill in your token.');
  process.exit(1);
}

console.log('┌──────────────────────────────────────┐');
console.log('│        BetCode Telegram Bot           │');
console.log('│  AI Tips → SportyBet Booking Codes    │');
console.log('└──────────────────────────────────────┘');
console.log('');

const missing = [];
if (!config.nerdytips.username) missing.push('NERDYTIPS_USERNAME');
if (!config.nerdytips.password) missing.push('NERDYTIPS_PASSWORD');
if (!config.sportybet.phone) missing.push('SPORTYBET_PHONE');
if (!config.sportybet.password) missing.push('SPORTYBET_PASSWORD');
if (!config.paystack.secretKey) missing.push('PAYSTACK_SECRET_KEY');

if (missing.length > 0) {
  console.warn(`[warn] Missing env vars: ${missing.join(', ')}`);
  console.warn('[warn] Some features will be unavailable until configured.');
  console.warn('');
}

const bot = createBot();

const { app, server } = createServer(bot);

process.on('SIGINT', async () => {
  console.log('\n[bot] Shutting down...');
  bot.stopPolling();
  server.close();
  await scraper.closeBrowser();
  await sportybet.closeBrowser();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('[bot] Unhandled rejection:', err);
});
