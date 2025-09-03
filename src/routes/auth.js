const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { connectMongo, User } = require('../utils/db');

const router = express.Router();

router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { email, password } = req.body;
    await connectMongo();
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await User.create({ email, password_hash: passwordHash });
    const token = jwt.sign({ id: user._id.toString(), email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '30d' });
    res.json({ success: true, token });
  }
);

router.post('/login',
  body('email').isEmail(),
  body('password').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { email, password } = req.body;
    await connectMongo();
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id.toString(), email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '30d' });
    res.json({ success: true, token });
  }
);

module.exports = router;

