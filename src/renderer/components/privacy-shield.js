// =============================================================================
// src/renderer/components/privacy-shield.js
// Componente do Escudo de Privacidade na barra de endereço (estilo DuckDuckGo)
// Exibe rastreadores bloqueados e permite ligar/desligar proteção por site
// =============================================================================

class PrivacyShieldComponent {
  constructor() {
    this.btn = document.getElementById('btn-privacy-shield');
    this.badge = document.getElementById('shield-badge');
    this.panel = document.getElementById('shield-panel');
    this.siteHostEl = document.getElementById('shield-site-host');
    this.statusTextEl = document.getElementById('shield-status-text');
    this.toggleBtn = document.getElementById('btn-shield-toggle');
    this.counterEl = document.getElementById('shield-trackers-count');
    this.popupsCountEl = document.getElementById('shield-popups-count');
    this.gradeBadge = document.getElementById('shield-grade-badge');
    this.trackersListEl = document.getElementById('shield-trackers-list');
    this.backdrop = document.getElementById('shield-panel-backdrop');

    this.isOpen = false;
    this.currentHostname = '';
    this.isProtected = true;

    this.initEvents();
  }

  /**
   * Registra eventos de clique, teclado e clique fora
   */
  initEvents() {
    if (this.btn) {
      this.btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      });
    }

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.currentHostname || !window.browserAPI) return;
        const newState = await window.browserAPI.toggleSiteProtection(this.currentHostname);
        this.isProtected = newState;
        this.renderProtectionState();
      });
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => {
        this.close();
      });
    }

    // Tecla Escape fecha o painel do escudo
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  /**
   * Alterna abertura do painel do escudo
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Abre o painel do escudo e esconde a WebContentsView para sobreposição limpa
   */
  async open() {
    if (this.isOpen) return;
    this.isOpen = true;

    if (window.browserAPI && typeof window.browserAPI.showOverlay === 'function') {
      window.browserAPI.showOverlay('shield');
    }

    if (this.backdrop) this.backdrop.classList.add('visible');
    if (this.panel) this.panel.classList.add('visible');

    await this.refreshData();
  }

  /**
   * Fecha o painel do escudo e restaura a visualização da página web
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.backdrop) this.backdrop.classList.remove('visible');
    if (this.panel) this.panel.classList.remove('visible');

    if (window.browserAPI && typeof window.browserAPI.hideOverlay === 'function') {
      window.browserAPI.hideOverlay('shield');
    }
  }

  /**
   * Consulta os dados mais recentes de privacidade da aba ativa
   */
  async refreshData() {
    if (!window.browserAPI || typeof window.browserAPI.getPrivacyInfo !== 'function') return;

    try {
      const info = await window.browserAPI.getPrivacyInfo();
      this.currentHostname = info.hostname || 'Página interna';
      this.isProtected = info.isProtected;

      if (this.siteHostEl) {
        this.siteHostEl.textContent = this.currentHostname;
      }

      this.renderProtectionState();

      if (this.counterEl) {
        this.counterEl.textContent = info.count === 1
          ? '1 rastreador bloqueado nesta página'
          : `${info.count} rastreadores bloqueados nesta página`;
      }

      if (this.popupsCountEl) {
        const popups = info.popupsBlocked || 0;
        this.popupsCountEl.textContent = popups === 1
          ? '1 pop-up / redirecionamento bloqueado'
          : `${popups} pop-ups / redirecionamentos bloqueados`;
      }

      if (this.gradeBadge) {
        const grade = (info.grade || 'A').toUpperCase();
        this.gradeBadge.textContent = grade;
        this.gradeBadge.className = `shield-grade-badge grade-${grade.toLowerCase()}`;
        this.gradeBadge.title = `Classificação de privacidade: Nota ${grade}`;
      }

      if (this.trackersListEl) {
        while (this.trackersListEl.firstChild) {
          this.trackersListEl.removeChild(this.trackersListEl.firstChild);
        }
        if (info.domains && info.domains.length > 0) {
          info.domains.forEach(d => {
            const li = document.createElement('li');
            li.className = 'shield-tracker-item';

            const bullet = document.createElement('span');
            bullet.className = 'tracker-bullet';

            const name = document.createElement('span');
            name.className = 'tracker-name';
            name.textContent = d;

            li.appendChild(bullet);
            li.appendChild(name);
            this.trackersListEl.appendChild(li);
          });
        } else {
          const emptyLi = document.createElement('li');
          emptyLi.className = 'shield-empty-item';
          emptyLi.textContent = 'Nenhum rastreador detectado até o momento.';
          this.trackersListEl.appendChild(emptyLi);
        }
      }
    } catch (err) {
      console.warn('[PrivacyShield] Erro ao carregar dados:', err);
    }
  }

  renderProtectionState() {
    if (this.statusTextEl) {
      this.statusTextEl.textContent = this.isProtected
        ? 'Proteção ativada neste site'
        : 'Proteção desativada neste site';
    }

    if (this.toggleBtn) {
      if (this.isProtected) {
        this.toggleBtn.classList.add('active');
        this.toggleBtn.setAttribute('aria-checked', 'true');
      } else {
        this.toggleBtn.classList.remove('active');
        this.toggleBtn.setAttribute('aria-checked', 'false');
      }
    }

    if (this.btn) {
      if (!this.isProtected) {
        this.btn.classList.add('protection-off');
      } else {
        this.btn.classList.remove('protection-off');
      }
    }
  }

  /**
   * Atualização contínua via broadcast de estado
   * @param {object} state
   */
  update(state) {
    if (!state) return;

    const info = state.privacyInfo || { count: 0, isProtected: true };
    const count = info.count || 0;

    // Atualiza o badge numérico na barra
    if (this.badge) {
      this.badge.textContent = count;
      if (count > 0) {
        this.badge.classList.add('has-blocked');
      } else {
        this.badge.classList.remove('has-blocked');
      }
    }

    if (this.gradeBadge && info.grade) {
      const grade = info.grade.toUpperCase();
      this.gradeBadge.textContent = grade;
      this.gradeBadge.className = `shield-grade-badge grade-${grade.toLowerCase()}`;
      this.gradeBadge.title = `Classificação de privacidade: Nota ${grade}`;
    }

    if (this.btn) {
      if (!info.isProtected) {
        this.btn.classList.add('protection-off');
        this.btn.title = 'Proteção desativada neste site (clique para gerenciar)';
      } else {
        this.btn.classList.remove('protection-off');
        this.btn.title = `Proteção contra rastreadores (${count} bloqueados)`;
      }
    }

    // Se o painel estiver aberto no momento, atualiza seu conteúdo também
    if (this.isOpen) {
      this.refreshData();
    }
  }
}

// Exporta globalmente para uso no app.js sem dependência de bundler
window.PrivacyShieldComponent = PrivacyShieldComponent;
