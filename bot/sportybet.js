const puppeteer = require('puppeteer');
const config = require('./config');

let browser = null;
let page = null;

const MARKET_SELECTORS = {
  '1':        { tab: '1X2',       pick: 'Home' },
  'Home':     { tab: '1X2',       pick: 'Home' },
  'X':        { tab: '1X2',       pick: 'Draw' },
  'Draw':     { tab: '1X2',       pick: 'Draw' },
  '2':        { tab: '1X2',       pick: 'Away' },
  'Away':     { tab: '1X2',       pick: 'Away' },
  'Over 0.5': { tab: 'Over/Under', pick: 'Over', specifier: '0.5' },
  'Over 1.5': { tab: 'Over/Under', pick: 'Over', specifier: '1.5' },
  'Over 2.5': { tab: 'Over/Under', pick: 'Over', specifier: '2.5' },
  'Over 3.5': { tab: 'Over/Under', pick: 'Over', specifier: '3.5' },
  'Under 0.5':{ tab: 'Over/Under', pick: 'Under', specifier: '0.5' },
  'Under 1.5':{ tab: 'Over/Under', pick: 'Under', specifier: '1.5' },
  'Under 2.5':{ tab: 'Over/Under', pick: 'Under', specifier: '2.5' },
  'Under 3.5':{ tab: 'Over/Under', pick: 'Under', specifier: '3.5' },
  'GG':       { tab: 'GG/NG',     pick: 'GG' },
  'BTTS':     { tab: 'GG/NG',     pick: 'GG' },
  'Yes':      { tab: 'GG/NG',     pick: 'GG' },
  'NG':       { tab: 'GG/NG',     pick: 'NG' },
  'No':       { tab: 'GG/NG',     pick: 'NG' },
  '1X':       { tab: 'Double Chance', pick: '1X' },
  'X2':       { tab: 'Double Chance', pick: 'X2' },
  '12':       { tab: 'Double Chance', pick: '12' },
};

function normalizeMarket(bestTip) {
  if (!bestTip) return null;
  const tip = bestTip.trim();

  if (MARKET_SELECTORS[tip]) return MARKET_SELECTORS[tip];

  const lower = tip.toLowerCase();

  if (/^home\b|^1$/i.test(lower))  return MARKET_SELECTORS['1'];
  if (/^away\b|^2$/i.test(lower))  return MARKET_SELECTORS['2'];
  if (/^draw\b|^x$/i.test(lower))  return MARKET_SELECTORS['X'];

  const overMatch = lower.match(/over\s*([\d.]+)/);
  if (overMatch) {
    const key = `Over ${overMatch[1]}`;
    return MARKET_SELECTORS[key] || { tab: 'Over/Under', pick: 'Over', specifier: overMatch[1] };
  }

  const underMatch = lower.match(/under\s*([\d.]+)/);
  if (underMatch) {
    const key = `Under ${underMatch[1]}`;
    return MARKET_SELECTORS[key] || { tab: 'Over/Under', pick: 'Under', specifier: underMatch[1] };
  }

  if (/btts|gg|both.*(teams|team).*score/i.test(lower)) return MARKET_SELECTORS['GG'];
  if (/\bng\b|btts.*no|no.*btts/i.test(lower))          return MARKET_SELECTORS['NG'];

  if (/^1x$/i.test(lower))  return MARKET_SELECTORS['1X'];
  if (/^x2$/i.test(lower))  return MARKET_SELECTORS['X2'];
  if (/^12$/i.test(lower))  return MARKET_SELECTORS['12'];

  console.warn(`[sportybet] Unknown market: "${tip}", defaulting to 1X2 Home`);
  return MARKET_SELECTORS['1'];
}

async function launchBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: config.puppeteer.headless ? 'new' : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...(config.puppeteer.executablePath && { executablePath: config.puppeteer.executablePath }),
    });
  }
  return browser;
}

async function getPage() {
  const b = await launchBrowser();
  if (!page || page.isClosed()) {
    page = await b.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    );
    await page.setViewport({ width: 414, height: 896 });
  }
  return page;
}

