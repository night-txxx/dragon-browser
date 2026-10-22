// =============================================================================
// pages/dialog.js
// Diálogos modais elegantes para as páginas internas (dragonConfirm & dragonAlert)
// Substitui window.confirm() e window.alert() nativos com segurança e acessibilidade
// =============================================================================

(function (global) {
  'use strict';

  /**
   * Normaliza os parâmetros recebidos para dragonConfirm e dragonAlert
   * @param {string|object} options
   * @param {boolean} [isAlert=false]
   * @returns {object}
   */
  function normalizeDialogOptions(options, isAlert = false) {
    if (typeof options === 'string') {
      return {
        title: isAlert ? 'Aviso' : 'Confirmação',
        message: options,
        confirmText: isAlert ? 'OK' : 'Confirmar',
        cancelText: 'Cancelar',
        danger: false
      };
    }

    const opts = options || {};
    return {
      title: typeof opts.title === 'string' ? opts.title : (isAlert ? 'Aviso' : 'Confirmação'),
      message: typeof opts.message === 'string' ? opts.message : '',
      confirmText: typeof opts.confirmText === 'string' ? opts.confirmText : (isAlert ? 'OK' : 'Confirmar'),
      cancelText: typeof opts.cancelText === 'string' ? opts.cancelText : 'Cancelar',
      danger: Boolean(opts.danger)
    };
  }

  /**
   * Cria o elemento SVG do ícone central (segurança contra XSS via DOM API)
   * @param {boolean} isDanger
   * @returns {SVGElement}
   */
  function createDialogIconSvg(isDanger) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    if (isDanger) {
      // Ícone de triângulo de aviso / perigo
      path.setAttribute('d', 'M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z');
    } else {
      // Ícone de escudo de proteção / informação
      path.setAttribute('d', 'M8 0c-.26 0-.51.1-.7.29L2.24 5.35c-.15.15-.24.36-.24.58v4.57c0 3.2 2.37 5.09 5.76 5.48.16.02.32.02.48 0 3.39-.39 5.76-2.28 5.76-5.48V5.93c0-.22-.09-.43-.24-.58L8.7 0.29C8.51 0.1 8.26 0 8 0zm0 1.5l4.5 4.5v4.5c0 2.4-1.7 3.8-4.5 4.19-2.8-.39-4.5-1.79-4.5-4.19V6l4.5-4.5z');
    }

    svg.appendChild(path);
    return svg;
  }

  /**
   * Constrói e exibe o modal acessível na página
   * @param {object} opts
   * @param {boolean} isAlert
   * @returns {Promise<boolean>}
   */
  function showModalDialog(opts, isAlert) {
    return new Promise((resolve) => {
      const previousActiveElement = document.activeElement;

      // 1. Overlay de fundo
      const overlay = document.createElement('div');
      overlay.className = 'dg-overlay';

      // 2. Cartão de diálogo
      const card = document.createElement('div');
      card.className = 'dg-card';
      card.setAttribute('role', opts.danger || isAlert ? 'alertdialog' : 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.tabIndex = -1;

      // 3. Cabeçalho
      const header = document.createElement('div');
      header.className = 'dg-header';

      // Ícone
      const iconWrap = document.createElement('div');
      iconWrap.className = 'dg-icon-wrap' + (opts.danger ? ' dg-icon-danger' : '');
      iconWrap.appendChild(createDialogIconSvg(opts.danger));
      header.appendChild(iconWrap);

      // Título
      const titleEl = document.createElement('h2');
      titleEl.className = 'dg-title';
      titleEl.textContent = opts.title;
      header.appendChild(titleEl);
      card.setAttribute('aria-label', opts.title);

      // Mensagem
      if (opts.message) {
        const messageEl = document.createElement('p');
        messageEl.className = 'dg-message';
        messageEl.textContent = opts.message;
        header.appendChild(messageEl);
      }

      card.appendChild(header);

      // 4. Ações / Botões
      const actions = document.createElement('div');
      actions.className = 'dg-actions' + (isAlert ? ' dg-actions-single' : '');

      let cancelBtn = null;
      let confirmBtn = null;

      function closeDialog(result) {
        document.removeEventListener('keydown', handleKeydown, true);
        overlay.classList.remove('dg-visible');

        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
            try {
              previousActiveElement.focus();
            } catch {}
          }
          resolve(result);
        }, 220);
      }

      // Se for Confirm, renderiza botão Cancelar
      if (!isAlert) {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'dg-btn dg-btn-secondary';
        cancelBtn.textContent = opts.cancelText;
        cancelBtn.addEventListener('click', () => closeDialog(false));
        actions.appendChild(cancelBtn);
      }

      // Botão Confirmar ou OK
      confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'dg-btn ' + (opts.danger ? 'dg-btn-danger' : 'dg-btn-primary');
      confirmBtn.textContent = opts.confirmText;
      confirmBtn.addEventListener('click', () => closeDialog(true));
      actions.appendChild(confirmBtn);

      card.appendChild(actions);
      overlay.appendChild(card);

      // Clique no fundo fecha com cancelamento
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          closeDialog(false);
        }
      });

      // Gerenciamento de teclado: Esc cancela e Tab circula o foco estritamente dentro do diálogo
      const focusableButtons = isAlert ? [confirmBtn] : [cancelBtn, confirmBtn];

      function handleKeydown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeDialog(false);
          return;
        }

        if (event.key === 'Tab') {
          if (focusableButtons.length <= 1) {
            event.preventDefault();
            return;
          }

          const first = focusableButtons[0];
          const last = focusableButtons[focusableButtons.length - 1];

          if (event.shiftKey) {
            if (document.activeElement === first) {
              event.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }
      }

      document.addEventListener('keydown', handleKeydown, true);

      // Anexa ao body e dispara a animação de entrada
      document.body.appendChild(overlay);

      // Força reflow para animação fluida
      void overlay.offsetWidth;
      overlay.classList.add('dg-visible');

      // Foco inicial: quando perigoso, foca em Cancelar; caso contrário, no botão primário
      requestAnimationFrame(() => {
        if (opts.danger && cancelBtn) {
          cancelBtn.focus();
        } else if (confirmBtn) {
          confirmBtn.focus();
        }
      });
    });
  }

  /**
   * Diálogo de confirmação com Promessa booleana
   * @param {string|object} options
   * @returns {Promise<boolean>}
   */
  function dragonConfirm(options) {
    const opts = normalizeDialogOptions(options, false);
    return showModalDialog(opts, false);
  }

  /**
   * Diálogo de alerta com Promessa resolvida ao fechar
   * @param {string|object} options
   * @returns {Promise<void>}
   */
  async function dragonAlert(options) {
    const opts = normalizeDialogOptions(options, true);
    await showModalDialog(opts, true);
  }

  // Exportação no escopo global (Browser / Window)
  if (typeof global !== 'undefined') {
    global.dragonConfirm = dragonConfirm;
    global.dragonAlert = dragonAlert;
  }

  // Exportação para testes unitários em Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      normalizeDialogOptions,
      dragonConfirm,
      dragonAlert
    };
  }
})(typeof window !== 'undefined' ? window : this);
