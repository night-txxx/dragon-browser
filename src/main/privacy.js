// =============================================================================
// src/main/privacy.js
// Proteções de privacidade no estilo DuckDuckGo:
// 1. Bloqueio de rastreadores (blocklist de domínios conhecidos)
// 2. Upgrade automático de HTTP para HTTPS com fallback seguro via token único
// 3. Cabeçalhos Sec-GPC: 1, DNT: 1 e minimização de Referer (com suporte a exceções)
// 4. Bloqueio de cookies de terceiros (Cookie / Set-Cookie com suporte a exceções)
// 5. Limpeza de parâmetros de rastreamento de URLs (utm_*, fbclid, etc.)
// 6. Política restrita de WebRTC para evitar vazamento de IP real
// =============================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, webContents, net } = require('electron');
const storage = require('./storage');
const settings = require('./settings');
const {
  getBaseDomain,
  isLocalHost,
  isTrackerDomain: isTrackerDomainPure,
  cleanTrackingParameters,
  isValidBlocklistHost,
  calculatePrivacyGrade
} = require('./pure/privacy-utils');

// Conjunto de domínios conhecidos de rastreadores carregados de assets/blocklists/trackers.txt
const trackerDomains = new Set();

// Mapa em memória para rastreadores bloqueados por WebContents (aba ativa)
// Chave: webContentsId (número) -> Valor: { count: number, domains: Set<string> }
const tabTrackerData = new Map();

// Mapa em memória para contagem de pop-ups e redirecionamentos bloqueados por WebContents
// Chave: webContentsId (número) -> Valor: number
const tabPopupsBlocked = new Map();

// Mapa em memória para hosts temporariamente liberados para HTTP por aba
// Chave: webContentsId (número) -> Valor: Set<string> (hostnames em minúsculas)
const tabAllowedHttpHosts = new Map();

// Mapa em memória para hosts com certificado temporariamente aceito por aba
// Chave: webContentsId (número) -> Valor: Set<string> (hostnames em minúsculas)
const tabAllowedCertHosts = new Map();

// Mapa de tokens de uso único para autorização de navegação HTTP a partir do aviso de segurança
// Chave: token (UUID string) -> Valor: { wcId: number, host: string, expiresAt: number }
const httpBypassTokens = new Map();

// Mapa de tokens de uso único para autorização de certificado inválido
// Chave: token (UUID string) -> Valor: { wcId: number, host: string, expiresAt: number }
const certBypassTokens = new Map();

/**
 * Gera um token de uso único criptograficamente seguro para bypass temporário de HTTPS.
 * Vinculado estritamente ao webContentsId e ao hostname, com validade de 30 segundos.
 * @param {number} webContentsId
 * @param {string} hostname
 * @returns {string|null} Token UUID gerado ou null
 */
function createHttpBypassToken(webContentsId, hostname) {
  if (!webContentsId || !hostname || typeof hostname !== 'string') return null;
  const token = crypto.randomUUID();
  const host = hostname.toLowerCase();
  httpBypassTokens.set(token, {
    wcId: webContentsId,
    host: host,
    expiresAt: Date.now() + 30000 // 30 segundos de validade (curto prazo)
  });
  return token;
}

/**
 * Valida e consome imediatamente o token de bypass HTTP (uso único).
 * @param {string} token
 * @param {number} webContentsId
 * @param {string} hostname
 * @returns {boolean} true se válido e consumido com sucesso; false caso contrário
 */
function validateAndConsumeHttpBypassToken(token, webContentsId, hostname) {
  if (!token || !httpBypassTokens.has(token)) return false;
  const data = httpBypassTokens.get(token);

  if (Date.now() > data.expiresAt) {
    httpBypassTokens.delete(token);
    return false;
  }
  if (data.wcId !== webContentsId) return false;
  if (data.host !== hostname.toLowerCase()) return false;

  // Invalida imediatamente após o uso com sucesso (uso estritamente único)
  httpBypassTokens.delete(token);
  return true;
}

/**
 * Libera temporariamente um host para HTTP na aba informada.
 * @param {number} webContentsId
 * @param {string} hostname
 */
function allowHttpForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return;
  if (!tabAllowedHttpHosts.has(webContentsId)) {
    tabAllowedHttpHosts.set(webContentsId, new Set());
  }
  tabAllowedHttpHosts.get(webContentsId).add(hostname.toLowerCase());
}

/**
 * Verifica se um host está temporariamente liberado para HTTP nesta aba.
 * @param {number} webContentsId
 * @param {string} hostname
 * @returns {boolean}
 */
function isHttpAllowedForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return false;
  const set = tabAllowedHttpHosts.get(webContentsId);
  return Boolean(set && set.has(hostname.toLowerCase()));
}

/**
 * Limpa o conjunto de hosts HTTP liberados ao fechar a aba de origem.
 * @param {number} webContentsId
 */
function clearAllowedHttpHosts(webContentsId) {
  if (webContentsId) {
    tabAllowedHttpHosts.delete(webContentsId);
  }
}

/**
  * Gera um token de uso único para bypass temporário de erro de certificado SSL/TLS.
  * Vinculado estritamente ao webContentsId e ao hostname, com validade de 30 segundos.
  * @param {number} webContentsId
  * @param {string} hostname
  * @returns {string|null}
  */
function createCertBypassToken(webContentsId, hostname) {
  if (!webContentsId || !hostname || typeof hostname !== 'string') return null;
  const token = crypto.randomUUID();
  const host = hostname.toLowerCase();
  certBypassTokens.set(token, {
    wcId: webContentsId,
    host: host,
    expiresAt: Date.now() + 30000 // 30 segundos
  });
  return token;
}

/**
  * Valida e consome imediatamente o token de bypass de certificado (uso estritamente único).
  * @param {string} token
  * @param {number} webContentsId
  * @param {string} hostname
  * @returns {boolean}
  */
function validateAndConsumeCertBypassToken(token, webContentsId, hostname) {
  if (!token || !certBypassTokens.has(token)) return false;
  const data = certBypassTokens.get(token);

  if (Date.now() > data.expiresAt) {
    certBypassTokens.delete(token);
    return false;
  }
  if (data.wcId !== webContentsId) return false;
  if (data.host !== hostname.toLowerCase()) return false;

  certBypassTokens.delete(token);
  return true;
}

/**
  * Libera temporariamente um host com erro de certificado SSL nesta aba.
  * @param {number} webContentsId
  * @param {string} hostname
  */
function allowCertHostForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return;
  if (!tabAllowedCertHosts.has(webContentsId)) {
    tabAllowedCertHosts.set(webContentsId, new Set());
  }
  tabAllowedCertHosts.get(webContentsId).add(hostname.toLowerCase());
}

/**
  * Verifica se um host com certificado inválido está temporariamente aceito nesta aba.
  * @param {number} webContentsId
  * @param {string} hostname
  * @returns {boolean}
  */
function isCertAllowedForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return false;
  const set = tabAllowedCertHosts.get(webContentsId);
  return Boolean(set && set.has(hostname.toLowerCase()));
}

/**
  * Limpa os hosts com certificado aceito ao fechar a aba de origem.
  * @param {number} webContentsId
  */
function clearAllowedCertHosts(webContentsId) {
  if (webContentsId) {
    tabAllowedCertHosts.delete(webContentsId);
  }
}

// Lista de sites onde o usuário desativou a proteção (persistida via storage.js)
let exemptSites = new Set();

// Referência opcional para notificar o renderer sobre novos rastreadores bloqueados
let onBlockedCallback = null;

// Parâmetros comuns de rastreamento a serem removidos de links
const TRACKING_PARAM_REGEX = /^(utm_[a-zA-Z0-9_]+|fbclid|gclid|msclkid|mc_eid|igshid|_ga)$/i;

/**
 * Verifica se um determinado host ou seu domínio base está na lista de exceções do usuário.
 * @param {string} hostname
 * @returns {boolean}
 */
