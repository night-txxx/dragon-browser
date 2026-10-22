// =============================================================================
// src/main/session.js
// Configurações de segurança, políticas de permissão, proxy e downloads da sessão
// =============================================================================

const crypto = require('crypto');
const { app, session } = require('electron');
const downloads = require('./downloads');
const permissions = require('./permissions');
const privacy = require('./privacy');
const settings = require('./settings');

let mainWindowRef = null;
let windowManagerRef = null;
const pendingPermissionRequests = new Map(); // requestId -> { callback, origin, permissionKey, webContentsId, isPrivate }
const privatePermissions = new Map(); // "origin::permissionKey" -> 'allow' | 'block' (apenas memória)

// Sanitização global do User-Agent antes do ready: remove "Electron/x.y.z" e "Dragon/x.y.z"
if (app && app.userAgentFallback) {
  app.userAgentFallback = app.userAgentFallback
    .replace(/Electron\/[0-9.]+\s?/gi, '')
    .replace(/Dragon\/[0-9.]+\s?/gi, '')
    .trim();
}

/**
 * Permissões intrinsecamente seguras liberadas sem necessidade de interrupção do usuário
 */
const ALLOWED_PERMISSIONS = new Set([
  'fullscreen',
  'clipboard-sanitized-write'
]);

/**
 * Mapeia permissões do Chromium para chaves consistentes de permissão.
 * Bloco 2.3: Quando mediaTypes contiver áudio e vídeo juntos, retorna 'media'.
 * Só retorna 'media:video' ou 'media:audio' quando for estritamente um tipo.
 * @param {string} permission
 * @param {object} details
 * @returns {string|null}
 */
function getPermissionKey(permission, details) {
  if (permission === 'media') {
    const types = details && Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
    const hasVideo = types.includes('video');
    const hasAudio = types.includes('audio');
    if (hasVideo && hasAudio) return 'media';
    if (hasVideo) return 'media:video';
    if (hasAudio) return 'media:audio';
    return 'media';
  }
  if (permission === 'notifications') return 'notifications';
  if (permission === 'geolocation') return 'geolocation';
  return null;
}

/**
 * Rótulo amigável em português para a interface do prompt de permissão
 * @param {string} permissionKey
 * @returns {string}
 */
function getPermissionLabel(permissionKey) {
  switch (permissionKey) {
    case 'media:video':
      return 'Câmera';
    case 'media:audio':
      return 'Microfone';
    case 'media':
      return 'Câmera e Microfone';
    case 'notifications':
      return 'Notificações';
    case 'geolocation':
      return 'Sua Localização';
    default:
      return permissionKey;
  }
}

/**
 * Cancela e nega todas as solicitações de permissão pendentes para um WebContents específico
 * @param {number} webContentsId
 */
function cancelPendingRequestsForWebContents(webContentsId) {
  if (!webContentsId) return;

  const toRemove = [];
  for (const [requestId, req] of pendingPermissionRequests.entries()) {
    if (req.webContentsId === webContentsId) {
      toRemove.push(requestId);
      if (typeof req.callback === 'function') {
        req.callback(false);
      }
    }
  }

  for (const requestId of toRemove) {
    pendingPermissionRequests.delete(requestId);
  }

  if (mainWindowRef && !mainWindowRef.isDestroyed() && toRemove.length > 0) {
    mainWindowRef.webContents.send('browser:cancel-permission-prompt', { webContentsId });
  }

  if (pendingPermissionRequests.size === 0 && windowManagerRef) {
    windowManagerRef.hideOverlay('permission');
  }
}

/**
 * Aplica as configurações de Proxy à sessão informada
 * @param {Electron.Session} ses
 * @param {boolean} [isPrivate=false]
 */
function applyProxyToSession(ses, isPrivate = false) {
  if (!ses) return;

  const proxyMode = settings.get('proxyMode') || 'system';
  const applyToPrivate = Boolean(settings.get('applyProxyToPrivateTabs'));

  if (isPrivate && !applyToPrivate) {
    ses.setProxy({ mode: 'direct' }).catch(() => {});
    return;
  }

  if (proxyMode === 'manual') {
    const rules = settings.get('proxyRules') || '';
    const bypass = settings.get('proxyBypass') || '<local>;*.local';
    ses.setProxy({ proxyRules: rules, proxyBypassRules: bypass }).catch(err => {
      console.warn('[Proxy] Falha ao configurar proxy manual:', err.message);
    });
  } else if (proxyMode === 'direct') {
    ses.setProxy({ mode: 'direct' }).catch(() => {});
  } else {
    ses.setProxy({ mode: 'system' }).catch(() => {});
  }
}

/**
 * Trata a resposta do usuário dada no prompt de permissão (bottom-sheet)
 * @param {string} requestId
 * @param {boolean} allowed
 * @param {boolean} remember
 */
function respondPermission(requestId, allowed, remember) {
  if (!requestId || !pendingPermissionRequests.has(requestId)) return;

  const req = pendingPermissionRequests.get(requestId);
  pendingPermissionRequests.delete(requestId);

  if (remember) {
    if (req.isPrivate) {
      privatePermissions.set(`${req.origin}::${req.permissionKey}`, allowed ? 'allow' : 'block');
    } else {
      permissions.setPermission(req.origin, req.permissionKey, allowed ? 'allow' : 'block');
    }
  }

  if (typeof req.callback === 'function') {
    req.callback(Boolean(allowed));
  }

  // O overlay só deve ser escondido quando a fila esvaziar por completo
  if (pendingPermissionRequests.size === 0 && windowManagerRef) {
    windowManagerRef.hideOverlay('permission');
  }
}

