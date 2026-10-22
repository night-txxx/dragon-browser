// =============================================================================
// pages/https-warning.js
// Lógica da página de aviso de conexão não criptografada (HTTPS Fallback)
// Utiliza token de uso único criptograficamente seguro via IPC (window.warningAPI)
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const rawTarget = params.get('url') || '';
  // Validação estrita: a URL de destino DEVE começar com http://
  const targetUrl = rawTarget.startsWith('http://') ? rawTarget : '';

  const urlDisplay = document.getElementById('target-url');
  if (urlDisplay) {
    urlDisplay.textContent = targetUrl || 'Endereço inválido ou não informado';
  }

  const continueBtn = document.getElementById('btn-continue-http');
  if (!targetUrl && continueBtn) {
    continueBtn.disabled = true;
    continueBtn.style.opacity = '0.5';
    continueBtn.style.cursor = 'not-allowed';
  }

  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', async () => {
      if (!targetUrl || !targetUrl.startsWith('http://')) return;

      continueBtn.disabled = true;
      continueBtn.textContent = 'Solicitando liberação segura...';

      try {
        // Solicita ao main process via preload validado um token de uso único com TTL curto
        if (window.warningAPI && typeof window.warningAPI.requestBypassToken === 'function') {
          const token = await window.warningAPI.requestBypassToken(targetUrl);
          if (token) {
            const delim = targetUrl.includes('?') ? '&' : '?';
            // Navega com o token único que é validado e invalidado imediatamente no main
            window.location.href = `${targetUrl}${delim}dragon_bypass_token=${token}`;
            return;
          }
        }
      } catch (err) {
        console.error('[Aviso HTTPS] Falha ao solicitar token de bypass:', err);
      }

      continueBtn.disabled = false;
      continueBtn.textContent = 'Continuar em HTTP (Inseguro)';
      if (window.dragonAlert) {
        await window.dragonAlert({
          title: 'Erro de Autorização',
          message: 'Não foi possível obter autorização de segurança para este endereço.'
        });
      } else {
        alert('Não foi possível obter autorização de segurança para este endereço.');
      }
    });
  }
});