function isSiteExempt(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const clean = hostname.toLowerCase();
  if (exemptSites.has(clean)) return true;
  const base = getBaseDomain(clean);
  return Boolean(base && exemptSites.has(base));
}

/**
 * Carrega a lista de domínios a partir de um arquivo em disco
 * @param {string} filePath
 */
function loadBlocklistFromFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim().toLowerCase();
        if (line && !line.startsWith('#')) {
          trackerDomains.add(line);
        }
      }
      return true;
    }
  } catch (err) {
    console.error(`[Privacidade] Erro ao carregar blocklist de ${filePath}:`, err.message);
  }
  return false;
}

/**
 * Verifica e baixa atualização da lista de rastreadores (Peter Lowe / EasyPrivacy) periodicamente.
 * Bloco 2.5: Valida cada linha contra regex de hostname válido, limita download a 5MB e usa timeout de 15s.
 */
function checkForBlocklistUpdates() {
  const userListPath = path.join(app.getPath('userData'), 'trackers-updated.txt');
  let shouldUpdate = false;

  try {
    if (!fs.existsSync(userListPath)) {
      shouldUpdate = true;
    } else {
      const stat = fs.statSync(userListPath);
      // Atualiza a cada 7 dias
      if (Date.now() - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
        shouldUpdate = true;
      }
    }
  } catch {
    shouldUpdate = true;
  }

  if (!shouldUpdate) return;

  const url = 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=nohtml&showintro=0&mimetype=plaintext';
  try {
    const request = net.request(url);
    let rawData = '';
    const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
    let totalReceived = 0;
    let aborted = false;

    // Timeout de 15 segundos
    const timer = setTimeout(() => {
      aborted = true;
      try { request.abort(); } catch {}
    }, 15000);

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timer);
        return;
      }
      response.on('data', (chunk) => {
        if (aborted) return;
        totalReceived += chunk.length;
        if (totalReceived > MAX_DOWNLOAD_BYTES) {
          aborted = true;
          clearTimeout(timer);
          try { request.abort(); } catch {}
          return;
        }
        rawData += chunk.toString();
      });
      response.on('end', () => {
        clearTimeout(timer);
        if (aborted) return;
        const rawLines = rawData.split(/\r?\n/);
        const validDomains = [];
        for (const line of rawLines) {
          if (isValidBlocklistHost(line)) {
            validDomains.push(line.trim().toLowerCase());
          }
        }
        if (validDomains.length > 500) {
          fs.writeFileSync(userListPath, validDomains.join('\n'), 'utf-8');
          for (const domain of validDomains) {
            trackerDomains.add(domain);
          }
          console.log(`[Privacidade] Blocklist atualizada dinamicamente com ${validDomains.length} domínios válidos.`);
        }
      });
    });

    request.on('error', () => {
      clearTimeout(timer);
      // Ignora falhas de rede silenciosamente para manter lista offline embutida
    });

    request.end();
  } catch {}
}

/**
 * Inicializa o módulo de privacidade carregando a blocklist e as exceções
 * @param {object} context Contexto global do app
 */
function init(context) {
  // Carrega lista atualizada do usuário em userData ou fallback para lista embutida
  const userListPath = path.join(app.getPath('userData'), 'trackers-updated.txt');
  const bundledListPath = path.join(__dirname, '../../assets/blocklists/trackers.txt');

  if (!loadBlocklistFromFile(userListPath)) {
    loadBlocklistFromFile(bundledListPath);
  }
  console.log(`[Privacidade] ${trackerDomains.size} domínios de rastreamento carregados.`);

  // Carrega a lista de sites liberados pelo usuário
  const savedExemptions = storage.readJSON('privacy-exemptions.json', []);
  if (Array.isArray(savedExemptions)) {
    exemptSites = new Set(savedExemptions.map(h => h.toLowerCase()));
  }

  // Verifica atualizações em segundo plano após inicialização
  setTimeout(() => {
    checkForBlocklistUpdates();
  }, 10000);
}

/**
 * Verifica se um domínio coincide com a lista de rastreadores (delega para função pura)
 * @param {string} hostname Hostname a ser testado
 * @returns {boolean}
 */
