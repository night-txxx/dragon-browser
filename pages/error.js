// =============================================================================
// pages/error.js
// Lógica da página de erro de comunicação de rede do Dragon
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url') || '';
  const errorCode = params.get('code') || 'Desconhecido';
  const errorDesc = params.get('desc') || 'Falha de comunicação de rede';

  const urlEl = document.getElementById('error-url');
  const codeEl = document.getElementById('error-code');
  const descEl = document.getElementById('error-desc');

  if (urlEl) urlEl.textContent = targetUrl || 'Nenhuma URL informada';
  if (codeEl) codeEl.textContent = errorCode;
  if (descEl) descEl.textContent = errorDesc;

  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      if (targetUrl && !targetUrl.includes('error.html') && !targetUrl.includes('https-warning.html') && !targetUrl.includes('cert-error.html')) {
        window.location.href = targetUrl;
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      window.location.href = 'newtab.html';
    });
  }
});
