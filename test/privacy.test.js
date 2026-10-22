const test = require('node:test');
const assert = require('node:assert');
const {
  getBaseDomain,
  isLocalHost,
  isTrackerDomain,
  cleanTrackingParameters,
  isValidBlocklistHost,
  isSuspiciousRedirectChain,
  calculatePrivacyGrade
} = require('../src/main/pure/privacy-utils');


test('getBaseDomain: extração de domínio com tldts (incluindo domínios multipartes e privados)', () => {
  assert.strictEqual(getBaseDomain('sub.domain.com.au'), 'domain.com.au');
  assert.strictEqual(getBaseDomain('user.github.io'), 'user.github.io');
  assert.strictEqual(getBaseDomain('test.co.jp'), 'test.co.jp');
  assert.strictEqual(getBaseDomain('analytics.google.com'), 'google.com');
  assert.strictEqual(getBaseDomain('globo.com'), 'globo.com');
  assert.strictEqual(getBaseDomain('localhost'), 'localhost');
});

test('isLocalHost: identifica loopback, IPs privados e mDNS', () => {
  assert.strictEqual(isLocalHost('localhost'), true);
  assert.strictEqual(isLocalHost('::1'), true);
  assert.strictEqual(isLocalHost('127.0.0.1'), true);
  assert.strictEqual(isLocalHost('192.168.0.1'), true);
  assert.strictEqual(isLocalHost('10.0.0.1'), true);
  assert.strictEqual(isLocalHost('meucomputador.local'), true);
  assert.strictEqual(isLocalHost('router'), true);
  assert.strictEqual(isLocalHost('google.com'), false);
});

test('isTrackerDomain: detecta correspondência exata e subdomínios', () => {
  const trackers = new Set(['doubleclick.net', 'google-analytics.com']);
  assert.strictEqual(isTrackerDomain('doubleclick.net', trackers), true);
  assert.strictEqual(isTrackerDomain('ad.service.doubleclick.net', trackers), true);
  assert.strictEqual(isTrackerDomain('google-analytics.com', trackers), true);
  assert.strictEqual(isTrackerDomain('google.com', trackers), false);
  assert.strictEqual(isTrackerDomain('wikipedia.org', trackers), false);
});

test('cleanTrackingParameters: remove utm_*, fbclid, gclid, etc.', () => {
  const dirty = 'https://loja.com/produto?utm_source=facebook&fbclid=xyz123&cor=azul';
  const { cleanedUrl, hasRemovedParams } = cleanTrackingParameters(dirty);
  assert.strictEqual(hasRemovedParams, true);
  assert.strictEqual(cleanedUrl, 'https://loja.com/produto?cor=azul');

  const clean = 'https://loja.com/produto?cor=azul';
  const res = cleanTrackingParameters(clean);
  assert.strictEqual(res.hasRemovedParams, false);
  assert.strictEqual(res.cleanedUrl, clean);
});

test('isValidBlocklistHost: valida apenas linhas sintaticamente corretas de domínios', () => {
  // Casos válidos
  assert.strictEqual(isValidBlocklistHost('tracker.doubleclick.net'), true);
  assert.strictEqual(isValidBlocklistHost('analytics.google.com'), true);
  assert.strictEqual(isValidBlocklistHost('ad-server123.example.org'), true);
  assert.strictEqual(isValidBlocklistHost('sub.domain.co.uk'), true);

  // Casos inválidos
  assert.strictEqual(isValidBlocklistHost('# Comentário'), false);
  assert.strictEqual(isValidBlocklistHost(''), false);
  assert.strictEqual(isValidBlocklistHost('   '), false);
  assert.strictEqual(isValidBlocklistHost('http://site.com'), false);
  assert.strictEqual(isValidBlocklistHost('site.com/ad'), false);
  assert.strictEqual(isValidBlocklistHost('site.com:8080'), false);
  assert.strictEqual(isValidBlocklistHost('palavra-sem-ponto'), false);
  assert.strictEqual(isValidBlocklistHost('site com espaco.com'), false);
  assert.strictEqual(isValidBlocklistHost('.inicia-com-ponto.com'), false);
});

test('calculatePrivacyGrade: calcula notas A, C e F com base nas métricas de privacidade', () => {
  // Caso Nota A: Conexão HTTPS segura, 0 a 3 rastreadores, 0 popups
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 0, popupsBlocked: 0 }), 'A');
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 2, popupsBlocked: 0 }), 'A');

  // Caso Nota B: Conexão HTTPS com poucos rastreadores
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 4, popupsBlocked: 0 }), 'B');

  // Caso Nota C: Conexão HTTPS com volume moderado de rastreadores (10 rastreadores = -40 -> 60 pts)
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 10, popupsBlocked: 0 }), 'C');
  // Ou HTTPS com 4 rastreadores (-25) e 1 popup bloqueado (-15) -> 60 pts -> Nota C
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 4, popupsBlocked: 1 }), 'C');

  // Caso Nota D: Conexão HTTP insegura sem rastreadores (-45 -> 55 pts)
  assert.strictEqual(calculatePrivacyGrade({ isHttps: false, count: 0, popupsBlocked: 0 }), 'D');

  // Caso Nota F: Conexão HTTP insegura com rastreadores ou pop-ups abusivos
  // HTTP (-45) + 10 rastreadores (-40) = 15 pts -> Nota F
  assert.strictEqual(calculatePrivacyGrade({ isHttps: false, count: 10, popupsBlocked: 0 }), 'F');
  // HTTP (-45) + 4 rastreadores (-25) + 2 popups (-30) = 0 pts -> Nota F
  assert.strictEqual(calculatePrivacyGrade({ isHttps: false, count: 4, popupsBlocked: 2 }), 'F');
  // HTTPS com volume massivo de rastreadores + múltiplos popups forçados (-40 -30 = 30 pts) -> Nota F
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 15, popupsBlocked: 2 }), 'F');
});

test('isSuspiciousRedirectChain: detecta sequências rápidas de redirecionamento entre domínios diferentes', () => {
  const now = 10000;
  const history = [
    { url: 'https://origem.com', domain: 'origem.com', timestamp: now - 1000 },
    { url: 'https://tracker.net/go', domain: 'tracker.net', timestamp: now - 400 }
  ];

  // Redirecionamento para o 3º domínio diferente em menos de 1.5s -> Detecta como suspeito
  assert.strictEqual(isSuspiciousRedirectChain(history, 'https://shadyad.org/landing', now, 1500, 2), true);

  // Redirecionamento interno dentro do mesmo domínio -> Não bloqueia
  assert.strictEqual(isSuspiciousRedirectChain(history, 'https://tracker.net/login', now, 1500, 2), false);

  // Redirecionamento fora da janela de 1.5s -> Não bloqueia
  const oldHistory = [
    { url: 'https://origem.com', domain: 'origem.com', timestamp: now - 3000 },
    { url: 'https://tracker.net/go', domain: 'tracker.net', timestamp: now - 2000 }
  ];
  assert.strictEqual(isSuspiciousRedirectChain(oldHistory, 'https://shadyad.org/landing', now, 1500, 2), false);
});

