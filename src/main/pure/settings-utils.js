// =============================================================================
// src/main/pure/settings-utils.js
// Funções puras de validação e mescla de configurações sem dependência do Electron
// =============================================================================

const DEFAULT_SETTINGS = {
  // Seção Principal
  searchEngine: 'duckduckgo',
  customSearchUrl: '',
  startupBehavior: 'newtab',
  startupCustomUrl: 'https://duckduckgo.com',
  homePageUrl: 'https://duckduckgo.com',
  defaultZoom: 1.0,

  // Seção Personalização
  accentColor: '#4d7cff',
  theme: 'dark',
  backgroundImage: '',
  backgroundDim: 40,
  backgroundBlur: 4,
  showShortcuts: true,

  // Seção Rede e Proxy
  proxyMode: 'system', // 'system', 'direct', 'manual'
  proxyRules: '',      // ex: http://127.0.0.1:8080 ou socks5://127.0.0.1:1080
  proxyBypass: '<local>;*.local',
  proxyAuthUser: '',
  proxyAuthPasswordEncrypted: '',
  applyProxyToPrivateTabs: false,

  // Seção Encerramento e Privacidade
  clearDataOnExit: false,

  // Seção Proteção contra Fingerprinting Avançada (Configurável + Reset)
  fingerprintProtectionEnabled: false,
  fingerprintSpoofTimezone: false,
  fingerprintSpoofResolution: false,
  fingerprintCanvasNoise: false,
  fingerprintLimitFonts: false,
  fingerprintNormalizeUA: false,

  fpFingerprintSeed: null,
  fpOs: 'windows11',
  fpBrowser: 'chrome',
  fpUserAgent: 'auto',
  fpPlatform: 'auto',
  fpLocale: 'pt-BR',
  fpTimezone: 'America/Sao_Paulo',
  fpScreenResolution: '1920x1080',
  fpDevicePixelRatio: 'auto',
  fpHardwareConcurrency: 8,
  fpDeviceMemory: 8,
  fpTouchSupport: false,
  fpWebglVendor: 'auto',
  fpWebglRenderer: 'auto',
  fpWebglImageMode: 'noise',
  fpCanvasMode: 'noise',
  fpAudioMode: 'noise',
  fpClientRectsMode: 'noise',
  fpFontsMode: 'mask',
  fpWebrtcMode: 'proxy',
  fpMediaDevicesCount: 2,
  fpSpeechVoices: 'mask',
  fpBatteryMode: 'mask',
  fpPermissionsMode: 'mask'
};

const VALID_THEMES = new Set(['dark', 'light', 'system']);
const VALID_SEARCH_ENGINES = new Set(['duckduckgo', 'google', 'bing', 'brave', 'startpage', 'ecosia', 'custom']);
const VALID_STARTUP_BEHAVIORS = new Set(['newtab', 'restore', 'custom']);
const VALID_PROXY_MODES = new Set(['system', 'direct', 'manual']);
const ACCENT_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const BACKGROUND_IMAGE_REGEX = /^newtab-bg\.(png|jpe?g|webp|gif|bmp)$/i;

const VALID_FP_OS = new Set(['windows10', 'windows11', 'macos', 'linux']);
const VALID_FP_BROWSERS = new Set(['chrome', 'edge', 'firefox']);
const VALID_FP_PLATFORMS = new Set(['auto', 'Win32', 'MacIntel', 'Linux x86_64']);
const VALID_FP_LOCALES = new Set(['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE']);
const VALID_FP_RESOLUTIONS = new Set(['1920x1080', '2560x1440', '1366x768', '1536x864', '2880x1800', '3840x2160']);
const VALID_FP_CORES = new Set([2, 4, 6, 8, 12, 16]);
const VALID_FP_MEMORY = new Set([2, 4, 8, 16, 32]);
const VALID_MODES_3 = new Set(['real', 'noise', 'mask']);
const VALID_MODES_2 = new Set(['real', 'mask']);
const VALID_WEBRTC_MODES = new Set(['proxy', 'disabled', 'real']);
const VALID_MEDIA_COUNTS = new Set([0, 1, 2, 3]);

