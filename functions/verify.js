const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SESSION_TTL_SECONDS = 600; // 10 minutos
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

// Gera ID único simples
function generateSessionId() {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `${random}${timestamp}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.TURNSTILE_SECRET) {
    return jsonResponse({ ok: false, error: 'server_not_configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const token = body && body.token;

  if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
    return jsonResponse({ ok: false, error: 'invalid_token' }, 400);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || '';
  
  // Valida com Turnstile
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

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
    
    clearTimeout(timeoutId);
    const turnstileData = await res.json();

    if (!turnstileData || !turnstileData.success) {
      console.error('Turnstile failed:', turnstileData);
      return jsonResponse({ ok: false, error: 'turnstile_failed' }, 403);
    }

    // Gera IDs únicos
    const sessionId = generateSessionId();
    const fallbackToken = generateSessionId();
    const timestamp = Date.now();

    // Cria cookie de sessão (SEM KV - dados embutidos no cookie)
    const cookieValue = `${sessionId}:${timestamp}`;
    
    // Detecta se é HTTPS ou HTTP para o atributo Secure
    const isHttps = request.headers.get('x-forwarded-proto') === 'https' || 
                    request.url.startsWith('https://');
    
    const cookieAttrs = [
      `lucy_session=${cookieValue}`,
      'HttpOnly',
      isHttps ? 'Secure' : null,
      'SameSite=None',
      `Max-Age=${SESSION_TTL_SECONDS}`,
      'Path=/'
    ].filter(Boolean).join('; ');

    // Cria fallback token (também sem KV - apenas um ID único)
    const fallbackCookieValue = `${fallbackToken}:${timestamp}:${sessionId}`;
    const fallbackCookieAttrs = [
      `lucy_fallback=${fallbackCookieValue}`,
      'HttpOnly',
      isHttps ? 'Secure' : null,
      'SameSite=None',
      `Max-Age=${SESSION_TTL_SECONDS}`,
      'Path=/'
    ].filter(Boolean).join('; ');

    console.log('✅ Sessão criada:', sessionId, 'IP:', clientIp, 'HTTPS:', isHttps);

    // Retorna JSON com fallback_token (o app.js espera isso!)
    return jsonResponse(
      { 
        ok: true,
        fallback_token: fallbackToken,
        session_id: sessionId
      },
      200,
      { 
        'Set-Cookie': [cookieAttrs, fallbackCookieAttrs].join(', ')
      }
    );

  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Erro na validação:', e);
    return jsonResponse({ ok: false, error: 'validation_error' }, 500);
  }
}
