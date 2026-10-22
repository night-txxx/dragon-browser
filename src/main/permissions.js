// =============================================================================
// src/main/permissions.js
// Gerenciamento e persistência de permissões por site (permissions.json)
// Câmera, microfone, notificações e geolocalização
// =============================================================================

const storage = require('./storage');

const PERMISSIONS_FILENAME = 'permissions.json';
let permissionsCache = null;

function loadPermissions() {
  if (permissionsCache === null) {
    permissionsCache = storage.readJSON(PERMISSIONS_FILENAME, {});
    if (!permissionsCache || typeof permissionsCache !== 'object') {
      permissionsCache = {};
    }
  }
  return permissionsCache;
}

function persistPermissions() {
  storage.writeJSON(PERMISSIONS_FILENAME, permissionsCache);
}

/**
 * Normaliza a origem da requisição (ex: https://example.com)
 * @param {string} rawUrlOrOrigin
 * @returns {string}
 */
function normalizeOrigin(rawUrlOrOrigin) {
  if (!rawUrlOrOrigin || typeof rawUrlOrOrigin !== 'string') return '';
  try {
    const url = new URL(rawUrlOrOrigin);
    return url.origin.toLowerCase();
  } catch {
    return rawUrlOrOrigin.toLowerCase().trim();
  }
}

/**
 * Retorna a decisão salva para uma permissão específica nesta origem
 * @param {string} origin
 * @param {string} permissionKey
 * @returns {'allow'|'block'|null}
 */
function getPermission(origin, permissionKey) {
  const normOrigin = normalizeOrigin(origin);
  if (!normOrigin || !permissionKey) return null;

  loadPermissions();
  if (permissionsCache[normOrigin] && permissionsCache[normOrigin][permissionKey]) {
    return permissionsCache[normOrigin][permissionKey];
  }
  return null;
}

/**
 * Salva a decisão de permissão para uma origem
 * @param {string} origin
 * @param {string} permissionKey
 * @param {'allow'|'block'} decision
 */
function setPermission(origin, permissionKey, decision) {
  const normOrigin = normalizeOrigin(origin);
  if (!normOrigin || !permissionKey) return;

  if (decision !== 'allow' && decision !== 'block') return;

  loadPermissions();
  if (!permissionsCache[normOrigin]) {
    permissionsCache[normOrigin] = {};
  }

  permissionsCache[normOrigin][permissionKey] = decision;
  persistPermissions();
}

/**
 * Retorna todas as permissões cadastradas organizadas por origem para as Configurações
 * @returns {Array<object>} Lista de { origin, permissions: { [key]: 'allow'|'block' } }
 */
function getAllPermissions() {
  loadPermissions();
  const list = [];
  for (const [origin, perms] of Object.entries(permissionsCache)) {
    list.push({
      origin,
      permissions: { ...perms }
    });
  }
  return list;
}

/**
 * Revoga uma permissão específica ou todas as permissões de uma origem
 * @param {string} origin
 * @param {string} [permissionKey]
 * @returns {boolean}
 */
function revokePermission(origin, permissionKey) {
  const normOrigin = normalizeOrigin(origin);
  if (!normOrigin) return false;

  loadPermissions();
  if (!permissionsCache[normOrigin]) return false;

  if (permissionKey) {
    delete permissionsCache[normOrigin][permissionKey];
    if (Object.keys(permissionsCache[normOrigin]).length === 0) {
      delete permissionsCache[normOrigin];
    }
  } else {
    delete permissionsCache[normOrigin];
  }

  persistPermissions();
  return true;
}

/**
 * Limpa todas as permissões salvas
 */
function clearAll() {
  permissionsCache = {};
  storage.writeJSON(PERMISSIONS_FILENAME, permissionsCache, { noBackup: true });
  if (typeof storage.removeBackupAndTempFiles === 'function') {
    storage.removeBackupAndTempFiles(PERMISSIONS_FILENAME);
  }
}

module.exports = {
  getPermission,
  setPermission,
  getAllPermissions,
  revokePermission,
  clearAll,
  normalizeOrigin
};
