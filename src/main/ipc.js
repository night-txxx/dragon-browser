// =============================================================================
// src/main/ipc.js
// Registro centralizado de todos os canais IPC da aplicação
// Interface (renderer) <---> Preload <---> Processo Principal (main)
// Validação rigorosa de segurança em TODOS os canais contra chamadas não autorizadas
// =============================================================================

const { ipcMain } = require('electron');
const bookmarks = require('./bookmarks');
const clearData = require('./clear-data');
const config = require('./config');
const downloads = require('./downloads');
const history = require('./history');
const menu = require('./menu');
const permissions = require('./permissions');
const privacy = require('./privacy');
const sessionModule = require('./session');
const settings = require('./settings');
const fingerprintProtection = require('./fingerprint-protection');

/**
 * Validação rigorosa para garantir que o remetente do IPC é estritamente
 * a interface gráfica da janela principal (mainWindow.webContents).
 * Abas de conteúdo externo ou frames secundários NUNCA podem invocar estes canais.
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {Electron.BrowserWindow} mainWindow
 * @returns {boolean}
 */
function isMainSender(event, mainWindow) {
  if (!event || !event.sender || !mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  return event.sender === mainWindow.webContents;
}

/**
 * Validação rigorosa genérica de remetente para qualquer página interna autorizada
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} targetCanonicalUrl
 * @returns {boolean}
 */
function isPageSender(event, targetCanonicalUrl) {
  if (!event || !event.senderFrame || !event.sender) return false;
  if (event.sender.mainFrame !== event.senderFrame) return false;

  const senderUrl = event.senderFrame.url;
  if (typeof senderUrl !== 'string' || !senderUrl) return false;

  try {
    const senderClean = new URL(senderUrl);
    senderClean.search = '';
    senderClean.hash = '';

    const targetClean = new URL(targetCanonicalUrl);
    targetClean.search = '';
    targetClean.hash = '';

    return senderClean.href.toLowerCase() === targetClean.href.toLowerCase();
  } catch {
    return false;
  }
}

function isSettingsSender(event) {
  return isPageSender(event, config.SETTINGS_PAGE_URL);
}

function isWarningSender(event) {
  return isPageSender(event, config.HTTPS_WARNING_URL);
}

function isHistorySender(event) {
  return isPageSender(event, config.HISTORY_PAGE_URL);
}

function isBookmarksSender(event) {
  return isPageSender(event, config.BOOKMARKS_PAGE_URL);
}

function isDownloadsSender(event) {
  return isPageSender(event, config.DOWNLOADS_PAGE_URL);
}

function isCertErrorSender(event) {
  return isPageSender(event, config.CERT_ERROR_PAGE_URL);
}

/**
 * Navega o webContents da aba do remetente para a URL solicitada
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} rawUrl
 * @param {object} tabManager
 * @param {object} navigation
 * @returns {boolean}
 */
function navigateSenderTab(event, rawUrl, tabManager, navigation) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  const targetUrl = navigation.normalizeInput(rawUrl);
  if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(targetUrl)) {
    console.warn('[Segurança] URL não permitida bloqueada para aba do remetente:', targetUrl);
    return false;
  }
  if (!event.sender || event.sender.isDestroyed()) return false;
  event.sender.loadURL(targetUrl).catch(err => {
    if (err && err.code !== 'ERR_ABORTED') {
      console.warn(`[Navegação] Falha ao carregar ${targetUrl} na aba do remetente:`, err.message);
    }
  });
  return true;
}

/**
 * Registra todos os manipuladores de IPC com validação de entrada de dados.
 * @param {object} context Objeto contendo { mainWindow, windowManager, tabManager, navigation, storage }
 */
