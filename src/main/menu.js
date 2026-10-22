// =============================================================================
// src/main/menu.js
// Gerenciamento dos atalhos de teclado do navegador
// =============================================================================

const { Menu } = require('electron');

let isClearing = false;

/**
 * Define se o navegador está atualmente executando o procedimento de limpeza de dados.
 * Enquanto ativo, todos os atalhos de teclado são imediatamente ignorados.
 * @param {boolean} active
 */
function setIsClearing(active) {
  isClearing = Boolean(active);
}

/**
 * Retorna se a limpeza de dados está em andamento
 * @returns {boolean}
 */
function getIsClearing() {
  return isClearing;
}

/**
 * Alterna a abertura do console de desenvolvedor (DevTools)
 * Prioriza o DevTools da aba ativa; se não houver, abre da janela principal.
 * @param {object} mainWindow Janela principal
 * @param {object} tabManager Gerenciador de abas
 */
function toggleDevTools(mainWindow, tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (activeTab && activeTab.view) {
    if (activeTab.view.webContents.isDevToolsOpened()) {
      activeTab.view.webContents.closeDevTools();
    } else {
      activeTab.view.webContents.openDevTools({ mode: 'detach' });
    }
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.toggleDevTools();
  }
}

/**
 * Trata eventos de tecla pressionada ('keyDown') disparados tanto pela
 * interface principal quanto pelas WebContentsViews das abas.
 *
 * @param {Event} event Evento do Electron
 * @param {object} input Informações da tecla pressionada
 * @param {object} context Contexto com mainWindow, tabManager e navigation
 * @returns {boolean} True se o atalho foi consumido
 */
function handleKeyboardEvent(event, input, context) {
  // Se a limpeza de dados estiver em andamento, bloqueia todos os atalhos para manter a interface travada
  if (isClearing) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    return true;
  }

  if (input.type !== 'keyDown') return false;

  const { mainWindow, tabManager, navigation } = context;
  const isCtrl = input.control || input.meta;
  const key = input.key ? input.key.toLowerCase() : '';

  // 1. Ctrl + Shift + T -> Reabrir aba fechada
  if (isCtrl && input.shift && key === 't' && !input.alt) {
    event.preventDefault();
    tabManager.reopenClosedTab();
    return true;
  }

  // 2. Ctrl + T -> Nova aba
  if (isCtrl && key === 't' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.createTab();
    return true;
  }

  // 3. Ctrl + W -> Fechar aba ativa
  if (isCtrl && key === 'w' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.closeActiveTab();
    return true;
  }

  // 4. Ctrl + L -> Focar barra de endereço
  if (isCtrl && key === 'l' && !input.shift && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:focus-addressbar');
    }
    return true;
  }

  // 5. Ctrl + F -> Busca na página
  if (isCtrl && key === 'f' && !input.shift && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:open-find');
    }
    return true;
  }

  // 6. Ctrl + D -> Favoritar página atual
  if (isCtrl && key === 'd' && !input.shift && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:toggle-bookmark');
    }
    return true;
  }

  // 7. Ctrl + R ou F5 -> Recarregar página
  if ((isCtrl && key === 'r' && !input.alt) || input.key === 'F5') {
    event.preventDefault();
    navigation.reload(tabManager);
    return true;
  }

  // 8. Alt + Seta Esquerda -> Voltar
  if (input.alt && (input.key === 'ArrowLeft' || input.key === 'Left') && !isCtrl) {
    event.preventDefault();
    navigation.goBack(tabManager);
    return true;
  }

  // 9. Alt + Seta Direita -> Avançar
  if (input.alt && (input.key === 'ArrowRight' || input.key === 'Right') && !isCtrl) {
    event.preventDefault();
    navigation.goForward(tabManager);
    return true;
  }

  // 10. Alt + Home -> Página Inicial
  if (input.alt && (key === 'home' || input.key === 'Home') && !isCtrl) {
    event.preventDefault();
    navigation.goHome(tabManager);
    return true;
  }

  // 11. Ctrl + Shift + Tab -> Aba anterior
  if (isCtrl && input.shift && input.key === 'Tab' && !input.alt) {
    event.preventDefault();
    tabManager.selectPreviousTab();
    return true;
  }

  // 12. Ctrl + Tab -> Próxima aba
  if (isCtrl && input.key === 'Tab' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.selectNextTab();
    return true;
  }

  // 13. Ctrl + 1 a 8 -> Ir para aba 1..8
  if (isCtrl && !input.shift && !input.alt && /^[1-8]$/.test(input.key)) {
    event.preventDefault();
    const tabIndex = parseInt(input.key, 10) - 1;
    tabManager.selectTabByIndex(tabIndex);
    return true;
  }

  // 14. Ctrl + 9 -> Ir para a última aba
  if (isCtrl && input.key === '9' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.selectLastTab();
    return true;
  }

  // 15. Zoom: Ctrl + / Ctrl - / Ctrl 0
  if (isCtrl && (key === '+' || key === '=' || input.key === '+' || input.key === '=') && !input.alt) {
    event.preventDefault();
    tabManager.zoomIn();
    return true;
  }
  if (isCtrl && (key === '-' || key === '_' || input.key === '-') && !input.alt) {
    event.preventDefault();
    tabManager.zoomOut();
    return true;
  }
  if (isCtrl && key === '0' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.zoomReset();
    return true;
  }

  // 16. F12 -> DevTools
  if (input.key === 'F12') {
    event.preventDefault();
    toggleDevTools(mainWindow, tabManager);
    return true;
  }

  // 17. Ctrl + Shift + Delete -> Apagar Tudo (Fogo do Dragão Azul)
  if (isCtrl && input.shift && (key === 'delete' || input.key === 'Delete') && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:trigger-clear-data');
    }
    return true;
  }

  // 18. Ctrl + Shift + N -> Nova Aba Privada
  if (isCtrl && input.shift && key === 'n' && !input.alt) {
    event.preventDefault();
    tabManager.createPrivateTab();
    return true;
  }

  // 19. Ctrl + , -> Abrir Configurações
  if (isCtrl && (key === ',' || input.key === ',') && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.openSettingsTab();
    return true;
  }

  // 20. Ctrl + H -> Histórico
  if (isCtrl && key === 'h' && !input.shift && !input.alt) {
    event.preventDefault();
    if (typeof tabManager.openHistoryTab === 'function') {
      tabManager.openHistoryTab();
    } else {
      tabManager.createTab('dragon://history', { active: true });
    }
    return true;
  }

  // 21. Ctrl + J -> Downloads
  if (isCtrl && key === 'j' && !input.shift && !input.alt) {
    event.preventDefault();
    if (typeof tabManager.openDownloadsTab === 'function') {
      tabManager.openDownloadsTab();
    } else {
      tabManager.createTab('dragon://downloads', { active: true });
    }
    return true;
  }

  return false;
}

