// =============================================================================
// src/main/config.js
// Constantes e valores padrão da aplicação
// =============================================================================

const path = require('path');
const { pathToFileURL } = require('url');

// Altura em pixels reservada para a interface do navegador (abas + barra de endereço)
// O WebContentsView de cada site começará exatamente abaixo dessa altura.
const TOP_BAR_HEIGHT = 76;

// Mecanismo de busca padrão quando o usuário digita termos que não são URLs
const DEFAULT_SEARCH_ENGINE = 'https://duckduckgo.com/?q=';

// Caminhos para as páginas internas do navegador (convertidos em URLs válidas)
const PAGES_DIR = path.join(__dirname, '../../pages');
const NEW_TAB_URL = pathToFileURL(path.join(PAGES_DIR, 'newtab.html')).href;
const SETTINGS_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'settings.html')).href;
const ERROR_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'error.html')).href;
const HTTPS_WARNING_URL = pathToFileURL(path.join(PAGES_DIR, 'https-warning.html')).href;
const CERT_ERROR_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'cert-error.html')).href;
const HISTORY_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'history.html')).href;
const BOOKMARKS_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'bookmarks.html')).href;
const DOWNLOADS_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'downloads.html')).href;

// Configurações padrão de dimensão e aparência da janela principal
const WINDOW_DEFAULTS = {
  width: 1200,
  height: 800,
  minWidth: 640,
  minHeight: 480,
  title: 'Dragon',
  backgroundColor: '#1e1e24',
  autoHideMenuBar: true
};

module.exports = {
  TOP_BAR_HEIGHT,
  DEFAULT_SEARCH_ENGINE,
  NEW_TAB_URL,
  SETTINGS_PAGE_URL,
  ERROR_PAGE_URL,
  HTTPS_WARNING_URL,
  CERT_ERROR_PAGE_URL,
  HISTORY_PAGE_URL,
  BOOKMARKS_PAGE_URL,
  DOWNLOADS_PAGE_URL,
  WINDOW_DEFAULTS
};
