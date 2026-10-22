// =============================================================================
// src/main/pure/fingerprint-utils.js
// Funções puras para sistema de fingerprint avançado, presets e validação de consistência
// =============================================================================

const OS_PRESETS = {
  windows11: {
    id: 'windows11',
    name: 'Windows 11',
    platform: 'Win32',
    uaOs: 'Windows NT 10.0; Win64; x64',
    oscpu: 'Windows NT 10.0; Win64; x64',
    defaultFonts: ['Arial', 'Calibri', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana', 'Consolas', 'Courier New', 'Georgia']
  },
  windows10: {
    id: 'windows10',
    name: 'Windows 10',
    platform: 'Win32',
    uaOs: 'Windows NT 10.0; Win64; x64',
    oscpu: 'Windows NT 10.0; Win64; x64',
    defaultFonts: ['Arial', 'Calibri', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana', 'Consolas', 'Courier New', 'Georgia']
  },
  macos: {
    id: 'macos',
    name: 'macOS (Sonoma / Sequoia)',
    platform: 'MacIntel',
    uaOs: 'Macintosh; Intel Mac OS X 10_15_7',
    oscpu: 'Intel Mac OS X 10_15_7',
    defaultFonts: ['San Francisco', 'Helvetica Neue', 'Helvetica', 'Arial', 'Times', 'Courier', 'Geneva', 'Monaco', 'Menlo']
  },
  linux: {
    id: 'linux',
    name: 'Linux (Ubuntu / Fedora)',
    platform: 'Linux x86_64',
    uaOs: 'X11; Linux x86_64',
    oscpu: 'Linux x86_64',
    defaultFonts: ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'FreeSans', 'Arial', 'Times New Roman', 'Courier 10 Pitch', 'DejaVu Sans Mono']
  }
};

const BROWSER_PRESETS = {
  chrome: {
    id: 'chrome',
    name: 'Google Chrome',
    version: '130.0.0.0',
    vendor: 'Google Inc.'
  },
  edge: {
    id: 'edge',
    name: 'Microsoft Edge',
    version: '130.0.0.0',
    vendor: 'Google Inc.'
  },
  firefox: {
    id: 'firefox',
    name: 'Mozilla Firefox',
    version: '132.0',
    vendor: ''
  }
};

const GPU_PRESETS = {
  windows: [
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
  ],
  macos: [
    {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)'
    },
    {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)'
    },
    {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)'
    },
    {
      vendor: 'Google Inc. (Intel Inc.)',
      renderer: 'ANGLE (Intel Inc., Intel Iris Plus Graphics OpenGL 4.1)'
    }
  ],
  linux: [
    {
      vendor: 'Google Inc. (Intel)',
      renderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)'
    },
    {
      vendor: 'Google Inc. (Mesa)',
      renderer: 'Mesa AMD Radeon RX 580 (POLARIS10)'
    },
    {
      vendor: 'Google Inc. (NVIDIA Corporation)',
      renderer: 'NVIDIA GeForce GTX 1060 6GB/PCIe/SSE2'
    }
  ]
};

const SCREEN_PRESETS = [
  { id: '1920x1080', name: '1920 × 1080 (Full HD, Mais Comum)', width: 1920, height: 1080, dpr: 1 },
  { id: '2560x1440', name: '2560 × 1440 (2K / QHD)', width: 2560, height: 1440, dpr: 1.25 },
  { id: '1366x768',  name: '1366 × 768 (Notebook Padrão)', width: 1366, height: 768, dpr: 1 },
  { id: '1536x864',  name: '1536 × 864 (Notebook Alta Densidade)', width: 1536, height: 864, dpr: 1.25 },
  { id: '2880x1800', name: '2880 × 1800 (MacBook Pro Retina)', width: 2880, height: 1800, dpr: 2 },
  { id: '3840x2160', name: '3840 × 2160 (4K UHD)', width: 3840, height: 2160, dpr: 1.5 }
];

const LOCALE_TIMEZONE_MAP = {
  'pt-BR': ['America/Sao_Paulo', 'America/Fortaleza', 'America/Cuiaba', 'America/Manaus'],
  'en-US': ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
  'es-ES': ['Europe/Madrid', 'Atlantic/Canary'],
  'fr-FR': ['Europe/Paris'],
  'de-DE': ['Europe/Berlin']
};

