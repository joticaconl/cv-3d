// functions/api/stickers/[id]/index.js

export async function onRequestDelete(context) {
  try {
    const id = context.params.id;
    const dataStr = await context.env.CV_KV.get('stickers');
    if (!dataStr) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    
    let data = JSON.parse(dataStr);
    data = data.filter(s => s.id !== id);
    
    await context.env.CV_KV.put('stickers', JSON.stringify(data));
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
