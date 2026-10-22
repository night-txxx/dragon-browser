// =============================================================================
// src/renderer/components/download-risk-sheet.js
// Modal estilo bottom-sheet para aviso de downloads de risco (ETAPA 4)
// =============================================================================

class DownloadRiskSheetComponent {
  constructor() {
    this.overlay = document.getElementById('download-risk-overlay');
    this.titleEl = document.getElementById('download-risk-title');
    this.descEl = document.getElementById('download-risk-desc');
    this.btnCancel = document.getElementById('btn-download-risk-cancel');
    this.btnConfirm = document.getElementById('btn-download-risk-confirm');

    this.currentPrompt = null;
    this.queue = [];

    this.initEvents();
  }

  initEvents() {
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => {
        this.respond(false);
      });
    }

    if (this.btnConfirm) {
      this.btnConfirm.addEventListener('click', () => {
        this.respond(true);
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onDownloadRiskPrompt === 'function') {
      window.browserAPI.onDownloadRiskPrompt((payload) => {
        this.enqueue(payload);
      });
    }
  }

  enqueue(payload) {
    if (!payload || !payload.downloadId) return;

    if (!this.currentPrompt) {
      this.display(payload);
    } else {
      this.queue.push(payload);
    }
  }

  display(payload) {
    if (!payload || !this.overlay) return;
    this.currentPrompt = payload;

    const filename = payload.filename || 'arquivo executável';
    const domain = payload.domain || 'origem desconhecida';

    if (this.titleEl) {
      this.titleEl.textContent = 'Arquivo potencialmente perigoso';
    }

    if (this.descEl) {
      this.descEl.innerHTML = `O arquivo <strong class="risk-highlight">${this.escapeHtml(filename)}</strong> de <strong class="risk-highlight">${this.escapeHtml(domain)}</strong> pode danificar o seu computador ou executar ações indesejadas. Deseja mantê-lo?`;
    }

    if (window.browserAPI && typeof window.browserAPI.showOverlay === 'function') {
      window.browserAPI.showOverlay('download-risk');
    }

    this.overlay.classList.add('visible');
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async respond(allow) {
    if (!this.currentPrompt) return;

    const { downloadId } = this.currentPrompt;
    this.currentPrompt = null;

    try {
      if (window.browserAPI) {
        if (allow && typeof window.browserAPI.confirmRiskDownload === 'function') {
          await window.browserAPI.confirmRiskDownload(downloadId);
        } else if (!allow && typeof window.browserAPI.cancelRiskDownload === 'function') {
          await window.browserAPI.cancelRiskDownload(downloadId);
        }
      }
    } catch (err) {
      console.warn('[DownloadRisk] Erro ao responder prompt:', err);
    }

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.display(next);
    } else {
      this.close();
    }
  }

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('visible');
    }
    if (window.browserAPI && typeof window.browserAPI.hideOverlay === 'function') {
      window.browserAPI.hideOverlay('download-risk');
    }
  }
}

window.DownloadRiskSheetComponent = DownloadRiskSheetComponent;
