const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/raw', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'url required' });
    let rawUrl = url;
    if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
      rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    const resp = await axios.get(rawUrl, { responseType: 'text' });
    res.type('text/plain').send(resp.data);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

