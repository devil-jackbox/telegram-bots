const express = require('express');
const router = express.Router();
const { Version, connectMongo } = require('../utils/db');
const fs = require('fs-extra');
const path = require('path');
const Diff = require('diff');

// Create snapshot for a bot (captures main code file + all files)
router.post('/:botId/snapshots', async (req, res) => {
  try {
    await connectMongo();
    const { botId } = req.params;
    const { label, code, files, environmentVariables } = req.body || {};

    let capturedFiles = files;
    if (!Array.isArray(capturedFiles)) {
      // auto-capture from bot directory
      const botDir = path.join(__dirname, '../../bots', botId);
      capturedFiles = [];
      if (await fs.pathExists(botDir)) {
        const stack = ['.'];
        while (stack.length) {
          const rel = stack.pop();
          const full = path.join(botDir, rel);
          const stat = await fs.stat(full);
          if (stat.isDirectory()) {
            const children = await fs.readdir(full);
            children.forEach(c => stack.push(path.join(rel, c)));
          } else {
            const content = await fs.readFile(full, 'utf8');
            capturedFiles.push({ path: rel, content });
          }
        }
      }
    }

    const doc = await Version.create({ bot_id: botId, label, code, files: capturedFiles, environmentVariables });
    res.json({ success: true, snapshot: { id: doc._id.toString(), created_at: doc.created_at, label: doc.label } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// List snapshots
router.get('/:botId/snapshots', async (req, res) => {
  try {
    await connectMongo();
    const { botId } = req.params;
    const list = await Version.find({ bot_id: botId }).sort({ created_at: -1 }).select('_id label created_at').lean();
    res.json({ success: true, snapshots: list.map(s => ({ id: s._id.toString(), label: s.label, created_at: s.created_at })) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get snapshot details
router.get('/snapshot/:id', async (req, res) => {
  try {
    await connectMongo();
    const { id } = req.params;
    const doc = await Version.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, snapshot: doc });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Diff two snapshots by id
router.get('/:botId/diff', async (req, res) => {
  try {
    await connectMongo();
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ success: false, error: 'from and to required' });
    const a = await Version.findById(from).lean();
    const b = await Version.findById(to).lean();
    if (!a || !b) return res.status(404).json({ success: false, error: 'Snapshot not found' });
    const codeDiff = Diff.createTwoFilesPatch('from', 'to', a.code || '', b.code || '', '', '');
    res.json({ success: true, codeDiff });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

