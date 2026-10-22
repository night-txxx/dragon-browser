const test = require('node:test');
const assert = require('node:assert');
const {
  isValidSetting,
  mergeWithDefaults,
  DEFAULT_SETTINGS,
  convertProxySettingsToUI,
  convertProxyUIToSettings
} = require('../src/main/pure/settings-utils');

test('isValidSetting: valida tipos, limites e enums', () => {
  assert.strictEqual(isValidSetting('searchEngine', 'duckduckgo'), true);
  assert.strictEqual(isValidSetting('searchEngine', 'invalido'), false);

  assert.strictEqual(isValidSetting('theme', 'dark'), true);
  assert.strictEqual(isValidSetting('theme', 'neon'), false);

  assert.strictEqual(isValidSetting('accentColor', '#4d7cff'), true);
  assert.strictEqual(isValidSetting('accentColor', 'red'), false);
  assert.strictEqual(isValidSetting('accentColor', '#12345'), false);

  assert.strictEqual(isValidSetting('defaultZoom', 1.0), true);
  assert.strictEqual(isValidSetting('defaultZoom', 0.1), false);
  assert.strictEqual(isValidSetting('defaultZoom', 5.0), false);

  assert.strictEqual(isValidSetting('backgroundDim', 40), true);
  assert.strictEqual(isValidSetting('backgroundDim', 95), false);

  assert.strictEqual(isValidSetting('proxyMode', 'manual'), true);
  assert.strictEqual(isValidSetting('proxyMode', 'socks'), false);

  assert.strictEqual(isValidSetting('showShortcuts', true), true);
  assert.strictEqual(isValidSetting('clearDataOnExit', true), true);
  assert.strictEqual(isValidSetting('clearDataOnExit', 'true'), false);
  assert.strictEqual(isValidSetting('fingerprintProtectionEnabled', true), true);
  assert.strictEqual(isValidSetting('fingerprintProtectionEnabled', 'yes'), false);
  assert.strictEqual(isValidSetting('fingerprintSpoofTimezone', false), true);
  assert.strictEqual(isValidSetting('fingerprintCanvasNoise', true), true);

  // Novos vetores de fingerprint
  assert.strictEqual(isValidSetting('fpOs', 'windows11'), true);
  assert.strictEqual(isValidSetting('fpOs', 'macos'), true);
  assert.strictEqual(isValidSetting('fpOs', 'android'), false);

  assert.strictEqual(isValidSetting('fpBrowser', 'chrome'), true);
  assert.strictEqual(isValidSetting('fpBrowser', 'safari'), false);

  assert.strictEqual(isValidSetting('fpScreenResolution', '1920x1080'), true);
  assert.strictEqual(isValidSetting('fpScreenResolution', '800x600'), false);

  assert.strictEqual(isValidSetting('fpHardwareConcurrency', 8), true);
  assert.strictEqual(isValidSetting('fpHardwareConcurrency', 3), false);

  assert.strictEqual(isValidSetting('fpDeviceMemory', 16), true);
  assert.strictEqual(isValidSetting('fpDeviceMemory', 10), false);

  assert.strictEqual(isValidSetting('fpCanvasMode', 'noise'), true);
  assert.strictEqual(isValidSetting('fpCanvasMode', 'mask'), true);
  assert.strictEqual(isValidSetting('fpCanvasMode', 'fake'), false);

  assert.strictEqual(isValidSetting('fpWebrtcMode', 'proxy'), true);
  assert.strictEqual(isValidSetting('fpWebrtcMode', 'disabled'), true);
  assert.strictEqual(isValidSetting('fpWebrtcMode', 'blocked'), false);

  assert.strictEqual(isValidSetting('fpFingerprintSeed', 123456789), true);
  assert.strictEqual(isValidSetting('fpFingerprintSeed', null), true);
  assert.strictEqual(isValidSetting('fpFingerprintSeed', -10), false);

  assert.strictEqual(isValidSetting('chaveInexistente', 123), false);
});

test('mergeWithDefaults: mescla chaves válidas e descarta corrompidas', () => {
  const saved = {
    theme: 'light',
    accentColor: '#00c853',
    defaultZoom: 10.0, // Inválido, deve reverter ao padrão 1.0
    chaveInvalida: 'teste' // Deve ser ignorada
  };

  const merged = mergeWithDefaults(saved);
  assert.strictEqual(merged.theme, 'light');
  assert.strictEqual(merged.accentColor, '#00c853');
  assert.strictEqual(merged.defaultZoom, DEFAULT_SETTINGS.defaultZoom);
  assert.strictEqual(merged.chaveInvalida, undefined);
  assert.strictEqual(merged.searchEngine, DEFAULT_SETTINGS.searchEngine);
});

test('convertProxySettingsToUI: converte modelo de backend para UI', () => {
  const settings = {
    proxyMode: 'manual',
    proxyRules: 'socks5://127.0.0.1:1080',
    proxyAuthUser: 'dragon_user',
    applyProxyToPrivateTabs: true,
    hasProxyPassword: true
  };

  const ui = convertProxySettingsToUI(settings);
  assert.strictEqual(ui.proxyEnabled, true);
  assert.strictEqual(ui.proxyProtocol, 'socks5');
  assert.strictEqual(ui.proxyHost, '127.0.0.1');
  assert.strictEqual(ui.proxyPort, '1080');
  assert.strictEqual(ui.proxyUsername, 'dragon_user');
  assert.strictEqual(ui.proxyApplyPrivate, true);
  assert.strictEqual(ui.hasProxyPassword, true);
});

test('convertProxyUIToSettings: converte dados do formulário para modelo persistido', () => {
  const uiData = {
    proxyEnabled: true,
    proxyProtocol: 'http',
    proxyHost: 'proxy.corp.com',
    proxyPort: '8080',
    proxyUsername: 'admin',
    proxyApplyPrivate: false
  };

  const s = convertProxyUIToSettings(uiData);
  assert.strictEqual(s.proxyMode, 'manual');
  assert.strictEqual(s.proxyRules, 'http://proxy.corp.com:8080');
  assert.strictEqual(s.proxyAuthUser, 'admin');
  assert.strictEqual(s.applyProxyToPrivateTabs, false);
});
