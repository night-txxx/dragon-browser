// =============================================================================
// src/main/history.js
// Gerenciamento e persistência do histórico de navegação (history.json)
// Abas privadas e páginas internas do navegador NUNCA são registradas.
// =============================================================================

const crypto = require('crypto');
const storage = require('./storage');
const config = require('./config');

const HISTORY_FILENAME = 'history.json';
const MAX_HISTORY_ITEMS = 5000;

let historyCache = null;
let persistTimer = null;

function loadHistory() {
  if (historyCache === null) {
    historyCache = storage.readJSON(HISTORY_FILENAME, []);
    if (!Array.isArray(historyCache)) {
      historyCache = [];
    }
  }
  return historyCache;
}

/**
 * Grava o histórico em disco com debounce de 1 segundo para evitar reescrita síncrona frequente
 */
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (historyCache !== null) {
      storage.writeJSON(HISTORY_FILENAME, historyCache);
    }
  }, 1000);
}

/**
 * Força a gravação imediata e síncrona do histórico (ex: antes de fechar o app)
 */
function flushHistorySync() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (historyCache !== null) {
    storage.writeJSON(HISTORY_FILENAME, historyCache);
  }
}

/**
 * Adiciona uma página ao histórico
 * @param {object} item { url, title, isPrivate }
 */
function addEntry(item) {
  if (!item || !item.url || item.isPrivate) return;

  const url = item.url.trim();
  if (
    !url ||
    url.startsWith('about:') ||
    url.startsWith('dragon:') ||
    url === 'chrome://' ||
    url.startsWith('javascript:')
  ) {
    return;
  }

  // Ignora páginas internas do navegador
  if (
    url.startsWith(config.NEW_TAB_URL) ||
    url.startsWith(config.SETTINGS_PAGE_URL) ||
    url.startsWith(config.HISTORY_PAGE_URL) ||
    url.startsWith(config.BOOKMARKS_PAGE_URL) ||
    url.startsWith(config.DOWNLOADS_PAGE_URL) ||
    url.startsWith(config.ERROR_PAGE_URL) ||
    url.startsWith(config.HTTPS_WARNING_URL) ||
    url.startsWith(config.CERT_ERROR_PAGE_URL)
  ) {
    return;
  }

  loadHistory();

  const title = (item.title || url).trim();
  const entry = {
    id: crypto.randomUUID(),
    url: url,
    title: title,
    timestamp: Date.now()
  };

  // Insere no início da lista
  historyCache.unshift(entry);

  if (historyCache.length > MAX_HISTORY_ITEMS) {
    historyCache.length = MAX_HISTORY_ITEMS;
  }

  schedulePersist();
}

/**
 * Atualiza o título da entrada mais recente com a URL correspondente (evita 2 entradas por navegação)
 * @param {string} url
 * @param {string} title
 */
function updateTitle(url, title) {
  if (!url || !title) return;
  loadHistory();
  const cleanUrl = url.trim();
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  const entry = historyCache.find(item => item.url === cleanUrl);
  if (entry) {
    entry.title = cleanTitle;
    schedulePersist();
  }
}

/**
 * Retorna as entradas do histórico com busca e limite opcionais
 * @param {string} [query]
 * @param {number} [limit]
 * @returns {Array<object>}
 */
function getEntries(query = '', limit = 100) {
  loadHistory();

  const q = (query || '').toLowerCase().trim();
  let results = historyCache;

  if (q) {
    results = historyCache.filter(item => {
      const titleMatch = item.title && item.title.toLowerCase().includes(q);
      const urlMatch = item.url && item.url.toLowerCase().includes(q);
      return titleMatch || urlMatch;
    });
  }

  return results.slice(0, Math.max(1, limit));
}

/**
 * Remove uma entrada do histórico por id
 * @param {string} id
 * @returns {boolean}
 */
function deleteEntry(id) {
  loadHistory();
  const initialLength = historyCache.length;
  historyCache = historyCache.filter(item => item.id !== id);

  if (historyCache.length !== initialLength) {
    flushHistorySync();
    return true;
  }
  return false;
}

/**
 * Limpa todo o histórico de navegação
 */
function clearAll() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  historyCache = [];
  storage.writeJSON(HISTORY_FILENAME, [], { noBackup: true });
  if (typeof storage.removeBackupAndTempFiles === 'function') {
    storage.removeBackupAndTempFiles(HISTORY_FILENAME);
  }
}

module.exports = {
  addEntry,
  updateTitle,
  flushHistorySync,
  getEntries,
  deleteEntry,
  clearAll
};
