// =============================================================================
// src/renderer/components/tabs-view.js
// Componente de visualização e manipulação da lista de abas com DOM Diffing
// e reordenação nativa via arrastar e soltar (HTML5 Drag & Drop).
// A interface gráfica é puramente reativa: renderiza com base no estado do Main.
// =============================================================================

class TabsViewComponent {
  constructor() {
    this.container = document.getElementById('tabs-container');
    this.btnNewTab = document.getElementById('btn-new-tab');
    this.tabElements = new Map(); // tabId -> { tabEl, titleEl, iconWrapper, currentFavicon, currentLoading, currentTitle, currentActive }
    this.lastTabOrder = [];
    this.lastActiveTabId = null;

    this.initEvents();
  }

  /**
   * Configura eventos gerais do componente
   */
  initEvents() {
    if (this.btnNewTab) {
      this.btnNewTab.addEventListener('click', () => {
        if (window.browserAPI) {
          window.browserAPI.createTab();
        }
      });
    }
  }

  /**
   * Atualiza a lista de abas realizando diffing por id sem recriar o DOM
   * @param {object} state Estado recebido pelo canal "browser:state-update"
   */
  update(state) {
    if (!this.container || !state || !Array.isArray(state.tabs)) return;

    const currentTabIds = new Set(state.tabs.map(t => t.id));

    // 1. Remove elementos de abas que foram fechadas
    for (const [id, record] of this.tabElements.entries()) {
      if (!currentTabIds.has(id)) {
        if (record.tabEl && record.tabEl.parentNode) {
          record.tabEl.remove();
        }
        this.tabElements.delete(id);
      }
    }

    // 2. Cria ou atualiza abas mantendo referências do DOM
    state.tabs.forEach((tab) => {
      const isActive = tab.id === state.activeTabId;
      const isPrivate = Boolean(tab.isPrivate);
      let record = this.tabElements.get(tab.id);

      if (!record) {
        // Cria novo elemento da aba com listeners
        record = this.createTabElement(tab);
        this.tabElements.set(tab.id, record);
      }

      // Atualiza estado ativo
      if (record.currentActive !== isActive) {
        record.currentActive = isActive;
        if (isActive) {
          record.tabEl.classList.add('active');
        } else {
          record.tabEl.classList.remove('active');
        }
      }

      // Atualiza título da aba
      const displayTitle = tab.title || (isPrivate ? 'Nova Aba Privada' : 'Nova Aba');
      if (record.currentTitle !== displayTitle) {
        record.currentTitle = displayTitle;
        record.titleEl.textContent = displayTitle;
      }
      record.tabEl.title = isPrivate ? `[Privada] ${displayTitle} - Sem rastros nem histórico` : `${displayTitle} - ${tab.url}`;

      // Atualiza ícone ou spinner de carregamento se alterado
      if (record.currentLoading !== tab.isLoading || record.currentFavicon !== tab.favicon) {
        record.currentLoading = tab.isLoading;
        record.currentFavicon = tab.favicon;
        this.updateFavicon(record.iconWrapper, tab, isPrivate);
      }
    });

    // 3. Reordena no DOM SOMENTE se a ordem das abas tiver mudado
    const newOrderIds = state.tabs.map(t => t.id);
    const orderChanged = newOrderIds.length !== this.lastTabOrder.length ||
      newOrderIds.some((id, index) => id !== this.lastTabOrder[index]);

    if (orderChanged) {
      this.lastTabOrder = newOrderIds;
      state.tabs.forEach(tab => {
        const record = this.tabElements.get(tab.id);
        if (record && record.tabEl) {
          this.container.appendChild(record.tabEl);
        }
      });
    }

    // 4. Rola suavemente para tornar a aba visível SOMENTE se a aba ativa tiver mudado
    const activeChanged = state.activeTabId !== this.lastActiveTabId;
    this.lastActiveTabId = state.activeTabId;

    if (activeChanged && state.activeTabId) {
      const activeRecord = this.tabElements.get(state.activeTabId);
      if (activeRecord && activeRecord.tabEl) {
        activeRecord.tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }

  /**
   * Cria o nó do DOM de uma nova aba com eventos de clique e arrastar
   * @param {object} tab
   * @returns {object} Record com referências do elemento
   */
  createTabElement(tab) {
    const isPrivate = Boolean(tab.isPrivate);

    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${isPrivate ? 'private' : ''}`;
    tabEl.dataset.tabId = tab.id;
    tabEl.draggable = true;

    // Favicon / Spinner
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'tab-favicon';
    this.updateFavicon(iconWrapper, tab, isPrivate);
    tabEl.appendChild(iconWrapper);

    // Título
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title || (isPrivate ? 'Nova Aba Privada' : 'Nova Aba');
    tabEl.appendChild(titleEl);

    // Botão Fechar (X)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.title = 'Fechar aba (Ctrl+W)';
    closeBtn.setAttribute('aria-label', 'Fechar aba');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 16 16">
        <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
      </svg>
    `;

    closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (window.browserAPI) {
        window.browserAPI.closeTab(tab.id);
      }
    });
    tabEl.appendChild(closeBtn);

    // Clique esquerdo para selecionar
    tabEl.addEventListener('click', () => {
      if (window.browserAPI) {
        window.browserAPI.selectTab(tab.id);
      }
    });

    // Clique com o scroll do mouse para fechar
    tabEl.addEventListener('auxclick', (event) => {
      if (event.button === 1 && window.browserAPI) {
        event.preventDefault();
        window.browserAPI.closeTab(tab.id);
      }
    });

    // Eventos de Arrastar e Soltar (Drag and Drop)
    tabEl.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', tab.id);
      event.dataTransfer.effectAllowed = 'move';
      tabEl.classList.add('dragging');
    });

    tabEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      tabEl.classList.add('drag-over');
    });

    tabEl.addEventListener('dragleave', () => {
      tabEl.classList.remove('drag-over');
    });

    tabEl.addEventListener('drop', (event) => {
      event.preventDefault();
      tabEl.classList.remove('drag-over');
      const sourceId = event.dataTransfer.getData('text/plain');
      if (sourceId && sourceId !== tab.id && window.browserAPI) {
        window.browserAPI.reorderTabs(sourceId, tab.id);
      }
    });

    tabEl.addEventListener('dragend', () => {
      tabEl.classList.remove('dragging');
      document.querySelectorAll('.tab-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    return {
      tabEl,
      titleEl,
      iconWrapper,
      closeBtn,
      currentFavicon: tab.favicon,
      currentLoading: tab.isLoading,
      currentTitle: tab.title,
      currentActive: false
    };
  }

  /**
   * Atualiza os nós filhos do iconWrapper
   * @param {HTMLElement} iconWrapper
   * @param {object} tab
   * @param {boolean} isPrivate
   */
  updateFavicon(iconWrapper, tab, isPrivate) {
    iconWrapper.innerHTML = '';

    if (tab.isLoading) {
      const spinner = document.createElement('div');
      spinner.className = 'tab-spinner';
      iconWrapper.appendChild(spinner);
    } else if (isPrivate) {
      iconWrapper.appendChild(this.createPrivateIcon());
    } else if (tab.favicon && typeof tab.favicon === 'string' && tab.favicon.startsWith('http')) {
      const img = document.createElement('img');
      img.src = tab.favicon;
      img.alt = '';
      img.onerror = () => {
        img.replaceWith(this.createDefaultIcon());
      };
      iconWrapper.appendChild(img);
    } else {
      iconWrapper.appendChild(this.createDefaultIcon());
    }
  }

  createDefaultIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.innerHTML = `
      <path fill="currentColor" d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.93 5H9.6a11.7 11.7 0 0 0-1.2-3.07A6.5 6.5 0 0 1 11.93 5zM8 1.5c.57 0 1.25 1.07 1.57 3.5H6.43c.32-2.43 1-3.5 1.57-3.5zm-3.93 3.5A6.5 6.5 0 0 1 7.6 1.93 11.7 11.7 0 0 0 6.4 5H4.07zM1.5 8c0-.7.1-1.37.28-2h2.5c-.05.65-.08 1.32-.08 2s.03 1.35.08 2h-2.5A6.47 6.47 0 0 1 1.5 8zm1.07 3h2.33c.3 1.15.73 2.18 1.2 3.07A6.5 6.5 0 0 1 2.57 11zM8 14.5c-.57 0-1.25-1.07-1.57-3.5h3.14c-.32 2.43-1 3.5-1.57 3.5zm3.93-3.5a6.5 6.5 0 0 1-2.33 3.07c.47-.89.9-1.92 1.2-3.07h1.13zM10.72 10c.05-.65.08-1.32.08-2s-.03-1.35-.08-2h2.5c.18.63.28 1.3.28 2s-.1 1.37-.28 2h-2.5z"/>
    `;
    return svg;
  }

  createPrivateIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', 'private-icon-svg');
    svg.innerHTML = `
      <path fill="currentColor" d="M8 1a2 2 0 0 0-2 2v.18A4.002 4.002 0 0 0 2 7c0 1.9 1.32 3.5 3.1 3.9A3.001 3.001 0 0 0 8 13a3.001 3.001 0 0 0 2.9-2.1c1.78-.4 3.1-2 3.1-3.9a4.002 4.002 0 0 0-4-3.82V3a2 2 0 0 0-2-2zm0 1a1 1 0 0 1 1 1v.05a4.05 4.05 0 0 0-2 0V3a1 1 0 0 1 1-1zM5 6.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
    `;
    return svg;
  }
}

window.TabsViewComponent = TabsViewComponent;
