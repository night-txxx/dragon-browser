// =============================================================================
// src/main/tabs.js
// Gerenciador de abas (TabManager) usando WebContentsView do Electron
// O processo principal é a única fonte da verdade de todo o estado das abas.
// =============================================================================

const fs = require('fs');
const path = require('path');
const { WebContentsView, session } = require('electron');
const config = require('./config');
const contextMenu = require('./context-menu');
const history = require('./history');
const privacy = require('./privacy');
const sessionModule = require('./session');
const settings = require('./settings');
const storage = require('./storage');
const { isSuspiciousRedirectChain, getBaseDomain } = require('./pure/privacy-utils');

// Conjunto canônico das URLs exatas das páginas internas permitidas no esquema file:
// Compara com as URLs exatas de config.js ignorando query e hash
const CANONICAL_INTERNAL_URLS = new Set([
  config.NEW_TAB_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.SETTINGS_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.ERROR_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.HTTPS_WARNING_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.CERT_ERROR_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.HISTORY_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.BOOKMARKS_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.DOWNLOADS_PAGE_URL.split('?')[0].split('#')[0].toLowerCase()
]);

/**
 * Converte atalhos amigáveis como dragon://downloads ou about:downloads
 * na URL canônica de arquivo correspondente.
 * @param {string} rawUrl
 * @returns {string}
 */
function resolveInternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return rawUrl;
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'dragon://downloads' || lower === 'about:downloads') return config.DOWNLOADS_PAGE_URL;
  if (lower === 'dragon://history' || lower === 'about:history') return config.HISTORY_PAGE_URL;
  if (lower === 'dragon://bookmarks' || lower === 'about:bookmarks') return config.BOOKMARKS_PAGE_URL;
  if (lower === 'dragon://settings' || lower === 'about:settings') return config.SETTINGS_PAGE_URL;
  if (lower === 'dragon://newtab' || lower === 'about:newtab') return config.NEW_TAB_URL;
  return trimmed;
}

/**
 * Valida se uma URL é permitida para navegação ou abertura de janela.
 * Permite apenas http:, https:, páginas internas exatas do Dragon em file: e about:blank.
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isAllowedNavigationUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const resolved = resolveInternalUrl(rawUrl);
    const parsed = new URL(resolved);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'file:') {
      // Compara a URL exata ignorando query e hash com a lista de páginas internas do Dragon
      const cleanHref = parsed.href.split('?')[0].split('#')[0].toLowerCase();
      return CANONICAL_INTERNAL_URLS.has(cleanHref);
    }
    if (parsed.protocol === 'about:' && parsed.pathname === 'blank') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

let tabs = [];
let activeTabId = null;
let nextTabIdNumber = 1;
const activePrivatePartitions = new Set();
const closedTabsStack = []; // Pilha para reabrir abas fechadas (Ctrl+Shift+T)

// Throttle de notificações de rastreadores bloqueados (no máximo 5 por segundo por aba)
// Intervalo de 200ms entre notificações por aba (1000ms / 5 chamadas = 200ms)
const TRACKER_THROTTLE_INTERVAL_MS = 200;
const trackerThrottleMap = new Map(); // wcId -> { lastTime: number, timer: NodeJS.Timeout | null }

let mainWindowRef = null;
let windowManagerRef = null;
let onShortCutTriggered = null;

/**
 * Salva a lista de abas normais abertas para suporte à restauração de sessão.
 * Abas privadas e a aba de configurações NUNCA são salvas na sessão persistida.
 */
function saveSessionTabs() {
  const normalUrls = tabs
    .filter(t => !t.isPrivate && t.url && !t.url.startsWith(config.SETTINGS_PAGE_URL))
    .map(t => t.url);
  storage.writeJSON('sessions.json', { urls: normalUrls });
}

/**
 * Propaga as configurações atuais em tempo real para todas as abas de nova aba abertas.
 */
function updateNewTabViews() {
  const newTabData = settings.getNewTabData();
  for (const tab of tabs) {
    if (tab.view && !tab.view.webContents.isDestroyed() && tab.url && tab.url.startsWith(config.NEW_TAB_URL)) {
      tab.view.webContents.executeJavaScript(
        `if (typeof window.__applyDragonSettings === 'function') { window.__applyDragonSettings(${JSON.stringify(newTabData)}); }`
      ).catch(() => {});
    }
  }
}

/**
 * Atualiza o zoom de todas as abas abertas em tempo real.
 * @param {number} [zoomFactor] Fator de zoom (ex: 1.0 = 100%)
 */
function updateTabsZoom(zoomFactor) {
  const factor = typeof zoomFactor === 'number' ? zoomFactor : (settings.get('defaultZoom') || 1.0);
  for (const tab of tabs) {
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.setZoomFactor(factor);
    }
  }
}

/**
 * Abre a página de configurações em uma aba normal.
 * Se já existir uma aba de configurações aberta, apenas troca para ela.
 * @returns {object} Aba de configurações
 */
