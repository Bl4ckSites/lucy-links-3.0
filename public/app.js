/* ============================================================
   LUCY LINKS — app.js (v3)
   Correções aplicadas:
   - P1: try/catch em sessionStorage (evita crash no WebView Instagram)
   - P2: credentials: 'include' no fetch (garante envio/recebimento de cookie)
   - P3: processa token pendente caso Turnstile resolva antes do app.js
   - Extra: fallback token via ?t= caso cookie seja descartado
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Referências DOM ---------- */
  const statusMsg = document.getElementById('status-msg');
  const cards = document.querySelectorAll('.link-card:not(.honeypot)');
  const honeypot = document.querySelector('.honeypot');
  const verificationContainer = document.getElementById('verification-container');

  /* ============================================================
     FIX P1 — Storage seguro
     WebViews do Instagram (SFSafariViewController / Chrome Custom Tabs)
     podem lançar SecurityError ao acessar sessionStorage. Isso mataria
     o IIFE inteiro silenciosamente. Fallback em memória resolve.
     ============================================================ */
  const memStore = {};
  const safeStorage = {
    get(k) {
      try { return sessionStorage.getItem(k); }
      catch (e) { return memStore[k] != null ? memStore[k] : null; }
    },
    set(k, v) {
      try { sessionStorage.setItem(k, v); }
      catch (e) { memStore[k] = v; }
    }
  };

  /* ---------- Helpers ---------- */
  function setStatus(text, color) {
    if (!statusMsg) return;
    statusMsg.textContent = text;
    statusMsg.style.opacity = '1';
    statusMsg.style.color = color || '#E94B00';
  }

  function enableButtons() {
    cards.forEach(card => {
      card.disabled = false;
      card.removeAttribute('disabled');
      card.removeAttribute('aria-disabled');
      card.style.opacity = '1';
      card.style.filter = 'none';
      card.style.cursor = 'pointer';
    });
  }

  function hideVerification() {
    if (verificationContainer) verificationContainer.style.display = 'none';
  }

  /* ---------- Estado inicial ---------- */
  if (safeStorage.get('lucy_verified') === 'true') {
    enableButtons();
    hideVerification();
  }

  /* ============================================================
     Callback do Turnstile (sobrescreve o stub definido no index.html)
     ============================================================ */
  window.onTurnstileSuccess = async function (token) {
    // Já verificado nesta sessão? Ignora.
    if (safeStorage.get('lucy_verified') === 'true') return;

    setStatus('Liberando acesso...', '#E94B00');

    // Libera botões IMEDIATAMENTE (não espera rede) — UX instantânea
    enableButtons();
    safeStorage.set('lucy_verified', 'true');
    setStatus('Acesso liberado por 10 minutos!', '#2E7D32');
    setTimeout(hideVerification, 500);

    try {
      /* ============================================================
         FIX P2 — credentials: 'include'
         Garante que o WebView processe o Set-Cookie da resposta,
         mesmo em contextos restritos de storage particionado.
         ============================================================ */
      const res = await fetch('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token })
      });

      if (res.ok) {
        // Guarda o fallback_token (usado no clique caso cookie seja descartado)
        try {
          const data = await res.clone().json();
          if (data && data.fallback_token) {
            safeStorage.set('lucy_token', data.fallback_token);
            window.__lucyToken = data.fallback_token;
          }
        } catch (e) { /* resposta sem JSON, tudo bem */ }
      } else {
        setStatus('Falha na verificação. Tente novamente.', '#E94B00');
        if (window.turnstile) window.turnstile.reset();
      }
    } catch (err) {
      // Não bloqueia UX: botões já estão liberados
      setStatus('Erro de rede. Recarregue se o clique falhar.', '#E94B00');
    }
  };

  /* ============================================================
     FIX P3 — Processa token pendente
     Se o Turnstile resolveu ANTES do app.js carregar, o stub do
     index.html guardou o token em window.__lucyTurnstilePending.
     Aqui processamos ele com a implementação real.
     ============================================================ */
  if (window.__lucyTurnstilePending) {
    const pending = window.__lucyTurnstilePending;
    window.__lucyTurnstilePending = null;
    window.onTurnstileSuccess(pending);
  }

  /* ---------- Clique nos cards ---------- */
  function handleCardClick(e) {
    if (safeStorage.get('lucy_verified') !== 'true') {
      e.preventDefault();
      setStatus('Complete a verificação primeiro.', '#E94B00');
      if (verificationContainer) {
        verificationContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const key = e.currentTarget.getAttribute('data-key');
    if (!key) return;

    setStatus('Redirecionando...', '#E94B00');

    // Monta URL. Se temos fallback token, envia via query (?t=)
    // Isso contorna o descarte do cookie pelo WebView.
    let url = '/go/' + encodeURIComponent(key);
    const tk = window.__lucyToken || safeStorage.get('lucy_token');
    if (tk) {
      url += '?t=' + encodeURIComponent(tk);
    }

    window.location.href = url;
  }

  cards.forEach(card => card.addEventListener('click', handleCardClick));

  /* ---------- Honeypot ---------- */
  if (honeypot) {
    honeypot.addEventListener('click', () => {
      fetch('/go/admin-883', { credentials: 'include' }).catch(() => {});
    });
  }

})();
