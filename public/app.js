(function() {
  const statusMsg = document.getElementById('status-msg');
  const cards = document.querySelectorAll('.link-card:not(.honeypot)');
  const honeypot = document.querySelector('.honeypot');
  const verificationContainer = document.getElementById('verification-container');

  // 1. VERIFICAÇÃO DE MEMÓRIA: O usuário já verificou nesta aba?
  const alreadyVerified = sessionStorage.getItem('lucy_verified') === 'true';

  if (alreadyVerified) {
    enableButtons();
    if (verificationContainer) verificationContainer.style.display = 'none';
  }

  window.onTurnstileSuccess = async function(token) {
    if (sessionStorage.getItem('lucy_verified') === 'true') return;
    
    statusMsg.textContent = 'Liberando acesso...';
    statusMsg.style.opacity = '1';
    statusMsg.style.color = '#E94B00';

    try {
      const res = await fetch('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (res.ok) {
        sessionStorage.setItem('lucy_verified', 'true');
        enableButtons();
        
        statusMsg.textContent = 'Acesso liberado por 10 minutos!';
        statusMsg.style.color = '#2E7D32';
        
        setTimeout(() => {
          if (verificationContainer) verificationContainer.style.display = 'none';
        }, 500);
        
      } else {
        statusMsg.textContent = 'Falha na verificação. Tente novamente.';
        if (window.turnstile) window.turnstile.reset();
      }
    } catch (err) {
      statusMsg.textContent = 'Erro de conexão. Recarregue a página.';
      if (window.turnstile) window.turnstile.reset();
    }
  };

  function enableButtons() {
    cards.forEach(card => {
      card.disabled = false;
      card.style.opacity = '1';
      card.style.filter = 'none';
      card.style.cursor = 'pointer';
    });
  }

  function handleCardClick(e) {
    if (sessionStorage.getItem('lucy_verified') !== 'true') {
      e.preventDefault();
      statusMsg.textContent = 'Complete a verificação primeiro.';
      statusMsg.style.opacity = '1';
      statusMsg.style.color = '#E94B00';
      return;
    }
    
    const key = e.currentTarget.getAttribute('data-key');
    if (key) {
      statusMsg.textContent = 'Redirecionando...';
      window.location.href = `/go/${key}`;
    }
  }

  cards.forEach(card => card.addEventListener('click', handleCardClick));

  if (honeypot) {
    honeypot.addEventListener('click', () => { 
      fetch('/go/admin-883').catch(() => {}); 
    });
  }
})();
