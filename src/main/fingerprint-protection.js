// =============================================================================
// src/main/fingerprint-protection.js
// Proteção contra Fingerprinting Avançada do Navegador Dragon
// Gera script isolado e determinístico com interceptações completas
// =============================================================================

const settings = require('./settings');
const fingerprintUtils = require('./pure/fingerprint-utils');
const {
  OS_PRESETS,
  BROWSER_PRESETS,
  GPU_PRESETS,
  SCREEN_PRESETS,
  LOCALE_TIMEZONE_MAP,
  TIMEZONE_PRESETS,
  deriveUserAgent,
  derivePlatform,
  deriveDevicePixelRatio,
  deriveWebglRenderer,
  buildFingerprintSeed,
  getFingerprintOptions,
  validateFingerprintConsistency
} = fingerprintUtils;

/**
 * Mapeamento de offset em minutos para fusos horários comuns
 */
const TIMEZONE_OFFSET_MAP = {
  'UTC': 0,
  'Europe/London': 0,
  'Europe/Paris': -60,
  'Europe/Berlin': -60,
  'Europe/Madrid': -60,
  'America/Sao_Paulo': 180,
  'America/Fortaleza': 180,
  'America/Cuiaba': 240,
  'America/Manaus': 240,
  'America/New_York': 300,
  'America/Chicago': 360,
  'America/Denver': 420,
  'America/Los_Angeles': 480,
  'Asia/Tokyo': -540
};

/**
 * Retorna o script JS a ser injetado em páginas web (WebContentsView).
 * Todas as modificações respeitam estritamente as preferências salvas pelo usuário.
 * NUNCA injetado em páginas internas do Dragon.
 *
 * @returns {string} Código JavaScript auto-executável
 */