function openSettingsTab() {
  const settingsUrl = config.SETTINGS_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(settingsUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(settingsUrl, { active: true, isPrivate: false, isSettings: true });
}

/**
 * Abre a página de downloads em uma aba normal.
 * Se já existir uma aba de downloads aberta, apenas troca para ela.
 * @returns {object} Aba de downloads
 */
function openDownloadsTab() {
  const downloadsUrl = config.DOWNLOADS_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(downloadsUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(downloadsUrl, { active: true, isPrivate: false });
}

/**
 * Abre a página de histórico em uma aba normal.
 * Se já existir uma aba de histórico aberta, apenas troca para ela.
 * @returns {object} Aba de histórico
 */
function openHistoryTab() {
  const historyUrl = config.HISTORY_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(historyUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(historyUrl, { active: true, isPrivate: false });
}

/**
 * Abre a página de favoritos em uma aba normal.
 * Se já existir uma aba de favoritos aberta, apenas troca para ela.
 * @returns {object} Aba de favoritos
 */
function openBookmarksTab() {
  const bookmarksUrl = config.BOOKMARKS_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(bookmarksUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(bookmarksUrl, { active: true, isPrivate: false });
}

/**
 * Helper para verificar se a página pode voltar no histórico (compatível com Electron moderno)
 */
function checkCanGoBack(webContents) {
  if (!webContents) return false;
  if (webContents.navigationHistory && typeof webContents.navigationHistory.canGoBack === 'function') {
    return webContents.navigationHistory.canGoBack();
  }
  return typeof webContents.canGoBack === 'function' ? webContents.canGoBack() : false;
}

/**
 * Helper para verificar se a página pode avançar no histórico (compatível com Electron moderno)
 */
function checkCanGoForward(webContents) {
  if (!webContents) return false;
  if (webContents.navigationHistory && typeof webContents.navigationHistory.canGoForward === 'function') {
    return webContents.navigationHistory.canGoForward();
  }
  return typeof webContents.canGoForward === 'function' ? webContents.canGoForward() : false;
}

/**
 * Retorna uma representação limpa do estado atual para ser enviada à interface.
 * O processo de renderização (UI) NUNCA manipula WebContentsView diretamente.
 */
function getState() {
  const activeTab = getActiveTab();
  const activeWcId = activeTab && activeTab.view ? activeTab.view.webContents.id : null;
  const privacyInfo = activeWcId
    ? privacy.getPrivacyInfoForTab(activeWcId, activeTab.url)
    : { count: 0, domains: [], isProtected: true, hostname: '' };

  return {
    tabs: tabs.map(t => ({
      id: t.id,
      title: t.title || (t.isPrivate ? 'Nova Aba Privada' : 'Nova Aba'),
      url: t.url || config.NEW_TAB_URL,
      favicon: t.favicon || '',
      isLoading: Boolean(t.isLoading),
      isPrivate: Boolean(t.isPrivate)
    })),
    activeTabId: activeTabId,
    canGoBack: activeTab && activeTab.view ? checkCanGoBack(activeTab.view.webContents) : false,
    canGoForward: activeTab && activeTab.view ? checkCanGoForward(activeTab.view.webContents) : false,
    isLoading: activeTab ? Boolean(activeTab.isLoading) : false,
    currentUrl: activeTab ? activeTab.url : '',
    currentTitle: activeTab ? (activeTab.title || '') : '',
    newTabUrl: config.NEW_TAB_URL,
    settingsUrl: config.SETTINGS_PAGE_URL,
    downloadsUrl: config.DOWNLOADS_PAGE_URL,
    historyUrl: config.HISTORY_PAGE_URL,
    bookmarksUrl: config.BOOKMARKS_PAGE_URL,
    errorUrl: config.ERROR_PAGE_URL,
    httpsWarningUrl: config.HTTPS_WARNING_URL,
    certErrorUrl: config.CERT_ERROR_PAGE_URL,
    isPrivate: Boolean(activeTab && activeTab.isPrivate),
    privacyInfo,
    settings: {
      accentColor: settings.get('accentColor'),
      theme: settings.get('theme')
    }
  };
}

/**
 * Notifica a janela do navegador sobre qualquer alteração no estado das abas.
 */
function notifyStateChange() {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

  const state = getState();
  // Envia o estado serializado via canal IPC para o renderer
  mainWindowRef.webContents.send('browser:state-update', state);
}

/**
 * Notifica a alteração de estado decorrente de rastreadores bloqueados com throttle.
 * Agrupa as notificações em no máximo 5 por segundo por aba (intervalo de 200ms),
 * evitando sobrecarregar o canal IPC e a renderização em páginas pesadas em anúncios.
 *
 * @param {number} wcId ID do WebContents que bloqueou o rastreador
 */
function notifyTrackerBlocked(wcId) {
  if (!wcId) {
    notifyStateChange();
    return;
  }

  // Como o privacyInfo na interface exibe as estatísticas da aba ativa,
  // apenas a aba em foco precisa disparar a atualização de UI em tempo real.
  // Os rastreadores de abas em segundo plano permanecem gravados em memória
  // e serão exibidos assim que o usuário alternar para elas.
  const activeTab = getActiveTab();
  const isActive = activeTab && activeTab.view && activeTab.view.webContents.id === wcId;
  if (!isActive) {
    return;
  }

  const now = Date.now();
  let entry = trackerThrottleMap.get(wcId);
  if (!entry) {
    entry = { lastTime: 0, timer: null };
    trackerThrottleMap.set(wcId, entry);
  }

  const elapsed = now - entry.lastTime;

  if (elapsed >= TRACKER_THROTTLE_INTERVAL_MS) {
    // Passou o intervalo de throttle: envia imediatamente
    entry.lastTime = now;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    notifyStateChange();
  } else if (!entry.timer) {
    // Dentro da janela de 200ms: agenda trailing update para capturar o valor final
    const remaining = TRACKER_THROTTLE_INTERVAL_MS - elapsed;
    entry.timer = setTimeout(() => {
      entry.lastTime = Date.now();
      entry.timer = null;
      notifyStateChange();
    }, remaining);
  }
}

/**
 * Retorna a aba ativa atual
 * @returns {object|null}
 */
function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

/**
 * Retorna uma aba pelo seu identificador
 * @param {string} id ID da aba (ex: 'tab-1')
 * @returns {object|null}
 */
function getTab(id) {
  return tabs.find(t => t.id === id) || null;
}

/**
 * Cria uma nova aba com sua respectiva WebContentsView.
 * @param {string} [initialUrl] URL opcional (abre config.NEW_TAB_URL se omitida)
 * @param {object} [options] Opções como { active: true, isPrivate: false }
 * @returns {object} A aba criada
 */
function createTab(initialUrl = null, options = { active: true, isPrivate: false, isSettings: false, isExplicitHttps: false }) {
  const tabId = `tab-${nextTabIdNumber++}`;
  const resolvedUrl = initialUrl ? resolveInternalUrl(initialUrl) : config.NEW_TAB_URL;
  let targetUrl = resolvedUrl;
  if (!isAllowedNavigationUrl(targetUrl)) {
    console.warn(`[TabManager] URL não permitida em createTab: ${targetUrl}`);
    targetUrl = config.NEW_TAB_URL;
  }
  const isPrivate = Boolean(options && options.isPrivate);
  const isSettings = Boolean(options && options.isSettings) || Boolean(targetUrl && targetUrl.startsWith(config.SETTINGS_PAGE_URL));
  const isExplicitHttps = Boolean(options && options.isExplicitHttps);

  let tabSession = undefined;
  let partitionName = null;

  if (isPrivate) {
    // Aba Privada: cria partição exclusiva em memória (sem persist:), descartada ao fechar
    partitionName = 'private-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    activePrivatePartitions.add(partitionName);
    tabSession = session.fromPartition(partitionName);
    sessionModule.configureSession(tabSession, true);
  }

  // Cria a WebContentsView isolada com o maior nível de segurança possível
  // SEGURANÇA: settings-preload.js é anexado ESTRITAMENTE na aba interna de configurações.
  // Demais abas usam tab-preload.js que expõe APIs apenas para páginas internas autorizadas.
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: isSettings
        ? path.join(__dirname, '../preload/settings-preload.js')
        : path.join(__dirname, '../preload/tab-preload.js'),
      ...(tabSession ? { session: tabSession } : {})
    }
  });

  // Aplica o zoom padrão definido nas configurações do usuário
  const defaultZoom = settings.get('defaultZoom') || 1.0;
  view.webContents.setZoomFactor(defaultZoom);

  // Configura política restrita de WebRTC para evitar vazamento de IP real
  privacy.applyWebRTCPolicy(view.webContents);

  // Adiciona a view à árvore de conteúdo da janela principal
  mainWindowRef.contentView.addChildView(view);

  // Inicialmente fica invisível até ser explicitamente ativada
  view.setVisible(false);

  let initialTitle = 'Nova Aba';
  if (targetUrl.startsWith(config.SETTINGS_PAGE_URL)) {
    initialTitle = 'Configurações';
  } else if (targetUrl.startsWith(config.DOWNLOADS_PAGE_URL)) {
    initialTitle = 'Downloads';
  } else if (targetUrl.startsWith(config.HISTORY_PAGE_URL)) {
    initialTitle = 'Histórico';
  } else if (targetUrl.startsWith(config.BOOKMARKS_PAGE_URL)) {
    initialTitle = 'Favoritos';
  } else if (isPrivate) {
    initialTitle = 'Nova Aba Privada';
  }

  const tab = {
    id: tabId,
    view: view,
    title: initialTitle,
    url: targetUrl,
    favicon: '',
    isLoading: true,
    canGoBack: false,
    canGoForward: false,
    isPrivate: isPrivate,
    isSettings: isSettings,
    isExplicitHttps: isExplicitHttps,
    isHtmlFullScreen: false,
    partition: partitionName,
    redirectHistory: [],
    lastUserInteraction: Date.now()
  };

  tabs.push(tab);

  // ===========================================================================
  // LISTENERS DE EVENTOS DO WEBCONTENTS DA ABA
  // ===========================================================================

  // Registra interação do usuário para distinguir redirecionamentos forçados de navegações intencionais
  view.webContents.on('before-input-event', () => {
    tab.lastUserInteraction = Date.now();
  });

  // 1. Início de carregamento
  view.webContents.on('did-start-loading', () => {
    tab.isLoading = true;
    privacy.resetTabTrackerData(view.webContents.id);
    const entry = trackerThrottleMap.get(view.webContents.id);
    if (entry && entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    notifyStateChange();
  });

  // 2. Fim de carregamento
  view.webContents.on('did-stop-loading', () => {
    tab.isLoading = false;
    tab.canGoBack = checkCanGoBack(view.webContents);
    tab.canGoForward = checkCanGoForward(view.webContents);
    notifyStateChange();
  });

  // 3. Atualização do título da página
  view.webContents.on('page-title-updated', (event, title) => {
    tab.title = title || (tab.isPrivate ? 'Aba Privada' : 'Sem título');
    if (!tab.isPrivate && tab.url) {
      history.updateTitle(tab.url, tab.title);
    }
    notifyStateChange();
  });

  // 4. Atualização de ícone (Favicon)
  view.webContents.on('page-favicon-updated', (event, favicons) => {
    if (favicons && favicons.length > 0) {
      tab.favicon = favicons[0];
      notifyStateChange();
    }
  });

  // 5. Navegação concluída para outra página
  view.webContents.on('did-navigate', (event, url) => {
    // Reaplica o fator de zoom padrão, pois a navegação entre origens diferentes pode resetá-lo no Chromium
    const currentZoom = settings.get('defaultZoom') || 1.0;
    try {
      view.webContents.setZoomFactor(currentZoom);
    } catch {}

    tab.url = url;
    let landingDomain = '';
    try {
      landingDomain = getBaseDomain(new URL(url).hostname);
    } catch {}
    if (landingDomain) {
      tab.redirectHistory = [{ url, domain: landingDomain, timestamp: Date.now() }];
    } else {
      tab.redirectHistory = [];
    }

    tab.canGoBack = checkCanGoBack(view.webContents);
    tab.canGoForward = checkCanGoForward(view.webContents);
    privacy.resetTabTrackerData(view.webContents.id);
    sessionModule.cancelPendingRequestsForWebContents(view.webContents.id);

    // Abas privadas NUNCA são gravadas em histórico
    if (!tab.isPrivate) {
      history.addEntry({ url, title: tab.title, isPrivate: false });
      saveSessionTabs();
    }

    notifyStateChange();
  });

  // 6. Navegação interna (mudança de hash, single-page application)
  view.webContents.on('did-navigate-in-page', (event, url) => {
    tab.url = url;
    tab.canGoBack = checkCanGoBack(view.webContents);
    tab.canGoForward = checkCanGoForward(view.webContents);
    notifyStateChange();
  });

  // 6.1. Detecção e bloqueio de redirecionamentos em cadeia rápida sem gesto do usuário (ETAPA 1)
  view.webContents.on('will-redirect', (event, targetUrl, isInPlace, isMainFrame) => {
    // Inspeciona apenas navegação no frame principal
    if (isMainFrame === false) return;

    let currentHost = '';
    try {
      currentHost = new URL(view.webContents.getURL()).hostname;
    } catch {}

    // Se o site atual for exceção cadastrada pelo usuário, não bloqueia
    if (currentHost && privacy.isSiteExempt(currentHost)) {
      return;
    }

    let targetHost = '';
    try {
      targetHost = new URL(targetUrl).hostname;
    } catch {}

    if (targetHost && privacy.isSiteExempt(targetHost)) {
      return;
    }

    const now = Date.now();
    const timeSinceUser = now - (tab.lastUserInteraction || 0);

    // Se mais de 1.5s desde última ação do usuário e a cadeia de redirecionamentos for suspeita
    if (timeSinceUser > 1500 && isSuspiciousRedirectChain(tab.redirectHistory || [], targetUrl, now, 1500, 2)) {
      event.preventDefault();
      console.warn(`[Privacidade] Redirecionamento forçado em cadeia bloqueado na aba ${tab.id} para: ${targetUrl}`);

      privacy.recordPopupBlocked(view.webContents.id);
      notifyStateChange();

      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('browser:redirect-blocked', {
          tabId: tab.id,
          targetUrl,
          domain: targetHost || targetUrl
        });
      }
      return;
    }

    // Registra na cadeia de histórico recente
    let targetDomain = '';
    try {
      targetDomain = getBaseDomain(targetHost);
    } catch {}
    if (targetDomain) {
      tab.redirectHistory = (tab.redirectHistory || []).filter(item => (now - item.timestamp) < 5000);
      tab.redirectHistory.push({ url: targetUrl, domain: targetDomain, timestamp: now });
    }
  });

  // 7. Tratamento de falha no carregamento (ex: sem internet ou falha de HTTPS)
  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // 1. Ignora códigos normais de aborto (-3 = ERR_ABORTED) que ocorrem ao redirecionar
    // e ignora falhas em sub-frames (iFrames/anúncios bloqueados)
    if (errorCode === -3 || !isMainFrame) return;

    // 2. PREVENÇÃO DE LOOP INFINITO: Não reentrar se a falha ocorreu na própria página de erro, aviso ou cert-error
    if (!validatedURL ||
        validatedURL.startsWith(config.ERROR_PAGE_URL) ||
        validatedURL.startsWith(config.HTTPS_WARNING_URL) ||
        validatedURL.startsWith(config.CERT_ERROR_PAGE_URL)) {
      return;
    }

    console.warn(`[Aba ${tabId}] Falha ao carregar ${(validatedURL || '').slice(0, 100)}: ${errorDescription} (${errorCode})`);

    // 3. Limita o tamanho máximo da URL e descrição passadas por parâmetro (evita ERR_INVALID_URL)
    const safeUrl = (validatedURL || '').slice(0, 500);
    const safeDesc = (errorDescription || '').slice(0, 200);
    const safeCode = String(errorCode || '');

    // Erros de certificado SSL/TLS (códigos -200 até -299) são direcionados para cert-error.html
    // sem botão fácil de prosseguir, impedindo downgrade inseguro para HTTP.
    const isCertError = errorCode <= -200 && errorCode >= -299;
    if (isCertError) {
      try {
        const certUrlObj = new URL(config.CERT_ERROR_PAGE_URL);
        certUrlObj.searchParams.set('url', safeUrl);
        certUrlObj.searchParams.set('code', safeCode);
        certUrlObj.searchParams.set('desc', safeDesc);
        view.webContents.loadURL(certUrlObj.href).catch(() => {});
      } catch (err) {
        console.warn(`[Aba ${tabId}] Erro ao carregar página de erro de certificado:`, err.message);
      }
      return;
    }

    // Fallback HTTP APENAS para falhas reais de conexão (-102, -107, -101, -118)
    // e SOMENTE quando o usuário não digitou https:// explicitamente.
    const isConnectionFailure = errorCode === -102 || errorCode === -107 || errorCode === -101 || errorCode === -118;
    const isHttps = validatedURL && validatedURL.startsWith('https://');
    const allowHttpFallback = isHttps && isConnectionFailure && !tab.isExplicitHttps;

    if (allowHttpFallback) {
      try {
        const httpTarget = ('http://' + validatedURL.slice(8)).slice(0, 500);
        const warningUrlObj = new URL(config.HTTPS_WARNING_URL);
        warningUrlObj.searchParams.set('url', httpTarget);
        view.webContents.loadURL(warningUrlObj.href).catch(() => {});
      } catch (err) {
        console.warn(`[Aba ${tabId}] Erro ao carregar página de aviso HTTPS:`, err.message);
      }
      return;
    }

    try {
      const errorUrlObj = new URL(config.ERROR_PAGE_URL);
      errorUrlObj.searchParams.set('url', safeUrl);
      errorUrlObj.searchParams.set('code', safeCode);
      errorUrlObj.searchParams.set('desc', safeDesc);
      view.webContents.loadURL(errorUrlObj.href).catch(() => {});
    } catch (err) {
      console.warn(`[Aba ${tabId}] Erro ao carregar página de erro:`, err.message);
    }
  });

  // 8. Interceptação de links com target="_blank" ou window.open (ETAPA 1)
  view.webContents.setWindowOpenHandler(({ url, disposition, userGesture, features }) => {
    // Permite apenas http:, https: e as páginas internas do Dragon
    if (!isAllowedNavigationUrl(url)) {
      console.warn('[Segurança] Abertura de janela bloqueada para URL não permitida:', url);
      return { action: 'deny' };
    }

    let currentHost = '';
    try {
      currentHost = new URL(view.webContents.getURL()).hostname;
    } catch {}

    const isExempt = currentHost ? privacy.isSiteExempt(currentHost) : false;

    // ETAPA 1: Bloquear qualquer tentativa de abrir nova janela/aba quando NÃO houver userGesture,
    // independentemente do disposition, a menos que o site esteja na lista de exceções do usuário
    if (!userGesture && !isExempt) {
      console.warn(`[Popups] Pop-up bloqueado sem userGesture na aba ${tabId} para URL: ${url}`);
      privacy.recordPopupBlocked(view.webContents.id);
      notifyStateChange();
      return { action: 'deny' };
    }

    // Permite janela pop-up real quando acionada por gesto do usuário (ex: Login com Google/Apple)
    if (userGesture && (disposition === 'new-window' || (features && features.length > 0))) {
      const iconPath = path.join(__dirname, '../../assets/icons/favicon-circle.png');
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: mainWindowRef,
          modal: false,
          autoHideMenuBar: true,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            session: view.webContents.session,
            preload: undefined
          }
        }
      };
    }

    // Links normais target="_blank" com userGesture abrem como nova aba mantendo a partição privada se aplicável
    createTab(url, { active: true, isPrivate: tab.isPrivate });
    return { action: 'deny' };
  });

  // Bloco 3.6: Aplica configurações em janelas filhas/popups criadas (OAuth)
  view.webContents.on('did-create-window', (childWindow) => {
    try {
      childWindow.setMenu(null);
      childWindow.setMenuBarVisibility(false);

      const iconPath = path.join(__dirname, '../../assets/icons/favicon-circle.png');
      if (fs.existsSync(iconPath)) {
        childWindow.setIcon(iconPath);
      }

      childWindow.webContents.setWindowOpenHandler(({ url: childUrl }) => {
        if (!isAllowedNavigationUrl(childUrl)) {
          return { action: 'deny' };
        }
        createTab(childUrl, { active: true, isPrivate: tab.isPrivate });
        return { action: 'deny' };
      });

      childWindow.webContents.on('before-input-event', (event, input) => {
        if (onShortCutTriggered) {
          onShortCutTriggered(event, input);
        }
      });

      contextMenu.attachContextMenu(childWindow.webContents, {
        mainWindow: mainWindowRef,
        tabManager: { createTab: (u, o) => createTab(u, o) },
        isPrivate: tab.isPrivate
      });
    } catch (err) {
      console.warn('[Popups] Aviso ao configurar janela pop-up filha:', err.message);
    }
  });

  // Anexa o menu de contexto nativo com copiar, colar, inspecionar, etc.
  contextMenu.attachContextMenu(view.webContents, {
    mainWindow: mainWindowRef,
    tabManager: { createTab: (u, o) => createTab(u, o) },
    isPrivate: tab.isPrivate
  });

  // Listener para resultados de busca na página (Ctrl+F)
  view.webContents.on('found-in-page', (event, result) => {
    if (tab.id === activeTabId && mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('browser:find-result', result);
    }
  });

  // 9. Interceptação de atalhos de teclado enquanto o foco está no conteúdo do site
  view.webContents.on('before-input-event', (event, input) => {
    if (onShortCutTriggered) {
      onShortCutTriggered(event, input);
    }
  });

  // 10. Trata entrada e saída de tela cheia HTML5 (vídeos em tela cheia)
  // Faz a visualização ocupar a janela inteira e notifica o renderer para esconder a barra superior
  view.webContents.on('enter-html-full-screen', () => {
    tab.isHtmlFullScreen = true;
    if (tab.id === activeTabId && windowManagerRef) {
      windowManagerRef.setHtmlFullScreen(true);
    }
  });

  view.webContents.on('leave-html-full-screen', () => {
    tab.isHtmlFullScreen = false;
    if (tab.id === activeTabId && windowManagerRef) {
      windowManagerRef.setHtmlFullScreen(false);
    }
  });

  // SEGURANÇA: Se for aba de configurações, impede navegação para fora dela
  if (isSettings) {
    view.webContents.on('will-navigate', (event, navUrl) => {
      if (!navUrl.startsWith(config.SETTINGS_PAGE_URL)) {
        event.preventDefault();
        createTab(navUrl, { active: true });
      }
    });
  }

  // Sincroniza configurações ao terminar de montar o DOM da página de nova aba
  view.webContents.on('dom-ready', () => {
    // Reaplica o zoom padrão no dom-ready para assegurar a escala configurada
    const currentZoom = settings.get('defaultZoom') || 1.0;
    try {
      view.webContents.setZoomFactor(currentZoom);
    } catch {}

    if (tab.url && tab.url.startsWith(config.NEW_TAB_URL)) {
      view.webContents.executeJavaScript(
        `if (typeof window.__applyDragonSettings === 'function') { window.__applyDragonSettings(${JSON.stringify(settings.getNewTabData())}); }`
      ).catch(() => {});
    }
  });

  // Prepara a URL inicial a ser carregada (sem anexar dados pesados de configurações no hash ou query)
  const urlToLoad = targetUrl;

  // Carrega a URL inicial
  view.webContents.loadURL(urlToLoad).catch(err => {
    if (err && err.code !== 'ERR_ABORTED') {
      console.warn(`[Aba ${tabId}] Erro ao carregar URL inicial:`, err.message);
    }
  });

  saveSessionTabs();

  // Se a opção active for verdadeira ou se for a única aba existente, ativa-a
  if (options.active || tabs.length === 1) {
    setActiveTab(tabId);
  } else {
    notifyStateChange();
  }

  return tab;
}

