const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const BotManager = require('../botManager');
const logger = require('../utils/logger');

// Get bot manager instance
let botManager;
try {
  botManager = BotManager.getInstance();
} catch (error) {
  logger.error('Failed to get bot manager instance:', error);
  botManager = null;
}

// Get bot file content
router.get('/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    
    if (!botManager) {
      return res.status(500).json({ success: false, error: 'Bot manager not available' });
    }
    
    const bot = botManager.getBot(botId);
    
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }
    
    const botDir = path.join(__dirname, '../../bots', botId);
    const fileExtension = 'js';
    const fileName = `bot.${fileExtension}`;
    const filePath = path.join(botDir, fileName);
    
    console.log('🔍 Debug file path:', filePath);
    console.log('🔍 Bot directory exists:', await fs.pathExists(botDir));
    console.log('🔍 File exists:', await fs.pathExists(filePath));
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ success: false, error: 'Bot file not found' });
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ success: true, content, fileName });
  } catch (error) {
    console.error('❌ File read error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update bot file content
router.put('/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { content } = req.body;
    
    if (content === undefined) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    
    const bot = botManager.getBot(botId);
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }
    
    const result = await botManager.updateBot(botId, { code: content });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get bot directory structure
router.get('/:botId/structure', async (req, res) => {
  try {
    const { botId } = req.params;
    const bot = botManager.getBot(botId);
    
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot not found' });
    }
    
    const botDir = path.join(__dirname, '../../bots', botId);
    
    if (!await fs.pathExists(botDir)) {
      return res.status(404).json({ success: false, error: 'Bot directory not found' });
    }
    
    const files = await fs.readdir(botDir);
    const fileList = [];
    
    for (const file of files) {
      const filePath = path.join(botDir, file);
      const stats = await fs.stat(filePath);
      fileList.push({
        name: file,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      });
    }
    
    res.json({ success: true, files: fileList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// Additional file operations

// Normalize and ensure path stays within bot dir
function resolveBotPath(botId, relativePath) {
  const botDir = path.join(__dirname, '../../bots', botId);
  const safePath = path.normalize(path.join(botDir, relativePath || ''));
  if (!safePath.startsWith(botDir)) {
    throw new Error('Invalid path');
  }
  return { botDir, safePath };
}

// Read arbitrary file by path
router.get('/:botId/file', async (req, res) => {
  try {
    const { botId } = req.params;
    const { path: rel } = req.query;
    if (!rel) return res.status(400).json({ success: false, error: 'path is required' });
    const { safePath } = resolveBotPath(botId, rel);
    if (!await fs.pathExists(safePath)) return res.status(404).json({ success: false, error: 'File not found' });
    const content = await fs.readFile(safePath, 'utf8');
    res.json({ success: true, content });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Write arbitrary file by path
router.put('/:botId/file', async (req, res) => {
  try {
    const { botId } = req.params;
    const { path: rel, content } = req.body || {};
    if (!rel || content === undefined) return res.status(400).json({ success: false, error: 'path and content required' });
    const { safePath } = resolveBotPath(botId, rel);
    await fs.ensureDir(path.dirname(safePath));
    await fs.writeFile(safePath, content);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Create new file
router.post('/:botId/files', async (req, res) => {
  try {
    const { botId } = req.params;
    const { path: rel, content = '' } = req.body || {};
    if (!rel) return res.status(400).json({ success: false, error: 'path required' });
    const { safePath } = resolveBotPath(botId, rel);
    if (await fs.pathExists(safePath)) return res.status(400).json({ success: false, error: 'File exists' });
    await fs.ensureDir(path.dirname(safePath));
    await fs.writeFile(safePath, content);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Rename file
router.patch('/:botId/files/rename', async (req, res) => {
  try {
    const { botId } = req.params;
    const { from, to } = req.body || {};
    if (!from || !to) return res.status(400).json({ success: false, error: 'from and to required' });
    const { safePath: fromPath } = resolveBotPath(botId, from);
    const { safePath: toPath } = resolveBotPath(botId, to);
    if (!await fs.pathExists(fromPath)) return res.status(404).json({ success: false, error: 'Source not found' });
    await fs.ensureDir(path.dirname(toPath));
    await fs.move(fromPath, toPath, { overwrite: false });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Delete file
router.delete('/:botId/files', async (req, res) => {
  try {
    const { botId } = req.params;
    const { path: rel } = req.body || {};
    if (!rel) return res.status(400).json({ success: false, error: 'path required' });
    const { safePath } = resolveBotPath(botId, rel);
    if (!await fs.pathExists(safePath)) return res.status(404).json({ success: false, error: 'File not found' });
    await fs.remove(safePath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});