async function loginToSportyBet() {
  const p = await getPage();
  console.log('[sportybet] Logging into SportyBet...');

  await p.goto(`${config.sportybet.baseUrl}/m/sport/football/today`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  const needsLogin = await p.evaluate(() => {
    return !!document.querySelector('.m-login-btn, .login-btn, [data-cms-key="login"]');
  });

  if (!needsLogin) {
    console.log('[sportybet] Already logged in');
    return p;
  }

  const loginBtn = await p.$('.m-login-btn, .login-btn, [data-cms-key="login"]');
  if (loginBtn) await loginBtn.click();

  await sleep(2000);

  const phoneInput = await p.$('input[type="tel"], input[name="phone"], input[placeholder*="phone" i], input[placeholder*="number" i]');
  const passwordInput = await p.$('input[type="password"]');

  if (phoneInput && passwordInput) {
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.type(config.sportybet.phone, { delay: 30 });
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(config.sportybet.password, { delay: 30 });

    const submitBtn = await p.$('button[type="submit"], .login-submit, .af-button--primary');
    if (submitBtn) await submitBtn.click();

    await sleep(5000);
  }

  console.log('[sportybet] Login flow completed');
  return p;
}

async function navigateToFootball(p) {
  const currentUrl = p.url();
  if (!currentUrl.includes('/sport/football')) {
    await p.goto(`${config.sportybet.baseUrl}/m/sport/football/today`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
  }
}

async function findAndSelectMatch(p, home, away, marketInfo) {
  await navigateToFootball(p);
  await sleep(2000);

  const found = await p.evaluate((homeTeam, awayTeam) => {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const h = normalize(homeTeam);
    const a = normalize(awayTeam);

    const matchElements = document.querySelectorAll(
      '.m-event, .m-match, [class*="event-item"], [class*="match-item"], #importMatch > div'
    );

    for (const el of matchElements) {
      const text = normalize(el.innerText || '');
      const hWords = h.split(' ');
      const aWords = a.split(' ');

      const homeMatch = hWords.some(w => w.length > 2 && text.includes(w));
      const awayMatch = aWords.some(w => w.length > 2 && text.includes(w));

      if (homeMatch && awayMatch) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
    }
    return false;
  }, home, away);

  if (!found) {
    console.log(`[sportybet] Match not found: ${home} vs ${away}`);
    return false;
  }

  await sleep(1000);

  if (marketInfo.tab === '1X2') {
    return await click1X2(p, home, away, marketInfo.pick);
  } else if (marketInfo.tab === 'Over/Under') {
    return await clickOverUnder(p, home, away, marketInfo.pick, marketInfo.specifier);
  } else if (marketInfo.tab === 'GG/NG') {
    return await clickBtts(p, home, away, marketInfo.pick);
  } else if (marketInfo.tab === 'Double Chance') {
    return await clickDoubleChance(p, home, away, marketInfo.pick);
  }

  return false;
}

async function click1X2(p, home, away, pick) {
  const pickIndex = pick === 'Home' ? 0 : pick === 'Draw' ? 1 : 2;

  return await p.evaluate((homeTeam, awayTeam, idx) => {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const h = normalize(homeTeam);
    const a = normalize(awayTeam);

    const rows = document.querySelectorAll(
      '#importMatch > div > div > div:nth-child(4) > div, .m-event, [class*="match-row"]'
    );

    for (const row of rows) {
      const text = normalize(row.innerText || '');
      const hWords = h.split(' ');
      const aWords = a.split(' ');

      if (hWords.some(w => w.length > 2 && text.includes(w)) &&
          aWords.some(w => w.length > 2 && text.includes(w))) {

        const oddsButtons = row.querySelectorAll(
          '.m-outcome, [class*="outcome"], [class*="odds-btn"], [class*="m-home"], [class*="m-draw"], [class*="m-away"]'
        );

        if (oddsButtons.length >= 3 && oddsButtons[idx]) {
          oddsButtons[idx].click();
          return true;
        }

        const allClickable = row.querySelectorAll('[class*="odd"]');
        if (allClickable.length >= 3 && allClickable[idx]) {
          allClickable[idx].click();
          return true;
        }
      }
    }
    return false;
  }, home, away, pickIndex);
}

async function clickOverUnder(p, home, away, pick, specifier) {
  const matchRow = await findMatchRow(p, home, away);
  if (!matchRow) return false;

  await p.evaluate(async (homeTeam, awayTeam, pickType, spec) => {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

    const tabs = document.querySelectorAll(
      '.m-market-tab, [class*="market-tab"], [class*="market-header"]'
    );
    for (const tab of tabs) {
      const tabText = tab.innerText.toLowerCase();
      if (tabText.includes('over') || tabText.includes('under') || tabText.includes('o/u')) {
        tab.click();
        break;
      }
    }
  }, home, away, pick, specifier);

  await sleep(1000);

  return await p.evaluate((pickType, spec) => {
    const specSelector = spec || '2.5';

    const selects = document.querySelectorAll('.af-select, select, [class*="select"]');
    for (const sel of selects) {
      const options = sel.querySelectorAll('option, .af-select-item, [class*="select-item"]');
      for (const opt of options) {
        if (opt.textContent.trim() === specSelector) {
          opt.click();
          break;
        }
      }
    }

    const outcomes = document.querySelectorAll('.m-outcome, [class*="outcome"], [class*="odds"]');
    for (const out of outcomes) {
      const text = out.innerText.toLowerCase();
      if (pickType === 'Over' && text.includes('over')) {
        out.click();
        return true;
      }
      if (pickType === 'Under' && text.includes('under')) {
        out.click();
        return true;
      }
    }
    return false;
  }, pick, specifier);
}

async function clickBtts(p, home, away, pick) {
  await p.evaluate(() => {
    const tabs = document.querySelectorAll(
      '.m-market-tab, [class*="market-tab"], [class*="market-header"]'
    );
    for (const tab of tabs) {
      const tabText = tab.innerText.toLowerCase();
      if (tabText.includes('gg') || tabText.includes('btts') || tabText.includes('both')) {
        tab.click();
        break;
      }
    }
  });

  await sleep(1000);

  return await p.evaluate((pickType) => {
    const outcomes = document.querySelectorAll('.m-outcome, [class*="outcome"], [class*="odds"]');
    for (const out of outcomes) {
      const text = out.innerText.toLowerCase();
      if (pickType === 'GG' && (text.includes('yes') || text.includes('gg'))) {
        out.click();
        return true;
      }
      if (pickType === 'NG' && (text.includes('no') || text.includes('ng'))) {
        out.click();
        return true;
      }
    }
    return false;
  }, pick);
}

async function clickDoubleChance(p, home, away, pick) {
  await p.evaluate(() => {
    const tabs = document.querySelectorAll(
      '.m-market-tab, [class*="market-tab"], [class*="market-header"]'
    );
    for (const tab of tabs) {
      if (tab.innerText.toLowerCase().includes('double')) {
        tab.click();
        break;
      }
    }
  });

  await sleep(1000);

  return await p.evaluate((pickType) => {
    const outcomes = document.querySelectorAll('.m-outcome, [class*="outcome"], [class*="odds"]');
    for (const out of outcomes) {
      const text = out.innerText.trim().toUpperCase();
      if (text.includes(pickType)) {
        out.click();
        return true;
      }
    }
    return false;
  }, pick);
}

async function findMatchRow(p, home, away) {
  return await p.evaluate((homeTeam, awayTeam) => {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const h = normalize(homeTeam);
    const a = normalize(awayTeam);

    const rows = document.querySelectorAll('[class*="event"], [class*="match"]');
    for (const row of rows) {
      const text = normalize(row.innerText || '');
      if (h.split(' ').some(w => w.length > 2 && text.includes(w)) &&
          a.split(' ').some(w => w.length > 2 && text.includes(w))) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
    }
    return false;
  }, home, away);
}

async function getBookingCode(p) {
  await sleep(1500);

  const shareBtn = await p.$(
    '.m-betslip-share, [class*="share"], [class*="booking"], .m-icon-share'
  );
  if (shareBtn) {
    await shareBtn.click();
    await sleep(2000);
  }

  const code = await p.evaluate(() => {
    const codeEl = document.querySelector(
      '.m-share-code, [class*="share-code"], [class*="booking-code"], [class*="shareCode"]'
    );
    if (codeEl) return codeEl.innerText.trim();

    const allText = document.body.innerText;
    const codeMatch = allText.match(/(?:code|Code|CODE)[:\s]*([A-Z0-9]{5,10})/);
    if (codeMatch) return codeMatch[1];

    return null;
  });

  return code;
}

async function generateBookingCode(matches) {
  if (!config.sportybet.phone || !config.sportybet.password) {
    throw new Error('SPORTYBET_PHONE and SPORTYBET_PASSWORD must be set');
  }

  const p = await loginToSportyBet();
  const results = [];

  for (const match of matches) {
    const marketInfo = normalizeMarket(match.bestTip);
    if (!marketInfo) {
      results.push({ ...match, matched: false, reason: 'Unknown market' });
      continue;
    }

    console.log(`[sportybet] Selecting: ${match.home} vs ${match.away} → ${match.bestTip}`);

    const selected = await findAndSelectMatch(p, match.home, match.away, marketInfo);
    results.push({
      ...match,
      matched: selected,
      marketTab: marketInfo.tab,
      marketPick: marketInfo.pick,
      specifier: marketInfo.specifier || null,
      reason: selected ? 'OK' : 'Not found on SportyBet',
    });

    await sleep(1500);
  }

  const matched = results.filter(r => r.matched);
  if (matched.length === 0) {
    return { results, bookingCode: null };
  }

  const bookingCode = await getBookingCode(p);

  if (bookingCode) {
    await clearBetslip(p);
  }

  return { results, bookingCode };
}

async function clearBetslip(p) {
  await p.evaluate(() => {
    const clearBtn = document.querySelector(
      '.m-betslip-clear, [class*="clear-all"], [class*="remove-all"], .m-icon-delete'
    );
    if (clearBtn) clearBtn.click();

    const confirmBtn = document.querySelector(
      '.af-button--primary, [class*="confirm"], button[data-ret="close"]'
    );
    if (confirmBtn) confirmBtn.click();
  });
  await sleep(1000);
}

async function closeBrowser() {
  if (page && !page.isClosed()) await page.close();
  if (browser && browser.connected) await browser.close();
  browser = null;
  page = null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  normalizeMarket,
  generateBookingCode,
  loginToSportyBet,
  closeBrowser,
  MARKET_SELECTORS,
};
