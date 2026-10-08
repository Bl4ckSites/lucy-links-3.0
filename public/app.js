(function() {
  const statusMsg = document.getElementById('status-msg');
  const cards = document.querySelectorAll('.link-card:not(.honeypot)');
  const honeypot = document.querySelector('.honeypot');
  let sessionActive = false;
  const loadTime = Date.now();

  window.onTurnstileSuccess = async function(token) {
    if (sessionActive) return;
    showStatus('Verificando acesso...');
    
    try {
      const res = await fetch('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (res.ok) {
        sessionActive = true;
        cards.forEach(card => {
          card.disabled = false;
          card.style.opacity = '1';
          card.style.filter = 'none';
        });
        showStatus('Acesso liberado!', true);
        document.getElementById('verification-container').style.display = 'none';
      } else {
        showStatus('Falha na verificação. Tente novamente.');
        if (window.turnstile) window.turnstile.reset();
      }
    } catch (err) {
      showStatus('Erro de conexão. Recarregue a página.');
      if (window.turnstile) window.turnstile.reset();
    }
  };

  function handleCardClick(e) {
    if (Date.now() - loadTime < 800) { e.preventDefault(); return; } // Anti-bot
    if (!sessionActive) { e.preventDefault(); showStatus('Complete a verificação primeiro.'); return; }
    
    const key = e.currentTarget.getAttribute('data-key');
    if (key) {
      showStatus('Redirecionando...');
      window.location.href = `/go/${key}`;
    }
  }

  cards.forEach(card => card.addEventListener('click', handleCardClick));

  if (honeypot) {
    honeypot.addEventListener('click', () => { fetch('/go/admin-883').catch(() => {}); });
  }

  function showStatus(msg, success = false) {
    statusMsg.textContent = msg;
    statusMsg.style.opacity = '1';
    statusMsg.style.color = success ? '#2E7D32' : '#E94B00';
  }
})();