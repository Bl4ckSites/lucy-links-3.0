// MAPA DE LINKS - URLs Reais
const LINKS = {
  "fatal-fans": "https://t.me/+PpgYUi67ciNiYzU5",
  "chat-privado": "https://privacy.com.br/@Lucylimagratis",
  "grupo-vip": "https://t.me/Lucydopriv_bot",
  "conteudo-premium": "https://privacy.com.br/@Lucysafadinha"
};

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const key = params.key;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(request.url);

  // 1. Honeypot Check
  if (key === 'admin-883') {
    await env.SECURITY_KV.put(`ban:${ip}`, 'true', { expirationTtl: 86400 });
    return new Response('Forbidden', { status: 403 });
  }

  // 2. Ban Check
  const isBanned = await env.SECURITY_KV.get(`ban:${ip}`);
  if (isBanned) {
    return new Response('Forbidden', { status: 403 });
  }

  // 3. Session Validation - USANDO lucy_session (consistente!)
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/lucy_session=([^;]+)/);
  
  if (!match) {
    console.log('[DEBUG] Cookie não encontrado');
    return Response.redirect(url.origin, 302);
  }

  const sessionToken = match[1];
  const sessionIp = await env.SECURITY_KV.get(`session:${sessionToken}`);

  if (!sessionIp || sessionIp !== ip) {
    console.log('[DEBUG] Sessão inválida ou IP diferente');
    return Response.redirect(url.origin, 302);
  }

  // 4. Redirect
  const finalUrl = LINKS[key];
  if (finalUrl) {
    console.log(`[DEBUG] Redirecionando ${key} -> ${finalUrl}`);
    return Response.redirect(finalUrl, 302);
  }

  console.log(`[DEBUG] Chave não encontrada: ${key}`);
  return new Response('Not Found', { status: 404 });
}