const TIMEZONE_PRESETS = [
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Tokyo',
  'UTC'
];

/**
 * Deriva uma string realista de User-Agent a partir do sistema operacional e navegador.
 * @param {string} os
 * @param {string} browser
 * @param {string} [version]
 * @returns {string}
 */
function deriveUserAgent(os, browser, version) {
  const osData = OS_PRESETS[os] || OS_PRESETS.windows11;
  const bData = BROWSER_PRESETS[browser] || BROWSER_PRESETS.chrome;
  const ver = version || bData.version;

  if (bData.id === 'firefox') {
    return `Mozilla/5.0 (${osData.uaOs}; rv:${ver}) Gecko/20100101 Firefox/${ver}`;
  }

  if (bData.id === 'edge') {
    return `Mozilla/5.0 (${osData.uaOs}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36 Edg/${ver}`;
  }

  return `Mozilla/5.0 (${osData.uaOs}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
}

/**
 * Deriva navigator.platform a partir do sistema operacional
 * @param {string} os
 * @returns {string}
 */
function derivePlatform(os) {
  const osData = OS_PRESETS[os];
  return osData ? osData.platform : 'Win32';
}

/**
 * Deriva DevicePixelRatio padrão baseado na resolução
 * @param {string} resolution
 * @returns {number}
 */
function deriveDevicePixelRatio(resolution) {
  const preset = SCREEN_PRESETS.find(p => p.id === resolution);
  return preset ? preset.dpr : 1;
}

/**
 * Deriva GPU compatível para o SO e vendor
 * @param {string} os
 * @param {string} [vendor]
 * @returns {{ vendor: string, renderer: string }}
 */
function deriveWebglRenderer(os, vendor) {
  const osKey = (os === 'macos') ? 'macos' : (os === 'linux' ? 'linux' : 'windows');
  const list = GPU_PRESETS[osKey] || GPU_PRESETS.windows;

  if (vendor && vendor !== 'auto') {
    const matched = list.find(g => g.vendor.toLowerCase().includes(vendor.toLowerCase()));
    if (matched) return matched;
  }

  return list[0];
}

/**
 * Valida consistência interna das configurações de fingerprint.
 * Detecta combinações impossíveis (ex.: macOS com NVIDIA) e combinações improváveis.
 *
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateFingerprintConsistency(config) {
  const errors = [];
  const warnings = [];
  if (!config || typeof config !== 'object') {
    return { valid: true, errors, warnings };
  }

  const os = config.fpOs || 'windows11';
  const browser = config.fpBrowser || 'chrome';
  const platform = config.fpPlatform;
  const ua = config.fpUserAgent;
  const resolution = config.fpScreenResolution || '1920x1080';
  const dpr = config.fpDevicePixelRatio;
  const cores = Number(config.fpHardwareConcurrency) || 8;
  const memory = Number(config.fpDeviceMemory) || 8;
  const vendor = config.fpWebglVendor || 'auto';
  const renderer = config.fpWebglRenderer || 'auto';
  const locale = config.fpLocale;
  const timezone = config.fpTimezone;

  // 1. Regra Inegociável: macOS NUNCA usa NVIDIA
  if (os === 'macos') {
    if (vendor !== 'auto' && /nvidia/i.test(vendor)) {
      errors.push('macOS não oferece suporte nem utiliza GPUs NVIDIA modernas.');
    }
    if (renderer !== 'auto' && /nvidia/i.test(renderer)) {
      errors.push('macOS não utiliza renderizadores de vídeo NVIDIA.');
    }
  }

  // 2. Regra de Plataforma
  if (platform && platform !== 'auto') {
    if (os === 'macos' && platform !== 'MacIntel') {
      warnings.push(`Sistema selecionado é macOS, mas a plataforma configurada é ${platform} (esperado: MacIntel).`);
    } else if ((os === 'windows10' || os === 'windows11') && platform !== 'Win32') {
      warnings.push(`Sistema selecionado é Windows, mas a plataforma configurada é ${platform} (esperado: Win32).`);
    } else if (os === 'linux' && platform !== 'Linux x86_64') {
      warnings.push(`Sistema selecionado é Linux, mas a plataforma configurada é ${platform} (esperado: Linux x86_64).`);
    }
  }

  // 3. Regra de User-Agent
  if (ua && ua !== 'auto') {
    if (browser === 'firefox' && !/firefox\//i.test(ua)) {
      warnings.push('Navegador selecionado é Firefox, mas o User-Agent não contém a assinatura Firefox/.');
    }
    if (os === 'macos' && !/macintosh/i.test(ua)) {
      warnings.push('Sistema selecionado é macOS, mas o User-Agent não menciona Macintosh.');
    }
    if ((os === 'windows10' || os === 'windows11') && !/windows nt/i.test(ua)) {
      warnings.push('Sistema selecionado é Windows, mas o User-Agent não menciona Windows NT.');
    }
  }

  // 4. Regra de Resolução e DPR
  if (resolution === '2880x1800' && os !== 'macos') {
    warnings.push('Resolução 2880×1800 é nativa de monitores Retina de MacBook Pro (incomum em Windows/Linux).');
  }
  if (resolution === '1366x768' && Number(dpr) > 1.25) {
    warnings.push('Resolução 1366×768 com DevicePixelRatio alto (> 1.25) é incomum em hardware real.');
  }

  // 5. Hardware Concurrency e RAM
  if (memory >= 32 && cores <= 2) {
    warnings.push('Computadores com 32GB de RAM geralmente possuem 4 ou mais núcleos de CPU.');
  }

  // 6. Timezone e Locale
  if (locale && timezone && timezone !== 'auto' && timezone !== 'UTC') {
    const expectedTzList = LOCALE_TIMEZONE_MAP[locale];
    if (expectedTzList && !expectedTzList.includes(timezone)) {
      warnings.push(`O idioma ${locale} tipicamente utiliza fusos horários como ${expectedTzList[0]}, mas o fuso ativo é ${timezone}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gera um inteiro determinístico de 32 bits a partir do seed persistente e configurações.
 * @param {object} config
 * @returns {number}
 */
function buildFingerprintSeed(config) {
  if (!config || typeof config !== 'object') {
    return 123456789;
  }

  let baseSeed = Number(config.fpFingerprintSeed);
  if (!baseSeed || Number.isNaN(baseSeed)) {
    baseSeed = 123456789;
  }

  // Gera hash simples e rápido tipo FNV-1a com as chaves de identidade
  const str = `${config.fpOs || ''}|${config.fpBrowser || ''}|${config.fpScreenResolution || ''}|${config.fpTimezone || ''}|${config.fpHardwareConcurrency || ''}|${config.fpDeviceMemory || ''}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return (baseSeed ^ hash) >>> 0;
}

/**
 * Aplica ruído sutil e determinístico em dados brutos de pixels RGBA.
 * Mantida para retrocompatibilidade com a suíte de testes existente.
 *
 * @param {Uint8ClampedArray|number[]} data
 * @param {number} seed
 * @returns {Uint8ClampedArray|number[]}
 */
function applyDeterministicCanvasNoise(data, seed) {
  if (!data || typeof data.length !== 'number' || data.length === 0) return data;
  const numSeed = Number(seed) || 12345;

  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] === 0) continue;
    const hash = (Math.imul(i ^ numSeed, 0x45d9f3b) >>> 0) % 3;
    const delta = (hash === 0) ? -1 : (hash === 1 ? 1 : 0);
    if (delta !== 0) {
      const channelIndex = i + (hash % 3);
      const val = data[channelIndex];
      data[channelIndex] = Math.max(0, Math.min(255, val + delta));
    }
  }

  return data;
}

/**
 * Alias semântico para applyDeterministicCanvasNoise
 */
function applyCanvasNoise(data, seed) {
  return applyDeterministicCanvasNoise(data, seed);
}

/**
 * Aplica ruído imperceptível e determinístico em amostras de buffer de áudio (Float32Array).
 * Variação na faixa de +/- 0.00002 mantendo o sinal audível limpo.
 *
 * @param {Float32Array|number[]} buffer
 * @param {number} seed
 * @returns {Float32Array|number[]}
 */
function applyAudioNoise(buffer, seed) {
  if (!buffer || typeof buffer.length !== 'number' || buffer.length === 0) return buffer;
  const numSeed = Number(seed) || 54321;

  for (let i = 0; i < buffer.length; i += 32) {
    const hash = (Math.imul(i ^ numSeed, 0x27d4eb2d) >>> 0) % 5;
    // Variação minúscula entre -0.00004 e +0.00004
    const delta = (hash - 2) * 0.00002;
    buffer[i] = buffer[i] + delta;
  }

  return buffer;
}

/**
 * Aplica ruído determinístico em DOMRect (x, y, width, height) para ClientRects
 * @param {object} rect
 * @param {number} seed
 * @returns {object}
 */
function applyClientRectsNoise(rect, seed) {
  if (!rect || typeof rect !== 'object') return rect;
  const numSeed = Number(seed) || 98765;

  const hashX = (Math.imul(numSeed, 0x1f1f1f) >>> 0) % 3;
  const deltaX = (hashX === 0 ? -0.1 : (hashX === 1 ? 0.1 : 0));

  const hashY = (Math.imul(numSeed ^ 0xabc, 0x3b3b3b) >>> 0) % 3;
  const deltaY = (hashY === 0 ? -0.1 : (hashY === 1 ? 0.1 : 0));

  return {
    x: Number((rect.x + deltaX).toFixed(2)),
    y: Number((rect.y + deltaY).toFixed(2)),
    width: Number((rect.width + deltaX).toFixed(2)),
    height: Number((rect.height + deltaY).toFixed(2)),
    top: Number(((rect.top || rect.y) + deltaY).toFixed(2)),
    bottom: Number(((rect.bottom || (rect.y + rect.height)) + deltaY).toFixed(2)),
    left: Number(((rect.left || rect.x) + deltaX).toFixed(2)),
    right: Number(((rect.right || (rect.x + rect.width)) + deltaX).toFixed(2))
  };
}

/**
 * Normaliza o User-Agent removendo versões exatas do Electron e Chromium
 * Mantida para retrocompatibilidade com a suíte de testes existente.
 * @param {string} ua User-Agent original
 * @returns {string}
 */
function normalizeUserAgentString(ua) {
  if (typeof ua !== 'string') return '';
  return ua
    .replace(/Electron\/[0-9.]+\s?/gi, '')
    .replace(/Dragon\/[0-9.]+\s?/gi, '')
    .replace(/Chrome\/[0-9.]+/i, 'Chrome/130.0.0.0')
    .replace(/Chromium\/[0-9.]+/i, 'Chrome/130.0.0.0')
    .trim();
}

/**
 * Gerador pseudoaleatório linear congruencial (LCG) com semente para sorteios determinísticos
 * @param {number} seed
 * @returns {function(): number} Retorna float no intervalo [0, 1)
 */
function createPrng(seed) {
  let s = (Number(seed) || 123456789) >>> 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Sorteia uma nova identidade de fingerprint aleatória e 100% consistente a partir de uma semente.
 *
 * @param {number} seed
 * @returns {{ config: object, seed: number }}
 */
function pickRandomConsistentPresetWithSeed(seed) {
  const prng = createPrng(seed);

  // 1. Sorteio de SO ponderado: 70% Windows (50% Win11, 20% Win10), 20% macOS, 10% Linux
  const osRoll = prng();
  let os = 'windows11';
  if (osRoll < 0.50) os = 'windows11';
  else if (osRoll < 0.70) os = 'windows10';
  else if (osRoll < 0.90) os = 'macos';
  else os = 'linux';

  // 2. Sorteio de Navegador: 75% Chrome, 20% Edge (se Windows) ou Chrome, 5% Firefox
  const browserRoll = prng();
  let browser = 'chrome';
  if (browserRoll < 0.75) {
    browser = 'chrome';
  } else if (browserRoll < 0.95 && (os === 'windows11' || os === 'windows10')) {
    browser = 'edge';
  } else {
    browser = 'firefox';
  }

  // 3. Resolução e DPR consistentes com o SO
  let allowedResolutions = SCREEN_PRESETS.filter(p => p.id !== '2880x1800');
  if (os === 'macos') {
    allowedResolutions = SCREEN_PRESETS.filter(p => p.id === '2880x1800' || p.id === '2560x1440' || p.id === '1920x1080');
  }
  const resIdx = Math.floor(prng() * allowedResolutions.length);
  const chosenRes = allowedResolutions[resIdx];
  const resolution = chosenRes.id;
  const dpr = chosenRes.dpr;

  // 4. Hardware: núcleos e memória coerentes
  const coreOptions = [4, 6, 8, 12, 16];
  const cores = coreOptions[Math.floor(prng() * coreOptions.length)];
  const memoryOptions = cores <= 4 ? [4, 8, 16] : [8, 16, 32];
  const memory = memoryOptions[Math.floor(prng() * memoryOptions.length)];

  // 5. GPU compatível com o SO (nunca NVIDIA em macOS)
  const gpuList = GPU_PRESETS[os === 'macos' ? 'macos' : (os === 'linux' ? 'linux' : 'windows')];
  const chosenGpu = gpuList[Math.floor(prng() * gpuList.length)];

  // 6. Locale e Timezone coerentes
  const localeKeys = Object.keys(LOCALE_TIMEZONE_MAP);
  const chosenLocale = localeKeys[Math.floor(prng() * localeKeys.length)];
  const tzList = LOCALE_TIMEZONE_MAP[chosenLocale];
  const chosenTz = tzList[Math.floor(prng() * tzList.length)];

  const config = {
    fingerprintProtectionEnabled: true,
    fpFingerprintSeed: seed,
    fpOs: os,
    fpBrowser: browser,
    fpUserAgent: 'auto',
    fpPlatform: 'auto',
    fpLocale: chosenLocale,
    fpTimezone: chosenTz,
    fpScreenResolution: resolution,
    fpDevicePixelRatio: dpr,
    fpHardwareConcurrency: cores,
    fpDeviceMemory: memory,
    fpTouchSupport: false,
    fpWebglVendor: chosenGpu.vendor,
    fpWebglRenderer: chosenGpu.renderer,
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

  return { config, seed };
}

/**
 * Sorteia uma nova identidade consistente gerando uma semente inteira de 32 bits.
 * Se a validação falhar, tenta até 10 vezes; persistindo a falha, aplica um preset seguro.
 * @returns {{ config: object, seed: number }}
 */
function pickRandomConsistentPreset() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const seed = (Math.floor(Math.random() * 0x7FFFFFFF) + 1);
    const candidate = pickRandomConsistentPresetWithSeed(seed);
    const check = validateFingerprintConsistency(candidate.config);
    if (check.valid && check.errors.length === 0) {
      return candidate;
    }
  }

  // Fallback seguro comprovadamente consistente
  const fallbackSeed = 123456789;
  return {
    seed: fallbackSeed,
    config: {
      fingerprintProtectionEnabled: true,
      fpFingerprintSeed: fallbackSeed,
      fpOs: 'windows11',
      fpBrowser: 'chrome',
      fpUserAgent: 'auto',
      fpPlatform: 'auto',
      fpLocale: 'pt-BR',
      fpTimezone: 'America/Sao_Paulo',
      fpScreenResolution: '1920x1080',
      fpDevicePixelRatio: 1,
      fpHardwareConcurrency: 8,
      fpDeviceMemory: 8,
      fpTouchSupport: false,
      fpWebglVendor: 'Google Inc. (Intel)',
      fpWebglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
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
    }
  };
}

/**
 * Retorna as listas de opções disponíveis para popular selects na interface
 */
function getFingerprintOptions() {
  return {
    osList: Object.values(OS_PRESETS),
    browserList: Object.values(BROWSER_PRESETS),
    screenList: SCREEN_PRESETS,
    timezoneList: TIMEZONE_PRESETS,
    localeList: Object.keys(LOCALE_TIMEZONE_MAP),
    gpuPresets: GPU_PRESETS
  };
}

module.exports = {
  OS_PRESETS,
  BROWSER_PRESETS,
  GPU_PRESETS,
  SCREEN_PRESETS,
  TIMEZONE_PRESETS,
  LOCALE_TIMEZONE_MAP,
  deriveUserAgent,
  derivePlatform,
  deriveDevicePixelRatio,
  deriveWebglRenderer,
  validateFingerprintConsistency,
  buildFingerprintSeed,
  applyDeterministicCanvasNoise,
  applyCanvasNoise,
  applyAudioNoise,
  applyClientRectsNoise,
  normalizeUserAgentString,
  pickRandomConsistentPreset,
  pickRandomConsistentPresetWithSeed,
  getFingerprintOptions
};
