/* ============================================================
   functions/verify.js — POST /verify
   Valida token do Turnstile, cria sessão no KV, retorna cookie
   + fallback_token no body.
   Correções: SameSite=None (P4) + fallback_token.
   ============================================================ */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SESSION_TTL_SECONDS = 600; // 10 minutos
const TURNSTILE_TIMEOUT_MS = 3000;

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

export async function onRequestPost(context) {
  const { request, env } = context;

  // ---------- Configuração ----------
  if (!env.TURNSTILE_SECRET || !env.SECURITY_KV) {
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

  // ---------- Gera sessão + fallback token ----------
  const sessionId = crypto.randomUUID();
  const fallbackToken = crypto.randomUUID();

  await env.SECURITY_KV.put(
    `session:${sessionId}`,
    JSON.stringify({ ip: clientIp, ts: Date.now() }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  await env.SECURITY_KV.put(
    `token:${fallbackToken}`,
    JSON.stringify({ ip: clientIp, sessionId, ts: Date.now() }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  /* ============================================================
     ✅ FIX P4 — SameSite=None; Secure
     Alguns WebViews (Instagram iOS especialmente) tratam o contexto
     de fetch em link-in-app como "cross-site" e DESCARTAM cookies
     SameSite=Lax. SameSite=None é aceito nesses casos. Obrigatório
     o atributo Secure (já presente).
     ============================================================ */
  const setCookie =
    `lucy_session=${sessionId}; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=None; ` +
    `Max-Age=${SESSION_TTL_SECONDS}; ` +
    `Path=/`;

  return jsonResponse(
    { ok: true, fallback_token: fallbackToken },
    200,
    { 'Set-Cookie': setCookie }
  );
}
