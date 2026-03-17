const puppeteer = require('puppeteer');
const config = require('./config');

let browser = null;
let sessionCookies = null;

const LAUNCH_OPTS = {
  headless: config.puppeteer.headless ? 'new' : false,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  ...(config.puppeteer.executablePath && { executablePath: config.puppeteer.executablePath }),
};

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch(LAUNCH_OPTS);
  }
  return browser;
}

async function loginToNerdyTips(page) {
  if (sessionCookies) {
    await page.setCookie(...sessionCookies);
    await page.goto(`${config.nerdytips.baseUrl}/all-matches/today`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const stillLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('.nt-user-menu, .user-menu, .logout, [href*="logout"]');
    });
    if (stillLoggedIn) return true;
  }

  console.log('[scraper] Logging into NerdyTips...');
  await page.goto(`${config.nerdytips.baseUrl}/login`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  await page.waitForSelector('#username', { timeout: 10000 });
  await page.type('#username', config.nerdytips.username, { delay: 40 });
  await page.type('#password', config.nerdytips.password, { delay: 40 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);

  const loggedIn = await page.evaluate(() => {
    const body = document.body.innerText.toLowerCase();
    return !body.includes('invalid credentials') && !body.includes('login failed');
  });

  if (!loggedIn) {
    throw new Error('NerdyTips login failed — check NERDYTIPS_USERNAME and NERDYTIPS_PASSWORD');
  }

  sessionCookies = await page.cookies();
  console.log('[scraper] NerdyTips login successful');
  return true;
}

async function fetchPredictions(day = 'today') {
  if (!config.nerdytips.username || !config.nerdytips.password) {
    throw new Error('NERDYTIPS_USERNAME and NERDYTIPS_PASSWORD must be set');
  }

  const b = await getBrowser();
  const page = await b.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    await loginToNerdyTips(page);

    const url = day === 'tomorrow'
      ? `${config.nerdytips.baseUrl}/all-matches/tomorrow`
      : `${config.nerdytips.baseUrl}/all-matches/today`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('table.table', { timeout: 15000 });
    await autoScroll(page);

    const predictions = await page.evaluate(() => {
      const results = [];

      document.querySelectorAll('table.table tbody tr[data-target="popup"]').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 10) return;

        const dateCell = cells[0]?.innerText?.trim() || '';
        const matchCell = cells[1];
        const bestTipCell = cells[8];
        const trustCell = cells[9];

        const teams = matchCell?.innerText?.trim().split('\n').map(t => t.trim()).filter(Boolean) || [];
        const home = teams[0] || '';
        const away = teams[teams.length - 1] || '';

        if (!home || !away) return;

        const bestTipText = bestTipCell?.innerText?.trim() || '';
        const trustText = trustCell?.innerText?.trim() || '';
        const trustNum = parseInt(trustText, 10);

        const tipCell = cells[5]?.innerText?.trim() || '';
        const goalsCell = cells[6]?.innerText?.trim() || '';
        const bttsCell = cells[7]?.innerText?.trim() || '';

        if (bestTipText === '?' || !bestTipText) return;

        const leagueEl = row.closest('.collapse')?.previousElementSibling?.querySelector('.nt-league-link');
        const league = leagueEl?.innerText?.trim() || '';

        const matchId = row.id?.replace('d', '') || '';
        const matchUrl = row.getAttribute('onclick')?.match(/window\.open\('([^']+)'/)?.[1] || '';

        results.push({
          home,
          away,
          bestTip: bestTipText,
          tip1x2: tipCell !== '?' ? tipCell : '',
          tipGoals: goalsCell !== '?' ? goalsCell : '',
          tipBtts: bttsCell !== '?' ? bttsCell : '',
          trust: isNaN(trustNum) ? 0 : trustNum,
          league,
          kickoff: dateCell.replace(/Live.*$/, '').replace('Upcoming', '').trim(),
          matchId,
          matchUrl,
        });
      });

      return results;
    });

    console.log(`[scraper] Fetched ${predictions.length} predictions for ${day}`);
    return predictions;
  } catch (err) {
    console.error('[scraper] Error fetching predictions:', err.message);
    throw err;
  } finally {
    await page.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
      setTimeout(resolve, 8000);
    });
  });
}

function pickMatches(predictions, count) {
  return predictions
    .filter(p => p.bestTip && p.trust > 0)
    .sort((a, b) => b.trust - a.trust)
    .slice(0, count);
}

async function closeBrowser() {
  if (browser && browser.connected) {
    await browser.close();
    browser = null;
  }
}

module.exports = { fetchPredictions, pickMatches, closeBrowser, getBrowser };
