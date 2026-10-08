// DICIONÁRIO DE LINKS (Nomes codificados -> URLs Reais)
const LINKS = {
  "fatal-fans": "https://t.me/+PpgYUi67ciNiYzU5",       // Card 1: Prévias/Telegram
  "chat-privado": "https://privacy.com.br/@Lucylimagratis", // Card 2: Chat Grátis
  "grupo-vip": "https://t.me/Lucydopriv_bot",             // Card 3: Telegram Bot
  "conteudo-premium": "https://privacy.com.br/@Lucysafadinha" // Card 4: VIP
};

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const key = params.key;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(request.url);

  // 1. Honeypot Check (Bane o IP se tentar acessar a isca)
  if (key === 'admin-883') {
    await env.SECURITY_KV.put(`ban:${ip}`, 'true', { expirationTtl: 86400 });
    return new Response('Forbidden', { status: 403 });
  }

  // 2. Ban Check
  const isBanned = await env.SECURITY_KV.get(`ban:${ip}`);
  if (isBanned) return new Response('Forbidden', { status: 403 });

  // 3. Session Validation (Verifica o cookie)
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/kerolay_session=([^;]+)/);
  
  if (!match) return Response.redirect(url.origin, 302);

  const sessionToken = match[1];
  const sessionIp = await env.SECURITY_KV.get(`session:${sessionToken}`);

  // Valida se a sessão existe e se o IP é o mesmo (anti-roubo de cookie)
  if (!sessionIp || sessionIp !== ip) return Response.redirect(url.origin, 302);

  // 4. Redirect
  const finalUrl = LINKS[key];
  if (finalUrl) {
    return Response.redirect(finalUrl, 302);
  }

  return new Response('Not Found', { status: 404 });
}