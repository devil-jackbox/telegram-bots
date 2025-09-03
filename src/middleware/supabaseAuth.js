const jwt = require('jsonwebtoken');

function supabaseAuthOptional(req, res, next) {
  const requireAuth = (process.env.SUPABASE_AUTH_REQUIRED || 'false').toLowerCase() === 'true';
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!requireAuth && !token) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const secret = process.env.SUPABASE_JWT_SECRET || '';
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration: SUPABASE_JWT_SECRET missing' });
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    // Typical Supabase claims include sub, email
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

module.exports = supabaseAuthOptional;

