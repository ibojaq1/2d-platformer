# BetCode

AI-powered Telegram bot that converts [NerdyTips](https://nerdytips.com) Trust BestTip predictions into [SportyBet](https://www.sportybet.com) booking codes — in under 90 seconds.

## How It Works

1. User sends `/generate 15` in Telegram
2. Bot logs into NerdyTips and scrapes today's Trust BestTip predictions (with trust ratings 1–10)
3. Picks the top N matches sorted by trust score
4. Opens SportyBet via browser automation, finds each match, and clicks the **exact correct market** (Over 2.5, BTTS, Home, Away, Under 1.5, Double Chance, etc.)
5. Generates a booking code from the betslip
6. Sends the code back to the user in Telegram

## Project Structure

```
├── index.html          # Landing page
├── style.css           # Landing page styles
├── script.js           # Landing page interactions
├── bot/
│   ├── index.js        # Entry point
│   ├── config.js       # Environment-based configuration
│   ├── telegram.js     # Telegram bot commands (/generate, /pay, /verify, etc.)
│   ├── scraper.js      # NerdyTips scraper (Puppeteer + authenticated session)
│   ├── sportybet.js    # SportyBet automation (Puppeteer + market selection)
│   ├── payment.js      # Paystack payment integration
│   ├── server.js       # Express server for Paystack webhooks & callbacks
│   └── db.js           # SQLite database (users, slips, payments)
├── .env.example        # Environment variables template
├── package.json
└── .gitignore
```

## Setup

### Prerequisites

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A [NerdyTips](https://nerdytips.com) subscription account (to access predictions)
- A [SportyBet](https://www.sportybet.com/ng) account
- A [Paystack](https://paystack.com) account (for payment processing)
- Chromium/Chrome installed (for Puppeteer)

### Install

```bash
git clone <repo-url>
cd betcode
npm install
```

### Configure

```bash
cp .env.example .env
```

Fill in all required credentials in `.env`:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `NERDYTIPS_USERNAME` | Your NerdyTips login username |
| `NERDYTIPS_PASSWORD` | Your NerdyTips login password |
| `SPORTYBET_PHONE` | Your SportyBet phone number |
| `SPORTYBET_PASSWORD` | Your SportyBet password |
| `PAYSTACK_SECRET_KEY` | From Paystack dashboard |
| `PAYSTACK_PUBLIC_KEY` | From Paystack dashboard |
| `PAYSTACK_PLAN_CODE` | (Optional) Paystack subscription plan code |
| `SERVER_BASE_URL` | Your public server URL (for webhooks) |

### Run

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

### Paystack Webhook Setup

1. Go to Paystack Dashboard → Settings → API Keys & Webhooks
2. Set webhook URL to: `https://your-server.com/payment/webhook`
3. Events to listen for: `charge.success`, `subscription.create`

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/generate N` | Generate a betslip with N matches |
| `/status` | Check your plan and daily usage |
| `/subscribe` | View Premium plan details |
| `/pay email` | Get a Paystack payment link for Premium |
| `/verify REF` | Verify payment and activate Premium |
| `/help` | Show available commands |

## Tiers

### Free

- 5 matches per betslip
- 2 betslips per day
- Today's matches only

### Premium (₦3,000/month via Paystack)

- Unlimited matches per slip
- Unlimited betslips per day
- League & trust filters
- Tomorrow's matches
- Priority processing

## Supported Markets

The bot picks the **actual recommended market** from NerdyTips Best Tip — not just "Home Win":

| Market | SportyBet Tab | Example |
|--------|---------------|---------|
| 1 / Home | 1X2 | Home Win |
| X / Draw | 1X2 | Draw |
| 2 / Away | 1X2 | Away Win |
| Over 2.5 | Over/Under | Over 2.5 Goals |
| Under 1.5 | Over/Under | Under 1.5 Goals |
| GG / BTTS | GG/NG | Both Teams to Score |
| NG | GG/NG | No Goal from Both |
| 1X | Double Chance | Home or Draw |
| X2 | Double Chance | Draw or Away |
| 12 | Double Chance | Home or Away |

## Landing Page

Open `index.html` in a browser or serve locally:

```bash
npx serve .
```

Dark-themed, responsive, scroll-animated landing page.

## Tech Stack

- **Bot:** Node.js, node-telegram-bot-api, Puppeteer, better-sqlite3, Express
- **Payments:** Paystack API (NGN)
- **Scraping:** Puppeteer (authenticated NerdyTips sessions)
- **Automation:** Puppeteer (SportyBet market selection + booking codes)
- **Landing Page:** Vanilla HTML/CSS/JS, Google Fonts (Outfit + JetBrains Mono)
