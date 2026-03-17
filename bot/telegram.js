const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const db = require('./db');
const scraper = require('./scraper');
const sportybet = require('./sportybet');
const payment = require('./payment');

function createBot() {
  const bot = new TelegramBot(config.telegram.token, { polling: true });

  bot.onText(/\/start(.*)/, (msg, match) => handleStart(bot, msg, match));
  bot.onText(/\/generate\s*(\d*)/, (msg, match) => handleGenerate(bot, msg, match));
  bot.onText(/\/status/, (msg) => handleStatus(bot, msg));
  bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
  bot.onText(/\/subscribe/, (msg) => handleSubscribe(bot, msg));
  bot.onText(/\/pay\s+(.+)/, (msg, match) => handlePay(bot, msg, match));
  bot.onText(/\/verify\s+(.+)/, (msg, match) => handleVerify(bot, msg, match));

  bot.on('polling_error', err => console.error('[bot] Polling error:', err.message));

  console.log('[bot] BetCode bot is running...');
  return bot;
}

async function handleStart(bot, msg, match) {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  db.ensureUser(chatId, username);

  const param = (match[1] || '').trim();
  if (param === 'subscribe') {
    return handleSubscribe(bot, msg);
  }

  await bot.sendMessage(chatId, [
    `*Welcome to BetCode, ${esc(username)}\\!*`,
    '',
    'I turn NerdyTips Trust BestTip predictions into SportyBet booking codes — in under 90 seconds\\.',
    '',
    '*Commands:*',
    '`/generate 15` — Generate a betslip with 15 matches',
    '`/status` — Check your plan \\& usage',
    '`/subscribe` — Upgrade to Premium',
    '`/help` — Show this message',
    '',
    '_Free tier: 5 matches per slip, 2 slips/day\\._',
    '_Premium: unlimited matches, filters, tomorrow games\\._',
  ].join('\n'), { parse_mode: 'MarkdownV2' });
}

