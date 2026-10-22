// =============================================================================
// src/renderer/components/toolbar.js
// Componente da barra de ferramentas (Voltar, Avançar, Recarregar/Parar, Downloads, Configurações)
// =============================================================================

class ToolbarComponent {
  constructor() {
    this.btnBack = document.getElementById('btn-back');
    this.btnForward = document.getElementById('btn-forward');
    this.btnReload = document.getElementById('btn-reload');
    this.btnHome = document.getElementById('btn-home');
    this.btnDownloads = document.getElementById('btn-downloads');
    this.btnSettings = document.getElementById('btn-settings');
    this.redirectBar = document.getElementById('redirect-blocked-bar');
    this.redirectText = document.getElementById('redirect-blocked-text');
    this.btnAllowRedirect = document.getElementById('btn-allow-redirect');
    this.btnDismissRedirect = document.getElementById('btn-dismiss-redirect');
    this.blockedRedirectUrl = null;
    this.redirectDismissTimer = null;
    this.activeTabId = null;
    this.isLoading = false;

    this.initEvents();
  }

  /**
   * Registra os eventos de clique dos botões da barra
   */
  initEvents() {
    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => {
        if (!this.btnBack.disabled && window.browserAPI) {
          window.browserAPI.goBack();
        }
      });
    }

    if (this.btnForward) {
      this.btnForward.addEventListener('click', () => {
        if (!this.btnForward.disabled && window.browserAPI) {
          window.browserAPI.goForward();
        }
      });
    }

    if (this.btnReload) {
      this.btnReload.addEventListener('click', () => {
        if (!window.browserAPI) return;
        if (this.isLoading) {
          window.browserAPI.stop();
        } else {
          window.browserAPI.reload();
        }
      });
    }

    if (this.btnHome) {
      this.btnHome.addEventListener('click', () => {
        if (window.browserAPI && typeof window.browserAPI.navigateHome === 'function') {
          window.browserAPI.navigateHome();
        }
      });
    }

    if (this.btnDownloads) {
      this.btnDownloads.addEventListener('click', () => {
        if (!window.browserAPI) return;
        if (typeof window.browserAPI.openDownloads === 'function') {
          window.browserAPI.openDownloads();
        } else {
          window.browserAPI.createTab('dragon://downloads');
        }
      });
    }

    if (this.btnSettings) {
      this.btnSettings.addEventListener('click', () => {
        if (window.browserAPI && typeof window.browserAPI.openSettings === 'function') {
          window.browserAPI.openSettings();
        }
      });
    }

    // Notificações de progresso de downloads
    if (window.browserAPI && typeof window.browserAPI.onDownloadUpdate === 'function') {
      window.browserAPI.onDownloadUpdate((dl) => {
        if (this.btnDownloads) {
          if (dl && dl.state === 'progressing') {
            this.btnDownloads.classList.add('downloading');
          } else {
            this.btnDownloads.classList.remove('downloading');
          }
        }
      });
    }

    if (this.btnAllowRedirect) {
      this.btnAllowRedirect.addEventListener('click', () => {
        if (this.blockedRedirectUrl && window.browserAPI && typeof window.browserAPI.allowRedirect === 'function') {
          window.browserAPI.allowRedirect(this.blockedRedirectUrl);
        }
        this.hideRedirectBar();
      });
    }

    if (this.btnDismissRedirect) {
      this.btnDismissRedirect.addEventListener('click', () => {
        this.hideRedirectBar();
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onRedirectBlocked === 'function') {
      window.browserAPI.onRedirectBlocked((payload) => {
        if (!payload || !payload.targetUrl) return;
        this.showRedirectBar(payload.domain || payload.targetUrl, payload.targetUrl);
      });
    }
  }

  showRedirectBar(domain, targetUrl) {
    this.blockedRedirectUrl = targetUrl;
    if (this.redirectText) {
      this.redirectText.textContent = `Redirecionamento bloqueado — ${domain}`;
    }
    if (this.redirectBar) {
      this.redirectBar.hidden = false;
      this.redirectBar.classList.add('visible');
    }
    if (this.redirectDismissTimer) {
      clearTimeout(this.redirectDismissTimer);
    }
    this.redirectDismissTimer = setTimeout(() => {
      this.hideRedirectBar();
    }, 8000);
  }

  hideRedirectBar() {
    if (this.redirectDismissTimer) {
      clearTimeout(this.redirectDismissTimer);
      this.redirectDismissTimer = null;
    }
    this.blockedRedirectUrl = null;
    if (this.redirectBar) {
      this.redirectBar.hidden = true;
      this.redirectBar.classList.remove('visible');
    }
  }

  /**
   * Atualiza a interface da barra com base no estado recebido do main process
   * @param {object} state Estado consolidado enviado pelo TabManager
   */
  update(state) {
    if (!state) return;

    if (state.activeTabId && state.activeTabId !== this.activeTabId) {
      this.activeTabId = state.activeTabId;
      this.hideRedirectBar();
    }

    this.isLoading = Boolean(state.isLoading);

    if (this.btnBack) {
      this.btnBack.disabled = !state.canGoBack;
    }

    if (this.btnForward) {
      this.btnForward.disabled = !state.canGoForward;
    }

    if (this.btnReload) {
      if (this.isLoading) {
        this.btnReload.title = 'Parar carregamento';
        this.btnReload.innerHTML = `
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
          </svg>
        `;
      } else {
        this.btnReload.title = 'Recarregar página (Ctrl+R ou F5)';
        this.btnReload.innerHTML = `
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path fill="currentColor" d="M1.705 8.001a6.3 6.3 0 0 1 10.7-4.47l.825-.824a.5.5 0 0 1 .854.354V6.5a.5.5 0 0 1-.5.5H10.14a.5.5 0 0 1-.354-.854l.872-.871a4.8 4.8 0 1 0 1.488 3.726.75.75 0 1 1 1.498.087 6.3 6.3 0 0 1-11.94.413z"/>
          </svg>
        `;
      }
    }
  }
}

window.ToolbarComponent = ToolbarComponent;
