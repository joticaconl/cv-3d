// src/worker.js

const SQL_INJECTION_PATTERNS = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(--|\/\*|\*\/)/i];
const XSS_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/i, /onerror=/i, /onload=/i];

function detectThreats(payload) {
  const hasSQLi = SQL_INJECTION_PATTERNS.some(regex => regex.test(payload));
  const hasXSS = XSS_PATTERNS.some(regex => regex.test(payload));
  return hasSQLi || hasXSS;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API Routes
    if (url.pathname.startsWith('/api/stickers')) {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      try {
        if (request.method === 'GET') {
          const dataStr = await env.CV_KV.get('stickers');
          const data = dataStr ? JSON.parse(dataStr) : [];
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (request.method === 'POST') {
          const bodyStr = await request.text();
          if (detectThreats(bodyStr)) {
            return new Response(JSON.stringify({ error: 'Invalid input detected by security firewall.' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }

          const newSticker = JSON.parse(bodyStr);
          if (newSticker.name) newSticker.name = newSticker.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          if (newSticker.imageName) newSticker.imageName = newSticker.imageName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

          const dataStr = await env.CV_KV.get('stickers');
          const data = dataStr ? JSON.parse(dataStr) : [];
          
          data.push(newSticker);
          await env.CV_KV.put('stickers', JSON.stringify(data));
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        if (request.method === 'PUT' && url.pathname.includes('/approve')) {
          const id = url.pathname.split('/')[3];
          const dataStr = await env.CV_KV.get('stickers');
          if (!dataStr) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
          
          const data = JSON.parse(dataStr);
          const sticker = data.find(s => s.id === id);
          
          if (sticker) {
            sticker.status = 'approved';
            await env.CV_KV.put('stickers', JSON.stringify(data));
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
        }

        if (request.method === 'DELETE') {
          const id = url.pathname.split('/')[3];
          const dataStr = await env.CV_KV.get('stickers');
          if (!dataStr) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
          
          let data = JSON.parse(dataStr);
          data = data.filter(s => s.id !== id);
          await env.CV_KV.put('stickers', JSON.stringify(data));
          
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Static Assets fallback is handled automatically by Workers if `assets` is defined in wrangler.jsonc.
    return new Response('Not found', { status: 404 });
  }
};
