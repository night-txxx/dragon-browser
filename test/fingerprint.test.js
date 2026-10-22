const test = require('node:test');
const assert = require('node:assert');
const {
  applyDeterministicCanvasNoise,
  applyCanvasNoise,
  applyAudioNoise,
  applyClientRectsNoise,
  normalizeUserAgentString,
  deriveUserAgent,
  derivePlatform,
  deriveDevicePixelRatio,
  deriveWebglRenderer,
  validateFingerprintConsistency,
  buildFingerprintSeed,
  pickRandomConsistentPreset,
  pickRandomConsistentPresetWithSeed,
  getFingerprintOptions
} = require('../src/main/pure/fingerprint-utils');

test('applyDeterministicCanvasNoise: mesma semente produz rigorosamente o mesmo resultado', () => {
  const seed = 987654321;
  const original = new Uint8ClampedArray([
    120, 150, 200, 255,  // pixel 0
    120, 150, 200, 255,  // pixel 1
    120, 150, 200, 255,  // pixel 2
    120, 150, 200, 255,  // pixel 3
    120, 150, 200, 255,  // pixel 4
    120, 150, 200, 255,  // pixel 5
    120, 150, 200, 255,  // pixel 6
    120, 150, 200, 255   // pixel 7
  ]);

  const run1 = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), seed);
  const run2 = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), seed);

  assert.deepStrictEqual(Array.from(run1), Array.from(run2));
});

test('applyDeterministicCanvasNoise: sementes diferentes produzem distorções distintas', () => {
  const original = new Uint8ClampedArray([
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255
  ]);

  const runSeedA = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), 11111);
  const runSeedB = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), 99999);

  assert.notDeepStrictEqual(Array.from(runSeedA), Array.from(runSeedB));
});

test('applyDeterministicCanvasNoise: distorção é sutil (máximo +-1) e preserva transparência', () => {
  const seed = 55555;
  const original = new Uint8ClampedArray([
    100, 100, 100, 255,  // opaco
    0,   0,   0,   0,    // transparente
    50,  50,  50,  255,
    0,   0,   0,   0,
    200, 200, 200, 255
  ]);

  const noisy = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), seed);

  // Pixels transparentes devem ser preservados
  assert.strictEqual(noisy[7], 0);

  // Delta de distorção não pode ultrapassar 1
  for (let i = 0; i < original.length; i++) {
    const diff = Math.abs(noisy[i] - original[i]);
    assert.ok(diff <= 1, `Diferença no índice ${i} excedeu 1: ${diff}`);
  }
});

test('applyAudioNoise: ruído de áudio é determinístico e imperceptível', () => {
  const seed = 444333;
  const original = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);

  const run1 = applyAudioNoise(new Float32Array(original), seed);
  const run2 = applyAudioNoise(new Float32Array(original), seed);

  assert.deepStrictEqual(Array.from(run1), Array.from(run2));

  // Variação é minúscula
  for (let i = 0; i < original.length; i++) {
    const diff = Math.abs(run1[i] - original[i]);
    assert.ok(diff <= 0.0001, `Variação de áudio excedeu tolerância: ${diff}`);
  }
});

test('applyClientRectsNoise: ruído de geometria é determinístico e restrito', () => {
  const seed = 777666;
  const rect = { x: 100, y: 150, width: 200, height: 80, top: 150, bottom: 230, left: 100, right: 300 };

  const noisy1 = applyClientRectsNoise(rect, seed);
  const noisy2 = applyClientRectsNoise(rect, seed);

  assert.deepStrictEqual(noisy1, noisy2);
  assert.ok(Math.abs(noisy1.width - rect.width) <= 0.2);
});

test('normalizeUserAgentString: remove Electron e normaliza versão estável do Chrome', () => {
  const rawUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Dragon/1.0.0 Chrome/130.0.6723.117 Electron/33.2.0 Safari/537.36';
  const normalized = normalizeUserAgentString(rawUA);

  assert.strictEqual(normalized.includes('Electron'), false);
  assert.strictEqual(normalized.includes('Dragon'), false);
  assert.strictEqual(normalized.includes('Chrome/130.0.0.0'), true);
});

test('deriveUserAgent: deriva strings coerentes para SO e Navegador', () => {
  const winChrome = deriveUserAgent('windows11', 'chrome');
  assert.ok(winChrome.includes('Windows NT 10.0'));
  assert.ok(winChrome.includes('Chrome/130'));

  const macFirefox = deriveUserAgent('macos', 'firefox');
  assert.ok(macFirefox.includes('Macintosh; Intel Mac OS X 10_15_7'));
  assert.ok(macFirefox.includes('Firefox/132'));

  const winEdge = deriveUserAgent('windows10', 'edge');
  assert.ok(winEdge.includes('Edg/130'));
});