/**
 * Define qual aba deve ser exibida e focada.
 * @param {string} tabId ID da aba desejada
 */
function setActiveTab(tabId) {
  const targetTab = getTab(tabId);
  if (!targetTab) return;

  activeTabId = tabId;

  // Esconde todas as outras abas
  for (const t of tabs) {
    if (t.id !== tabId && t.view) {
      t.view.setVisible(false);
    }
  }

  // Se o overlay da interface estiver ativo, a aba não deve ficar visível ainda
  const isOverlay = windowManagerRef ? windowManagerRef.getIsOverlayActive() : false;
  if (!isOverlay && targetTab.view) {
    targetTab.view.setVisible(true);
  }

  // Redimensiona para garantir bounds corretos
  if (windowManagerRef) {
    windowManagerRef.updateActiveViewBounds();
    windowManagerRef.setHtmlFullScreen(Boolean(targetTab.isHtmlFullScreen));
  }

  // Dá foco para a página do site
  if (targetTab.view) {
    targetTab.view.webContents.focus();
  }

  notifyStateChange();
}

/**
 * Fecha uma aba existente. Se for a última aba restante, cria uma nova automaticamente.
 * Se a aba for privada, apaga completamente os dados da sessão em memória.
 * @param {string} tabId ID da aba a ser fechada
 */
