// =============================================================================
// src/renderer/components/find-bar.js
// Barra de busca textual na página (Ctrl+F)
// =============================================================================

class FindBarComponent {
  constructor() {
    this.bar = document.getElementById('find-bar');
    this.input = document.getElementById('find-input');
    this.countLabel = document.getElementById('find-count');
    this.btnPrev = document.getElementById('find-prev');
    this.btnNext = document.getElementById('find-next');
    this.btnClose = document.getElementById('find-close');

    this.isVisible = false;
    this.lastQuery = '';

    this.initEvents();
  }

  initEvents() {
    if (!this.bar || !this.input) return;

    // Digitação na busca
    this.input.addEventListener('input', () => {
      const q = this.input.value;
      this.lastQuery = q;
      if (window.browserAPI) {
        window.browserAPI.findInPage(q, true, false);
      }
    });

    // Teclas especiais no campo de busca
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.findPrev();
        } else {
          this.findNext();
        }
      }
    });

    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => this.findPrev());
    }

    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => this.findNext());
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    // Ouvinte para abrir a busca via atalho Ctrl+F enviado pelo Main
    if (window.browserAPI && typeof window.browserAPI.onOpenFind === 'function') {
      window.browserAPI.onOpenFind(() => {
        this.open();
      });
    }

    // Ouvinte para resultados encontrados na página
    if (window.browserAPI && typeof window.browserAPI.onFindResult === 'function') {
      window.browserAPI.onFindResult((result) => {
        if (!result) return;
        const matches = result.matches || 0;
        const current = result.activeMatchOrdinal || 0;
        if (this.countLabel) {
          if (!this.input.value) {
            this.countLabel.textContent = '';
          } else {
            this.countLabel.textContent = `${current}/${matches}`;
          }
        }
      });
    }
  }

  open() {
    this.isVisible = true;
    this.bar.classList.add('visible');
    if (window.browserAPI && typeof window.browserAPI.setFindBarOpen === 'function') {
      window.browserAPI.setFindBarOpen(true);
    }
    this.input.focus();
    this.input.select();
    if (this.input.value && window.browserAPI) {
      window.browserAPI.findInPage(this.input.value, true, false);
    }
  }

  close() {
    this.isVisible = false;
    this.bar.classList.remove('visible');
    if (window.browserAPI && typeof window.browserAPI.setFindBarOpen === 'function') {
      window.browserAPI.setFindBarOpen(false);
    }
    if (this.countLabel) this.countLabel.textContent = '';
    if (window.browserAPI) {
      window.browserAPI.stopFindInPage('clearSelection');
    }
  }

  findNext() {
    if (this.input.value && window.browserAPI) {
      window.browserAPI.findInPage(this.input.value, true, true);
    }
  }

  findPrev() {
    if (this.input.value && window.browserAPI) {
      window.browserAPI.findInPage(this.input.value, false, true);
    }
  }
}

window.FindBarComponent = FindBarComponent;
