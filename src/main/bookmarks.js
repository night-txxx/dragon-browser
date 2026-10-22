// =============================================================================
// src/main/bookmarks.js
// Gerenciamento e persistência dos favoritos do usuário (bookmarks.json)
// =============================================================================

const crypto = require('crypto');
const storage = require('./storage');

const BOOKMARKS_FILENAME = 'bookmarks.json';
let bookmarksCache = null;

function loadBookmarks() {
  if (bookmarksCache === null) {
    bookmarksCache = storage.readJSON(BOOKMARKS_FILENAME, []);
    if (!Array.isArray(bookmarksCache)) {
      bookmarksCache = [];
    }
  }
  return bookmarksCache;
}

function persistBookmarks() {
  storage.writeJSON(BOOKMARKS_FILENAME, bookmarksCache);
}

/**
 * Retorna todos os favoritos com busca opcional por termo
 * @param {string} [query]
 * @returns {Array<object>}
 */
function getBookmarks(query = '') {
  loadBookmarks();

  const q = (query || '').toLowerCase().trim();
  if (!q) {
    return [...bookmarksCache];
  }

  return bookmarksCache.filter(b => {
    const titleMatch = b.title && b.title.toLowerCase().includes(q);
    const urlMatch = b.url && b.url.toLowerCase().includes(q);
    return titleMatch || urlMatch;
  });
}

/**
 * Verifica se uma URL já está nos favoritos
 * @param {string} url
 * @returns {boolean}
 */
function isBookmarked(url) {
  if (!url || typeof url !== 'string') return false;
  loadBookmarks();
  const cleanUrl = url.trim().toLowerCase();
  return bookmarksCache.some(b => b.url && b.url.toLowerCase() === cleanUrl);
}

/**
 * Adiciona uma URL aos favoritos se ainda não existir
 * @param {object} item { url, title }
 * @returns {object|null} Item adicionado ou existente
 */
function addBookmark(item) {
  if (!item || !item.url) return null;
  const url = item.url.trim();
  if (!url || url.startsWith('about:') || url.startsWith('javascript:')) return null;

  loadBookmarks();

  const existing = bookmarksCache.find(b => b.url.toLowerCase() === url.toLowerCase());
  if (existing) {
    return existing;
  }

  const newBookmark = {
    id: crypto.randomUUID(),
    title: (item.title || url).trim(),
    url: url,
    createdAt: Date.now()
  };

  bookmarksCache.unshift(newBookmark);
  persistBookmarks();
  return newBookmark;
}

/**
 * Remove um favorito pelo ID ou URL
 * @param {string} idOrUrl
 * @returns {boolean}
 */
function removeBookmark(idOrUrl) {
  if (!idOrUrl) return false;
  loadBookmarks();

  const initialLength = bookmarksCache.length;
  const target = idOrUrl.trim().toLowerCase();

  bookmarksCache = bookmarksCache.filter(b => b.id !== idOrUrl && b.url.toLowerCase() !== target);

  if (bookmarksCache.length !== initialLength) {
    persistBookmarks();
    return true;
  }
  return false;
}

/**
 * Alterna o estado de favorito para uma URL
 * @param {object} item { url, title }
 * @returns {{ bookmarked: boolean, bookmark: object|null }}
 */
function toggleBookmark(item) {
  if (!item || !item.url) return { bookmarked: false, bookmark: null };
  const url = item.url.trim();

  if (isBookmarked(url)) {
    removeBookmark(url);
    return { bookmarked: false, bookmark: null };
  } else {
    const b = addBookmark(item);
    return { bookmarked: true, bookmark: b };
  }
}

/**
 * Limpa todos os favoritos
 */
function clearAll() {
  bookmarksCache = [];
  persistBookmarks();
}

module.exports = {
  getBookmarks,
  isBookmarked,
  addBookmark,
  removeBookmark,
  toggleBookmark,
  clearAll
};
