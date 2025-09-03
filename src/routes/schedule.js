const express = require('express');
const auth = require('../middleware/auth');
const { getDb } = require('../utils/db');
const BotManager = require('../botManager');
const cron = require('node-cron');

const router = express.Router();
let botManager;
try { botManager = BotManager.getInstance(); } catch { botManager = null; }

const scheduledJobs = new Map();

function scheduleJob(id, botId, action, cronExpr) {
  if (scheduledJobs.has(id)) scheduledJobs.get(id).stop();
  const job = cron.schedule(cronExpr, async () => {
    try {
      if (action === 'start') await botManager.startBot(botId);
      if (action === 'stop') await botManager.stopBot(botId);
    } catch (e) {
      // ignore
    }
  });
  scheduledJobs.set(id, job);
}

router.post('/', auth, (req, res) => {
  const { botId, action, cron: cronExpr } = req.body || {};
  if (!botId || !action || !cronExpr) {
    return res.status(400).json({ success: false, error: 'botId, action, cron required' });
  }
  const db = getDb();
  const stmt = db.prepare('INSERT INTO schedules (bot_id, action, cron, created_at) VALUES (?, ?, ?, ?)');
  const info = stmt.run(botId, action, cronExpr, new Date().toISOString());
  scheduleJob(info.lastInsertRowid, botId, action, cronExpr);
  res.json({ success: true, id: info.lastInsertRowid });
});

router.get('/', auth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM schedules').all();
  res.json({ success: true, schedules: rows });
});

router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  if (scheduledJobs.has(id)) { scheduledJobs.get(id).stop(); scheduledJobs.delete(id); }
  res.json({ success: true });
});

module.exports = router;

