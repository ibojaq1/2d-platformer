const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');

const MARKET_KEYWORDS = {
  'home':          '1',
  'home win':      '1',
  'away':          '2',
  'away win':      '2',
  'draw':          'X',
  'over 0.5':      'Over 0.5',
  'over 1.5':      'Over 1.5',
  'over 2.5':      'Over 2.5',
  'over 3.5':      'Over 3.5',
  'under 0.5':     'Under 0.5',
  'under 1.5':     'Under 1.5',
  'under 2.5':     'Under 2.5',
  'under 3.5':     'Under 3.5',
  'btts':          'GG',
  'btts yes':      'GG',
  'gg':            'GG',
  'btts no':       'NG',
  'ng':            'NG',
  'double chance 1x': '1X',
  '1x':           '1X',
  'double chance x2': 'X2',
  'x2':           'X2',
  'double chance 12': '12',
  '12':           '12',
};

function normalizeMarket(raw) {
  const key = raw.trim().toLowerCase();
  return MARKET_KEYWORDS[key] || raw.trim();
}

async function fetchPredictions(day = 'today') {
  const url = day === 'tomorrow'
    ? `${config.nerdytips.baseUrl}/predictions/tomorrow`
    : `${config.nerdytips.baseUrl}/predictions/today`;

  let html;
  try {
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });
    html = resp.data;
  } catch (err) {
    console.error('[scraper] Failed to fetch NerdyTips:', err.message);
    return [];
  }

  return parsePredictions(html);
}

function parsePredictions(html) {
  const $ = cheerio.load(html);
  const predictions = [];

  $('table tbody tr, .prediction-row, .match-row').each((_, el) => {
    const row = $(el);
    const cells = row.find('td');

    if (cells.length >= 4) {
      const homeTeam = cells.eq(0).text().trim();
      const awayTeam = cells.eq(1).text().trim();
      const tipRaw = cells.eq(2).text().trim();
      const trustText = cells.eq(3).text().trim();
      const trust = parseInt(trustText, 10) || 0;

      if (homeTeam && awayTeam && tipRaw) {
        predictions.push({
          home: homeTeam,
          away: awayTeam,
          market: normalizeMarket(tipRaw),
          marketRaw: tipRaw,
          trust,
          league: row.find('.league, td:nth-child(5)').text().trim() || 'Unknown',
          kickoff: row.find('.time, td:nth-child(6)').text().trim() || '',
        });
      }
    }

    const home = row.find('.home-team, .team-home').text().trim();
    const away = row.find('.away-team, .team-away').text().trim();
    const tip = row.find('.tip, .prediction, .best-tip').text().trim();
    const trustEl = row.find('.trust, .trust-score, .rating').text().trim();

    if (home && away && tip && cells.length < 4) {
      predictions.push({
        home,
        away,
        market: normalizeMarket(tip),
        marketRaw: tip,
        trust: parseInt(trustEl, 10) || 0,
        league: row.find('.league').text().trim() || 'Unknown',
        kickoff: row.find('.time, .kickoff').text().trim() || '',
      });
    }
  });

  return predictions;
}

function filterByTrust(predictions, minTrust = 0) {
  return predictions
    .filter(p => p.trust >= minTrust)
    .sort((a, b) => b.trust - a.trust);
}

function pickMatches(predictions, count) {
  const sorted = filterByTrust(predictions, 1);
  return sorted.slice(0, count);
}

module.exports = { fetchPredictions, parsePredictions, filterByTrust, pickMatches, normalizeMarket };
