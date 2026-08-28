// functions/api/stickers/[id]/approve.js

export async function onRequestPut(context) {
  try {
    const id = context.params.id;
    const dataStr = await context.env.CV_KV.get('stickers');
    if (!dataStr) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    
    const data = JSON.parse(dataStr);
    const sticker = data.find(s => s.id === id);
    
    if (sticker) {
      sticker.status = 'approved';
      await context.env.CV_KV.put('stickers', JSON.stringify(data));
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
