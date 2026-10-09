const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Sessão longa: usuário não precisa revalidar Turnstile toda vez que volta
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const TURNSTILE_TIMEOUT_MS = 5000;

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
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Verificação de configuração antes de qualquer trabalho
  if (!env.TURNSTILE_SECRET) {
    console.error('TURNSTILE_SECRET ausente no ambiente');
    return jsonResponse({ success: false, error: 'server_misconfigured' }, 500);
  }

  if (!env.SECURITY_KV) {
    console.error('SECURITY_KV ausente no ambiente');
    return jsonResponse({ success: false, error: 'server_misconfigured' }, 500);
  }

  let token;
  try {
    const body = await request.json();
    token = body?.token;
  } catch {
    return jsonResponse({ success: false, error: 'invalid_body' }, 400);
  }

  if (!token || typeof token !== 'string' || token.length > 4096) {
    return jsonResponse({ success: false, error: 'missing_token' }, 400);
  }

  // Validação no Turnstile com timeout (evita request travado)
  let data;
  try {
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET);
    formData.append('response', token);
    if (ip !== 'unknown') formData.append('remoteip', ip);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

    const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    data = await verifyRes.json();
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    console.error('turnstile_verify_failed', isAbort ? 'timeout' : err?.message);
    return jsonResponse(
      { success: false, error: isAbort ? 'verify_timeout' : 'verify_unavailable' },
      503
    );
  }

  if (!data || data.success !== true) {
    return jsonResponse(
      {
        success: false,
        error: 'invalid_token',
        codes: data?.['error-codes'] || []
      },
      403
    );
  }

  // Token válido: cria sessão persistente no KV
  try {
    const sessionToken = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Guarda contexto útil para debug e para regras futuras no /go/:key
    await env.SECURITY_KV.put(
      `session:${sessionToken}`,
      JSON.stringify({
        ip,
        createdAt: now,
        expiresAt: now + SESSION_TTL_SECONDS
      }),
      { expirationTtl: SESSION_TTL_SECONDS }
    );

    return jsonResponse(
      {
        success: true,
        expiresIn: SESSION_TTL_SECONDS,
        exp: now + SESSION_TTL_SECONDS
      },
      200,
      {
        // Max-Age alinhado com o TTL do KV: quando o cookie expira, o KV também já expirou
        'Set-Cookie': `lucy_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}; Path=/`
      }
    );
  } catch (err) {
    console.error('session_store_failed', err?.message);
    return jsonResponse({ success: false, error: 'session_error' }, 500);
  }
}
