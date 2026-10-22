// =============================================================================
// src/main/window-state.js
// Persistência e restauração do tamanho e posição da janela (window-state.json)
// =============================================================================

const { screen } = require('electron');
const storage = require('./storage');
const config = require('./config');

const STATE_FILENAME = 'window-state.json';
let saveTimeout = null;

/**
 * Lê o estado salvo da janela ou devolve os padrões seguros
 * @returns {object} { width, height, x, y, isMaximized }
 */
function loadWindowState() {
  const defaults = {
    width: config.WINDOW_DEFAULTS.width || 1200,
    height: config.WINDOW_DEFAULTS.height || 800,
    isMaximized: false
  };

  const saved = storage.readJSON(STATE_FILENAME, null);
  if (!saved || typeof saved !== 'object') {
    return defaults;
  }

  const state = {
    width: Number.isInteger(saved.width) && saved.width >= config.WINDOW_DEFAULTS.minWidth ? saved.width : defaults.width,
    height: Number.isInteger(saved.height) && saved.height >= config.WINDOW_DEFAULTS.minHeight ? saved.height : defaults.height,
    x: Number.isInteger(saved.x) ? saved.x : undefined,
    y: Number.isInteger(saved.y) ? saved.y : undefined,
    isMaximized: Boolean(saved.isMaximized)
  };

  // Se coordenadas foram gravadas, verifica se estão dentro dos limites visíveis de algum monitor conectado
  if (state.x !== undefined && state.y !== undefined) {
    const isVisible = isBoundsVisible({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height
    });

    if (!isVisible) {
      delete state.x;
      delete state.y;
    }
  }

  return state;
}

/**
 * Valida se um retângulo está ao menos parcialmente visível em qualquer monitor conectado
 * @param {object} bounds
 * @returns {boolean}
 */
function isBoundsVisible(bounds) {
  const displays = screen.getAllDisplays();
  return displays.some(display => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

/**
 * Salva as dimensões normais e estado maximizado da janela com debounce
 * @param {Electron.BrowserWindow} window
 */
function saveWindowState(window) {
  if (!window || window.isDestroyed()) return;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    try {
      if (window.isDestroyed()) return;

      const isMaximized = window.isMaximized();
      let bounds;

      if (typeof window.getNormalBounds === 'function') {
        bounds = window.getNormalBounds();
      } else {
        bounds = window.getBounds();
      }

      const state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: isMaximized
      };

      storage.writeJSON(STATE_FILENAME, state);
    } catch (err) {
      console.warn('[WindowState] Erro ao salvar estado da janela:', err.message);
    }
  }, 300);
}

module.exports = {
  loadWindowState,
  saveWindowState
};
