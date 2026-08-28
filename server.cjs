const express = require('express');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

const app = express();

// SECURITY: Helmet headers
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit body size for high traffic / abuse prevention

// SECURITY: Rate Limiting (Alto tráfico y prevención DDoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 peticiones por IP
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// SECURITY: Threat Detection Middleware (Basado en Proyecto Gravedad)
const SQL_INJECTION_PATTERNS = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(--|\/\*|\*\/)/i];
const XSS_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/i, /onerror=/i, /onload=/i];

function detectThreats(req, res, next) {
  const payload = JSON.stringify(req.body) + req.url;
  
  const hasSQLi = SQL_INJECTION_PATTERNS.some(regex => regex.test(payload));
  const hasXSS = XSS_PATTERNS.some(regex => regex.test(payload));

  if (hasSQLi || hasXSS) {
    console.warn(`[SECURITY ALERT] Threat detected from IP: ${req.ip}`);
    return res.status(400).json({ error: 'Invalid input detected by security firewall.' });
  }
  next();
}
app.use(detectThreats);


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
  const newSticker = req.body;
  newSticker.name = xss(newSticker.name);
  newSticker.imageName = xss(newSticker.imageName);
  
  data.stickers.push(newSticker);
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.put('/stickers/:id/approve', (req, res) => {
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

app.delete('/stickers/:id', (req, res) => {
  const data = JSON.parse(fs.readFileSync(dbPath));
  data.stickers = data.stickers.filter(s => s.id !== req.params.id);
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.listen(4000, () => console.log('Backend running on port 4000 with Security Enabled'));