function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const [removedTab] = tabs.splice(index, 1);

  // Se a aba removida estava em tela cheia HTML5, restaura layout normal
  if (removedTab && removedTab.isHtmlFullScreen && windowManagerRef) {
    windowManagerRef.setHtmlFullScreen(false);
  }

  // Remove a view da janela e libera os recursos
  if (removedTab && removedTab.view) {
    try {
      const wcId = removedTab.view.webContents.id;

      // Limpa dados de privacidade, certificados e hosts HTTP liberados para esta aba
      privacy.resetTabTrackerData(wcId);
      privacy.clearAllowedHttpHosts(wcId);
      privacy.clearAllowedCertHosts(wcId);
      sessionModule.cancelPendingRequestsForWebContents(wcId);

      // Limpa timers pendentes de throttle de rastreadores desta aba
      const entry = trackerThrottleMap.get(wcId);
      if (entry && entry.timer) {
        clearTimeout(entry.timer);
      }
      trackerThrottleMap.delete(wcId);

      mainWindowRef.contentView.removeChildView(removedTab.view);
      removedTab.view.webContents.close();
    } catch (err) {
      console.warn(`[TabManager] Aviso ao destruir view da aba ${tabId}:`, err.message);
    }

    // Se for uma aba privada, limpa os dados da sessão imediatamente
    if (removedTab.isPrivate && removedTab.partition) {
      activePrivatePartitions.delete(removedTab.partition);
      try {
        const privSes = session.fromPartition(removedTab.partition);
        privSes.clearStorageData();
        privSes.clearCache();
      } catch (err) {
        console.warn(`[TabManager] Aviso ao limpar sessão privada de ${tabId}:`, err.message);
      }
    }
  }

  // Se a aba fechada era uma aba normal e válida, salva na pilha para reabrir (Ctrl+Shift+T)
  if (
    removedTab &&
    !removedTab.isPrivate &&
    removedTab.url &&
    !removedTab.url.startsWith(config.NEW_TAB_URL) &&
    !removedTab.url.startsWith(config.SETTINGS_PAGE_URL)
  ) {
    closedTabsStack.push({
      url: removedTab.url,
      title: removedTab.title
    });
    if (closedTabsStack.length > 25) {
      closedTabsStack.shift();
    }
  }

  // Se a aba fechada era a aba ativa, seleciona uma adjacente
  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const nextIndex = Math.min(index, tabs.length - 1);
      setActiveTab(tabs[nextIndex].id);
    } else {
      activeTabId = null;
    }
  }

  saveSessionTabs();

  // REGRA DO REQUISITO: Se a última aba for fechada, abre uma nova imediatamente
  if (tabs.length === 0) {
    createTab(config.NEW_TAB_URL, { active: true });
    return;
  }

  notifyStateChange();
}