async function handleGenerate(bot, msg, match) {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  db.ensureUser(chatId, username);

  const premium = db.isPremium(chatId);
  let requested = parseInt(match[1], 10) || 10;

  if (!premium) {
    if (requested > config.limits.freeMaxMatches) {
      await bot.sendMessage(chatId,
        `⚠️ Free tier is limited to *${config.limits.freeMaxMatches} matches* per slip. Use /subscribe to go unlimited.\n\nGenerating ${config.limits.freeMaxMatches} matches instead...`,
        { parse_mode: 'Markdown' }
      );
      requested = config.limits.freeMaxMatches;
    }

    const used = db.slipsToday(chatId);
    if (used >= config.limits.freeMaxSlipsPerDay) {
      return bot.sendMessage(chatId,
        `🚫 You've used all *${config.limits.freeMaxSlipsPerDay} free slips* for today. Come back tomorrow or /subscribe for unlimited.`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  const statusMsg = await bot.sendMessage(chatId,
    `⏳ Generating your betslip with *${requested}* matches...\n\n_Scraping NerdyTips Trust BestTip..._`,
    { parse_mode: 'Markdown' }
  );

  try {
    const predictions = await scraper.fetchPredictions('today');

    if (predictions.length === 0) {
      return bot.editMessageText(
        '❌ No predictions available right now. NerdyTips may not have posted today\'s tips yet. Try again later.',
        { chat_id: chatId, message_id: statusMsg.message_id }
      );
    }

    const picked = scraper.pickMatches(predictions, requested);

    await bot.editMessageText(
      `⏳ Found *${predictions.length}* predictions. Placing *${picked.length}* on SportyBet...\n\n_Matching events & selecting correct markets..._`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );

    const { results, bookingCode } = await sportybet.generateBookingCode(picked);
    const matched = results.filter(r => r.matched);
    const unmatched = results.filter(r => !r.matched);

    if (matched.length === 0) {
      return bot.editMessageText(
        '❌ Could not match any predictions to SportyBet events. The matches may not be listed yet.',
        { chat_id: chatId, message_id: statusMsg.message_id }
      );
    }

    if (!bookingCode) {
      return bot.editMessageText(
        '❌ Selections were added but failed to generate a booking code. Please try again.',
        { chat_id: chatId, message_id: statusMsg.message_id }
      );
    }

    db.recordSlip(chatId, matched.length, bookingCode);

    const avgTrust = matched.length > 0
      ? (matched.reduce((sum, m) => sum + m.trust, 0) / matched.length).toFixed(1)
      : '—';

    const matchLines = matched.map((m, i) =>
      `${i + 1}. ${m.home} vs ${m.away} — *${m.bestTip}* → ${m.marketTab} ${m.marketPick}${m.specifier ? ' ' + m.specifier : ''} (Trust ${m.trust}/10)`
    ).join('\n');

    const unmatchedNote = unmatched.length > 0
      ? `\n\n⚠️ _${unmatched.length} match(es) skipped: not found on SportyBet._`
      : '';

    await bot.editMessageText([
      `✅ *Your betslip is ready!*`,
      '',
      matchLines,
      '',
      `🎫 *SPORTYBET CODE:* \`${bookingCode}\``,
      `📊 ${matched.length} matches on slip • Avg Trust ${avgTrust}/10`,
      unmatchedNote,
      '',
      '_Load this code on SportyBet to place your bet._',
    ].join('\n'), {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'Markdown',
    });

  } catch (err) {
    console.error('[bot] Generate error:', err);
    await bot.editMessageText(
      `❌ Error: ${err.message || 'Something went wrong. Please try again in a minute.'}`,
      { chat_id: chatId, message_id: statusMsg.message_id }
    ).catch(() => {});
  }
}

async function handleStatus(bot, msg) {
  const chatId = msg.chat.id;
  db.ensureUser(chatId, msg.from.username);

  const user = db.getUser(chatId);
  const premium = db.isPremium(chatId);
  const usedToday = db.slipsToday(chatId);

  const planLabel = premium ? '💎 Premium' : '🆓 Free';
  const expiresLine = premium && user.plan_expires_at
    ? `\n📅 Expires: ${new Date(user.plan_expires_at).toLocaleDateString()}`
    : '';

  const limitLine = premium
    ? '♾️ Unlimited matches & slips'
    : `📋 ${config.limits.freeMaxMatches} matches/slip, ${usedToday}/${config.limits.freeMaxSlipsPerDay} slips used today`;

  await bot.sendMessage(chatId, [
    `*Your BetCode Status*`,
    '',
    `Plan: ${planLabel}${expiresLine}`,
    limitLine,
    '',
    premium ? '_Enjoying premium? Tell your friends!_' : '_Upgrade: /subscribe_',
  ].join('\n'), { parse_mode: 'Markdown' });
}

async function handleSubscribe(bot, msg) {
  const chatId = msg.chat.id;
  db.ensureUser(chatId, msg.from.username);

  if (db.isPremium(chatId)) {
    const user = db.getUser(chatId);
    return bot.sendMessage(chatId,
      `💎 You're already on *Premium*!\n📅 Expires: ${new Date(user.plan_expires_at).toLocaleDateString()}`,
      { parse_mode: 'Markdown' }
    );
  }

  await bot.sendMessage(chatId, [
    `💎 *BetCode Premium — ₦3,000/month*`,
    '',
    '✅ Unlimited matches per slip',
    '✅ Unlimited betslips per day',
    '✅ League & trust filters',
    '✅ Tomorrow\'s matches',
    '✅ Priority processing',
    '',
    '*To pay, send:*',
    '`/pay your@email.com`',
    '',
    'You\'ll get a Paystack payment link. After payment, your Premium is activated automatically.',
  ].join('\n'), { parse_mode: 'Markdown' });
}

async function handlePay(bot, msg, match) {
  const chatId = msg.chat.id;
  const email = (match[1] || '').trim();

  if (!email || !email.includes('@')) {
    return bot.sendMessage(chatId, '❌ Please provide a valid email: `/pay your@email.com`', { parse_mode: 'Markdown' });
  }

  db.ensureUser(chatId, msg.from.username);
  db.setEmail(chatId, email);

  if (db.isPremium(chatId)) {
    return bot.sendMessage(chatId, '💎 You\'re already on Premium!');
  }

  if (!config.paystack.secretKey) {
    return bot.sendMessage(chatId, '❌ Payment system is not configured. Contact admin.');
  }

  try {
    const { paymentUrl, reference } = await payment.initializePayment(chatId, email);

    await bot.sendMessage(chatId, [
      `💳 *Payment Link Ready*`,
      '',
      `Amount: *₦3,000*`,
      `Reference: \`${reference}\``,
      '',
      `[Click here to pay](${paymentUrl})`,
      '',
      'After payment, send `/verify ' + reference + '` to activate Premium.',
      '',
      '_Payment is processed securely via Paystack._',
    ].join('\n'), { parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (err) {
    console.error('[bot] Payment init error:', err);
    await bot.sendMessage(chatId, `❌ Could not create payment link: ${err.message}`);
  }
}

async function handleVerify(bot, msg, match) {
  const chatId = msg.chat.id;
  const reference = (match[1] || '').trim();

  if (!reference) {
    return bot.sendMessage(chatId, '❌ Please provide a reference: `/verify REF_CODE`', { parse_mode: 'Markdown' });
  }

  try {
    const result = await payment.verifyPayment(reference);

    if (result.verified) {
      await bot.sendMessage(chatId, [
        '✅ *Payment verified! Premium activated!*',
        '',
        '💎 You now have unlimited access for 30 days.',
        '',
        'Try it out: `/generate 20`',
      ].join('\n'), { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId,
        `❌ Payment not confirmed yet. Status: *${result.status}*\n\nIf you've paid, wait a moment and try again.`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    console.error('[bot] Verify error:', err);
    await bot.sendMessage(chatId, `❌ Could not verify payment: ${err.message}`);
  }
}

async function handleHelp(bot, msg) {
  return handleStart(bot, msg, ['', '']);
}

function esc(text) {
  if (!text) return '';
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

module.exports = { createBot };
