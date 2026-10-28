const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SESSION_TTL_SECONDS = 600; // 10 minutos
const TURNSTILE_TIMEOUT_MS = 3000;

// 🔐 Chave secreta para assinar cookies (use uma string aleatória de 32+ chars)
// Adicione como variável secreta: wrangler secret put COOKIE_SECRET
const COOKIE_SECRET = 'sua-chave-secreta-aqui-mude-isso';

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

// Função simples de hash (para produção use algo mais seguro)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // ---------- Configuração ----------
  if (!env.TURNSTILE_SECRET) {
    return jsonResponse({ ok: false, error: 'server_not_configured' }, 500);
  }

  // ---------- Parse do body ----------
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const token = body && body.token;

  // ---------- Validação do token ----------
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
    return jsonResponse({ ok: false, error: 'invalid_token' }, 400);
  }

  // ---------- Valida com a API do Turnstile (com timeout) ----------
  const clientIp = request.headers.get('CF-Connecting-IP') || '';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

  let turnstileData;
  try {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', token);
    if (clientIp) form.append('remoteip', clientIp);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal
    });
    turnstileData = await res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    return jsonResponse({ ok: false, error: 'turnstile_unreachable' }, 503);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!turnstileData || !turnstileData.success) {
    return jsonResponse({ ok: false, error: 'turnstile_failed' }, 403);
  }

  // ---------- Gera cookie assinado (SEM KV) ----------
  const sessionId = crypto.randomUUID();
  const timestamp = Date.now();
  
  // Cria assinatura simples
  const signature = simpleHash(`${sessionId}:${timestamp}:${COOKIE_SECRET}`);
  const cookieValue = `${sessionId}:${timestamp}:${signature}`;

  /* ============================================================
     ✅ FIX P4 — SameSite=None; Secure
     ============================================================ */
  const setCookie =
    `lucy_session=${cookieValue}; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=None; ` +
    `Max-Age=${SESSION_TTL_SECONDS}; ` +
    `Path=/`;

  // ✅ SEM OPERAÇÕES PUT NO KV!
  return jsonResponse(
    { ok: true },
    200,
    { 'Set-Cookie': setCookie }
  );
}