/**
 * Inicializa os atalhos de teclado da aplicação
 * @param {object} context Objeto contendo { mainWindow, tabManager, navigation }
 */
function init(context) {
  const { mainWindow, tabManager } = context;

  // Intercepta atalhos quando o foco está na interface (HTML)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    handleKeyboardEvent(event, input, context);
  });

  // Conecta o manipulador ao TabManager para interceptar teclas dentro dos WebContentsViews
  tabManager.setShortcutHandler((event, input) => {
    handleKeyboardEvent(event, input, context);
  });

  // Configura um menu de aplicação limpo do Electron para habilitar aceleradores nativos
  const template = [
    {
      label: 'Navegação',
      submenu: [
        {
          label: 'Nova Aba',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            if (isClearing) return;
            tabManager.createTab();
          }
        },
        {
          label: 'Reabrir Aba Fechada',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            if (isClearing) return;
            tabManager.reopenClosedTab();
          }
        },
        {
          label: 'Nova Aba Privada',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            if (isClearing) return;
            tabManager.createPrivateTab();
          }
        },
        {
          label: 'Fechar Aba',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (isClearing) return;
            tabManager.closeActiveTab();
          }
        },
        {
          label: 'Focar Barra de Endereço',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:focus-addressbar');
            }
          }
        },
        {
          label: 'Localizar na Página',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:open-find');
            }
          }
        },
        {
          label: 'Favoritar Página',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:toggle-bookmark');
            }
          }
        },
        {
          label: 'Página Inicial',
          accelerator: 'Alt+Home',
          click: () => {
            if (isClearing) return;
            context.navigation.goHome(tabManager);
          }
        },
        {
          label: 'Recarregar',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (isClearing) return;
            context.navigation.reload(tabManager);
          }
        },
        {
          label: 'Próxima Aba',
          accelerator: 'Ctrl+Tab',
          click: () => {
            if (isClearing) return;
            tabManager.selectNextTab();
          }
        },
        {
          label: 'Aba Anterior',
          accelerator: 'Ctrl+Shift+Tab',
          click: () => {
            if (isClearing) return;
            tabManager.selectPreviousTab();
          }
        },
        {
          label: 'Zoom +',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            if (isClearing) return;
            tabManager.zoomIn();
          }
        },
        {
          label: 'Zoom -',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (isClearing) return;
            tabManager.zoomOut();
          }
        },
        {
          label: 'Zoom 100%',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (isClearing) return;
            tabManager.zoomReset();
          }
        },
        {
          label: 'Apagar Tudo...',
          accelerator: 'CmdOrCtrl+Shift+Delete',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:trigger-clear-data');
            }
          }
        },
        {
          label: 'Configurações',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (isClearing) return;
            tabManager.openSettingsTab();
          }
        },
        {
          label: 'Alternar Ferramentas de Desenvolvedor',
          accelerator: 'F12',
          click: () => {
            if (isClearing) return;
            toggleDevTools(mainWindow, tabManager);
          }
        }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);

  return {
    handleKeyboardEvent,
    toggleDevTools,
    setIsClearing,
    getIsClearing
  };
}

module.exports = {
  init,
  handleKeyboardEvent,
  toggleDevTools,
  setIsClearing,
  getIsClearing
};
