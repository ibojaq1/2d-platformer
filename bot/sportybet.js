const axios = require('axios');
const config = require('./config');

const SPORTYBET_MARKET_MAP = {
  '1':         { marketId: 1, outcomeId: '1' },
  '2':         { marketId: 1, outcomeId: '2' },
  'X':         { marketId: 1, outcomeId: 'X' },
  'Over 0.5':  { marketId: 18, outcomeId: 'Over', specifier: '0.5' },
  'Over 1.5':  { marketId: 18, outcomeId: 'Over', specifier: '1.5' },
  'Over 2.5':  { marketId: 18, outcomeId: 'Over', specifier: '2.5' },
  'Over 3.5':  { marketId: 18, outcomeId: 'Over', specifier: '3.5' },
  'Under 0.5': { marketId: 18, outcomeId: 'Under', specifier: '0.5' },
  'Under 1.5': { marketId: 18, outcomeId: 'Under', specifier: '1.5' },
  'Under 2.5': { marketId: 18, outcomeId: 'Under', specifier: '2.5' },
  'Under 3.5': { marketId: 18, outcomeId: 'Under', specifier: '3.5' },
  'GG':        { marketId: 29, outcomeId: 'Yes' },
  'NG':        { marketId: 29, outcomeId: 'No' },
  '1X':        { marketId: 10, outcomeId: '1X' },
  'X2':        { marketId: 10, outcomeId: 'X2' },
  '12':        { marketId: 10, outcomeId: '12' },
};

const api = axios.create({
  baseURL: config.sportybet.apiBase,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

async function searchEvent(homeTeam, awayTeam) {
  try {
    const resp = await api.get(`/ng/factsCenter/popularEvents`, {
      params: { sportId: 'sr:sport:1', _t: Date.now() },
    });

    const events = resp.data?.data || resp.data?.events || [];
    return findBestMatch(events, homeTeam, awayTeam);
  } catch {
    // noop
  }

  try {
    const query = `${homeTeam} ${awayTeam}`.substring(0, 40);
    const resp = await api.get(`/ng/factsCenter/searchEvents`, {
      params: { keyword: query, sportId: 'sr:sport:1', _t: Date.now() },
    });
    const events = resp.data?.data || [];
    return findBestMatch(events, homeTeam, awayTeam);
  } catch (err) {
    console.error(`[sportybet] Search failed for ${homeTeam} vs ${awayTeam}:`, err.message);
    return null;
  }
}

function findBestMatch(events, homeTeam, awayTeam) {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const h = normalize(homeTeam);
  const a = normalize(awayTeam);

  for (const evt of events) {
    const evtHome = normalize(evt.homeTeamName || evt.home || '');
    const evtAway = normalize(evt.awayTeamName || evt.away || '');
    if (
      (evtHome.includes(h) || h.includes(evtHome)) &&
      (evtAway.includes(a) || a.includes(evtAway))
    ) {
      return evt;
    }
  }

  for (const evt of events) {
    const evtHome = normalize(evt.homeTeamName || evt.home || '');
    const evtAway = normalize(evt.awayTeamName || evt.away || '');
    if (evtHome.includes(h) || h.includes(evtHome) ||
        evtAway.includes(a) || a.includes(evtAway)) {
      return evt;
    }
  }

  return null;
}

function buildOutcome(event, marketKey) {
  const mapping = SPORTYBET_MARKET_MAP[marketKey];
  if (!mapping) {
    return { marketId: 1, outcomeId: '1' };
  }

  return {
    eventId: event.eventId || event.id,
    sportId: event.sportId || 'sr:sport:1',
    marketId: mapping.marketId,
    outcomeId: mapping.outcomeId,
    specifier: mapping.specifier || '',
  };
}

async function createBookingCode(selections) {
  const outcomes = selections
    .filter(s => s.event)
    .map(s => buildOutcome(s.event, s.market));

  if (outcomes.length === 0) {
    return null;
  }

  try {
    const resp = await api.post(`/ng/orders/share`, {
      outcomes,
      sportId: 'sr:sport:1',
    });

    const code = resp.data?.data?.shareCode
      || resp.data?.shareCode
      || resp.data?.data?.code
      || resp.data?.code;

    return code || null;
  } catch (err) {
    console.error('[sportybet] Booking creation failed:', err.message);
    return null;
  }
}

async function resolveSelections(matches) {
  const results = [];
  for (const match of matches) {
    const event = await searchEvent(match.home, match.away);
    results.push({
      ...match,
      event,
      matched: !!event,
    });
    await sleep(300);
  }
  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  searchEvent,
  buildOutcome,
  createBookingCode,
  resolveSelections,
  SPORTYBET_MARKET_MAP,
};