/**
 * Alterna para a próxima aba na lista (atalho Ctrl+Tab)
 */
function selectNextTab() {
  if (tabs.length <= 1) return;
  const currentIndex = tabs.findIndex(t => t.id === activeTabId);
  const nextIndex = (currentIndex + 1) % tabs.length;
  setActiveTab(tabs[nextIndex].id);
}

/**
 * Alterna para a aba anterior na lista
 */
function selectPreviousTab() {
  if (tabs.length <= 1) return;
  const currentIndex = tabs.findIndex(t => t.id === activeTabId);
  const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  setActiveTab(tabs[prevIndex].id);
}

/**
 * Fecha a aba ativa atual (atalho Ctrl+W)
 */
function closeActiveTab() {
  if (activeTabId) {
    closeTab(activeTabId);
  }
}

/**
 * Fecha e destrói TODAS as abas existentes sem recriar uma nova imediatamente.
 * Utilizado pelo processo de "Apagar Tudo", garantindo que todas as abas
 * sejam totalmente desalocadas da memória durante a animação de chamas.
 * @returns {number} Quantidade de abas fechadas
 */
function destroyAllTabs() {
  const count = tabs.length;
  const tabsToClose = [...tabs];
  tabs = [];
  activeTabId = null;

  // Cancela e limpa todos os timers pendentes de throttle de rastreadores
  for (const entry of trackerThrottleMap.values()) {
    if (entry && entry.timer) {
      clearTimeout(entry.timer);
    }
  }
  trackerThrottleMap.clear();

  for (const tab of tabsToClose) {
    if (tab && tab.view) {
      try {
        const wcId = tab.view.webContents.id;
        privacy.resetTabTrackerData(wcId);
        privacy.clearAllowedHttpHosts(wcId);
        privacy.clearAllowedCertHosts(wcId);
        sessionModule.cancelPendingRequestsForWebContents(wcId);

        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.contentView.removeChildView(tab.view);
        }
        tab.view.webContents.close();
      } catch (err) {
        console.warn(`[TabManager] Aviso ao destruir aba ${tab.id}:`, err.message);
      }
    }
  }

  // Bloco 2.1: Limpa a pilha de abas fechadas (Ctrl+Shift+T não pode reabrir abas apagadas)
  closedTabsStack.length = 0;

  // Notifica a interface sobre a destruição das abas
  notifyStateChange();
  return count;
}

