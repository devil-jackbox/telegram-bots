const express = require('express');
const { incMetric, getMetrics } = require('../utils/db');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/inc', auth, async (req, res) => {
  const { key, by = 1 } = req.body || {};
  if (!key) return res.status(400).json({ success: false, error: 'key required' });
  await incMetric(key, Number(by) || 1);
  res.json({ success: true });
});

router.get('/', auth, async (req, res) => {
  const metrics = await getMetrics();
  res.json({ success: true, metrics });
});

module.exports = router;

