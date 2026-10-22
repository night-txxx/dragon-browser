// =============================================================================
// src/main/window.js
// Criação da janela principal do navegador e gerenciamento de layout
// =============================================================================

const { BrowserWindow } = require('electron');
const path = require('path');
const config = require('./config');
const windowState = require('./window-state');

let mainWindow = null;
let tabManagerRef = null;
let isOverlayActive = false;
let isHtmlFullScreen = false;
let isFindBarOpen = false;
const FIND_BAR_HEIGHT = 44;
let wasWindowFullScreenBeforeVideo = false;

/**
 * Atualiza as coordenadas e dimensões da WebContentsView da aba ativa.
 * Em modo normal: a interface do navegador ocupa os primeiros config.TOP_BAR_HEIGHT pixels no topo.
 * Se a barra de busca (Ctrl+F) estiver aberta, desloca a visualização para baixo para abrir espaço visível.
 * Em modo tela cheia HTML5 (vídeo): a view ocupa a janela inteira a partir do topo (y = 0).
 */
function updateActiveViewBounds() {
  if (!mainWindow || !tabManagerRef) return;

  const activeTab = tabManagerRef.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  // getContentBounds retorna as dimensões da área útil da janela (descontando bordas do SO)
  const { width, height } = mainWindow.getContentBounds();
  const topOffset = isHtmlFullScreen ? 0 : (config.TOP_BAR_HEIGHT + (isFindBarOpen ? FIND_BAR_HEIGHT : 0));
  const contentHeight = isHtmlFullScreen ? height : Math.max(0, height - topOffset);

  activeTab.view.setBounds({
    x: 0,
    y: topOffset,
    width: width,
    height: contentHeight
  });
}

/**
 * Define se a barra de busca textual está aberta e ajusta a visualização sem ocultar a página
 * @param {boolean} open
 */
function setFindBarOpen(open) {
  isFindBarOpen = Boolean(open);
  updateActiveViewBounds();
}

/**
 * Retorna se a barra de busca está aberta
 * @returns {boolean}
 */
function getIsFindBarOpen() {
  return isFindBarOpen;
}

/**
 * Alterna o estado de tela cheia de vídeo HTML5 (enter-html-full-screen / leave-html-full-screen).
 * Ajusta os limites da visualização ativa para cobrir toda a janela e notifica o renderer.
 * @param {boolean} active
 */
function setHtmlFullScreen(active) {
  const willBeActive = Boolean(active);
  if (willBeActive && !isHtmlFullScreen) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      wasWindowFullScreenBeforeVideo = mainWindow.isFullScreen();
      if (!wasWindowFullScreenBeforeVideo) {
        mainWindow.setFullScreen(true);
      }
    }
  } else if (!willBeActive && isHtmlFullScreen) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!wasWindowFullScreenBeforeVideo) {
        mainWindow.setFullScreen(false);
      }
    }
  }

  isHtmlFullScreen = willBeActive;
  updateActiveViewBounds();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser:html-fullscreen-changed', isHtmlFullScreen);
  }
}

/**
 * Retorna se o modo de tela cheia HTML5 está ativo
 * @returns {boolean}
 */
function getIsHtmlFullScreen() {
  return isHtmlFullScreen;
}

/**
 * Oculta temporariamente a WebContentsView ativa.
 *
 * IMPORTANTE: No Electron moderno, os WebContentsView são desenhados por cima
 * de qualquer elemento HTML da janela principal. Quando precisamos abrir
 * menus suspensos, modais ou listas na barra do navegador que ultrapassem a altura
 * da barra superior, chamamos showOverlay() para esconder o site e permitir que o
 * HTML da interface seja visto.
 */
function showOverlay() {
  isOverlayActive = true;
  if (!tabManagerRef) return;
  const activeTab = tabManagerRef.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.setVisible(false);
  }
}

/**
 * Restaura a visualização da WebContentsView ativa após o fechamento de um menu ou modal.
 */
function hideOverlay() {
  isOverlayActive = false;
  if (!tabManagerRef) return;
  const activeTab = tabManagerRef.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.setVisible(true);
    // Garante que o layout esteja ajustado ao tamanho atual da janela
    updateActiveViewBounds();
  }
}

/**
 * Retorna se o overlay está ativo no momento
 */
function getIsOverlayActive() {
  return isOverlayActive;
}

/**
 * Retorna a referência da janela principal
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * Cria a janela principal do navegador e configura eventos de layout
 * @param {object} context Contexto global da aplicação
 * @returns {object} Controlador da janela
 */
function init(context) {
  const savedState = windowState.loadWindowState();

  mainWindow = new BrowserWindow({
    ...config.WINDOW_DEFAULTS,
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    icon: path.join(__dirname, '../../assets/icons/favicon-circle.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Carrega a interface HTML do navegador (barra de topo, abas e navegação)
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);

  // Quando a janela for redimensionada ou movida, salva estado e atualiza bounds
  mainWindow.on('resize', () => {
    updateActiveViewBounds();
    windowState.saveWindowState(mainWindow);
  });

  mainWindow.on('move', () => {
    windowState.saveWindowState(mainWindow);
  });

  // Quando a janela for restaurada de minimizada/maximizada
  mainWindow.on('maximize', () => {
    updateActiveViewBounds();
    windowState.saveWindowState(mainWindow);
  });

  mainWindow.on('unmaximize', () => {
    updateActiveViewBounds();
    windowState.saveWindowState(mainWindow);
  });

  mainWindow.on('close', () => {
    windowState.saveWindowState(mainWindow);
  });

  const windowController = {
    getMainWindow,
    updateActiveViewBounds,
    setHtmlFullScreen,
    getIsHtmlFullScreen,
    setFindBarOpen,
    getIsFindBarOpen,
    showOverlay,
    hideOverlay,
    getIsOverlayActive,
    setTabManager: (tm) => {
      tabManagerRef = tm;
    }
  };

  return windowController;
}

module.exports = {
  init,
  getMainWindow,
  updateActiveViewBounds,
  setHtmlFullScreen,
  getIsHtmlFullScreen,
  setFindBarOpen,
  getIsFindBarOpen,
  showOverlay,
  hideOverlay,
  getIsOverlayActive
};
