/* ============================================================
   functions/go/[[key]].js — GET /go/:key
   Valida sessão (cookie OU fallback token via ?t=) e redireciona.

   Mapa atualizado:
   - Removidos: privacy-gratis, contos-exclusivos
   - Adicionado: fatal-fans
   - Honeypot (admin-883) removido por decisão do cliente
   ============================================================ */

const LINKS = {
  "previas-gratis": "https://t.me/+PpgYUi67ciNiYzU5",
  "privacy-vip":    "https://privacy.com.br/@Lucysafadinha",
  "fatal-fans":     "https://fatalfans.com/@Lucy",   // ⚠️ SUBSTITUIR PELA URL REAL
  "telegram-vip":   "https://t.me/Lucydopriv_bot"
};

const NO_STORE = { 'Cache-Control': 'no-store' };

/* ---------- Helpers ---------- */
function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, ...NO_STORE }
  });
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

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

/* ---------- Handler ---------- */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const key = params.key;
  const url = new URL(request.url);

  // ---------- Link válido? ----------
  const target = LINKS[key];
  if (!target) return text('Link inválido.', 404);
  if (!env.SECURITY_KV) return text('Servidor indisponível.', 500);

  const clientIp = request.headers.get('CF-Connecting-IP') || '';

  /* ============================================================
     Resolver sessão: primeiro pelo cookie, depois pelo fallback
     token (?t=token). O fallback garante funcionamento mesmo se o
     WebView descartar o cookie (Instagram iOS / storage particionado).
     ============================================================ */
  let sessionId = getCookie(request, 'lucy_session');
  const queryToken = url.searchParams.get('t');

  if (!sessionId && queryToken) {
    try {
      const raw = await env.SECURITY_KV.get(`token:${queryToken}`);
      if (raw) {
        const data = JSON.parse(raw);
        sessionId = data.sessionId || null;
      }
    } catch (e) { /* ignora */ }
  }

  // ---------- Validação da sessão ----------
  const sessionRaw = sessionId
    ? await env.SECURITY_KV.get(`session:${sessionId}`)
    : null;

  // Sessão expirada ou inexistente?
  if (!sessionRaw) {
    return text('Sessão expirada. Recarregue a página.', 403);
  }

  // IP binding tolerante (só compara se ambos os lados forem válidos)
  const sessionIp = extractIp(sessionRaw);
  if (sessionIp && clientIp && sessionIp !== clientIp) {
    return text('Sessão inválida para este IP.', 403);
  }

  // ---------- Tudo certo: redireciona ----------
  return redirect(target);
}