/**
 * Limpa a pilha de abas fechadas (Ctrl+Shift+T)
 */
function clearClosedTabs() {
  closedTabsStack.length = 0;
}

/**
 * Registra um callback para repassar eventos de teclado capturados dentro dos WebContents
 * @param {Function} handler
 */
function setShortcutHandler(handler) {
  onShortCutTriggered = handler;
}

/**
 * Retorna lista de partições de sessões privadas ativas no momento
 * @returns {string[]}
 */
function getActivePrivatePartitions() {
  return Array.from(activePrivatePartitions);
}

/**
 * Esvazia o registro interno de partições privadas após a limpeza ser concluída em clear-data.js
 */
function clearPrivatePartitionsList() {
  activePrivatePartitions.clear();
}

/**
 * Cria uma nova aba privada
 * @param {string} [url]
 * @returns {object}
 */
function createPrivateTab(url = null) {
  let targetUrl = url || config.NEW_TAB_URL;
  if (!isAllowedNavigationUrl(targetUrl)) {
    console.warn(`[TabManager] URL não permitida em createPrivateTab: ${targetUrl}`);
    targetUrl = config.NEW_TAB_URL;
  }
  return createTab(targetUrl, { active: true, isPrivate: true });
}

/**
 * Envia uma mensagem IPC para todas as abas abertas da página de configurações.
 * @param {string} channel Nome do canal IPC
 * @param {*} data Dados a enviar
 */