function init(context) {
  const { mainWindow, windowManager, tabManager, navigation, storage } = context;

  // ---------------------------------------------------------------------------
  // CANAIS: app:open-settings, app:open-downloads, app:open-history, app:open-bookmarks
  // Finalidade: Abrem as páginas internas em aba dedicada ou trocam para ela se já aberta
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:open-settings', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-settings: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openSettingsTab();
    return tab ? tab.id : null;
  });

  ipcMain.handle('app:open-downloads', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-downloads: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openDownloadsTab();
    return tab ? tab.id : null;
  });

  ipcMain.handle('app:open-history', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-history: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openHistoryTab();
    return tab ? tab.id : null;
  });

  ipcMain.handle('app:open-bookmarks', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-bookmarks: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openBookmarksTab();
    return tab ? tab.id : null;
  });

  // CANAL: window:set-findbar-open
  // Notifica o windowManager para reservar espaço abaixo da topbar para a barra de busca (Ctrl+F)
  ipcMain.handle('window:set-findbar-open', (event, open) => {
    if (!isMainSender(event, mainWindow)) return false;
    if (windowManager && typeof windowManager.setFindBarOpen === 'function') {
      windowManager.setFindBarOpen(Boolean(open));
      return true;
    }
    return false;
  });

  // Notifica o renderer e a aba de configurações sempre que houver alteração
  settings.onChange((key, value, allSettings) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // A UI principal só precisa de accentColor e theme
      mainWindow.webContents.send('browser:settings-updated', {
        accentColor: allSettings.accentColor,
        theme: allSettings.theme
      });
    }
    // Emite o evento settings:changed em tempo real para abas abertas de configurações
    if (tabManager && typeof tabManager.broadcastToSettingsTabs === 'function') {
      tabManager.broadcastToSettingsTabs('settings:changed', { key, value, allSettings });
    }
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:create
  // Finalidade: Cria uma nova aba de navegação.
  // Parâmetro opcional: url (string)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:create', (event, initialUrl) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em tabs:create: remetente não é a janela principal');
      return null;
    }
    let validUrl = typeof initialUrl === 'string' && initialUrl.trim().length > 0
      ? initialUrl.trim()
      : null;
    if (validUrl) {
      const resolved = typeof tabManager.resolveInternalUrl === 'function'
        ? tabManager.resolveInternalUrl(validUrl)
        : validUrl;

      if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(resolved)) {
        console.warn('[IPC:tabs:create] URL bloqueada por esquema não permitido:', validUrl);
        validUrl = null;
      } else {
        if (resolved === config.SETTINGS_PAGE_URL) {
          const tab = tabManager.openSettingsTab();
          return tab ? tab.id : null;
        }
        if (resolved === config.DOWNLOADS_PAGE_URL) {
          const tab = tabManager.openDownloadsTab();
          return tab ? tab.id : null;
        }
        if (resolved === config.HISTORY_PAGE_URL) {
          const tab = tabManager.openHistoryTab();
          return tab ? tab.id : null;
        }
        if (resolved === config.BOOKMARKS_PAGE_URL) {
          const tab = tabManager.openBookmarksTab();
          return tab ? tab.id : null;
        }
        validUrl = resolved;
      }
    }
    return tabManager.createTab(validUrl, { active: true }).id;
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:close
  // Finalidade: Fecha a aba identificada pelo tabId.
  // Parâmetro: tabId (string)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:close', (event, tabId) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em tabs:close: remetente não é a janela principal');
      return false;
    }
    if (typeof tabId !== 'string' || !tabId) {
      console.warn('[IPC:tabs:close] tabId inválido recebido:', tabId);
      return false;
    }
    tabManager.closeTab(tabId);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:select
  // Finalidade: Torna ativa a aba com o identificador fornecido.
  // Parâmetro: tabId (string)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:select', (event, tabId) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em tabs:select: remetente não é a janela principal');
      return false;
    }
    if (typeof tabId !== 'string' || !tabId) {
      console.warn('[IPC:tabs:select] tabId inválido recebido:', tabId);
      return false;
    }
    tabManager.setActiveTab(tabId);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:navigate
  // Finalidade: Navega a aba ativa para o endereço ou termo de busca fornecido.
  // Parâmetro: urlOrQuery (string)
  // Permite apenas http:, https: e páginas internas do Dragon
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:navigate', (event, urlOrQuery) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em navigation:navigate: remetente não é a janela principal');
      return false;
    }
    if (typeof urlOrQuery !== 'string' || !urlOrQuery.trim()) {
      console.warn('[IPC:navigation:navigate] Valor inválido recebido:', urlOrQuery);
      return false;
    }
    const targetUrl = navigation.normalizeInput(urlOrQuery);
    if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(targetUrl)) {
      console.warn('[IPC:navigation:navigate] Navegação bloqueada para URL não permitida:', targetUrl);
      return false;
    }
    // Se a URL normalizada for uma página interna com aba dedicada, abre ou alterna para ela
    if (targetUrl === config.SETTINGS_PAGE_URL) {
      tabManager.openSettingsTab();
      return true;
    }
    if (targetUrl === config.DOWNLOADS_PAGE_URL) {
      tabManager.openDownloadsTab();
      return true;
    }
    if (targetUrl === config.HISTORY_PAGE_URL) {
      tabManager.openHistoryTab();
      return true;
    }
    if (targetUrl === config.BOOKMARKS_PAGE_URL) {
      tabManager.openBookmarksTab();
      return true;
    }
    navigation.loadURL(tabManager, urlOrQuery);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:allow-redirect
  // Finalidade: Permite um redirecionamento que havia sido bloqueado por segurança.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:allow-redirect', (event, targetUrl) => {
    if (!isMainSender(event, mainWindow)) return false;
    if (typeof targetUrl !== 'string' || !tabManager.isAllowedNavigationUrl(targetUrl)) {
      return false;
    }
    tabManager.allowRedirect(targetUrl);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:back
  // Finalidade: Retorna para a página anterior no histórico da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:back', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.goBack(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:forward
  // Finalidade: Avança para a próxima página no histórico da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:forward', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.goForward(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:reload
  // Finalidade: Recarrega a página atual da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:reload', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.reload(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:home
  // Finalidade: Navega a aba ativa para a Página Inicial configurada
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:home', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.goHome(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:stop
  // Finalidade: Interrompe o carregamento da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:stop', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.stop(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: window:show-overlay
  // Finalidade: Oculta a WebContentsView para que menus/modais HTML da interface
  // possam ser exibidos sem ficarem cobertos pela camada do site.
  // ---------------------------------------------------------------------------
  ipcMain.handle('window:show-overlay', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    windowManager.showOverlay();
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: window:hide-overlay
  // Finalidade: Restaura a visibilidade da WebContentsView ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('window:hide-overlay', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    windowManager.hideOverlay();
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: app:get-state
  // Finalidade: Retorna o estado completo das abas e da navegação sob demanda.
  // Utilizado pelo renderer no carregamento inicial da interface.
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:get-state', (event) => {
    if (!isMainSender(event, mainWindow)) return null;
    return tabManager.getState();
  });

  // ---------------------------------------------------------------------------
  // CANAL: app:clear-all-data
  // Finalidade: Executa a limpeza completa e profunda de todas as abas, cookies,
  // cache e arquivos locais durante a animação do Dragão Azul.
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:clear-all-data', async (event, options) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] Tentativa não autorizada de invocar app:clear-all-data');
      return { success: false, errors: ['Acesso não autorizado'] };
    }
    menu.setIsClearing(true);
    try {
      const summary = await clearData.clearAllData({
        mainWindow: context.mainWindow,
        tabManager: context.tabManager,
        storage: context.storage,
        includeBookmarks: Boolean(options && options.includeBookmarks)
      });
      return summary;
    } catch (err) {
      menu.setIsClearing(false);
      console.error('[IPC:app:clear-all-data] Erro:', err);
      return {
        success: false,
        errors: [err.message || String(err)]
      };
    }
  });

  // ---------------------------------------------------------------------------
  // CANAL: app:finish-clear-session
  // Finalidade: Invocado estritamente no final da animação de chamas para
  // restaurar a visualização (hideOverlay) e abrir UMA aba limpa ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:finish-clear-session', (event) => {
    if (!isMainSender(event, mainWindow)) return { success: false };
    menu.setIsClearing(false);
    windowManager.hideOverlay();
    const newTab = tabManager.createTab(config.NEW_TAB_URL, { active: true });
    return { success: true, tabId: newTab ? newTab.id : null };
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:create-private
  // Finalidade: Cria uma nova aba privada (sessão isolada em memória, sem persistência)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:create-private', (event, initialUrl) => {
    if (!isMainSender(event, mainWindow)) return null;
    let validUrl = typeof initialUrl === 'string' && initialUrl.trim().length > 0
      ? initialUrl.trim()
      : null;
    if (validUrl && typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(validUrl)) {
      console.warn('[IPC:tabs:create-private] URL bloqueada por esquema não permitido:', validUrl);
      validUrl = null;
    }
    return tabManager.createPrivateTab(validUrl).id;
  });

  // ---------------------------------------------------------------------------
  // CANAL: privacy:get-info
  // Finalidade: Retorna o número e lista de rastreadores bloqueados na aba ativa
  // ---------------------------------------------------------------------------
  ipcMain.handle('privacy:get-info', (event) => {
    if (!isMainSender(event, mainWindow)) return null;
    const activeTab = tabManager.getActiveTab();
    if (!activeTab || !activeTab.view) {
      return { count: 0, domains: [], isProtected: true, hostname: '' };
    }
    return privacy.getPrivacyInfoForTab(activeTab.view.webContents.id, activeTab.url);
  });

  // ---------------------------------------------------------------------------
  // CANAL: privacy:toggle-protection
  // Finalidade: Alterna a proteção contra rastreamento para o domínio do site atual
  // ---------------------------------------------------------------------------
  ipcMain.handle('privacy:toggle-protection', (event, hostname) => {
    if (!isMainSender(event, mainWindow)) return false;
    if (typeof hostname !== 'string' || !hostname) return false;
    const newState = privacy.toggleSiteProtection(hostname);
    tabManager.notifyStateChange();
    return newState;
  });

  // ===========================================================================
  // CANAL DE AVISO HTTPS (SEGURANÇA: REQUER isWarningSender(event))
  // ===========================================================================
  ipcMain.handle('warning:request-bypass-token', (event, targetUrl) => {
    if (!isWarningSender(event)) {
      console.warn('[Segurança] Requisição não autorizada em warning:request-bypass-token de:', event?.senderFrame?.url);
      return null;
    }
    if (typeof targetUrl !== 'string' || !targetUrl.startsWith('http://')) {
      return null;
    }
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname;
      const wcId = event.sender.id;
      return privacy.createHttpBypassToken(wcId, host);
    } catch {
      return null;
    }
  });

  // ===========================================================================
  // CANAIS DE CONFIGURAÇÕES (SEGURANÇA: REQUER isSettingsSender(event))
  // ===========================================================================

  // CANAL: settings:get
  // Retorna todas as configurações salvas (somente para pages/settings.html)
  ipcMain.handle('settings:get', (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:get de origem não autorizada:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return null;
    }
    return settings.getSettingsPageData();
  });

  // CANAL: settings:set
  // Grava uma chave individual de configuração
  ipcMain.handle('settings:set', (event, key, value) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:set de origem não autorizada:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return false;
    }
    return settings.set(key, value);
  });

  // CANAL: settings:set-all
  // Grava um lote de configurações
  ipcMain.handle('settings:set-all', (event, newSettings) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:set-all de origem não autorizada:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return false;
    }
    return settings.setAll(newSettings);
  });

  // CANAL: settings:choose-background-image
  // Abre diálogo nativo do sistema para escolher imagem e copiar para userData
  ipcMain.handle('settings:choose-background-image', async (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:choose-background-image:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return null;
    }
    return settings.chooseBackgroundImage(mainWindow);
  });

  // CANAL: settings:remove-background-image
  // Remove a imagem de fundo salva
  ipcMain.handle('settings:remove-background-image', (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:remove-background-image:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return false;
    }
    return settings.removeBackgroundImage();
  });

  // CANAL: settings:set-proxy-password
  ipcMain.handle('settings:set-proxy-password', (event, password) => {
    if (!isSettingsSender(event)) return false;
    return settings.setProxyPassword(password);
  });

  // CANAL: settings:test-proxy
  ipcMain.handle('settings:test-proxy', async (event, proxyConfig) => {
    if (!isSettingsSender(event)) return { success: false, message: 'Não autorizado.' };
    return settings.testProxyConnection(proxyConfig);
  });

  // CANAL: settings:get-permissions
  ipcMain.handle('settings:get-permissions', (event) => {
    if (!isSettingsSender(event)) return [];
    return permissions.getAllPermissions();
  });

  // CANAL: settings:revoke-permission
  ipcMain.handle('settings:revoke-permission', (event, origin, permKey) => {
    if (!isSettingsSender(event)) return false;
    return permissions.revokePermission(origin, permKey);
  });

  // CANAL: fingerprint:reset
  // Sorteia nova identidade de fingerprint aleatória e consistente, persiste e recarrega abas
  ipcMain.handle('fingerprint:reset', (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição não autorizada em fingerprint:reset');
      return null;
    }
    const result = settings.resetFingerprint();
    if (tabManager && typeof tabManager.reloadAllWebTabs === 'function') {
      tabManager.reloadAllWebTabs();
    }
    return result;
  });

  // CANAL: fingerprint:get-options
  // Retorna listas de opções e presets para popular dropdowns na página de configurações
  ipcMain.handle('fingerprint:get-options', (event) => {
    if (!isSettingsSender(event)) return null;
    return fingerprintProtection.getFingerprintOptions();
  });

  // CANAL: fingerprint:validate
  // Valida consistência interna das configurações de fingerprint
  ipcMain.handle('fingerprint:validate', (event, config) => {
    if (!isSettingsSender(event)) return { valid: true, errors: [], warnings: [] };
    return fingerprintProtection.validateFingerprintConsistency(config);
  });

  // ===========================================================================
  // CANAIS DA INTERFACE PRINCIPAL (Validação: isMainSender)
  // ===========================================================================

  // CANAL: tabs:reorder
  ipcMain.handle('tabs:reorder', (event, sourceId, targetId) => {
    if (!isMainSender(event, mainWindow)) return false;
    tabManager.reorderTabs(sourceId, targetId);
    return true;
  });

  // CANAL: search:find
  ipcMain.handle('search:find', (event, payload) => {
    if (!isMainSender(event, mainWindow)) return false;
    const { text, forward, findNext } = payload || {};
    tabManager.findInPage(text, { forward: forward !== false, findNext: Boolean(findNext) });
    return true;
  });

  // CANAL: search:stop
  ipcMain.handle('search:stop', (event, action) => {
    if (!isMainSender(event, mainWindow)) return false;
    tabManager.stopFindInPage(action);
    return true;
  });

  // CANAL: omnibox:suggestions
  ipcMain.handle('omnibox:suggestions', (event, query) => {
    if (!isMainSender(event, mainWindow)) return { bookmarks: [], history: [], searchItem: null };
    const q = (query || '').trim();
    if (!q) return { bookmarks: [], history: [], searchItem: null };

    const bm = bookmarks.getBookmarks(q).slice(0, 4);
    const hist = history.getEntries(q, 4);
    const searchUrl = settings.getSearchUrl(q);
    const engineInfo = settings.getSearchEngineInfo();

    return {
      searchItem: {
        type: 'search',
        query: q,
        engineName: engineInfo.name,
        searchUrl: searchUrl
      },
      bookmarks: bm,
      history: hist
    };
  });

  // CANAL: bookmarks:toggle
  ipcMain.handle('bookmarks:toggle', (event, payload) => {
    if (!isMainSender(event, mainWindow)) return { bookmarked: false, bookmark: null };
    return bookmarks.toggleBookmark(payload);
  });

  // CANAL: bookmarks:is-bookmarked
  ipcMain.handle('bookmarks:is-bookmarked', (event, url) => {
    if (!isMainSender(event, mainWindow)) return false;
    return bookmarks.isBookmarked(url);
  });

  // CANAL: permissions:respond
  ipcMain.handle('permissions:respond', (event, payload) => {
    if (!isMainSender(event, mainWindow)) return false;
    const { requestId, allowed, remember } = payload || {};
    sessionModule.respondPermission(requestId, allowed, remember);
    return true;
  });

  // ===========================================================================
  // CANAIS DE PÁGINAS INTERNAS ESPECÍFICAS
  // ===========================================================================

  // Histórico (isHistorySender)
  ipcMain.handle('history:get', (event, query) => {
    if (!isHistorySender(event)) return [];
    return history.getEntries(query, 200);
  });

  ipcMain.handle('history:delete', (event, id) => {
    if (!isHistorySender(event)) return false;
    return history.deleteEntry(id);
  });

  ipcMain.handle('history:clear', (event) => {
    if (!isHistorySender(event)) return false;
    history.clearAll();
    return true;
  });

  ipcMain.handle('history:open', (event, url) => {
    if (!isHistorySender(event)) return false;
    return navigateSenderTab(event, url, tabManager, navigation);
  });

  // Favoritos (isBookmarksSender)
  ipcMain.handle('bookmarks:get', (event, query) => {
    if (!isBookmarksSender(event)) return [];
    return bookmarks.getBookmarks(query);
  });

  ipcMain.handle('bookmarks:remove', (event, id) => {
    if (!isBookmarksSender(event)) return false;
    return bookmarks.removeBookmark(id);
  });

  ipcMain.handle('bookmarks:add', (event, item) => {
    if (!isBookmarksSender(event)) return null;
    return bookmarks.addBookmark(item);
  });

  ipcMain.handle('bookmarks:clear', (event) => {
    if (!isBookmarksSender(event)) return false;
    bookmarks.clearAll();
    return true;
  });

  ipcMain.handle('bookmarks:open', (event, url) => {
    if (!isBookmarksSender(event)) return false;
    return navigateSenderTab(event, url, tabManager, navigation);
  });

  // Downloads (isDownloadsSender)
  ipcMain.handle('downloads:get', (event) => {
    if (!isDownloadsSender(event)) return [];
    return downloads.getDownloads();
  });

  ipcMain.handle('downloads:open-file', (event, filePath) => {
    if (!isDownloadsSender(event)) return false;
    downloads.openFile(filePath);
    return true;
  });

  ipcMain.handle('downloads:show-in-folder', (event, filePath) => {
    if (!isDownloadsSender(event)) return false;
    downloads.showInFolder(filePath);
    return true;
  });

  ipcMain.handle('downloads:cancel', (event, id) => {
    if (!isDownloadsSender(event)) return false;
    return downloads.cancelDownload(id);
  });

  ipcMain.handle('downloads:clear', (event) => {
    if (!isDownloadsSender(event)) return false;
    downloads.clearHistory();
    return true;
  });

  ipcMain.handle('downloads:open', (event, url) => {
    if (!isDownloadsSender(event)) return false;
    return navigateSenderTab(event, url, tabManager, navigation);
  });

  // Erro de Certificado (isCertErrorSender)
  ipcMain.handle('navigation:home-from-page', (event) => {
    if (!isCertErrorSender(event)) return false;
    const homeUrl = settings.get('homePageUrl') || config.NEW_TAB_URL;
    if (!event.sender || event.sender.isDestroyed()) return false;
    event.sender.loadURL(homeUrl).catch(err => {
      if (err && err.code !== 'ERR_ABORTED') {
        console.warn('[Navegação] Falha ao navegar para Home na aba do remetente:', err.message);
      }
    });
    return true;
  });

  ipcMain.handle('cert-error:request-bypass-token', (event, targetUrl) => {
    if (!isCertErrorSender(event)) {
      console.warn('[Segurança] Requisição não autorizada em cert-error:request-bypass-token de:', event?.senderFrame?.url);
      return null;
    }
    if (typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
      return null;
    }
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname;
      const wcId = event.sender.id;
      return privacy.createCertBypassToken(wcId, host);
    } catch {
      return null;
    }
  });

  ipcMain.handle('cert-error:proceed', (event, payload) => {
    if (!isCertErrorSender(event)) return false;
    const { targetUrl, token } = payload || {};
    if (!targetUrl || !token) return false;
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname;
      const wcId = event.sender.id;
      if (privacy.validateAndConsumeCertBypassToken(token, wcId, host)) {
        privacy.allowCertHostForTab(wcId, host);
        return navigateSenderTab(event, targetUrl, tabManager, navigation);
      }
    } catch {}
    return false;
  });

  // Confirmação ou cancelamento de download potencialmente perigoso (ETAPA 4)
  ipcMain.handle('downloads:confirm-risk', (event, downloadId) => {
    if (!isMainSender(event, mainWindow)) return false;
    return downloads.confirmRiskDownload(downloadId);
  });

  ipcMain.handle('downloads:cancel-risk', (event, downloadId) => {
    if (!isMainSender(event, mainWindow)) return false;
    return downloads.cancelRiskDownload(downloadId);
  });

  // Notifica downloads na interface principal e nas abas de download abertas
  downloads.setDownloadUpdateListener((downloadData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:download-update', downloadData);
    }
    if (tabManager && typeof tabManager.getTabs === 'function') {
      const allTabs = tabManager.getTabs();
      for (const t of allTabs) {
        if (t.url && t.url.startsWith(config.DOWNLOADS_PAGE_URL) && t.view && !t.view.webContents.isDestroyed()) {
          t.view.webContents.send('downloads:tab-update', downloadData);
        }
      }
    }
  });

  // Notifica aviso de download de risco para a interface principal
  downloads.setDownloadRiskListener((promptData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:download-risk-prompt', promptData);
    }
  });

  // Canal para injeção de script de mitigação de fingerprinting nas abas web (ETAPA 5)
  ipcMain.on('fingerprint:get-script', (event) => {
    if (!event || !event.sender || event.sender.isDestroyed()) {
      event.returnValue = '';
      return;
    }
    event.returnValue = fingerprintProtection.getInjectionScript();
  });
}

module.exports = {
  init
};
