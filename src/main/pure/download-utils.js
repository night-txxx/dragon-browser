// =============================================================================
// src/main/pure/download-utils.js
// Funções puras para validação e classificação de segurança de arquivos baixados
// =============================================================================

const path = require('path');

// Lista canônica de extensões de risco de execução no Windows
const RISKY_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.scr',
  '.msi',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.ps1',
  '.ps1xml',
  '.ps2',
  '.ps2xml',
  '.psc1',
  '.psc2',
  '.jar',
  '.com',
  '.pif',
  '.reg',
  '.hta',
  '.cpl',
  '.inf',
  '.ins',
  '.isp'
]);

/**
 * Verifica se um nome de arquivo ou caminho possui extensão de risco de execução
 * @param {string} filename Nome do arquivo ou caminho completo
 * @returns {boolean}
 */
function isRiskyDownload(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const ext = path.extname(filename).trim().toLowerCase();
  return RISKY_EXTENSIONS.has(ext);
}

module.exports = {
  RISKY_EXTENSIONS,
  isRiskyDownload
};
