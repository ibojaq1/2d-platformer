const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.db.path);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    chat_id   INTEGER PRIMARY KEY,
    username  TEXT,
    plan      TEXT DEFAULT 'free',
    plan_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS slips (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id    INTEGER NOT NULL,
    match_count INTEGER NOT NULL,
    booking_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES users(chat_id)
  );
`);

const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (chat_id, username) VALUES (?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET username = excluded.username
  `),
  getUser: db.prepare('SELECT * FROM users WHERE chat_id = ?'),
  setPlan: db.prepare(`
    UPDATE users SET plan = ?, plan_expires_at = ? WHERE chat_id = ?
  `),
  insertSlip: db.prepare(`
    INSERT INTO slips (chat_id, match_count, booking_code) VALUES (?, ?, ?)
  `),
  countSlipsToday: db.prepare(`
    SELECT COUNT(*) AS cnt FROM slips
    WHERE chat_id = ? AND date(created_at) = date('now')
  `),
};

function ensureUser(chatId, username) {
  stmts.upsertUser.run(chatId, username || null);
}

function getUser(chatId) {
  return stmts.getUser.get(chatId);
}

function isPremium(chatId) {
  const user = getUser(chatId);
  if (!user || user.plan !== 'premium') return false;
  if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
    stmts.setPlan.run('free', null, chatId);
    return false;
  }
  return true;
}

function setPremium(chatId, daysFromNow = 30) {
  const expires = new Date();
  expires.setDate(expires.getDate() + daysFromNow);
  stmts.setPlan.run('premium', expires.toISOString(), chatId);
}

function recordSlip(chatId, matchCount, bookingCode) {
  stmts.insertSlip.run(chatId, matchCount, bookingCode);
}

function slipsToday(chatId) {
  return stmts.countSlipsToday.get(chatId).cnt;
}

module.exports = { ensureUser, getUser, isPremium, setPremium, recordSlip, slipsToday };
