const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../utils/db');

const router = express.Router();

router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { email, password } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)');
    const info = stmt.run(email, passwordHash, new Date().toISOString());
    const token = jwt.sign({ id: info.lastInsertRowid, email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '30d' });
    res.json({ success: true, token });
  }
);

router.post('/login',
  body('email').isEmail(),
  body('password').isString(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { email, password } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '30d' });
    res.json({ success: true, token });
  }
);

module.exports = router;

