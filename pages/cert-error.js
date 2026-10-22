// =============================================================================
// pages/cert-error.js
// Lógica da página interna de erro de certificado digital (SSL/TLS) do Dragon
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url') || '';
  const errorCode = params.get('code') || '-200';
  const errorDesc = params.get('desc') || 'ERR_CERT_COMMON_NAME_INVALID';

  const urlDisplay = document.getElementById('cert-url');
  const codeDisplay = document.getElementById('cert-code');
  const descDisplay = document.getElementById('cert-desc');

  if (urlDisplay) urlDisplay.textContent = targetUrl || 'Endereço não informado';
  if (codeDisplay) codeDisplay.textContent = errorCode;
  if (descDisplay) descDisplay.textContent = `${errorDesc} (Certificado Inválido)`;

  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (window.certErrorAPI && typeof window.certErrorAPI.goHome === 'function') {
        window.certErrorAPI.goHome();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  const btnToggleAdvanced = document.getElementById('btn-toggle-advanced');
  const advancedPanel = document.getElementById('advanced-panel');
  if (btnToggleAdvanced && advancedPanel) {
    btnToggleAdvanced.addEventListener('click', () => {
      const isHidden = advancedPanel.classList.contains('hidden');
      if (isHidden) {
        advancedPanel.classList.remove('hidden');
        btnToggleAdvanced.textContent = 'Ocultar detalhes';
      } else {
        advancedPanel.classList.add('hidden');
        btnToggleAdvanced.textContent = 'Avançado';
      }
    });
  }

  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      if (targetUrl && !targetUrl.includes('cert-error.html')) {
        window.location.href = targetUrl;
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  const btnDangerProceed = document.getElementById('btn-danger-proceed');
  if (btnDangerProceed) {
    btnDangerProceed.addEventListener('click', async () => {
      if (!targetUrl || targetUrl.includes('cert-error.html')) return;
      const confirmed = window.confirm(
        'ATENÇÃO: A conexão com este site NÃO é segura. O certificado digital não é confiável e terceiros podem interceptar ou adulterar suas informações pessoais.\n\nDeseja realmente continuar para este site de forma insegura?'
      );
      if (confirmed) {
        if (window.certErrorAPI && typeof window.certErrorAPI.requestBypassToken === 'function') {
          try {
            const token = await window.certErrorAPI.requestBypassToken(targetUrl);
            if (token && typeof window.certErrorAPI.proceedWithBypass === 'function') {
              await window.certErrorAPI.proceedWithBypass(targetUrl, token);
              return;
            }
          } catch (err) {
            console.error('Erro ao solicitar liberação de certificado:', err);
          }
        }
        window.location.href = targetUrl;
      }
    });
  }
});
