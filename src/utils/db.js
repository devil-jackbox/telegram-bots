const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;
  const dbPath = path.join(__dirname, '../../data/app.db');
  fs.ensureDirSync(path.dirname(dbPath));
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_key ON metrics(key);

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('start','stop')),
      cron TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  dbInstance = db;
  return dbInstance;
}

function incMetric(key, by = 1) {
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO metrics (key, value, updated_at) VALUES (@key, @by, @now)
    ON CONFLICT(key) DO UPDATE SET value = value + @by, updated_at = @now
  `);
  upsert.run({ key, by, now });
}

function getMetrics() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value, updated_at FROM metrics').all();
  return rows;
}

module.exports = { getDb, incMetric, getMetrics };

