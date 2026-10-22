// =============================================================================
// src/preload/tab-preload.js
// Preload exclusivo e seguro para as WebContentsViews de abas do Dragon.
// Segurança máxima: contextIsolation: true, sandbox: true, nodeIntegration: false.
// APIs internas NUNCA são expostas a páginas externas da web (HTTP/HTTPS).
// Expõe métodos restritos apenas quando a URL pertence às páginas internas autorizadas.
// =============================================================================

const { contextBridge, ipcRenderer, webFrame } = require('electron');

const rawPathname = (window.location && window.location.pathname) || '';
const pathname = decodeURIComponent(rawPathname).replace(/\\/g, '/').toLowerCase();

const isHttpsWarning = pathname.endsWith('/pages/https-warning.html');
const isCertError = pathname.endsWith('/pages/cert-error.html');
const isHistory = pathname.endsWith('/pages/history.html');
const isBookmarks = pathname.endsWith('/pages/bookmarks.html');
const isDownloads = pathname.endsWith('/pages/downloads.html');
const isNewTab = pathname.endsWith('/pages/newtab.html');
const isSettings = pathname.endsWith('/pages/settings.html');
const isError = pathname.endsWith('/pages/error.html');

const isInternalPage = isHttpsWarning || isCertError || isHistory || isBookmarks || isDownloads ||
  isNewTab || isSettings || isError ||
  (window.location && (window.location.protocol === 'chrome:' || window.location.protocol === 'data:'));

// ETAPA 5: Injeta proteções de fingerprinting estritamente em páginas web normais (HTTP/HTTPS)
if (!isInternalPage) {
  try {
    const fpScript = ipcRenderer.sendSync('fingerprint:get-script');
    if (fpScript && typeof fpScript === 'string' && fpScript.trim()) {
      webFrame.executeJavaScript(fpScript);
    }
  } catch (err) {
    // Falha silenciosa para preservar a navegação
  }
}

// Expõe a API de aviso HTTPS estritamente para pages/https-warning.html
if (isHttpsWarning) {
  contextBridge.exposeInMainWorld('warningAPI', {
    requestBypassToken: (targetUrl) => ipcRenderer.invoke('warning:request-bypass-token', targetUrl)
  });
}

// Expõe a API de erro de certificado estritamente para pages/cert-error.html
if (isCertError) {
  contextBridge.exposeInMainWorld('certErrorAPI', {
    requestBypassToken: (targetUrl) => ipcRenderer.invoke('cert-error:request-bypass-token', targetUrl),
    proceedWithBypass: (targetUrl, token) => ipcRenderer.invoke('cert-error:proceed', { targetUrl, token }),
    goHome: () => ipcRenderer.invoke('navigation:home-from-page')
  });
}

// Expõe a API de histórico estritamente para pages/history.html
if (isHistory) {
  contextBridge.exposeInMainWorld('historyAPI', {
    getEntries: (query) => ipcRenderer.invoke('history:get', query),
    deleteEntry: (id) => ipcRenderer.invoke('history:delete', id),
    clearAll: () => ipcRenderer.invoke('history:clear'),
    openUrl: (url) => ipcRenderer.invoke('history:open', url)
  });
}

// Expõe a API de favoritos estritamente para pages/bookmarks.html
if (isBookmarks) {
  contextBridge.exposeInMainWorld('bookmarksAPI', {
    getBookmarks: (query) => ipcRenderer.invoke('bookmarks:get', query),
    removeBookmark: (id) => ipcRenderer.invoke('bookmarks:remove', id),
    addBookmark: (item) => ipcRenderer.invoke('bookmarks:add', item),
    clearAll: () => ipcRenderer.invoke('bookmarks:clear'),
    openUrl: (url) => ipcRenderer.invoke('bookmarks:open', url)
  });
}

// Expõe a API de downloads estritamente para pages/downloads.html
if (isDownloads) {
  contextBridge.exposeInMainWorld('downloadsAPI', {
    getDownloads: () => ipcRenderer.invoke('downloads:get'),
    openFile: (filePath) => ipcRenderer.invoke('downloads:open-file', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('downloads:show-in-folder', filePath),
    cancelDownload: (id) => ipcRenderer.invoke('downloads:cancel', id),
    clearHistory: () => ipcRenderer.invoke('downloads:clear'),
    openUrl: (url) => ipcRenderer.invoke('downloads:open', url),
    onDownloadUpdate: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (event, data) => callback(data);
      ipcRenderer.on('downloads:tab-update', handler);
      return () => {
        ipcRenderer.removeListener('downloads:tab-update', handler);
      };
    }
  });
}
