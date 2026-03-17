const config = require('./config');
const { createBot } = require('./telegram');

if (!config.telegram.token) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Copy .env.example to .env and fill in your token.');
  process.exit(1);
}

console.log('┌──────────────────────────────────────┐');
console.log('│        BetCode Telegram Bot           │');
console.log('│  AI Tips → SportyBet Booking Codes    │');
console.log('└──────────────────────────────────────┘');

const bot = createBot();

process.on('SIGINT', () => {
  console.log('\n[bot] Shutting down...');
  bot.stopPolling();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('[bot] Unhandled rejection:', err);
});
