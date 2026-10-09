// DICIONÁRIO DE LINKS (Nomes codificados -> URLs Reais)
// ATENÇÃO: As chaves aqui devem ser IDÊNTICAS aos data-key do index.html
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

  // ---------------------------------------------------------
  // 1. RATE LIMITING (Proteção contra spam de requisições)
  // ---------------------------------------------------------
  const rlKey = `rl:${ip}`;
  const currentAttempts = await env.SECURITY_KV.get(rlKey);
  const attempts = currentAttempts ? parseInt(currentAttempts) : 0;

  if (attempts >= 15) { // Bloqueia após 15 tentativas
    await env.SECURITY_KV.put(`ban:${ip}`, 'true', { expirationTtl: 3600 }); // Ban por 1 hora
    return new Response('Too Many Requests', { status: 429 });
  }
  
  // Registra a tentativa (expira em 60 segundos)
  await env.SECURITY_KV.put(rlKey, (attempts + 1).toString(), { expirationTtl: 60 });

  // ---------------------------------------------------------
  // 2. HONEYPOT CHECK (Isca para bots)
  // ---------------------------------------------------------
  if (key === 'admin-883') {
    await env.SECURITY_KV.put(`ban:${ip}`, 'true', { expirationTtl: 86400 }); // Ban por 24h
    return new Response('Forbidden', { status: 403 });
  }

  // ---------------------------------------------------------
  // 3. BAN CHECK (Verifica se o IP já foi banido)
  // ---------------------------------------------------------
  const isBanned = await env.SECURITY_KV.get(`ban:${ip}`);
  if (isBanned) return new Response('Forbidden', { status: 403 });

  // ---------------------------------------------------------
  // 4. SESSION VALIDATION (Verifica o cookie de autorização)
  // ---------------------------------------------------------
  const cookie = request.headers.get('Cookie') || '';
  // Nota: Certifique-se de que o verify.js também usa 'lucy_session'
  const match = cookie.match(/lucy_session=([^;]+)/);
  
  if (!match) {
    return Response.redirect(url.origin, 302); // Sem cookie, volta para o início
  }

  const sessionToken = match[1];
  const sessionIp = await env.SECURITY_KV.get(`session:${sessionToken}`);

  // Valida se a sessão existe e se o IP é o mesmo (anti-roubo de cookie)
  if (!sessionIp || sessionIp !== ip) {
    return Response.redirect(url.origin, 302);
  }

  // ---------------------------------------------------------
  // 5. REDIRECT (Libera o acesso ao link real)
  // ---------------------------------------------------------
  const finalUrl = LINKS[key];
  if (finalUrl) {
    // Opcional: Limpar o contador de rate limit após sucesso
    await env.SECURITY_KV.delete(rlKey);
    return Response.redirect(finalUrl, 302);
  }

  return new Response('Not Found', { status: 404 });
}