function isTrackerDomain(hostname) {
  return isTrackerDomainPure(hostname, trackerDomains);
}

/**
 * Registra as regras de privacidade na sessão informada (padrão ou privada)
 * @param {Electron.Session} sessionInstance Sessão do Electron
 */
function applyPrivacy(sessionInstance) {
  if (!sessionInstance || !sessionInstance.webRequest) return;

  // ---------------------------------------------------------------------------
  // 1. onBeforeRequest: Bloqueio de rastreadores, Upgrade HTTPS e Limpeza de links
  // ---------------------------------------------------------------------------
  sessionInstance.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const reqUrl = details.url;

    // A) Permite arquivos locais, páginas internas e esquemas especiais
    if (reqUrl.startsWith('file:') || reqUrl.startsWith('data:') || reqUrl.startsWith('chrome:')) {
      return callback({ cancel: false });
    }

    let parsedReqUrl = null;
    try {
      parsedReqUrl = new URL(reqUrl);
    } catch {
      return callback({ cancel: false });
    }

    const host = parsedReqUrl.hostname;

    // B) Limpeza de links com parâmetros de rastreamento na navegação principal
    if (details.resourceType === 'mainFrame') {
      const { cleanedUrl, hasRemovedParams } = cleanTrackingParameters(reqUrl);
      if (hasRemovedParams) {
        return callback({ redirectURL: cleanedUrl });
      }
    }

    // C) Upgrade automático de HTTP para HTTPS com suporte a token de uso único
    if (parsedReqUrl.protocol === 'http:') {
      const isLocal = isLocalHost(host);
      const wcId = details.webContentsId;
      const bypassToken = parsedReqUrl.searchParams.get('dragon_bypass_token');

      if (bypassToken) {
        // Remove o token da URL para não vazar pela rede nem para o site
        parsedReqUrl.searchParams.delete('dragon_bypass_token');
        const isValid = validateAndConsumeHttpBypassToken(bypassToken, wcId, host);
        if (isValid) {
          // Token único válido: libera o host temporariamente para esta aba
          if (wcId) {
            allowHttpForTab(wcId, host);
          }
          return callback({ redirectURL: parsedReqUrl.toString() });
        }
        // Se o token for inválido, expirado ou forjado, continua o fluxo seguro (upgrade HTTPS)
      }

      // Nas requisições seguintes, pula o upgrade para hosts liberados nesta aba
      const isHttpAllowed = isHttpAllowedForTab(wcId, host);
      if (!isLocal && !isHttpAllowed) {
        // Redireciona para HTTPS mantendo porta padrão ou alterando protocolo
        parsedReqUrl.protocol = 'https:';
        return callback({ redirectURL: parsedReqUrl.toString() });
      }
    }

    // D) Bloqueio de Rastreadores
    // Bloquear apenas requisições que não sejam mainFrame (navegar direto deve funcionar)
    // E NÃO bloquear requisições first-party (mesmo domínio base do initiator ou da página ativa)
    let pageHost = '';
    try {
      if (details.initiator) {
        pageHost = new URL(details.initiator).hostname;
      }
    } catch {}

    // Trata initiator ausente obtendo o hostname da URL do WebContents da aba
    if (!pageHost && details.webContentsId) {
      try {
        const wc = details.webContents || webContents.fromId(details.webContentsId);
        if (wc && !wc.isDestroyed()) {
          const currentUrl = wc.getURL();
          if (currentUrl) {
            pageHost = new URL(currentUrl).hostname;
          }
        }
      } catch {}
    }

    const isFirstParty = Boolean(pageHost && host && getBaseDomain(pageHost) === getBaseDomain(host));
    const exempt = Boolean(pageHost && isSiteExempt(pageHost));

    if (details.resourceType !== 'mainFrame' && !isFirstParty && !exempt && isTrackerDomain(host)) {
      // Incrementa o contador da aba que originou a requisição
      const wcId = details.webContentsId;
      if (wcId) {
        if (!tabTrackerData.has(wcId)) {
          tabTrackerData.set(wcId, { count: 0, domains: new Set() });
        }
        const data = tabTrackerData.get(wcId);
        data.count++;
        data.domains.add(host);

        if (typeof onBlockedCallback === 'function') {
          onBlockedCallback(wcId, data);
        }
      }

      // Cancela a requisição do rastreador
      return callback({ cancel: true });
    }

    callback({ cancel: false });
  });

  // ---------------------------------------------------------------------------
  // 2. onBeforeSendHeaders: Sec-GPC, DNT, Referer e Cookies de Terceiros
  // ---------------------------------------------------------------------------
  sessionInstance.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = details.requestHeaders;

    // Envia cabeçalhos que expressam recusa explícita de rastreamento
    headers['Sec-GPC'] = '1'; // Global Privacy Control
    headers['DNT'] = '1';     // Do Not Track

    // Normalização estável de User-Agent (ETAPA 5)
    if (settings && typeof settings.get === 'function' &&
        settings.get('fingerprintProtectionEnabled') &&
        settings.get('fingerprintNormalizeUA')) {
      const genericUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
      headers['User-Agent'] = genericUA;
      if (headers['user-agent']) headers['user-agent'] = genericUA;
    }

    let reqHost = '';
    try {
      reqHost = new URL(details.url).hostname;
    } catch {}

    let initiatorHost = '';
    try {
      if (details.initiator) {
        initiatorHost = new URL(details.initiator).hostname;
      }
    } catch {}

    // Identifica o hostname da página para verificar exceções do usuário
    let pageHost = initiatorHost;
    if (!pageHost && details.webContentsId) {
      try {
        const wc = details.webContents || webContents.fromId(details.webContentsId);
        if (wc && !wc.isDestroyed()) {
          const currentUrl = wc.getURL();
          if (currentUrl) {
            pageHost = new URL(currentUrl).hostname;
          }
        }
      } catch {}
    }

    const exempt = Boolean(pageHost && isSiteExempt(pageHost));
    const isCrossOrigin = initiatorHost && reqHost && getBaseDomain(initiatorHost) !== getBaseDomain(reqHost);

    // Se o site não estiver na lista de exceções, aplica proteção contra rastreamento cross-origin
    if (isCrossOrigin && !exempt) {
      // Reduz o Referer para apenas a origem (sem caminho nem parâmetros sensíveis)
      if (headers['Referer'] || headers['referer']) {
        try {
          const refUrl = new URL(headers['Referer'] || headers['referer']);
          headers['Referer'] = refUrl.origin + '/';
        } catch {
          delete headers['Referer'];
          delete headers['referer'];
        }
      }

      // Bloqueio de Cookies de Terceiros: só deve valer para resourceType diferente de "mainFrame" e "subFrame"
      if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
        delete headers['Cookie'];
        delete headers['cookie'];
      }
    }

    callback({ requestHeaders: headers });
  });

  // ---------------------------------------------------------------------------
  // 3. onHeadersReceived: Impede plantio de Cookies por terceiros (Set-Cookie)
  // ---------------------------------------------------------------------------
  sessionInstance.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = details.responseHeaders || {};

    let reqHost = '';
    try {
      reqHost = new URL(details.url).hostname;
    } catch {}

    let initiatorHost = '';
    try {
      if (details.initiator) {
        initiatorHost = new URL(details.initiator).hostname;
      }
    } catch {}

    let pageHost = initiatorHost;
    if (!pageHost && details.webContentsId) {
      try {
        const wc = details.webContents || webContents.fromId(details.webContentsId);
        if (wc && !wc.isDestroyed()) {
          const currentUrl = wc.getURL();
          if (currentUrl) {
            pageHost = new URL(currentUrl).hostname;
          }
        }
      } catch {}
    }

    const exempt = Boolean(pageHost && isSiteExempt(pageHost));
    const isCrossOrigin = initiatorHost && reqHost && getBaseDomain(initiatorHost) !== getBaseDomain(reqHost);

    // Bloqueio de Set-Cookie de Terceiros: ignora se o site foi liberado em exemptSites
    if (isCrossOrigin && !exempt && details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
      delete headers['Set-Cookie'];
      delete headers['set-cookie'];
    }

    callback({ responseHeaders: headers });
  });
}

