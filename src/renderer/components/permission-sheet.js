// =============================================================================
// src/renderer/components/permission-sheet.js
// Modal estilo bottom-sheet para solicitar permissão por site (câmera, microfone, etc.)
// Fila de solicitações simultâneas: exibe um por um, ocultando overlay só ao esvaziar
// =============================================================================

class PermissionSheetComponent {
  constructor() {
    this.overlay = document.getElementById('permission-sheet-overlay');
    this.titleEl = document.getElementById('perm-title');
    this.descEl = document.getElementById('perm-desc');
    this.iconEl = document.getElementById('perm-icon-wrap');
    this.rememberCheck = document.getElementById('perm-remember-check');
    this.btnAllow = document.getElementById('btn-perm-allow');
    this.btnBlock = document.getElementById('btn-perm-block');

    this.currentRequest = null;
    this.queue = [];

    this.initEvents();
  }

  initEvents() {
    if (this.btnAllow) {
      this.btnAllow.addEventListener('click', () => {
        this.respond(true);
      });
    }

    if (this.btnBlock) {
      this.btnBlock.addEventListener('click', () => {
        this.respond(false);
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onPromptPermission === 'function') {
      window.browserAPI.onPromptPermission((payload) => {
        this.enqueuePrompt(payload);
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onCancelPermissionPrompt === 'function') {
      window.browserAPI.onCancelPermissionPrompt((payload) => {
        this.cancelRequests(payload);
      });
    }
  }

  enqueuePrompt(payload) {
    if (!payload || !payload.requestId) return;

    if (!this.currentRequest) {
      this.displayPrompt(payload);
    } else {
      this.queue.push(payload);
    }
  }

  displayPrompt(payload) {
    if (!payload || !this.overlay) return;

    this.currentRequest = payload;
    const origin = payload.origin || 'Este site';
    const label = payload.label || payload.permissionKey || 'um recurso';

    if (this.titleEl) {
      this.titleEl.textContent = `Permitir acesso a ${label}?`;
    }
    if (this.descEl) {
      this.descEl.textContent = `${origin} está solicitando autorização para usar ${label}.`;
    }
    if (this.rememberCheck) {
      this.rememberCheck.checked = true;
    }

    this.overlay.classList.add('visible');
  }

  cancelRequests(payload) {
    const { webContentsId, requestId } = payload || {};

    // Remove pedidos da fila pertencentes ao webContents cancelado ou ao requestId
    this.queue = this.queue.filter(item => {
      if (requestId && item.requestId === requestId) return false;
      if (webContentsId && item.webContentsId === webContentsId) return false;
      return true;
    });

    // Se o pedido atualmente em exibição foi cancelado, avança para o próximo
    if (this.currentRequest) {
      const matchWc = webContentsId && this.currentRequest.webContentsId === webContentsId;
      const matchReq = requestId && this.currentRequest.requestId === requestId;
      if (matchWc || matchReq) {
        this.currentRequest = null;
        this.processNextInQueue();
      }
    }
  }

  respond(allowed) {
    if (!this.currentRequest) return;

    const reqId = this.currentRequest.requestId;
    const remember = this.rememberCheck ? this.rememberCheck.checked : false;

    this.currentRequest = null;

    if (window.browserAPI && typeof window.browserAPI.respondPermission === 'function') {
      window.browserAPI.respondPermission(reqId, allowed, remember);
    }

    this.processNextInQueue();
  }

  processNextInQueue() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.displayPrompt(next);
    } else {
      if (this.overlay) {
        this.overlay.classList.remove('visible');
      }
    }
  }
}

window.PermissionSheetComponent = PermissionSheetComponent;