function isValidHttpUrl(str) {
  if (typeof str !== 'string' || !str.trim()) return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Valida rigorosamente se uma chave e seu respectivo valor são válidos
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
function isValidSetting(key, value) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    return false;
  }

  switch (key) {
    case 'searchEngine':
      return typeof value === 'string' && VALID_SEARCH_ENGINES.has(value);

    case 'theme':
      return typeof value === 'string' && VALID_THEMES.has(value);

    case 'startupBehavior':
      return typeof value === 'string' && VALID_STARTUP_BEHAVIORS.has(value);

    case 'accentColor':
      return typeof value === 'string' && ACCENT_COLOR_REGEX.test(value);

    case 'defaultZoom':
      return typeof value === 'number' && !Number.isNaN(value) && value >= 0.25 && value <= 3.0;

    case 'backgroundDim':
      return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 90;

    case 'backgroundBlur':
      return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 20;

    case 'startupCustomUrl':
    case 'homePageUrl':
      return isValidHttpUrl(value);

    case 'customSearchUrl':
      return typeof value === 'string' && (value === '' || (value.includes('%s') && isValidHttpUrl(value)));

    case 'backgroundImage':
      return typeof value === 'string' && (value === '' || BACKGROUND_IMAGE_REGEX.test(value));

    case 'showShortcuts':
    case 'clearDataOnExit':
      return typeof value === 'boolean';

    case 'proxyMode':
      return typeof value === 'string' && VALID_PROXY_MODES.has(value);

    case 'proxyRules':
    case 'proxyBypass':
    case 'proxyAuthUser':
    case 'proxyAuthPasswordEncrypted':
      return typeof value === 'string';

    case 'applyProxyToPrivateTabs':
    case 'fingerprintProtectionEnabled':
    case 'fingerprintSpoofTimezone':
    case 'fingerprintSpoofResolution':
    case 'fingerprintCanvasNoise':
    case 'fingerprintLimitFonts':
    case 'fingerprintNormalizeUA':
    case 'fpTouchSupport':
      return typeof value === 'boolean';

    case 'fpFingerprintSeed':
      return value === null || (typeof value === 'number' && !Number.isNaN(value) && Number.isInteger(value) && value >= 0);

    case 'fpOs':
      return typeof value === 'string' && VALID_FP_OS.has(value);

    case 'fpBrowser':
      return typeof value === 'string' && VALID_FP_BROWSERS.has(value);

    case 'fpUserAgent':
      return typeof value === 'string' && (value === 'auto' || value.length > 5);

    case 'fpPlatform':
      return typeof value === 'string' && VALID_FP_PLATFORMS.has(value);

    case 'fpLocale':
      return typeof value === 'string' && VALID_FP_LOCALES.has(value);

    case 'fpTimezone':
      return typeof value === 'string' && (value === 'auto' || value.length >= 2);

    case 'fpScreenResolution':
      return typeof value === 'string' && VALID_FP_RESOLUTIONS.has(value);

    case 'fpDevicePixelRatio':
      return value === 'auto' || ([1, 1.25, 1.5, 2, 3].includes(Number(value)));

    case 'fpHardwareConcurrency':
      return VALID_FP_CORES.has(Number(value));

    case 'fpDeviceMemory':
      return VALID_FP_MEMORY.has(Number(value));

    case 'fpWebglVendor':
    case 'fpWebglRenderer':
      return typeof value === 'string' && value.length >= 1;

    case 'fpWebglImageMode':
    case 'fpCanvasMode':
    case 'fpAudioMode':
    case 'fpClientRectsMode':
      return typeof value === 'string' && VALID_MODES_3.has(value);

    case 'fpFontsMode':
    case 'fpSpeechVoices':
    case 'fpBatteryMode':
    case 'fpPermissionsMode':
      return typeof value === 'string' && VALID_MODES_2.has(value);

    case 'fpWebrtcMode':
      return typeof value === 'string' && VALID_WEBRTC_MODES.has(value);

    case 'fpMediaDevicesCount':
      return VALID_MEDIA_COUNTS.has(Number(value));

    default:
      return false;
  }
}

/**
 * Mescla dados gravados com valores padrão descartando valores inválidos
 * @param {object} saved
 * @returns {object}
 */
function mergeWithDefaults(saved) {
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (saved[key] !== undefined && saved[key] !== null && isValidSetting(key, saved[key])) {
      result[key] = saved[key];
    }
  }
  return result;
}

function convertProxySettingsToUI(settings = {}) {
  const proxyEnabled = settings.proxyMode === 'manual';
  let proxyProtocol = 'http';
  let proxyHost = '';
  let proxyPort = '';

  const rules = typeof settings.proxyRules === 'string' ? settings.proxyRules.trim() : '';
  if (rules) {
    const match = rules.match(/^(?:([a-zA-Z0-9]+):\/\/)?([^:]+)(?::(\d+))?$/);
    if (match) {
      proxyProtocol = match[1] || 'http';
      proxyHost = match[2] || '';
      proxyPort = match[3] || '';
    }
  }

  return {
    proxyEnabled,
    proxyProtocol,
    proxyHost,
    proxyPort,
    proxyUsername: typeof settings.proxyAuthUser === 'string' ? settings.proxyAuthUser : '',
    proxyApplyPrivate: Boolean(settings.applyProxyToPrivateTabs),
    hasProxyPassword: Boolean(settings.hasProxyPassword)
  };
}

function convertProxyUIToSettings(uiData = {}) {
  const proxyMode = uiData.proxyEnabled ? 'manual' : 'system';
  const proto = (uiData.proxyProtocol || 'http').trim();
  const host = (uiData.proxyHost || '').trim();
  const port = (uiData.proxyPort !== undefined && uiData.proxyPort !== null) ? String(uiData.proxyPort).trim() : '';

  let proxyRules = '';
  if (host) {
    proxyRules = port ? `${proto}://${host}:${port}` : `${proto}://${host}`;
  }

  return {
    proxyMode,
    proxyRules,
    proxyAuthUser: (uiData.proxyUsername || '').trim(),
    applyProxyToPrivateTabs: Boolean(uiData.proxyApplyPrivate)
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  isValidSetting,
  mergeWithDefaults,
  isValidHttpUrl,
  convertProxySettingsToUI,
  convertProxyUIToSettings
};