test('derivePlatform e deriveDevicePixelRatio: valores corretos', () => {
  assert.strictEqual(derivePlatform('windows11'), 'Win32');
  assert.strictEqual(derivePlatform('macos'), 'MacIntel');
  assert.strictEqual(derivePlatform('linux'), 'Linux x86_64');

  assert.strictEqual(deriveDevicePixelRatio('1920x1080'), 1);
  assert.strictEqual(deriveDevicePixelRatio('2880x1800'), 2);
  assert.strictEqual(deriveDevicePixelRatio('3840x2160'), 1.5);
});

test('deriveWebglRenderer: nunca retorna NVIDIA em macOS', () => {
  const macGpu = deriveWebglRenderer('macos');
  assert.ok(!macGpu.vendor.toLowerCase().includes('nvidia'));
  assert.ok(!macGpu.renderer.toLowerCase().includes('nvidia'));
});

test('validateFingerprintConsistency: bloqueia macOS com NVIDIA com erro estrito', () => {
  const invalidConfig = {
    fpOs: 'macos',
    fpBrowser: 'chrome',
    fpWebglVendor: 'NVIDIA Corporation',
    fpWebglRenderer: 'NVIDIA GeForce RTX 3060'
  };

  const result = validateFingerprintConsistency(invalidConfig);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length >= 1);
  assert.ok(result.errors.some(e => e.includes('macOS')));
});

test('validateFingerprintConsistency: detecta avisos para combinações improváveis', () => {
  const weirdConfig = {
    fpOs: 'windows11',
    fpBrowser: 'firefox',
    fpUserAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0.0.0', // Sem Firefox/
    fpScreenResolution: '2880x1800', // Tela Apple em Windows
    fpHardwareConcurrency: 2,
    fpDeviceMemory: 32, // 32GB RAM com 2 núcleos
    fpLocale: 'pt-BR',
    fpTimezone: 'Asia/Tokyo' // Idioma pt-BR com Tóquio
  };

  const result = validateFingerprintConsistency(weirdConfig);
  assert.strictEqual(result.valid, true); // Válido estruturalmente, mas com avisos
  assert.ok(result.warnings.length >= 4);
});

test('buildFingerprintSeed: gera semente de 32 bits determinística', () => {
  const cfg1 = { fpFingerprintSeed: 12345, fpOs: 'windows11', fpScreenResolution: '1920x1080' };
  const cfg2 = { fpFingerprintSeed: 12345, fpOs: 'windows11', fpScreenResolution: '1920x1080' };
  const cfg3 = { fpFingerprintSeed: 99999, fpOs: 'windows11', fpScreenResolution: '1920x1080' };

  const seed1 = buildFingerprintSeed(cfg1);
  const seed2 = buildFingerprintSeed(cfg2);
  const seed3 = buildFingerprintSeed(cfg3);

  assert.strictEqual(seed1, seed2);
  assert.notStrictEqual(seed1, seed3);
  assert.ok(seed1 > 0);
});

test('pickRandomConsistentPresetWithSeed: determinismo absoluto e consistência 100%', () => {
  const seed = 42891234;
  const p1 = pickRandomConsistentPresetWithSeed(seed);
  const p2 = pickRandomConsistentPresetWithSeed(seed);

  assert.deepStrictEqual(p1, p2);

  const check = validateFingerprintConsistency(p1.config);
  assert.strictEqual(check.valid, true);
  assert.strictEqual(check.errors.length, 0);

  if (p1.config.fpOs === 'macos') {
    assert.ok(!p1.config.fpWebglVendor.toLowerCase().includes('nvidia'));
    assert.ok(!p1.config.fpWebglRenderer.toLowerCase().includes('nvidia'));
  }
});

test('pickRandomConsistentPreset: sorteia preset 100% consistente sem erros', () => {
  for (let i = 0; i < 20; i++) {
    const { config, seed } = pickRandomConsistentPreset();
    assert.ok(seed > 0);
    const check = validateFingerprintConsistency(config);
    assert.strictEqual(check.valid, true, `Preset sorteado na iteração ${i} falhou na validação`);
    assert.strictEqual(check.errors.length, 0);

    if (config.fpOs === 'macos') {
      assert.ok(!config.fpWebglVendor.toLowerCase().includes('nvidia'));
    }
  }
});

test('getFingerprintOptions: retorna listas completas para a UI', () => {
  const opts = getFingerprintOptions();
  assert.ok(Array.isArray(opts.osList) && opts.osList.length > 0);
  assert.ok(Array.isArray(opts.browserList) && opts.browserList.length > 0);
  assert.ok(Array.isArray(opts.screenList) && opts.screenList.length > 0);
  assert.ok(Array.isArray(opts.timezoneList) && opts.timezoneList.length > 0);
  assert.ok(Array.isArray(opts.localeList) && opts.localeList.length > 0);
  assert.ok(opts.gpuPresets && opts.gpuPresets.windows && opts.gpuPresets.macos);
});