/**
 * Configura segurança, downloads, privacidade e permissões para qualquer sessão
 * @param {Electron.Session} ses Instância de sessão
 * @param {boolean} [isPrivate=false]
 */
function configureSession(ses, isPrivate = false) {
  if (!ses) return;

  // 1. Aplica regras de privacidade da rede (bloqueio de rastreadores, HTTPS, headers, cookies)
  privacy.applyPrivacy(ses);

  // 2. Registra o gerenciador de downloads (downloads privados não vão para o disco)
  downloads.registerSessionDownloads(ses, isPrivate);

  // 3. Aplica regras de proxy
  applyProxyToSession(ses, isPrivate);

  // Helper para checar status (considera memória privada ou storage persistente)
  const getDecision = (origin, key) => {
    if (isPrivate) {
      return privatePermissions.get(`${origin}::${key}`);
    }
    return permissions.getPermission(origin, key);
  };

  // 4. Política de permissões por site com prompt e persistência (negar por padrão)
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (ALLOWED_PERMISSIONS.has(permission)) {
      if (details && details.isMainFrame !== false) {
        callback(true);
        return;
      }
      callback(false);
      return;
    }

    const permissionKey = getPermissionKey(permission, details);
    if (!permissionKey) {
      console.warn(`[Segurança] Permissão desconhecida negada por padrão para ${details?.requestingUrl}: ${permission}`);
      callback(false);
      return;
    }

    const origin = details?.requestingUrl || '';
    let savedDecision = getDecision(origin, permissionKey);

    // Se a chave for 'media', mas tivermos permissões individuais de áudio e vídeo
    if (!savedDecision && permissionKey === 'media') {
      const vid = getDecision(origin, 'media:video');
      const aud = getDecision(origin, 'media:audio');
      if (vid === 'allow' && aud === 'allow') savedDecision = 'allow';
      else if (vid === 'block' || aud === 'block') savedDecision = 'block';
    } else if (!savedDecision && (permissionKey === 'media:video' || permissionKey === 'media:audio')) {
      const med = getDecision(origin, 'media');
      if (med) savedDecision = med;
    }

    if (savedDecision === 'allow') {
      callback(true);
      return;
    }
    if (savedDecision === 'block') {
      callback(false);
      return;
    }

    // Se ainda não houver decisão para a origem, abre o prompt na interface
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      const requestId = crypto.randomUUID();
      pendingPermissionRequests.set(requestId, {
        callback,
        origin,
        permissionKey,
        webContentsId: webContents.id,
        isPrivate: Boolean(isPrivate)
      });

      mainWindowRef.webContents.send('browser:prompt-permission', {
        requestId,
        origin,
        permissionKey,
        webContentsId: webContents.id,
        label: getPermissionLabel(permissionKey)
      });

      if (windowManagerRef) {
        windowManagerRef.showOverlay('permission');
      }
    } else {
      callback(false);
    }
  });

  // 5. Verificação síncrona de permissões concedidas anteriormente
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (ALLOWED_PERMISSIONS.has(permission)) {
      return true;
    }
    const permissionKey = getPermissionKey(permission, details);
    if (!permissionKey) return false;

    if (permissionKey === 'media') {
      const stateMedia = getDecision(requestingOrigin, 'media');
      if (stateMedia === 'allow') return true;
      if (stateMedia === 'block') return false;
      return getDecision(requestingOrigin, 'media:video') === 'allow' && getDecision(requestingOrigin, 'media:audio') === 'allow';
    }

    if (permissionKey === 'media:video' || permissionKey === 'media:audio') {
      const stateSpecific = getDecision(requestingOrigin, permissionKey);
      if (stateSpecific === 'allow') return true;
      if (stateSpecific === 'block') return false;
      return getDecision(requestingOrigin, 'media') === 'allow';
    }

    return getDecision(requestingOrigin, permissionKey) === 'allow';
  });
}

/**
 * Inicializa a sessão padrão e os manipuladores globais
 * @param {object} context Objeto contendo { mainWindow, windowManager }
 */
function init(context) {
  mainWindowRef = context.mainWindow;
  windowManagerRef = context.windowManager;

  // Inicializa o motor de privacidade (carrega blocklist e exceções)
  privacy.init(context);

  // Configura a sessão padrão
  configureSession(session.defaultSession, false);

  // Trata autenticação de proxy e sites normais (Bloco 3.8)
  app.on('login', (event, webContents, request, authInfo, callback) => {
    if (authInfo && authInfo.isProxy) {
      event.preventDefault();
      const user = settings.get('proxyAuthUser') || '';
      const pass = settings.getProxyPassword() || '';
      if (user && pass) {
        callback(user, pass);
      } else {
        callback();
      }
    } else {
      // Para sites normais (!authInfo.isProxy), previne travamento do processo
      event.preventDefault();
      callback();
    }
  });

  // Sincroniza proxy quando as configurações forem alteradas
  settings.onChange((key) => {
    if (key.startsWith('proxy') || key === '*') {
      applyProxyToSession(session.defaultSession, false);
    }
  });
}

function clearPrivatePermissions() {
  privatePermissions.clear();
}

module.exports = {
  init,
  configureSession,
  applyProxyToSession,
  respondPermission,
  cancelPendingRequestsForWebContents,
  getPermissionKey,
  getPermissionLabel,
  ALLOWED_PERMISSIONS,
  clearPrivatePermissions
};
