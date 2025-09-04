const express = require('express');
const router = express.Router();
const BotManager = require('../botManager');

let botManager;
try {
  botManager = BotManager.getInstance();
} catch {
  botManager = null;
}

// Export a bot configuration
router.get('/:botId/export', (req, res) => {
  try {
    const { botId } = req.params;
    const bot = botManager.getBot(botId);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
    const data = {
      name: bot.name,
      code: bot.code,
      environmentVariables: bot.environmentVariables,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    };
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Import a bot configuration into an existing bot
router.post('/:botId/import', async (req, res) => {
  try {
    const { botId } = req.params;
    const { name, code, environmentVariables } = req.body || {};
    const updates = {};
    if (name) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (Array.isArray(environmentVariables)) updates.environmentVariables = environmentVariables;
    const result = await botManager.updateBot(botId, updates);
    return res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

