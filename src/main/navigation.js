// =============================================================================
// src/main/navigation.js
// Normalização da barra de endereços e comandos de navegação
// =============================================================================

const {
  DEFAULT_SEARCH_ENGINE,
  NEW_TAB_URL,
  SETTINGS_PAGE_URL,
  DOWNLOADS_PAGE_URL,
  HISTORY_PAGE_URL,
  BOOKMARKS_PAGE_URL
} = require('./config');
const settings = require('./settings');
const { normalizeInput: normalizeInputPure } = require('./pure/navigation-utils');

/**
 * Normaliza o texto digitado pelo usuário na barra de endereços delegando para a função pura
 * @param {string} rawInput Texto bruto digitado pelo usuário
 * @returns {string} URL pronta para navegação
 */
function normalizeInput(rawInput) {
  return normalizeInputPure(rawInput, {
    newTabUrl: NEW_TAB_URL,
    settingsUrl: SETTINGS_PAGE_URL,
    downloadsUrl: DOWNLOADS_PAGE_URL,
    historyUrl: HISTORY_PAGE_URL,
    bookmarksUrl: BOOKMARKS_PAGE_URL,
    searchTemplate: settings.getSearchUrlTemplate()
  });
}

/**
 * Navega a aba ativa para a URL especificada (normalizando antes a entrada)
 * @param {object} tabManager Instância do gerenciador de abas
 * @param {string} rawInput Texto ou URL digitada
 */
function loadURL(tabManager, rawInput) {
  const rawTrimmed = (rawInput || '').trim();
  const lower = rawTrimmed.toLowerCase();

  // Se o usuário digitou diretamente atalhos de páginas internas que possuem aba dedicada,
  // reutiliza a aba existente ou abre com isolamento
  if (lower === 'dragon://downloads' || lower === 'about:downloads') {
    if (typeof tabManager.openDownloadsTab === 'function') {
      tabManager.openDownloadsTab();
      return;
    }
  }
  if (lower === 'dragon://settings' || lower === 'about:settings') {
    if (typeof tabManager.openSettingsTab === 'function') {
      tabManager.openSettingsTab();
      return;
    }
  }
  if (lower === 'dragon://history' || lower === 'about:history') {
    if (typeof tabManager.openHistoryTab === 'function') {
      tabManager.openHistoryTab();
      return;
    }
  }
  if (lower === 'dragon://bookmarks' || lower === 'about:bookmarks') {
    if (typeof tabManager.openBookmarksTab === 'function') {
      tabManager.openBookmarksTab();
      return;
    }
  }

  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  const isExplicitHttps = /^https:\/\//i.test(rawTrimmed);
  activeTab.isExplicitHttps = isExplicitHttps;

  let targetUrl = normalizeInput(rawInput);
  try {
    new URL(targetUrl);
  } catch {
    targetUrl = settings.getSearchUrl(rawInput);
  }

  if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(targetUrl)) {
    console.warn(`[Navegação] URL não permitida bloqueada: ${targetUrl}`);
    return;
  }
  activeTab.view.webContents.loadURL(targetUrl).catch(err => {
    // Erros normais de cancelamento (-3 ERR_ABORTED) acontecem se o usuário navegar
    // rapidamente para outro site antes do anterior terminar; podemos ignorá-los.
    if (err && err.code !== 'ERR_ABORTED') {
      console.warn(`[Navegação] Falha ao carregar ${targetUrl}:`, err.message);
    }
  });
}

/**
 * Volta para a página anterior no histórico da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function goBack(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  const wc = activeTab.view.webContents;
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoBack === 'function') {
    if (wc.navigationHistory.canGoBack()) {
      wc.navigationHistory.goBack();
    }
  } else if (typeof wc.canGoBack === 'function' && wc.canGoBack()) {
    wc.goBack();
  }
}

/**
 * Avança para a próxima página no histórico da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function goForward(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  const wc = activeTab.view.webContents;
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoForward === 'function') {
    if (wc.navigationHistory.canGoForward()) {
      wc.navigationHistory.goForward();
    }
  } else if (typeof wc.canGoForward === 'function' && wc.canGoForward()) {
    wc.goForward();
  }
}

/**
 * Recarrega a página da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function reload(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.webContents.reload();
  }
}

/**
 * Interrompe o carregamento da página da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function stop(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.webContents.stop();
  }
}

/**
 * Navega a aba ativa para a URL da Página Inicial configurada nas opções (homePageUrl)
 * @param {object} tabManager Instância do gerenciador de abas
 */
function goHome(tabManager) {
  const homeUrl = settings.get('homePageUrl') || NEW_TAB_URL;
  loadURL(tabManager, homeUrl);
}

/**
 * Inicializa o módulo de navegação
 * @param {object} context Objeto com dependências do sistema
 */
function init(context) {
  // O módulo de navegação é puro e sem estado interno, mantendo funções utilitárias.
  return {
    normalizeInput,
    loadURL,
    goBack,
    goForward,
    reload,
    stop,
    goHome
  };
}

module.exports = {
  init,
  normalizeInput,
  loadURL,
  goBack,
  goForward,
  reload,
  stop,
  goHome
};
