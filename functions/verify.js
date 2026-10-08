const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    const { token } = await request.json();
    if (!token) return new Response('Token ausente', { status: 400 });

    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const verifyRes = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: formData });
    const data = await verifyRes.json();

    if (data.success) {
      const sessionToken = crypto.randomUUID();
      // Sessão válida por 30 minutos
      await env.SECURITY_KV.put(`session:${sessionToken}`, ip, { expirationTtl: 1800 });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `kerolay_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=1800; Path=/`
        }
      });
    }

    return new Response(JSON.stringify({ success: false }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response('Erro interno', { status: 500 });
  }
}