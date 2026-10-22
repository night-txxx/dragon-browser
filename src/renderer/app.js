// =============================================================================
// src/renderer/app.js
// Ponto de entrada do processo de renderização (UI)
// Orquestra os componentes e consome o estado reativo via window.browserAPI
// =============================================================================

// Tratamento de erros e logs consistentes na interface gráfica
window.addEventListener('error', (event) => {
  console.error('[Dragon Renderer] Erro na interface:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Dragon Renderer] Rejeição de Promise não tratada na interface:', event.reason);
});

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Instanciação dos componentes visuais
  const toolbar = new window.ToolbarComponent();
  const addressbar = new window.AddressBarComponent();
  const tabsView = new window.TabsViewComponent();
  const privacyShield = new window.PrivacyShieldComponent();
  const findBar = new window.FindBarComponent();
  const permissionSheet = new window.PermissionSheetComponent();
  const downloadRiskSheet = new window.DownloadRiskSheetComponent();

  // Componentes do Dragão Azul (Apagar Tudo)
  const fireAnimation = new window.FireAnimationComponent();

  let fireButton = null;
  const fireSheet = new window.FireSheetComponent({
    onConfirm: (options) => {
      if (fireButton) {
        fireButton.setBusy(true);
      }
      const coords = fireButton ? fireButton.getOriginCoords() : { x: window.innerWidth - 30, y: 38 };
      fireAnimation.start(coords, () => {
        if (fireButton) {
          fireButton.setBusy(false);
        }
      }, options);
    }
  });

  fireButton = new window.FireButtonComponent({
    onTrigger: () => {
      fireSheet.open();
    }
  });

  /**
   * Aplica configurações de aparência (cor de destaque e tema claro/escuro) em tempo real
   * @param {object} settings Configurações recebidas
   */
  function applyGlobalTheme(settings) {
    if (!settings) return;
    const root = document.documentElement;

    // 1. Cor de destaque (accent color)
    if (settings.accentColor) {
      root.style.setProperty('--color-accent', settings.accentColor);
      root.style.setProperty('--color-border-focus', settings.accentColor);
    }

    // 2. Tema da interface (escuro, claro ou seguir sistema)
    if (settings.theme) {
      document.body.classList.remove('theme-light');
      if (settings.theme === 'light') {
        document.body.classList.add('theme-light');
      } else if (settings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (!prefersDark) {
          document.body.classList.add('theme-light');
        }
      }
    }
  }

  /**
   * Distribui o estado recebido do processo principal para todos os componentes
   * @param {object} state Objeto de estado consolidado do navegador
   */
  function handleStateUpdate(state) {
    if (!state) return;
    tabsView.update(state);
    toolbar.update(state);
    addressbar.update(state);
    privacyShield.update(state);
    if (state.settings) {
      applyGlobalTheme(state.settings);
    }
  }

  // 2. Conecta ao listener de atualizações de estado em tempo real
  if (window.browserAPI && typeof window.browserAPI.onStateUpdate === 'function') {
    window.browserAPI.onStateUpdate((state) => {
      handleStateUpdate(state);
    });
  }

  // 3. Conecta ao evento de solicitação de foco na barra de endereços (ex: atalho Ctrl+L)
  if (window.browserAPI && typeof window.browserAPI.onFocusAddressBar === 'function') {
    window.browserAPI.onFocusAddressBar(() => {
      addressbar.focus();
    });
  }

  // 4. Conecta ao evento de atalho para Apagar Tudo (Ctrl+Shift+Delete)
  if (window.browserAPI && typeof window.browserAPI.onTriggerClearData === 'function') {
    window.browserAPI.onTriggerClearData(() => {
      fireSheet.open();
    });
  }

  // 5. Conecta ao evento de atualização de configurações em tempo real
  if (window.browserAPI && typeof window.browserAPI.onSettingsUpdated === 'function') {
    window.browserAPI.onSettingsUpdated((newSettings) => {
      applyGlobalTheme(newSettings);
    });
  }

  // 5.1 Conecta ao evento de tela cheia HTML5 para ocultar ou exibir a barra superior
  if (window.browserAPI && typeof window.browserAPI.onHtmlFullScreenChanged === 'function') {
    window.browserAPI.onHtmlFullScreenChanged((isFullscreen) => {
      document.body.classList.toggle('html-fullscreen', Boolean(isFullscreen));
    });
  }

  // 6. Solicita o estado atual imediatamente para renderizar o layout inicial
  if (window.browserAPI && typeof window.browserAPI.getState === 'function') {
    try {
      const initialState = await window.browserAPI.getState();
      handleStateUpdate(initialState);
    } catch (err) {
      console.error('[Renderer] Falha ao carregar estado inicial do navegador:', err);
    }
  }
});
