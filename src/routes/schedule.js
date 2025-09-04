const express = require('express');
const { connectMongo, Schedule } = require('../utils/db');
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

router.post('/', async (req, res) => {
  const { botId, action, cron: cronExpr } = req.body || {};
  if (!botId || !action || !cronExpr) {
    return res.status(400).json({ success: false, error: 'botId, action, cron required' });
  }
  await connectMongo();
  const doc = await Schedule.create({ bot_id: botId, action, cron: cronExpr });
  scheduleJob(doc._id.toString(), botId, action, cronExpr);
  res.json({ success: true, id: doc._id.toString() });
});

router.get('/', async (req, res) => {
  await connectMongo();
  const rows = await Schedule.find({}).lean();
  res.json({ success: true, schedules: rows });
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  await connectMongo();
  await Schedule.deleteOne({ _id: id });
  if (scheduledJobs.has(id)) { scheduledJobs.get(id).stop(); scheduledJobs.delete(id); }
  res.json({ success: true });
});

module.exports = router;