function broadcastToSettingsTabs(channel, data) {
  for (const tab of tabs) {
    if (tab.view && !tab.view.webContents.isDestroyed() && tab.url && tab.url.startsWith(config.SETTINGS_PAGE_URL)) {
      try {
        tab.view.webContents.send(channel, data);
      } catch (err) {
        console.warn('[TabManager] Falha ao enviar evento para aba de configurações:', err.message);
      }
    }
  }
}

/**
 * Reabre a última aba fechada (Ctrl+Shift+T)
 * @returns {object|null}
 */
function reopenClosedTab() {
  if (closedTabsStack.length === 0) return null;
  const lastClosed = closedTabsStack.pop();
  if (lastClosed && lastClosed.url) {
    return createTab(lastClosed.url, { active: true, isPrivate: false });
  }
  return null;
}

/**
 * Seleciona a aba pelo índice numérico (0 a 7 para Ctrl+1 a Ctrl+8)
 * @param {number} index
 */
function selectTabByIndex(index) {
  if (index >= 0 && index < tabs.length) {
    setActiveTab(tabs[index].id);
  }
}

/**
 * Seleciona a última aba aberta (Ctrl+9)
 */
function selectLastTab() {
  if (tabs.length > 0) {
    setActiveTab(tabs[tabs.length - 1].id);
  }
}

