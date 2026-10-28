const LINKS = {
  "previas-gratis": "https://t.me/+PpgYUi67ciNiYzU5",
  "privacy-vip":    "https://privacy.com.br/@Lucysafadinha",
  "fatal-fans":     "https://fatalfans.com/lucysafadinha",
  "telegram-vip":   "https://t.me/Lucydopriv_bot"
};

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

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

function validateSession(sessionValue, fallbackValue) {
  // Tenta validar pelo cookie de sessão principal
  if (sessionValue) {
    const parts = sessionValue.split(':');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1]);
      const age = Date.now() - timestamp;
      
      // Válida por 10 minutos (600000ms)
      if (age <= 600000) {
        console.log('✅ Sessão válida (cookie principal). Idade:', age, 'ms');
        return true;
      } else {
        console.log('⚠️ Sessão expirada (cookie principal). Idade:', age, 'ms');
      }
    }
  }

  // Fallback: valida pelo token via query param
  if (fallbackValue) {
    const parts = fallbackValue.split(':');
    if (parts.length >= 3) {
      const timestamp = parseInt(parts[1]);
      const age = Date.now() - timestamp;
      
      if (age <= 600000) {
        console.log('✅ Sessão válida (fallback token). Idade:', age, 'ms');
        return true;
      } else {
        console.log('⚠️ Fallback token expirado. Idade:', age, 'ms');
      }
    }
  }

  console.log('❌ Nenhuma sessão válida encontrada');
  return false;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const key = params.key;
  const url = new URL(request.url);

  const target = LINKS[key];
  if (!target) {
    console.log('❌ Link inválido:', key);
    return text('Link inválido.', 404);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') || '';
  
  // Pega cookies
  const sessionCookie = getCookie(request, 'lucy_session');
  const fallbackCookie = getCookie(request, 'lucy_fallback');
  
  // Pega fallback token via query param (?t=)
  const queryToken = url.searchParams.get('t');

  console.log('🔍 Validando acesso:', {
    key,
    ip: clientIp,
    hasSessionCookie: !!sessionCookie,
    hasFallbackCookie: !!fallbackCookie,
    hasQueryToken: !!queryToken,
    url: url.toString()
  });

  // Tenta validar (cookie OU fallback)
  const isValid = validateSession(sessionCookie || fallbackCookie, queryToken);

  if (!isValid) {
    console.log(' Acesso negado - sem sessão válida');
    return text('Sessão expirada. Recarregue a página.', 403);
  }

  console.log('✅ Redirecionando para:', target);
  return redirect(target);
}
