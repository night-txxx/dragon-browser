// =============================================================================
// src/renderer/components/fire-button.js
// Botão do Fogo do Dragão Azul na barra de ferramentas
// =============================================================================

class FireButtonComponent {
  /**
   * @param {object} options
   * @param {Function} options.onTrigger Callback disparado ao clicar no botão
   */
  constructor({ onTrigger }) {
    this.btn = document.getElementById('btn-fire');
    this.onTrigger = onTrigger;
    this.isBusy = false;

    this.initEvents();
  }

  /**
   * Configura os ouvintes de clique e acessibilidade
   */
  initEvents() {
    if (!this.btn) return;

    this.btn.addEventListener('click', (event) => {
      event.preventDefault();
      // Se a limpeza já estiver em andamento, ignora qualquer novo clique
      if (this.isBusy) return;

      if (typeof this.onTrigger === 'function') {
        this.onTrigger();
      }
    });
  }

  /**
   * Bloqueia ou desbloqueia o botão durante o ciclo de animação e exclusão
   * @param {boolean} busy
   */
  setBusy(busy) {
    this.isBusy = Boolean(busy);
    if (this.btn) {
      this.btn.disabled = this.isBusy;
      if (this.isBusy) {
        this.btn.classList.add('fire-busy');
      } else {
        this.btn.classList.remove('fire-busy');
      }
    }
  }

  /**
   * Retorna as coordenadas no viewport do centro do botão (usado como origem do choque)
   * @returns {{ x: number, y: number }}
   */
  getOriginCoords() {
    if (!this.btn) {
      return { x: window.innerWidth - 30, y: 38 };
    }
    const rect = this.btn.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
}

// Exporta globalmente para uso no app.js sem dependência de bundler
window.FireButtonComponent = FireButtonComponent;