/**
 * Reordena abas na lista (arrastar e soltar)
 * @param {string} sourceId ID da aba arrastada
 * @param {string} targetId ID da aba de destino
 */
function reorderTabs(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;

  const sourceIndex = tabs.findIndex(t => t.id === sourceId);
  const targetIndex = tabs.findIndex(t => t.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [movedTab] = tabs.splice(sourceIndex, 1);
  tabs.splice(targetIndex, 0, movedTab);

  saveSessionTabs();
  notifyStateChange();
}

/**
 * Aumenta o zoom da aba ativa e atualiza as configurações
 */
function zoomIn() {
  const current = settings.get('defaultZoom') || 1.0;
  const next = Math.min(3.0, Math.round((current + 0.1) * 10) / 10);
  settings.set('defaultZoom', next);
  updateTabsZoom(next);
}

/**
 * Diminui o zoom da aba ativa e atualiza as configurações
 */
function zoomOut() {
  const current = settings.get('defaultZoom') || 1.0;
  const next = Math.max(0.25, Math.round((current - 0.1) * 10) / 10);
  settings.set('defaultZoom', next);
  updateTabsZoom(next);
}

/**
 * Restaura o zoom para o valor padrão de 100%
 */
function zoomReset() {
  settings.set('defaultZoom', 1.0);
  updateTabsZoom(1.0);
}

/**
 * Dispara busca textual na página ativa (Ctrl+F)
 * @param {string} text
 * @param {object} [options] { forward, findNext, matchCase }
 */
function findInPage(text, options = {}) {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
    if (!text) {
      activeTab.view.webContents.stopFindInPage('clearSelection');
      return;
    }
    activeTab.view.webContents.findInPage(text, options);
  }
}

/**
 * Interrompe a busca textual na página ativa
 * @param {'clearSelection'|'keepSelection'|'activateSelection'} [action]
 */
function stopFindInPage(action = 'clearSelection') {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
    activeTab.view.webContents.stopFindInPage(action);
  }
}

/**
 * Inicializa o gerenciador de abas
 * @param {object} context Objeto contendo mainWindow e windowManager
 */
function init(context) {
  mainWindowRef = context.mainWindow;
  windowManagerRef = context.windowManager;

  // Conecta ao módulo de privacidade para re-renderizar interface quando rastreador for bloqueado
  // Agrupa as notificações com throttle de no máximo 5 por segundo por aba
  privacy.setOnBlockedCallback((wcId) => {
    notifyTrackerBlocked(wcId);
  });

  // Conecta às alterações de configurações em tempo real
  settings.onChange((key, value, allSettings) => {
    if (key === 'defaultZoom' || key === '*') {
      updateTabsZoom(parseFloat(allSettings.defaultZoom) || 1.0);
    }
    updateNewTabViews();
    notifyStateChange();
  });

  return {
    createTab,
    createPrivateTab,
    openSettingsTab,
    openDownloadsTab,
    openHistoryTab,
    openBookmarksTab,
    resolveInternalUrl,
    closeTab,
    setActiveTab,
    getActiveTab,
    getTab,
    getTabs: () => [...tabs],
    getState,
    notifyStateChange,
    selectNextTab,
    selectPreviousTab,
    closeActiveTab,
    destroyAllTabs,
    getActivePrivatePartitions,
    clearPrivatePartitionsList,
    setShortcutHandler,
    isAllowedNavigationUrl,
    broadcastToSettingsTabs,
    reopenClosedTab,
    selectTabByIndex,
    selectLastTab,
    reorderTabs,
    zoomIn,
    zoomOut,
    zoomReset,
    findInPage,
    stopFindInPage,
    allowRedirect,
    reloadAllWebTabs
  };
}

/**
 * Permite explicitamente um redirecionamento bloqueado a pedido do usuário
 * @param {string} targetUrl
 */
function allowRedirect(targetUrl) {
  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.view || !targetUrl) return;
  activeTab.lastUserInteraction = Date.now();
  activeTab.redirectHistory = [];
  activeTab.view.webContents.loadURL(targetUrl).catch(() => {});
}

/**
 * Recarrega todas as abas web abertas (http:// ou https://),
 * ignorando páginas internas do Dragon (file: ou dragon://).
 */
function reloadAllWebTabs() {
  for (const tab of tabs) {
    if (tab && tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
      const url = tab.url || '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        tab.view.webContents.reload();
      }
    }
  }
}

module.exports = {
  init,
  createTab,
  createPrivateTab,
  openSettingsTab,
  openDownloadsTab,
  openHistoryTab,
  openBookmarksTab,
  resolveInternalUrl,
  closeTab,
  setActiveTab,
  getActiveTab,
  getTab,
  getTabs: () => [...tabs],
  getState,
  notifyStateChange,
  selectNextTab,
  selectPreviousTab,
  closeActiveTab,
  destroyAllTabs,
  getActivePrivatePartitions,
  clearPrivatePartitionsList,
  setShortcutHandler,
  isAllowedNavigationUrl,
  broadcastToSettingsTabs,
  reopenClosedTab,
  clearClosedTabs,
  getClosedTabsStack: () => [...closedTabsStack],
  selectTabByIndex,
  selectLastTab,
  reorderTabs,
  zoomIn,
  zoomOut,
  zoomReset,
  findInPage,
  stopFindInPage,
  allowRedirect,
  reloadAllWebTabs
};

