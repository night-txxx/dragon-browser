// =============================================================================
// src/main/pure/privacy-utils.js
// Funções puras de privacidade, domínios e limpeza de parâmetros de rastreamento
// =============================================================================

const { getDomain } = require('tldts');

// Parâmetros comuns de rastreamento a serem removidos de links
const TRACKING_PARAM_REGEX = /^(utm_[a-zA-Z0-9_]+|fbclid|gclid|msclkid|mc_eid|igshid|_ga)$/i;

/**
 * Extrai o domínio base (eTLD+1) usando a biblioteca robusta tldts
 * @param {string} hostname
 * @returns {string}
 */
function getBaseDomain(hostname) {
  if (!hostname || typeof hostname !== 'string') return '';
  const domain = getDomain(hostname, { allowPrivateDomains: true });
  return domain || hostname.toLowerCase();
}

/**
 * Verifica se um hostname corresponde a um endereço local/privado
 * @param {string} hostname
 * @returns {boolean}
 */
function isLocalHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;

  const clean = hostname.trim().toLowerCase();

  if (clean === 'localhost' || clean === '::1' || clean === '[::1]') {
    return true;
  }

  if (clean.endsWith('.local')) {
    return true;
  }

  if (!clean.includes('.') && !clean.includes(':')) {
    return true;
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = clean.match(ipv4Regex);
  if (match) {
    const b0 = parseInt(match[1], 10);
    const b1 = parseInt(match[2], 10);
    const b2 = parseInt(match[3], 10);
    const b3 = parseInt(match[4], 10);

    if (b0 <= 255 && b1 <= 255 && b2 <= 255 && b3 <= 255) {
      if (b0 === 127) return true;
      if (b0 === 10) return true;
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      if (b0 === 192 && b1 === 168) return true;
      if (b0 === 169 && b1 === 254) return true;
      if (b0 === 0 && b1 === 0 && b2 === 0 && b3 === 0) return true;
    }
  }

  return false;
}

/**
 * Verifica se um domínio coincide com a lista ou conjunto de rastreadores
 * @param {string} hostname Hostname a ser testado
 * @param {Set<string>} trackerDomains Conjunto de rastreadores conhecidos
 * @returns {boolean}
 */
function isTrackerDomain(hostname, trackerDomains) {
  if (!hostname || !trackerDomains || !(trackerDomains instanceof Set)) return false;
  const host = hostname.toLowerCase();

  // Teste exato
  if (trackerDomains.has(host)) return true;

  // Teste de subdomínio (ex: ad.service.doubleclick.net -> doubleclick.net)
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (trackerDomains.has(parentDomain)) {
      return true;
    }
  }

  return false;
}

/**
 * Limpa parâmetros de rastreamento da URL
 * @param {string} rawUrl
 * @returns {{ cleanedUrl: string, hasRemovedParams: boolean }}
 */
function cleanTrackingParameters(rawUrl) {
  try {
    const urlObj = new URL(rawUrl);
    let hasRemovedParams = false;
    const keysToRemove = [];

    urlObj.searchParams.forEach((value, key) => {
      if (TRACKING_PARAM_REGEX.test(key)) {
        keysToRemove.push(key);
      }
    });

    if (keysToRemove.length > 0) {
      keysToRemove.forEach(k => urlObj.searchParams.delete(k));
      hasRemovedParams = true;
      return { cleanedUrl: urlObj.toString(), hasRemovedParams };
    }
  } catch (e) {
    // Mantém original em caso de URL inválida
  }
  return { cleanedUrl: rawUrl, hasRemovedParams: false };
}

/**
 * Valida se uma linha da blocklist representa um hostname sintaticamente válido.
 * Aceita apenas linhas com letras, números, hífen e pontos, com ao menos um ponto,
 * sem espaços, sem barras, sem '#' e sem portas.
 * @param {string} line
 * @returns {boolean}
 */
function isValidBlocklistHost(line) {
  if (!line || typeof line !== 'string') return false;
  const clean = line.trim().toLowerCase();
  if (!clean || clean.startsWith('#')) return false;
  if (clean.includes(' ') || clean.includes('/') || clean.includes(':') || clean.includes('\\')) return false;
  if (!clean.includes('.')) return false;

  const hostRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
  return hostRegex.test(clean);
}

/**
 * Detecta se uma sequência de redirecionamentos em curto intervalo de tempo (<= windowMs)
 * excede o limite de domínios diferentes visitados sem interação do usuário.
 * Exemplo: mais de 2 transições para domínios diferentes em menos de 1.5 segundos.
 *
 * @param {Array<{ url: string, domain: string, timestamp: number }>} history
 * @param {string} targetUrl URL de destino do redirecionamento
 * @param {number} [now=Date.now()] Timestamp atual
 * @param {number} [windowMs=1500] Janela de tempo em milissegundos
 * @param {number} [threshold=2] Quantidade máxima tolerada de domínios diferentes na cadeia
 * @returns {boolean} true se a cadeia for abusiva/suspeita
 */