/**
 * Configura política restrita de WebRTC para evitar vazamento de IP real
 * @param {Electron.WebContents} webContents
 */
function applyWebRTCPolicy(webContents) {
  if (webContents && typeof webContents.setWebRTCIPHandlingPolicy === 'function') {
    webContents.setWebRTCIPHandlingPolicy('default_public_interface_only');
  }
}

/**
 * Registra um pop-up ou redirecionamento forçado bloqueado na aba
 * @param {number} webContentsId
 */
function recordPopupBlocked(webContentsId) {
  if (!webContentsId) return;
  const current = tabPopupsBlocked.get(webContentsId) || 0;
  tabPopupsBlocked.set(webContentsId, current + 1);
  if (onBlockedCallback) {
    onBlockedCallback(webContentsId);
  }
}

/**
 * Zera o contador de rastreadores e pop-ups para uma aba (chamado ao navegar)
 * @param {number} webContentsId
 */
function resetTabTrackerData(webContentsId) {
  if (webContentsId) {
    tabTrackerData.delete(webContentsId);
    tabPopupsBlocked.delete(webContentsId);
  }
}

/**
 * Retorna as estatísticas de privacidade e nota de classificação para o webContents informado
 * @param {number} webContentsId
 * @param {string} currentUrl
 * @returns {{ count: number, domains: string[], popupsBlocked: number, grade: string, isHttps: boolean, isProtected: boolean, hostname: string }}
 */
