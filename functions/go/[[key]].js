// MAPA DE LINKS — Chaves alinhadas com o index.html (Spec Técnica Seção 23)
const LINKS = {
  "previas-gratis": "https://t.me/+PpgYUi67ciNiYzU5",
  "privacy-gratis": "https://privacy.com.br/@Lucylimagratis",
  "privacy-vip": "https://privacy.com.br/@Lucysafadinha",
  "telegram-vip": "https://t.me/Lucydopriv_bot",
  "contos-exclusivos": "https://www.casadoscontos.com.br/perfil/308907"
};

const HONEYPOT_KEY = 'admin-883';
const NO_STORE = { 'Cache-Control': 'no-store' };

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, ...NO_STORE } });
}

function text(body, status) {
  return new Response(body, { status, headers: NO_STORE });
}

function extractIp(raw) {
  if (!raw) return null;
  if (raw.charCodeAt(0) === 123) {
    try { return JSON.parse(raw).ip || null; } catch { return null; }
  }
  return raw;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const key = params.key;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 1. Honeypot Check (Background)
  if (key === HONEYPOT_KEY) {
    context.waitUntil(env.SECURITY_KV.put(`ban:${ip}`, 'true', { expirationTtl: 86400 }));
    return text('Forbidden', 403);
  }

  // 2. Cookie parse
  const cookieHeader = request.headers.get('Cookie');
  const match = cookieHeader ? cookieHeader.match(/lucy_session=([^;]+)/) : null;
  const sessionToken = match ? match[1] : null;

  // 3. Leitura em PARALELO (Máxima velocidade)
  const [isBanned, sessionRaw] = await Promise.all([
    env.SECURITY_KV.get(`ban:${ip}`),
    sessionToken ? env.SECURITY_KV.get(`session:${sessionToken}`) : Promise.resolve(null)
  ]);

  // 4. Validações
  if (isBanned) return text('Forbidden', 403);
  if (!sessionToken || !sessionRaw) return redirect('/');

  const sessionIp = extractIp(sessionRaw);
  if (sessionIp && ip !== 'unknown' && sessionIp !== ip) return redirect('/');

  // 5. Redirect
  const finalUrl = LINKS[key];
  if (finalUrl) {
    console.log(`[DEBUG] Redirecionando ${key} -> ${finalUrl}`);
    return redirect(finalUrl);
  }

  console.log(`[DEBUG] Chave não encontrada: ${key}`);
  return text('Not Found', 404);
}
