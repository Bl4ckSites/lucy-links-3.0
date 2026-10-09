(function() {
  const statusMsg = document.getElementById('status-msg');
  const cards = document.querySelectorAll('.link-card:not(.honeypot)');
  const honeypot = document.querySelector('.honeypot');
  const verificationContainer = document.getElementById('verification-container');

  // 1. VERIFICAÇÃO DE MEMÓRIA: O usuário já verificou nesta aba?
  const alreadyVerified = sessionStorage.getItem('lucy_verified') === 'true';

  if (alreadyVerified) {
    // Se sim, libera os botões IMEDIATAMENTE e esconde o Turnstile
    enableButtons();
    if (verificationContainer) verificationContainer.style.display = 'none';
  }

  // Função chamada pelo Turnstile
  window.onTurnstileSuccess = async function(token) {
    // Se já estava verificado, ignora chamadas duplicadas
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
        // 2. SALVA NO NAVEGADOR que a verificação foi concluída com sucesso
        sessionStorage.setItem('lucy_verified', 'true');
        
        enableButtons();
        
        statusMsg.textContent = 'Acesso liberado por 10 minutos!';
        statusMsg.style.color = '#2E7D32';
        
        // Esconde o widget suavemente
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

  // Função auxiliar para liberar os botões de forma limpa
  function enableButtons() {
    cards.forEach(card => {
      card.disabled = false;
      card.style.opacity = '1';
      card.style.filter = 'none';
      card.style.cursor = 'pointer';
    });
  }

  function handleCardClick(e) {
    // Segurança frontend: impede clique se a memória de verificação não existir
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

  // Honeypot (Armadilha para bots)
  if (honeypot) {
    honeypot.addEventListener('click', () => { 
      fetch('/go/admin-883').catch(() => {}); 
    });
  }
})();
