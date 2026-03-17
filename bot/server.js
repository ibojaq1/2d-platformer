const express = require('express');
const config = require('./config');
const payment = require('./payment');
const db = require('./db');

function createServer(bot) {
  const app = express();

  app.use('/payment/webhook', express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/payment/callback', async (req, res) => {
    const reference = req.query.reference || req.query.trxref;

    if (!reference) {
      return res.status(400).send('Missing payment reference');
    }

    try {
      const result = await payment.verifyPayment(reference);

      if (result.verified && result.chatId && bot) {
        await bot.sendMessage(result.chatId, [
          '✅ *Payment received! Premium activated!*',
          '',
          '💎 You now have unlimited access for 30 days.',
          'Try it out: `/generate 20`',
        ].join('\n'), { parse_mode: 'Markdown' }).catch(() => {});
      }

      res.send(`
        <html>
        <head><title>BetCode Payment</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:3rem;">
          <h1>${result.verified ? '✅ Payment Successful!' : '⏳ Payment Processing...'}</h1>
          <p>${result.verified
            ? 'Your Premium subscription is now active. Go back to Telegram!'
            : 'Your payment is being processed. Use /verify in the bot to check status.'}</p>
          <a href="https://t.me/BettingAutomatorBot" style="display:inline-block;margin-top:1rem;padding:.8rem 2rem;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;">
            Back to Telegram
          </a>
        </body>
        </html>
      `);
    } catch (err) {
      console.error('[server] Callback error:', err);
      res.status(500).send('Payment verification failed. Please use /verify in the bot.');
    }
  });

  app.post('/payment/webhook', async (req, res) => {
    const signature = req.headers['x-paystack-signature'];

    try {
      const result = await payment.handleWebhook(req.body, signature);

      if (result.activated && result.chatId && bot) {
        await bot.sendMessage(result.chatId, [
          '✅ *Payment confirmed! Premium activated!*',
          '',
          '💎 Enjoy unlimited BetCode for 30 days.',
          'Try: `/generate 20`',
        ].join('\n'), { parse_mode: 'Markdown' }).catch(() => {});
      }

      res.sendStatus(200);
    } catch (err) {
      console.error('[server] Webhook error:', err);
      res.sendStatus(400);
    }
  });

  const server = app.listen(config.server.port, () => {
    console.log(`[server] Payment server listening on port ${config.server.port}`);
  });

  return { app, server };
}

module.exports = { createServer };