function isSuspiciousRedirectChain(history, targetUrl, now = Date.now(), windowMs = 1500, threshold = 2) {
  if (!Array.isArray(history) || !targetUrl) return false;
  let targetDomain = '';
  try {
    targetDomain = getBaseDomain(new URL(targetUrl).hostname);
  } catch {
    return false;
  }
  if (!targetDomain) return false;

  // Filtra itens recentes dentro da janela de tempo (ex.: 1500ms)
  const recent = history.filter(item => (now - item.timestamp) <= windowMs);
  const distinctDomains = new Set();
  for (const item of recent) {
    if (item.domain) {
      distinctDomains.add(item.domain);
    }
  }

  // Se já houver >= threshold domínios distintos e o novo for mais um domínio diferente
  if (!distinctDomains.has(targetDomain) && distinctDomains.size >= threshold) {
    return true;
  }

  return false;
}

/**
 * Calcula a nota de privacidade (A a F) para um site com base nas métricas coletadas pelo Dragon.
 *
 * Regra de avaliação (base 100 pontos):
 * 1. Protocolo HTTPS:
 *    - Conexão HTTPS: 0 penalidade (tráfego criptografado e seguro)
 *    - Conexão HTTP insegura: -45 pontos (tráfego em texto claro, vulnerável a interceptação)
 * 2. Rastreadores bloqueados:
 *    - 0 rastreadores: 0 penalidade
 *    - 1 a 3 rastreadores: -10 pontos
 *    - 4 a 9 rastreadores: -25 pontos
 *    - 10 ou mais rastreadores: -40 pontos
 * 3. Pop-ups e Redirecionamentos abusivos bloqueados:
 *    - 0 bloqueios: 0 penalidade
 *    - 1 bloqueio: -15 pontos
 *    - 2 ou mais bloqueios: -30 pontos
 * 4. Cookies de terceiros bloqueados:
 *    - Se houver registro de cookies de terceiros bloqueados: -5 pontos adicionais
 *
 * Classificação final:
 * - A: 90 a 100 pontos (HTTPS + 0 a 3 rastreadores + sem popups)
 * - B: 75 a 89 pontos (HTTPS + poucos rastreadores bloqueados)
 * - C: 60 a 74 pontos (HTTPS + quantidade moderada de rastreadores ou 1 popup abusivo)
 * - D: 40 a 59 pontos (HTTP inseguro OU densidade alta de rastreadores)
 * - F: Menos de 40 pontos (HTTP inseguro com rastreadores/pop-ups OU tráfego altamente invasivo)
 *
 * @param {object} [info]
 * @param {boolean} [info.isHttps=true]
 * @param {number} [info.count=0]
 * @param {number} [info.trackersCount=0]
 * @param {number} [info.popupsBlocked=0]
 * @param {number|boolean} [info.thirdPartyCookiesBlocked=0]
 * @returns {'A'|'B'|'C'|'D'|'F'}
 */
function calculatePrivacyGrade(info = {}) {
  const isHttps = info.isHttps !== false;
  const trackers = Number(info.trackersCount ?? info.count ?? 0) || 0;
  const popups = Number(info.popupsBlocked ?? 0) || 0;
  const thirdPartyCookies = Number(info.thirdPartyCookiesBlocked ?? 0) || (info.thirdPartyCookiesBlocked ? 1 : 0);

  let score = 100;

  // 1. Penalidade por tráfego HTTP sem TLS/HTTPS
  if (!isHttps) {
    score -= 45;
  }

  // 2. Penalidade por rastreadores identificados e bloqueados
  if (trackers >= 10) {
    score -= 40;
  } else if (trackers >= 4) {
    score -= 25;
  } else if (trackers >= 1) {
    score -= 10;
  }

  // 3. Penalidade por pop-ups e redirecionamentos abusivos sem gesto do usuário
  if (popups >= 2) {
    score -= 30;
  } else if (popups === 1) {
    score -= 15;
  }

  // 4. Penalidade por cookies de terceiros
  if (thirdPartyCookies > 0) {
    score -= 5;
  }

  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

module.exports = {
  getBaseDomain,
  isLocalHost,
  isTrackerDomain,
  cleanTrackingParameters,
  isValidBlocklistHost,
  isSuspiciousRedirectChain,
  calculatePrivacyGrade
};


