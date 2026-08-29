// src/worker.js - Blindaje de Seguridad Integral 0.001%

const SQL_INJECTION_PATTERNS = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(--|\/\*|\*\/)/i];
const XSS_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/i, /onerror=/i, /onload=/i];

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

function verifyAdminAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const adminSecret = env.ADMIN_SECRET_TOKEN || env.ADMIN_SECRET || 'cv3d_admin_secret_key_2026';
  return safeCompare(token, adminSecret);
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
    
    // API Routes
    if (url.pathname.startsWith('/api/stickers')) {
      const corsHeaders = {
        'Access-Control-Allow-Origin': url.origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        ...GLOBAL_SEC_HEADERS,
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      try {
        // GET: Listar stickers
        if (request.method === 'GET') {
          const dataStr = await env.CV_KV.get('stickers');
          const data = dataStr ? JSON.parse(dataStr) : [];
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // POST: Registrar nuevo sticker (Público con validación estricta)
        if (request.method === 'POST') {
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

          // Validación estricta de esquema y tipos
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

          const cleanSticker = {
            id: String(rawSticker.id || Date.now()),
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

        // PUT /api/stickers/:id/approve (Protegido con Token)
        if (request.method === 'PUT' && url.pathname.includes('/approve')) {
          if (!verifyAdminAuth(request, env)) {
            return new Response(JSON.stringify({ error: 'No autorizado. Token de administrador requerido.' }), {
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

        // DELETE /api/stickers/:id (Protegido con Token)
        if (request.method === 'DELETE') {
          if (!verifyAdminAuth(request, env)) {
            return new Response(JSON.stringify({ error: 'No autorizado. Token de administrador requerido.' }), {
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
