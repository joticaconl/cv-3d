// functions/api/stickers/index.js

const SQL_INJECTION_PATTERNS = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)|(--|\/\*|\*\/)/i];
const XSS_PATTERNS = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript:/i, /onerror=/i, /onload=/i];

function detectThreats(payload) {
  const hasSQLi = SQL_INJECTION_PATTERNS.some(regex => regex.test(payload));
  const hasXSS = XSS_PATTERNS.some(regex => regex.test(payload));
  return hasSQLi || hasXSS;
}

export async function onRequestGet(context) {
  try {
    const dataStr = await context.env.CV_KV.get('stickers');
    const data = dataStr ? JSON.parse(dataStr) : [];
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const bodyStr = await context.request.text();
    
    // Security check
    if (detectThreats(bodyStr)) {
      return new Response(JSON.stringify({ error: 'Invalid input detected by security firewall.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const newSticker = JSON.parse(bodyStr);
    
    // Sanitize basic tags just in case
    newSticker.name = newSticker.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if(newSticker.imageName) newSticker.imageName = newSticker.imageName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const dataStr = await context.env.CV_KV.get('stickers');
    const data = dataStr ? JSON.parse(dataStr) : [];
    
    data.push(newSticker);
    
    await context.env.CV_KV.put('stickers', JSON.stringify(data));
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
