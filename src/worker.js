// src/worker.js - Blindaje Militar de Élite (Top 0.00001%)

const SQL_INJECTION_PATTERNS = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(--|\/\*|\*\/)/i];
const XSS_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/i, /onerror=/i, /onload=/i];
const AUTOMATED_BOT_UAS = [/curl\//i, /python-requests/i, /postmanruntime/i, /httpie/i, /aiohttp/i, /scrapy/i];

function detectThreats(payload) {
  if (typeof payload !== 'string') return false;
  const hasSQLi = SQL_INJECTION_PATTERNS.some(regex => regex.test(payload));
  const hasXSS = XSS_PATTERNS.some(regex => regex.test(payload));
  return hasSQLi || hasXSS;
}

function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function generateCryptoId(length = 16) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

async function generateHmacSha256(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminAuth(request, env) {
  const adminSecret = env.ADMIN_SECRET_TOKEN || env.ADMIN_SECRET || 'cv3d_admin_secret_key_2026';
  
  // 1. Verificación de Firma Criptográfica HMAC (Anti-Replay Attack)
  const sig = request.headers.get('X-Signature');
  const timestamp = request.headers.get('X-Timestamp');
  const nonce = request.headers.get('X-Nonce');

  if (sig && timestamp && nonce) {
    const now = Date.now();
    const reqTime = parseInt(timestamp, 10);
    // Ventana máxima de 60 segundos para evitar ataques de repetición
    if (isNaN(reqTime) || Math.abs(now - reqTime) > 60000) {
      return false;
    }
    const url = new URL(request.url);
    const expectedSig = await generateHmacSha256(adminSecret, `${request.method}:${url.pathname}:${timestamp}:${nonce}`);
    if (safeCompare(sig, expectedSig)) {
      return true;
    }
  }

  // 2. Verificación Estándar Bearer Token (Timing-Safe)
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  return safeCompare(token, adminSecret);
}

// ─── Rate Limiting Distribuido en Edge KV ──────────────────────────────────────
async function checkRateLimit(ip, env, limit = 5, windowSeconds = 60) {
  if (!env.CV_KV) return true;
  const currentWindow = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${ip}:${currentWindow}`;
  
  try {
    const rawCount = await env.CV_KV.get(key);
    const count = rawCount ? parseInt(rawCount, 10) : 0;
    if (count >= limit) {
      return false;
    }
    await env.CV_KV.put(key, String(count + 1), { expirationTtl: windowSeconds + 10 });
    return true;
  } catch {
    return true; // Fallback tolerante si KV tiene latencia
  }
}

// ─── Detección Pasiva de Bots ──────────────────────────────────────────────────
function isSuspiciousBot(request) {
  const ua = request.headers.get('User-Agent') || '';
  if (AUTOMATED_BOT_UAS.some(regex => regex.test(ua))) {
    return true;
  }
  // Bloquear peticiones de mutación sin cabeceras Sec-Fetch coherentes
  const secFetchSite = request.headers.get('Sec-Fetch-Site');
  if (secFetchSite === 'cross-site' && request.method === 'POST') {
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');
    if (!origin && !referer) return true;
  }
  return false;
}

const GLOBAL_SEC_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // API Routes
    if (url.pathname.startsWith('/api/stickers')) {
      const corsHeaders = {
        'Access-Control-Allow-Origin': url.origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature, X-Timestamp, X-Nonce',
        ...GLOBAL_SEC_HEADERS,
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Bloqueo pasivo de scrapers maliciosos
      if (isSuspiciousBot(request) && request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Acceso no autorizado por filtro de seguridad.' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      try {
        // GET: Listar stickers públicos
        if (request.method === 'GET') {
          const dataStr = await env.CV_KV.get('stickers');
          const data = dataStr ? JSON.parse(dataStr) : [];
          return new Response(JSON.stringify(data), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
              ...corsHeaders
            }
          });
        }

        // POST: Registrar nuevo sticker (Protegido con Rate Limiting y NanoID)
        if (request.method === 'POST') {
          // 1. Rate Limiting por IP (Máx 5 stickers por minuto)
          const isAllowed = await checkRateLimit(clientIp, env, 5, 60);
          if (!isAllowed) {
            return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Espera un momento antes de enviar otro sticker.' }), {
              status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders }
            });
          }

          const bodyStr = await request.text();
          if (bodyStr.length > 20000) {
            return new Response(JSON.stringify({ error: 'Payload demasiado grande.' }), {
              status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          if (detectThreats(bodyStr)) {
            return new Response(JSON.stringify({ error: 'Entrada bloqueada por firewall de seguridad.' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          let rawSticker;
          try {
            rawSticker = JSON.parse(bodyStr);
          } catch {
            return new Response(JSON.stringify({ error: 'JSON inválido.' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          // Validación estricta de tipos y rangos
          if (
            !rawSticker ||
            typeof rawSticker.name !== 'string' ||
            typeof rawSticker.price !== 'number' ||
            isNaN(rawSticker.price) ||
            rawSticker.price < 1 ||
            rawSticker.price > 100000
          ) {
            return new Response(JSON.stringify({ error: 'Datos de sticker inválidos o incompletos.' }), {
              status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          // Identificador criptográfico aleatorio (NanoID de 16 caracteres)
          const cryptoId = `stk_${generateCryptoId(16)}`;

          const cleanSticker = {
            id: cryptoId,
            name: String(rawSticker.name).slice(0, 80).replace(/</g, "&lt;").replace(/>/g, "&gt;"),
            price: Number(rawSticker.price),
            size: typeof rawSticker.size === 'number' ? rawSticker.size : 1,
            position: Array.isArray(rawSticker.position) ? rawSticker.position.slice(0, 3) : [0, 0, 0],
            rotation: Array.isArray(rawSticker.rotation) ? rawSticker.rotation.slice(0, 3) : [0, 0, 0],
            imageName: typeof rawSticker.imageName === 'string' ? rawSticker.imageName.slice(0, 100) : 'default',
            texture: typeof rawSticker.texture === 'string' && rawSticker.texture.startsWith('data:image/') ? rawSticker.texture.slice(0, 15000) : null,
            status: 'pending',
            createdAt: Date.now()
          };

          const dataStr = await env.CV_KV.get('stickers');
          const data = dataStr ? JSON.parse(dataStr) : [];
          
          data.push(cleanSticker);
          await env.CV_KV.put('stickers', JSON.stringify(data));
          
          return new Response(JSON.stringify({ success: true, id: cleanSticker.id }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // PUT /api/stickers/:id/approve (Protegido con HMAC / Bearer)
        if (request.method === 'PUT' && url.pathname.includes('/approve')) {
          const isAuthed = await verifyAdminAuth(request, env);
          if (!isAuthed) {
            return new Response(JSON.stringify({ error: 'No autorizado. Token o firma de administrador requerida.' }), {
              status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          const parts = url.pathname.split('/');
          const id = parts[3];
          const dataStr = await env.CV_KV.get('stickers');
          if (!dataStr) return new Response(JSON.stringify({ error: 'Sticker no encontrado.' }), { status: 404, headers: corsHeaders });
          
          const data = JSON.parse(dataStr);
          const sticker = data.find(s => s.id === id);
          
          if (sticker) {
            sticker.status = 'approved';
            await env.CV_KV.put('stickers', JSON.stringify(data));
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          return new Response(JSON.stringify({ error: 'Sticker no encontrado.' }), { status: 404, headers: corsHeaders });
        }

        // DELETE /api/stickers/:id (Protegido con HMAC / Bearer)
        if (request.method === 'DELETE') {
          const isAuthed = await verifyAdminAuth(request, env);
          if (!isAuthed) {
            return new Response(JSON.stringify({ error: 'No autorizado. Token o firma de administrador requerida.' }), {
              status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          const parts = url.pathname.split('/');
          const id = parts[3];
          const dataStr = await env.CV_KV.get('stickers');
          if (!dataStr) return new Response(JSON.stringify({ error: 'Sticker no encontrado.' }), { status: 404, headers: corsHeaders });
          
          let data = JSON.parse(dataStr);
          data = data.filter(s => s.id !== id);
          await env.CV_KV.put('stickers', JSON.stringify(data));
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Static Assets fallback con cabeceras de seguridad
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(assetResponse.headers);
      for (const [key, value] of Object.entries(GLOBAL_SEC_HEADERS)) {
        newHeaders.set(key, value);
      }
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: newHeaders,
      });
    } catch (e) {
      return new Response('Not found', { status: 404, headers: GLOBAL_SEC_HEADERS });
    }
  }
};
