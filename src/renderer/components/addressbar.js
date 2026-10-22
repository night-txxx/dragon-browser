// =============================================================================
// src/renderer/components/addressbar.js
// Componente da barra de endereços (Omnibox para URLs, pesquisa e favoritos)
// =============================================================================

class AddressBarComponent {
  constructor() {
    this.form = document.getElementById('address-form');
    this.input = document.getElementById('address-input');
    this.btnBookmark = document.getElementById('btn-bookmark');
    this.dropdown = document.getElementById('omnibox-dropdown');

    this.isFocused = false;
    this.currentUrl = '';
    this.currentTitle = '';
    this.suggestions = [];
    this.selectedIndex = -1;
    this.debounceTimer = null;

    this.initEvents();
  }

  /**
   * Configura eventos de envio, digitação, navegação por setas e favoritos
   */
  initEvents() {
    if (!this.form || !this.input) return;

    // Quando o usuário pressiona Enter para navegar
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitCurrent();
    });

    // Digitação para buscar sugestões no histórico/favoritos/mecanismo de busca
    this.input.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      const query = this.input.value.trim();

      if (!query) {
        this.hideSuggestions();
        return;
      }

      this.debounceTimer = setTimeout(() => {
        this.fetchSuggestions(query);
      }, 150);
    });

    // Teclado para navegar nas sugestões
    this.input.addEventListener('keydown', (event) => {
      if (this.dropdown && this.dropdown.classList.contains('visible') && this.suggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
          this.renderSelectedSuggestion();
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
          this.renderSelectedSuggestion();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          this.hideSuggestions();
          return;
        }
      }
    });

    // Ao focar, seleciona o texto
    this.input.addEventListener('focus', () => {
      this.isFocused = true;
      requestAnimationFrame(() => {
        this.input.select();
      });
    });

    // Ao perder o foco, fecha sugestões com tolerância para cliques
    this.input.addEventListener('blur', () => {
      this.isFocused = false;
      setTimeout(() => {
        this.hideSuggestions();
      }, 200);
    });

    // Botão de Favorito (Estrela)
    if (this.btnBookmark) {
      this.btnBookmark.addEventListener('click', () => {
        this.toggleCurrentBookmark();
      });
    }

    // Atalho Ctrl+D do teclado repassado pelo preload
    if (window.browserAPI && typeof window.browserAPI.onToggleBookmark === 'function') {
      window.browserAPI.onToggleBookmark(() => {
        this.toggleCurrentBookmark();
      });
    }

    // Redimensionamento da janela recalcula a posição do dropdown fixo
    window.addEventListener('resize', () => {
      if (this.dropdown && this.dropdown.classList.contains('visible')) {
        this.updateDropdownPosition();
      }
    });
  }

  updateDropdownPosition() {
    if (!this.dropdown || !this.form) return;
    const rect = this.form.getBoundingClientRect();
    this.dropdown.style.position = 'fixed';
    this.dropdown.style.left = `${rect.left}px`;
    this.dropdown.style.width = `${rect.width}px`;
    this.dropdown.style.top = `${rect.bottom + 4}px`;
    this.dropdown.style.zIndex = '9999';
  }

  submitCurrent() {
    let target = this.input.value.trim();

    if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
      const selected = this.suggestions[this.selectedIndex];
      target = selected.url || selected.searchUrl || target;
    }

    this.hideSuggestions();

    if (target && window.browserAPI) {
      window.browserAPI.navigate(target);
      this.input.blur();
    }
  }

  async toggleCurrentBookmark() {
    if (!this.currentUrl || !window.browserAPI) return;

    try {
      const res = await window.browserAPI.toggleBookmark(this.currentUrl, this.currentTitle);
      if (this.btnBookmark) {
        if (res && res.bookmarked) {
          this.btnBookmark.classList.add('active');
          this.btnBookmark.title = 'Remover dos favoritos (Ctrl+D)';
        } else {
          this.btnBookmark.classList.remove('active');
          this.btnBookmark.title = 'Favoritar esta página (Ctrl+D)';
        }
      }
    } catch (err) {
      console.warn('[AddressBar] Falha ao alternar favorito:', err);
    }
  }

  async fetchSuggestions(query) {
    if (!window.browserAPI || !this.dropdown) return;

    try {
      const data = await window.browserAPI.getOmniboxSuggestions(query);
      if (!data) {
        this.hideSuggestions();
        return;
      }

      const list = [];

      // 1. Sugestão de Busca
      if (data.searchItem) {
        list.push({
          type: 'search',
          title: `Pesquisar "${data.searchItem.query}" no ${data.searchItem.engineName || 'DuckDuckGo'}`,
          url: data.searchItem.searchUrl
        });
      }

      // 2. Favoritos correspondentes
      if (Array.isArray(data.bookmarks)) {
        data.bookmarks.forEach(b => {
          list.push({
            type: 'bookmark',
            title: b.title,
            url: b.url
          });
        });
      }

      // 3. Histórico recente correspondente
      if (Array.isArray(data.history)) {
        data.history.forEach(h => {
          list.push({
            type: 'history',
            title: h.title,
            url: h.url
          });
        });
      }

      if (list.length === 0) {
        this.hideSuggestions();
        return;
      }

      this.suggestions = list;
      this.selectedIndex = -1;
      this.renderDropdown(list);
      this.showSuggestions();
    } catch (err) {
      console.warn('[AddressBar] Erro ao obter sugestões:', err);
      this.hideSuggestions();
    }
  }

  renderDropdown(list) {
    if (!this.dropdown) return;
    this.dropdown.innerHTML = '';
    this.updateDropdownPosition();

    list.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `omnibox-item type-${item.type}`;
      el.dataset.index = index;

      const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgIcon.setAttribute('class', 'omnibox-icon');
      svgIcon.setAttribute('viewBox', '0 0 16 16');

      if (item.type === 'search') {
        svgIcon.innerHTML = `<path d="M11.5 7a4.499 4.499 0 1 1-8.998 0A4.499 4.499 0 0 1 11.5 7zm-.82 4.74a6 6 0 1 0-1.06 1.06l3.65 3.65a.75.75 0 1 0 1.06-1.06l-3.65-3.65z"/>`;
      } else if (item.type === 'bookmark') {
        svgIcon.innerHTML = `<path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>`;
      } else {
        svgIcon.innerHTML = `<path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.376.868a6.975 6.975 0 0 0-.757-.597l.5-.866c.348.202.68.431.996.685l-.739.778zM8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>`;
      }

      const textWrap = document.createElement('div');
      textWrap.className = 'omnibox-text-wrap';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'omnibox-title';
      titleSpan.textContent = item.title;

      const urlSpan = document.createElement('span');
      urlSpan.className = 'omnibox-url';
      urlSpan.textContent = item.url;

      textWrap.appendChild(titleSpan);
      textWrap.appendChild(urlSpan);

      el.appendChild(svgIcon);
      el.appendChild(textWrap);

      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.selectedIndex = index;
        this.submitCurrent();
      });

      this.dropdown.appendChild(el);
    });
  }

  renderSelectedSuggestion() {
    if (!this.dropdown) return;
    const items = this.dropdown.querySelectorAll('.omnibox-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('selected');
        const selectedObj = this.suggestions[idx];
        if (selectedObj) {
          this.input.value = selectedObj.url;
        }
      } else {
        item.classList.remove('selected');
      }
    });
  }

  showSuggestions() {
    if (!this.dropdown || this.dropdown.classList.contains('visible')) return;
    this.updateDropdownPosition();
    this.dropdown.classList.add('visible');
    if (window.browserAPI) {
      window.browserAPI.showOverlay('omnibox');
    }
  }

  hideSuggestions() {
    if (!this.dropdown || !this.dropdown.classList.contains('visible')) return;
    this.dropdown.classList.remove('visible');
    this.suggestions = [];
    this.selectedIndex = -1;
    if (window.browserAPI) {
      window.browserAPI.hideOverlay('omnibox');
    }
  }

  /**
   * Dá foco imediato e seleciona o texto da barra de endereços (usado no atalho Ctrl+L)
   */
  focus() {
    if (this.input) {
      this.input.focus();
      this.input.select();
    }
  }

  /**
   * Atualiza o valor exibido na barra com a URL da aba ativa
   * @param {object} state Estado atualizado vindo do main process
   */
  async update(state) {
    if (!this.input || !state) return;

    this.currentUrl = state.currentUrl || '';
    this.currentTitle = state.currentTitle || '';

    // Atualiza o estado da estrela de favoritos
    if (this.btnBookmark && window.browserAPI && this.currentUrl) {
      try {
        const isFav = await window.browserAPI.isBookmarked(this.currentUrl);
        if (isFav) {
          this.btnBookmark.classList.add('active');
          this.btnBookmark.title = 'Remover dos favoritos (Ctrl+D)';
        } else {
          this.btnBookmark.classList.remove('active');
          this.btnBookmark.title = 'Favoritar esta página (Ctrl+D)';
        }
      } catch {}
    }

    // Se o usuário estiver digitando no momento, NÃO sobrescrevemos o que ele está escrevendo!
    if (this.isFocused) return;

    const url = state.currentUrl || '';

    // Se for a página interna de "Nova Aba", deixamos o campo em branco com placeholder
    const isNewTab = !url || url === 'about:blank' || (state.newTabUrl && url.startsWith(state.newTabUrl));
    if (isNewTab) {
      this.input.value = '';
      return;
    }

    // Se for uma página interna com rota amigável, exibe o protocolo amigável
    if (state.downloadsUrl && url.startsWith(state.downloadsUrl)) {
      this.input.value = 'dragon://downloads';
      return;
    }
    if (state.historyUrl && url.startsWith(state.historyUrl)) {
      this.input.value = 'dragon://history';
      return;
    }
    if (state.bookmarksUrl && url.startsWith(state.bookmarksUrl)) {
      this.input.value = 'dragon://bookmarks';
      return;
    }
    if (state.settingsUrl && url.startsWith(state.settingsUrl)) {
      this.input.value = 'dragon://settings';
      return;
    }

    // Se a aba estiver em página de erro ou aviso, exibe a URL original que falhou
    const isErrorOrWarning =
      (state.errorUrl && url.startsWith(state.errorUrl)) ||
      (state.httpsWarningUrl && url.startsWith(state.httpsWarningUrl)) ||
      (state.certErrorUrl && url.startsWith(state.certErrorUrl));

    if (isErrorOrWarning) {
      try {
        const parsed = new URL(url);
        const originalUrl = parsed.searchParams.get('url');
        if (originalUrl) {
          this.input.value = originalUrl;
          return;
        }
      } catch (err) {}
    }

    this.input.value = url;
  }
}

window.AddressBarComponent = AddressBarComponent;
