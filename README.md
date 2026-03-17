# BetCode

AI-powered Telegram bot that converts [NerdyTips](https://www.nerdytips.com) Trust BestTip predictions into [SportyBet](https://www.sportybet.com) booking codes — in under 90 seconds.

## How It Works

1. User sends `/generate 15` in Telegram
2. Bot scrapes NerdyTips for today's Trust BestTip predictions (with trust ratings 1–10)
3. Picks the top N matches sorted by trust score
4. Matches each prediction to the correct SportyBet event and market (Over 2.5, BTTS, Home, Away, etc.)
5. Creates a booking code via SportyBet's API
6. Sends the code back to the user

## Project Structure

```
├── index.html          # Landing page
├── style.css           # Landing page styles
├── script.js           # Landing page interactions
├── bot/
│   ├── index.js        # Entry point
│   ├── config.js       # Environment config
│   ├── telegram.js     # Telegram bot commands
│   ├── scraper.js      # NerdyTips scraper
│   ├── sportybet.js    # SportyBet API integration
│   └── db.js           # SQLite user/subscription management
├── .env.example        # Environment variables template
├── package.json
└── .gitignore
```

## Setup

### Prerequisites

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Install

```bash
git clone https://github.com/ibojaq1/2d-platformer.git
cd 2d-platformer
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` and add your Telegram bot token:

```
TELEGRAM_BOT_TOKEN=your_token_here
```

### Run

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/generate N` | Generate a betslip with N matches |
| `/status` | Check your plan and daily usage |
| `/subscribe` | Upgrade to Premium |
| `/help` | Show available commands |

## Tiers

### Free

- 5 matches per betslip
- 2 betslips per day
- Today's matches only

### Premium (₦3,000/month)

- Unlimited matches per slip
- Unlimited betslips per day
- League & trust filters
- Tomorrow's matches
- Priority processing

## Supported Markets

The bot picks the **actual recommended market** from NerdyTips, not just "Home Win":

- 1X2 (Home / Draw / Away)
- Over/Under (0.5, 1.5, 2.5, 3.5)
- BTTS Yes / No (GG / NG)
- Double Chance (1X, X2, 12)

## Landing Page

Open `index.html` in a browser or serve it:

```bash
npx serve .
```

Features: dark theme, scroll animations, interactive terminal demo, responsive layout.

## Tech Stack

- **Bot:** Node.js, node-telegram-bot-api, axios, cheerio, better-sqlite3
- **Landing Page:** Vanilla HTML/CSS/JS, Google Fonts (Outfit + JetBrains Mono)
