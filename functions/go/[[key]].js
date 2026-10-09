// MAPA DE LINKS - URLs Reais
const LINKS = {
  "fatal-fans": "https://t.me/+PpgYUi67ciNiYzU5",
  "chat-privado": "https://privacy.com.br/@Lucylimagratis",
  "grupo-vip": "https://t.me/Lucydopriv_bot",
  "conteudo-premium": "https://privacy.com.br/@Lucysafadinha"
};

const HONEYPOT_KEY = 'admin-883';
const NO_STORE = { 'Cache-Control': 'no-store' };

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...NO_STORE }
  });
}

function text(body, status) {
  return new Response(body, { status, headers: NO_STORE });
}

// Aceita tanto IP cru (formato antigo) quanto JSON {ip, createdAt, expiresAt}
function extractIp(raw) {
  if (!raw) return null;
  if (raw.charCodeAt(0) === 123 /* { */) {
    try { return JSON.parse(raw).ip || null; } catch { return null; }
  }
  return raw;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const key = params.key;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 1. Honeypot Check — ban gravado em background, resposta imediata
  if (key === HONEYPOT_KEY) {
    context.waitUntil(
      env.SECURITY_KV.put(`ban:${ip}`, 'true', { expirationTtl: 86400 })
    );
    return text('Forbidden', 403);
  }

  // 2. Cookie parse (sync, sem KV)
  const cookieHeader = request.headers.get('Cookie');
  const match = cookieHeader ? cookieHeader.match(/lucy_session=([^;]+)/) : null;
  const sessionToken = match ? match[1] : null;

  // 3. Ban + Session em PARALELO (uma latência só)
  const [isBanned, sessionRaw] = await Promise.all([
    env.SECURITY_KV.get(`ban:${ip}`),
    sessionToken
      ? env.SECURITY_KV.get(`session:${sessionToken}`)
      : Promise.resolve(null)
  ]);

  // 4. Ban Check
  if (isBanned) {
    return text('Forbidden', 403);
  }

  // 5. Session Validation
  if (!sessionToken || !sessionRaw) {
    console.log('[DEBUG] Cookie ou sessão ausente');
    return redirect('/');
  }

  const sessionIp = extractIp(sessionRaw);
  // Só faz binding de IP se ambos forem válidos (não bloqueia quando CF não manda IP)
  if (sessionIp && ip !== 'unknown' && sessionIp !== ip) {
    console.log('[DEBUG] IP diferente da sessão');
    return redirect('/');
  }

  // 6. Redirect
  const finalUrl = LINKS[key];
  if (finalUrl) {
    console.log(`[DEBUG] Redirecionando ${key}`);
    return redirect(finalUrl);
  }

  console.log(`[DEBUG] Chave não encontrada: ${key}`);
  return text('Not Found', 404);
}