function getPrivacyInfoForTab(webContentsId, currentUrl) {
  let hostname = '';
  let isHttps = true;
  try {
    if (currentUrl) {
      const parsed = new URL(currentUrl);
      hostname = parsed.hostname;
      isHttps = parsed.protocol === 'https:';
    }
  } catch {}

  const isProtected = Boolean(hostname && !isSiteExempt(hostname));
  const data = tabTrackerData.get(webContentsId) || { count: 0, domains: new Set() };
  const popupsBlocked = tabPopupsBlocked.get(webContentsId) || 0;

  const grade = calculatePrivacyGrade({
    isHttps,
    count: data.count,
    popupsBlocked
  });

  return {
    count: data.count,
    domains: Array.from(data.domains),
    popupsBlocked,
    grade,
    isHttps,
    isProtected,
    hostname
  };
}

/**
 * Alterna a proteção contra rastreadores para o site informado
 * @param {string} hostname
 * @returns {boolean} Novo estado de proteção (true = ativado, false = desativado)
 */
function toggleSiteProtection(hostname) {
  if (!hostname) return true;
  const cleanHost = hostname.toLowerCase();

  if (exemptSites.has(cleanHost)) {
    exemptSites.delete(cleanHost);
  } else {
    exemptSites.add(cleanHost);
  }

  // Persiste a lista atualizada
  storage.writeJSON('privacy-exemptions.json', Array.from(exemptSites));
  return !exemptSites.has(cleanHost);
}

/**
 * Define callback para notificar quando novos rastreadores forem bloqueados
 * @param {Function} cb
 */
function setOnBlockedCallback(cb) {
  onBlockedCallback = cb;
}

module.exports = {
  init,
  applyPrivacy,
  applyWebRTCPolicy,
  resetTabTrackerData,
  recordPopupBlocked,
  createHttpBypassToken,
  validateAndConsumeHttpBypassToken,
  allowHttpForTab,
  isHttpAllowedForTab,
  clearAllowedHttpHosts,
  createCertBypassToken,
  validateAndConsumeCertBypassToken,
  allowCertHostForTab,
  isCertAllowedForTab,
  clearAllowedCertHosts,
  isValidBlocklistHost,
  getPrivacyInfoForTab,
  toggleSiteProtection,
  setOnBlockedCallback,
  isTrackerDomain,
  cleanTrackingParameters,
  isLocalHost,
  getBaseDomain,
  isSiteExempt
};
