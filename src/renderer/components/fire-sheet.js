// =============================================================================
// src/renderer/components/fire-sheet.js
// Painel estilo "bottom sheet" de confirmação com visual do Dragão Azul
// =============================================================================

class FireSheetComponent {
  /**
   * @param {object} options
   * @param {Function} options.onConfirm Callback disparado ao clicar em "Apagar tudo"
   */
  constructor({ onConfirm }) {
    this.overlay = document.getElementById('fire-sheet-overlay');
    this.sheet = document.getElementById('fire-sheet-panel');
    this.btnCancel = document.getElementById('btn-fire-cancel');
    this.btnConfirm = document.getElementById('btn-fire-confirm');
    this.onConfirm = onConfirm;

    this.isOpen = false;
    this.initEvents();
  }

  /**
   * Registra os eventos de clique, teclado (Esc) e clique fora
   */
  initEvents() {
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => this.cancel());
    }

    if (this.btnConfirm) {
      this.btnConfirm.addEventListener('click', () => this.confirm());
    }

    // Clique fora (no backdrop escuro) cancela a confirmação
    if (this.overlay) {
      this.overlay.addEventListener('click', (event) => {
        if (event.target === this.overlay) {
          this.cancel();
        }
      });
    }

    // Tecla Escape cancela quando o painel estiver aberto
    window.addEventListener('keydown', (event) => {
      if (this.isOpen && event.key === 'Escape') {
        event.preventDefault();
        this.cancel();
      }
    });
  }

  /**
   * Abre o painel de confirmação por cima de tudo
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    // Favoritos desmarcados por padrão
    const chkBookmarks = document.getElementById('chk-fire-bookmarks');
    if (chkBookmarks) {
      chkBookmarks.checked = false;
    }

    // Notifica o main process para esconder a WebContentsView da aba ativa
    if (window.browserAPI && typeof window.browserAPI.showOverlay === 'function') {
      window.browserAPI.showOverlay('fire-sheet');
    }

    if (this.overlay) {
      this.overlay.classList.add('visible');
    }
    if (this.sheet) {
      this.sheet.classList.add('visible');
      // Foca no botão de confirmação para ergonomia
      if (this.btnConfirm) {
        setTimeout(() => this.btnConfirm.focus(), 50);
      }
    }
  }

  /**
   * Cancela e fecha o painel, restaurando a visão da aba ativa
   */
  cancel() {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.overlay) {
      this.overlay.classList.remove('visible');
    }
    if (this.sheet) {
      this.sheet.classList.remove('visible');
    }

    // Restaura a visualização da página web
    if (window.browserAPI && typeof window.browserAPI.hideOverlay === 'function') {
      window.browserAPI.hideOverlay('fire-sheet');
    }
  }

  /**
   * Confirma a limpeza. Fecha o painel mas mantém o overlay ativo para o fogo.
   */
  confirm() {
    if (!this.isOpen) return;
    this.isOpen = false;

    const chkBookmarks = document.getElementById('chk-fire-bookmarks');
    const includeBookmarks = Boolean(chkBookmarks && chkBookmarks.checked);

    if (this.overlay) {
      this.overlay.classList.remove('visible');
    }
    if (this.sheet) {
      this.sheet.classList.remove('visible');
    }

    // Dispara a animação e o processo de exclusão passando o parâmetro de favoritos
    if (typeof this.onConfirm === 'function') {
      this.onConfirm({ includeBookmarks });
    }
  }
}

// Exporta globalmente para uso no app.js sem dependência de bundler
window.FireSheetComponent = FireSheetComponent;
