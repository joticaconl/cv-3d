const express = require('express');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const crypto = require('crypto');

const app = express();

// SECURITY: Helmet headers
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100kb' })); // Limit body size for abuse prevention

// SECURITY: Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 peticiones por IP
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// SECURITY: Threat Detection Middleware
const SQL_INJECTION_PATTERNS = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(--|\/\*|\*\/)/i];
const XSS_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/i, /onerror=/i, /onload=/i];

function detectThreats(req, res, next) {
  const payload = JSON.stringify(req.body || {}) + req.url;
  
  const hasSQLi = SQL_INJECTION_PATTERNS.some(regex => regex.test(payload));
  const hasXSS = XSS_PATTERNS.some(regex => regex.test(payload));

  if (hasSQLi || hasXSS) {
    console.warn(`[SECURITY ALERT] Threat detected from IP: ${req.ip}`);
    return res.status(400).json({ error: 'Invalid input detected by security firewall.' });
  }
  next();
}
app.use(detectThreats);

// SECURITY: Admin Authentication Middleware (Timing-Safe)
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const adminSecret = process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return res.status(500).json({ error: 'Server authentication unconfigured' });
  }

  if (!token || token.length !== adminSecret.length) {
    return res.status(401).json({ error: 'Unauthorized: Admin token required' });
  }

  try {
    const isMatch = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(adminSecret));
    if (!isMatch) {
      return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
}

const dbPath = './db.json';
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ stickers: [] }));
}

app.get('/stickers', (req, res) => {
  const data = JSON.parse(fs.readFileSync(dbPath));
  res.json(data.stickers);
});

app.post('/stickers', (req, res) => {
  const data = JSON.parse(fs.readFileSync(dbPath));
  
  // Sanitize inputs
  const raw = req.body;
  if (!raw || typeof raw.name !== 'string' || typeof raw.price !== 'number') {
    return res.status(422).json({ error: 'Invalid sticker payload' });
  }

  const newSticker = {
    id: `stk_${crypto.randomBytes(8).toString('hex')}`,
    name: xss(String(raw.name).slice(0, 80)),
    imageName: xss(String(raw.imageName || 'default').slice(0, 100)),
    price: Number(raw.price),
    size: typeof raw.size === 'number' ? raw.size : 1,
    position: Array.isArray(raw.position) ? raw.position.slice(0, 3) : [0, 0, 0],
    rotation: Array.isArray(raw.rotation) ? raw.rotation.slice(0, 3) : [0, 0, 0],
    texture: typeof raw.texture === 'string' && /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.texture) ? raw.texture.slice(0, 15000) : null,
    status: 'pending',
    createdAt: Date.now(),
  };
  
  data.stickers.push(newSticker);
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  res.status(201).json({ success: true, id: newSticker.id });
});

app.put('/stickers/:id/approve', requireAdminAuth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dbPath));
  const sticker = data.stickers.find(s => s.id === req.params.id);
  if (sticker) {
    sticker.status = 'approved';
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.delete('/stickers/:id', requireAdminAuth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dbPath));
  data.stickers = data.stickers.filter(s => s.id !== req.params.id);
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.listen(4000, () => console.log('Backend running on port 4000 with Security Enabled'));
