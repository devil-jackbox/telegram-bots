const express = require('express');
const axios = require('axios');

const router = express.Router();

const WHITELIST = [
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  'pastebin.com',
  'pastebin.pl',
  'gist.github.com'
];

function toRawUrl(url) {
  if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  if (url.includes('pastebin.com/') && !url.endsWith('/raw')) {
    return url.replace('pastebin.com/', 'pastebin.com/raw/');
  }
  return url;
}

router.get('/fetch', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'url required' });
    const u = new URL(toRawUrl(url));
    if (!WHITELIST.some(h => u.hostname.endsWith(h))) {
      return res.status(400).json({ success: false, error: 'domain not allowed' });
    }
    const resp = await axios.get(u.toString(), { responseType: 'text' });
    res.type('text/plain').send(resp.data);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