function getInjectionScript() {
  const isEnabled = Boolean(settings.get('fingerprintProtectionEnabled'));
  if (!isEnabled) {
    return '';
  }

  const allSettings = settings.getAll ? settings.getAll() : settings.get();
  const seed = buildFingerprintSeed(allSettings);

  const os = allSettings.fpOs || 'windows11';
  const browser = allSettings.fpBrowser || 'chrome';
  const osPreset = OS_PRESETS[os] || OS_PRESETS.windows11;

  // 1. User-Agent e Plataforma
  let userAgent = allSettings.fpUserAgent;
  if (!userAgent || userAgent === 'auto') {
    userAgent = deriveUserAgent(os, browser);
  }
  let platform = allSettings.fpPlatform;
  if (!platform || platform === 'auto') {
    platform = derivePlatform(os);
  }

  // 2. Resolução e DPR
  const resolutionId = allSettings.fpScreenResolution || '1920x1080';
  const resPreset = SCREEN_PRESETS.find(p => p.id === resolutionId) || SCREEN_PRESETS[0];
  const width = resPreset.width;
  const height = resPreset.height;
  const availHeight = height > 768 ? height - 40 : height;

  let dpr = allSettings.fpDevicePixelRatio;
  if (dpr === 'auto' || !dpr) {
    dpr = deriveDevicePixelRatio(resolutionId);
  } else {
    dpr = Number(dpr) || 1;
  }

  // 3. Hardware (CPU, RAM, Touch)
  const cores = Number(allSettings.fpHardwareConcurrency) || 8;
  const memory = Number(allSettings.fpDeviceMemory) || 8;
  const touch = Boolean(allSettings.fpTouchSupport);

  // 4. GPU / WebGL
  let gpuVendor = allSettings.fpWebglVendor;
  let gpuRenderer = allSettings.fpWebglRenderer;
  if (!gpuVendor || gpuVendor === 'auto' || !gpuRenderer || gpuRenderer === 'auto') {
    const derivedGpu = deriveWebglRenderer(os, gpuVendor);
    gpuVendor = gpuVendor && gpuVendor !== 'auto' ? gpuVendor : derivedGpu.vendor;
    gpuRenderer = gpuRenderer && gpuRenderer !== 'auto' ? gpuRenderer : derivedGpu.renderer;
  }
  const webglImageMode = allSettings.fpWebglImageMode || 'noise';

  // 5. Idioma e Fuso Horário
  const locale = allSettings.fpLocale || 'pt-BR';
  const timezone = allSettings.fpTimezone || 'America/Sao_Paulo';
  const tzOffset = Object.prototype.hasOwnProperty.call(TIMEZONE_OFFSET_MAP, timezone)
    ? TIMEZONE_OFFSET_MAP[timezone]
    : 0;

  // 6. Modos por Vetor
  const canvasMode = allSettings.fpCanvasMode || 'noise';
  const audioMode = allSettings.fpAudioMode || 'noise';
  const clientRectsMode = allSettings.fpClientRectsMode || 'noise';
  const fontsMode = allSettings.fpFontsMode || 'mask';
  const batteryMode = allSettings.fpBatteryMode || 'mask';
  const speechVoicesMode = allSettings.fpSpeechVoices || 'mask';
  const permissionsMode = allSettings.fpPermissionsMode || 'mask';
  const webrtcMode = allSettings.fpWebrtcMode || 'proxy';
  const mediaCount = Number(allSettings.fpMediaDevicesCount) || 2;

  const allowedFonts = JSON.stringify(osPreset.defaultFonts || ['Arial', 'Helvetica', 'Times New Roman']);

  return `
(function() {
  'use strict';
  try {
    const SEED = ${seed};

    // Helper LCG determinístico
    function prng(offset) {
      let s = (Math.imul(SEED ^ (offset || 0), 0x45d9f3b) >>> 0);
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return (s / 4294967296);
    }

    // =========================================================================
    // GRUPO A: IDENTIDADE DO SISTEMA (UA, Plataforma, Locale, Timezone)
    // =========================================================================
    try {
      const ua = ${JSON.stringify(userAgent)};
      const plat = ${JSON.stringify(platform)};
      const loc = ${JSON.stringify(locale)};
      const tz = ${JSON.stringify(timezone)};
      const tzOff = ${tzOffset};

      Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
      Object.defineProperty(navigator, 'appVersion', { get: () => ua.replace(/^Mozilla\\//, ''), configurable: true });
      Object.defineProperty(navigator, 'platform', { get: () => plat, configurable: true });
      Object.defineProperty(navigator, 'language', { get: () => loc, configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => [loc, loc.split('-')[0], 'en-US', 'en'], configurable: true });

      // Spoof de Timezone
      const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const opts = origResolvedOptions.apply(this, arguments);
        opts.timeZone = tz;
        return opts;
      };
      Date.prototype.getTimezoneOffset = function() {
        return tzOff;
      };
    } catch (e) {}

    // =========================================================================
    // GRUPO B: HARDWARE (Resolução, DPR, Cores, RAM, Touch)
    // =========================================================================
    try {
      const scrW = ${width};
      const scrH = ${height};
      const availH = ${availHeight};
      const dprVal = ${dpr};
      const coresCount = ${cores};
      const memoryGb = ${memory};
      const touchEnabled = ${touch};

      Object.defineProperty(window.screen, 'width', { get: () => scrW, configurable: true });
      Object.defineProperty(window.screen, 'height', { get: () => scrH, configurable: true });
      Object.defineProperty(window.screen, 'availWidth', { get: () => scrW, configurable: true });
      Object.defineProperty(window.screen, 'availHeight', { get: () => availH, configurable: true });
      Object.defineProperty(window.screen, 'colorDepth', { get: () => 24, configurable: true });
      Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24, configurable: true });

      Object.defineProperty(window, 'devicePixelRatio', { get: () => dprVal, configurable: true });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => coresCount, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => memoryGb, configurable: true });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => (touchEnabled ? 5 : 0), configurable: true });
    } catch (e) {}

    // =========================================================================
    // GRUPO C: GPU E WEBGL (Vendor, Renderer, readPixels)
    // =========================================================================
    try {
      const targetVendor = ${JSON.stringify(gpuVendor)};
      const targetRenderer = ${JSON.stringify(gpuRenderer)};
      const webglMode = ${JSON.stringify(webglImageMode)};

      function patchGl(proto) {
        if (!proto || !proto.getParameter) return;
        const origGetParam = proto.getParameter;
        proto.getParameter = function(param) {
          // 0x9245 = UNMASKED_VENDOR_WEBGL, 0x9246 = UNMASKED_RENDERER_WEBGL
          if (param === 0x9245) return targetVendor;
          if (param === 0x9246) return targetRenderer;
          return origGetParam.apply(this, arguments);
        };

        if (webglMode === 'noise') {
          const origReadPixels = proto.readPixels;
          proto.readPixels = function(x, y, w, h, format, type, pixels) {
            origReadPixels.apply(this, arguments);
            if (pixels && pixels.length) {
              for (let i = 0; i < pixels.length; i += 16) {
                if (pixels[i + 3] === 0) continue;
                const hVal = (Math.imul(i ^ SEED, 0x45d9f3b) >>> 0) % 3;
                const d = (hVal === 0 ? -1 : (hVal === 1 ? 1 : 0));
                if (d !== 0) {
                  const ch = i + (hVal % 3);
                  pixels[ch] = Math.max(0, Math.min(255, pixels[ch] + d));
                }
              }
            }
          };
        }
      }

      if (typeof WebGLRenderingContext !== 'undefined') patchGl(WebGLRenderingContext.prototype);
      if (typeof WebGL2RenderingContext !== 'undefined') patchGl(WebGL2RenderingContext.prototype);
    } catch (e) {}

    // =========================================================================
    // GRUPO D: CANVAS, ÁUDIO, CLIENTRECTS, FONTES
    // =========================================================================
    // Canvas
    try {
      const cMode = ${JSON.stringify(canvasMode)};
      if (cMode === 'noise') {
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
          const imgData = origGetImageData.apply(this, arguments);
          try {
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 16) {
              if (d[i + 3] === 0) continue;
              const h = (Math.imul(i ^ SEED, 0x45d9f3b) >>> 0) % 3;
              const delta = (h === 0 ? -1 : (h === 1 ? 1 : 0));
              if (delta !== 0) {
                const idx = i + (h % 3);
                d[idx] = Math.max(0, Math.min(255, d[idx] + delta));
              }
            }
          } catch (err) {}
          return imgData;
        };

        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
          try {
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              const w = Math.min(this.width, 32);
              const h = Math.min(this.height, 32);
              const imgData = ctx.getImageData(0, 0, w, h);
              ctx.putImageData(imgData, 0, 0);
            }
          } catch (err) {}
          return origToDataURL.apply(this, arguments);
        };
      }
    } catch (e) {}

    // Áudio
    try {
      const aMode = ${JSON.stringify(audioMode)};
      if (aMode === 'noise') {
        if (typeof AudioBuffer !== 'undefined' && AudioBuffer.prototype.getChannelData) {
          const origGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = function() {
            const channel = origGetChannelData.apply(this, arguments);
            try {
              for (let i = 0; i < channel.length; i += 32) {
                const h = (Math.imul(i ^ SEED, 0x27d4eb2d) >>> 0) % 5;
                channel[i] = channel[i] + (h - 2) * 0.00002;
              }
            } catch (err) {}
            return channel;
          };
        }
      }
    } catch (e) {}

    // ClientRects
    try {
      const crMode = ${JSON.stringify(clientRectsMode)};
      if (crMode === 'noise') {
        const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
          const r = origGetBoundingClientRect.apply(this, arguments);
          const delta = ((SEED % 3) - 1) * 0.05;
          return new DOMRect(r.x + delta, r.y + delta, r.width + delta, r.height + delta);
        };
      } else if (crMode === 'mask') {
        const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
          const r = origGetBoundingClientRect.apply(this, arguments);
          return new DOMRect(Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height));
        };
      }
    } catch (e) {}

    // Fontes
    try {
      const fMode = ${JSON.stringify(fontsMode)};
      if (fMode === 'mask' && document.fonts && typeof document.fonts.check === 'function') {
        const allowed = new Set(${allowedFonts}.map(f => f.toLowerCase()));
        allowed.add('sans-serif');
        allowed.add('serif');
        allowed.add('monospace');
        const origCheck = document.fonts.check.bind(document.fonts);
        document.fonts.check = function(font, text) {
          if (typeof font === 'string') {
            const clean = font.replace(/[0-9pxptemrem%]/g, '').replace(/['"]/g, '').trim().toLowerCase();
            if (clean && !allowed.has(clean)) {
              return false;
            }
          }
          return origCheck(font, text);
        };
      }
    } catch (e) {}

    // =========================================================================
    // GRUPO E: BATERIA, DISPOSITIVOS, VOZES E PERMISSÕES
    // =========================================================================
    try {
      const bMode = ${JSON.stringify(batteryMode)};
      if (bMode === 'mask' && navigator.getBattery) {
        navigator.getBattery = function() {
          return Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1.0,
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return false; }
          });
        };
      }

      const pMode = ${JSON.stringify(permissionsMode)};
      if (pMode === 'mask' && navigator.permissions && navigator.permissions.query) {
        const origQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = function(desc) {
          return Promise.resolve({
            state: 'prompt',
            name: desc ? desc.name : 'unknown',
            onchange: null,
            addEventListener: function() {},
            removeEventListener: function() {}
          });
        };
      }

      const mCount = ${mediaCount};
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices = function() {
          const devs = [];
          if (mCount >= 1) devs.push({ deviceId: 'default', kind: 'audioinput', label: '', groupId: 'grp1' });
          if (mCount >= 2) devs.push({ deviceId: 'default', kind: 'videoinput', label: '', groupId: 'grp2' });
          if (mCount >= 3) devs.push({ deviceId: 'default', kind: 'audiooutput', label: '', groupId: 'grp1' });
          return Promise.resolve(devs);
        };
      }

      const wMode = ${JSON.stringify(webrtcMode)};
      if (wMode === 'disabled') {
        try {
          if (typeof window.RTCPeerConnection !== 'undefined') window.RTCPeerConnection = undefined;
          if (typeof window.webkitRTCPeerConnection !== 'undefined') window.webkitRTCPeerConnection = undefined;
          if (typeof window.RTCSessionDescription !== 'undefined') window.RTCSessionDescription = undefined;
          if (typeof window.RTCIceCandidate !== 'undefined') window.RTCIceCandidate = undefined;
        } catch (e) {}
      }

      const svMode = ${JSON.stringify(speechVoicesMode)};
      if (svMode === 'mask' && typeof window.speechSynthesis !== 'undefined') {
        const targetOs = ${JSON.stringify(os)};
        const simulatedVoices = (targetOs === 'macos')
          ? [
              { name: 'Alex', lang: 'en-US', default: true, localService: true, voiceURI: 'Alex' },
              { name: 'Samantha', lang: 'en-US', default: false, localService: true, voiceURI: 'Samantha' },
              { name: 'Luciana', lang: 'pt-BR', default: false, localService: true, voiceURI: 'Luciana' }
            ]
          : [
              { name: 'Microsoft Maria - Portuguese (Brazil)', lang: 'pt-BR', default: true, localService: true, voiceURI: 'Microsoft Maria' },
              { name: 'Microsoft David - English (United States)', lang: 'en-US', default: false, localService: true, voiceURI: 'Microsoft David' },
              { name: 'Microsoft Zira - English (United States)', lang: 'en-US', default: false, localService: true, voiceURI: 'Microsoft Zira' }
            ];
        speechSynthesis.getVoices = function() {
          return simulatedVoices;
        };
      }
    } catch (e) {}

  } catch (err) {}
})();
  `;
}

function isFingerprintProtectionEnabled() {
  return Boolean(settings.get('fingerprintProtectionEnabled'));
}

function shouldNormalizeUA() {
  return isFingerprintProtectionEnabled();
}

module.exports = {
  getInjectionScript,
  isFingerprintProtectionEnabled,
  shouldNormalizeUA,
  getFingerprintOptions,
  validateFingerprintConsistency
};
