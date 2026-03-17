const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');
const db = require('./db');

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

async function initializePayment(chatId, email) {
  const reference = `betcode_${chatId}_${Date.now()}`;

  const payload = {
    email,
    amount: config.paystack.premiumPriceKobo,
    reference,
    currency: 'NGN',
    callback_url: `${config.server.baseUrl}/payment/callback`,
    metadata: {
      chat_id: chatId,
      plan: 'premium',
      custom_fields: [
        { display_name: 'Telegram Chat ID', variable_name: 'chat_id', value: String(chatId) },
      ],
    },
  };

  if (config.paystack.planCode) {
    payload.plan = config.paystack.planCode;
  }

  const resp = await paystack.post('/transaction/initialize', payload);

  if (!resp.data.status) {
    throw new Error(resp.data.message || 'Payment initialization failed');
  }

  db.recordPayment(chatId, reference, 'pending', config.paystack.premiumPriceKobo);

  return {
    paymentUrl: resp.data.data.authorization_url,
    reference: resp.data.data.reference,
    accessCode: resp.data.data.access_code,
  };
}

async function verifyPayment(reference) {
  const resp = await paystack.get(`/transaction/verify/${encodeURIComponent(reference)}`);

  if (!resp.data.status) {
    return { verified: false, reason: resp.data.message };
  }

  const data = resp.data.data;
  const verified = data.status === 'success';
  const chatId = data.metadata?.chat_id;

  if (verified && chatId) {
    db.updatePayment(reference, 'success');
    db.setPremium(parseInt(chatId, 10), 30);
    console.log(`[payment] Premium activated for chat_id=${chatId}`);
  } else {
    db.updatePayment(reference, data.status);
  }

  return {
    verified,
    status: data.status,
    chatId: chatId ? parseInt(chatId, 10) : null,
    amount: data.amount,
    reference: data.reference,
  };
}

function validateWebhookSignature(body, signature) {
  const hash = crypto
    .createHmac('sha512', config.paystack.secretKey)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === signature;
}

async function handleWebhook(body, signature) {
  if (!validateWebhookSignature(body, signature)) {
    throw new Error('Invalid webhook signature');
  }

  const event = body;

  if (event.event === 'charge.success') {
    const data = event.data;
    const reference = data.reference;
    const chatId = data.metadata?.chat_id;

    if (chatId) {
      db.updatePayment(reference, 'success');
      db.setPremium(parseInt(chatId, 10), 30);
      console.log(`[payment] Webhook: Premium activated for chat_id=${chatId}`);
      return { chatId: parseInt(chatId, 10), activated: true };
    }
  }

  if (event.event === 'subscription.create') {
    const chatId = event.data.customer?.metadata?.chat_id;
    if (chatId) {
      db.setPremium(parseInt(chatId, 10), 30);
      return { chatId: parseInt(chatId, 10), activated: true };
    }
  }

  return { activated: false };
}

async function listPlans() {
  const resp = await paystack.get('/plan');
  return resp.data.data || [];
}

async function createPlan() {
  const resp = await paystack.post('/plan', {
    name: 'BetCode Premium',
    amount: config.paystack.premiumPriceKobo,
    interval: 'monthly',
    currency: 'NGN',
    description: 'Unlimited matches, slips, league filters, and tomorrow\'s matches.',
  });

  if (!resp.data.status) {
    throw new Error(resp.data.message || 'Failed to create plan');
  }

  console.log('[payment] Plan created:', resp.data.data.plan_code);
  return resp.data.data;
}

module.exports = {
  initializePayment,
  verifyPayment,
  validateWebhookSignature,
  handleWebhook,
  listPlans,
  createPlan,
};
