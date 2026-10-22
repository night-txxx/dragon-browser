// =============================================================================
// src/preload/preload.js
// Ponte de comunicação segura (Bridge) entre a Interface (HTML) e o Main Process
// Segurança máxima: contextIsolation: true, sandbox: true, nodeIntegration: false
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expõe uma API estrita e controlada no objeto global window.browserAPI
 * A interface gráfica (renderer) NÃO tem acesso ao Node.js nem ao ipcRenderer direto.
 */
contextBridge.exposeInMainWorld('browserAPI', {
  // --- Gerenciamento de Abas ---
  createTab: (url) => ipcRenderer.invoke('tabs:create', url),
  createPrivateTab: (url) => ipcRenderer.invoke('tabs:create-private', url),
  closeTab: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
  selectTab: (tabId) => ipcRenderer.invoke('tabs:select', tabId),
  reorderTabs: (sourceId, targetId) => ipcRenderer.invoke('tabs:reorder', sourceId, targetId),

  // --- Privacidade e Proteção contra Rastreadores ---
  getPrivacyInfo: () => ipcRenderer.invoke('privacy:get-info'),
  toggleSiteProtection: (hostname) => ipcRenderer.invoke('privacy:toggle-protection', hostname),

  // --- Comandos de Navegação ---
  navigate: (urlOrQuery) => ipcRenderer.invoke('navigation:navigate', urlOrQuery),
  allowRedirect: (url) => ipcRenderer.invoke('navigation:allow-redirect', url),
  navigateHome: () => ipcRenderer.invoke('navigation:home'),
  goBack: () => ipcRenderer.invoke('navigation:back'),
  goForward: () => ipcRenderer.invoke('navigation:forward'),
  reload: () => ipcRenderer.invoke('navigation:reload'),
  stop: () => ipcRenderer.invoke('navigation:stop'),

  // --- Busca na Página (Ctrl+F) ---
  findInPage: (text, forward = true, findNext = false) => ipcRenderer.invoke('search:find', { text, forward, findNext }),
  stopFindInPage: (action = 'clearSelection') => ipcRenderer.invoke('search:stop', action),
  setFindBarOpen: (open) => ipcRenderer.invoke('window:set-findbar-open', open),
  setRedirectBarOpen: (open) => ipcRenderer.invoke('window:set-redirect-bar-open', open),

  // --- Sugestões na Barra de Endereço (Omnibox) ---
  getOmniboxSuggestions: (query) => ipcRenderer.invoke('omnibox:suggestions', query),

  // --- Favoritos ---
  toggleBookmark: (url, title) => ipcRenderer.invoke('bookmarks:toggle', { url, title }),
  isBookmarked: (url) => ipcRenderer.invoke('bookmarks:is-bookmarked', url),

  // --- Permissões por Site ---
  respondPermission: (requestId, allowed, remember) => ipcRenderer.invoke('permissions:respond', { requestId, allowed, remember }),

  // --- Controle de Camadas / Overlay ---
  showOverlay: (owner = 'default') => ipcRenderer.invoke('window:show-overlay', owner),
  hideOverlay: (owner = 'default') => ipcRenderer.invoke('window:hide-overlay', owner),

  // --- Apagar Tudo (Fogo do Dragão Azul) ---
  clearAllData: (options) => ipcRenderer.invoke('app:clear-all-data', options),
  finishClearSession: () => ipcRenderer.invoke('app:finish-clear-session'),

  // --- Downloads com Risco de Execução (ETAPA 4) ---
  confirmRiskDownload: (downloadId) => ipcRenderer.invoke('downloads:confirm-risk', downloadId),
  cancelRiskDownload: (downloadId) => ipcRenderer.invoke('downloads:cancel-risk', downloadId),

  // --- Obtenção de Estado Inicial e Configurações ---
  getState: () => ipcRenderer.invoke('app:get-state'),
  openSettings: () => ipcRenderer.invoke('app:open-settings'),
  openDownloads: () => ipcRenderer.invoke('app:open-downloads'),
  openHistory: () => ipcRenderer.invoke('app:open-history'),
  openBookmarks: () => ipcRenderer.invoke('app:open-bookmarks'),

  // --- Eventos recebidos do Main Process ---
  onStateUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, state) => callback(state);
    ipcRenderer.on('browser:state-update', subscription);

    return () => {
      ipcRenderer.removeListener('browser:state-update', subscription);
    };
  },

  onSettingsUpdated: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, settings) => callback(settings);
    ipcRenderer.on('browser:settings-updated', subscription);

    return () => {
      ipcRenderer.removeListener('browser:settings-updated', subscription);
    };
  },

  onFocusAddressBar: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:focus-addressbar', subscription);

    return () => {
      ipcRenderer.removeListener('browser:focus-addressbar', subscription);
    };
  },

  onTriggerClearData: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:trigger-clear-data', subscription);

    return () => {
      ipcRenderer.removeListener('browser:trigger-clear-data', subscription);
    };
  },

  onHtmlFullScreenChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('browser:html-fullscreen-changed', subscription);

    return () => {
      ipcRenderer.removeListener('browser:html-fullscreen-changed', subscription);
    };
  },

  onFindResult: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, result) => callback(result);
    ipcRenderer.on('browser:find-result', subscription);

    return () => {
      ipcRenderer.removeListener('browser:find-result', subscription);
    };
  },

  onOpenFind: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:open-find', subscription);

    return () => {
      ipcRenderer.removeListener('browser:open-find', subscription);
    };
  },

  onToggleBookmark: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:toggle-bookmark', subscription);

    return () => {
      ipcRenderer.removeListener('browser:toggle-bookmark', subscription);
    };
  },

  onPromptPermission: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:prompt-permission', subscription);

    return () => {
      ipcRenderer.removeListener('browser:prompt-permission', subscription);
    };
  },

  onCancelPermissionPrompt: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:cancel-permission-prompt', subscription);

    return () => {
      ipcRenderer.removeListener('browser:cancel-permission-prompt', subscription);
    };
  },

  onDownloadUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, downloadData) => callback(downloadData);
    ipcRenderer.on('browser:download-update', subscription);

    return () => {
      ipcRenderer.removeListener('browser:download-update', subscription);
    };
  },

  onRedirectBlocked: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:redirect-blocked', subscription);

    return () => {
      ipcRenderer.removeListener('browser:redirect-blocked', subscription);
    };
  },

  onDownloadRiskPrompt: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:download-risk-prompt', subscription);

    return () => {
      ipcRenderer.removeListener('browser:download-risk-prompt', subscription);
    };
  }
});
