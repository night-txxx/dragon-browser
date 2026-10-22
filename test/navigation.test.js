const test = require('node:test');
const assert = require('node:assert');
const { normalizeInput } = require('../src/main/pure/navigation-utils');

test('normalizeInput: entrada vazia retorna newtab', () => {
  assert.strictEqual(normalizeInput(''), 'pages/newtab.html');
  assert.strictEqual(normalizeInput('   '), 'pages/newtab.html');
});

test('normalizeInput: atalhos dragon:// e about:// para páginas internas', () => {
  assert.strictEqual(normalizeInput('dragon://settings'), 'pages/settings.html');
  assert.strictEqual(normalizeInput('about:settings'), 'pages/settings.html');
  assert.strictEqual(normalizeInput('dragon://downloads'), 'pages/downloads.html');
  assert.strictEqual(normalizeInput('dragon://history'), 'pages/history.html');
  assert.strictEqual(normalizeInput('dragon://bookmarks'), 'pages/bookmarks.html');
});

test('normalizeInput: URLs com protocolo explícito mantidas', () => {
  assert.strictEqual(normalizeInput('https://google.com'), 'https://google.com');
  assert.strictEqual(normalizeInput('http://exemplo.org/path'), 'http://exemplo.org/path');
  assert.strictEqual(normalizeInput('about:blank'), 'about:blank');
});

test('normalizeInput: localhost e IPs recebem http://', () => {
  assert.strictEqual(normalizeInput('localhost'), 'http://localhost');
  assert.strictEqual(normalizeInput('localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(normalizeInput('127.0.0.1:8080'), 'http://127.0.0.1:8080');
  assert.strictEqual(normalizeInput('192.168.1.1'), 'http://192.168.1.1');
});

test('normalizeInput: domínios recebem https://', () => {
  assert.strictEqual(normalizeInput('github.com'), 'https://github.com');
  assert.strictEqual(normalizeInput('globo.com/noticias'), 'https://globo.com/noticias');
});

test('normalizeInput: palavras soltas ou com espaços viram busca', () => {
  const customOpts = { searchTemplate: 'https://duckduckgo.com/?q=%s' };
  assert.strictEqual(normalizeInput('dragao azul', customOpts), 'https://duckduckgo.com/?q=dragao%20azul');
  assert.strictEqual(normalizeInput('receitas', customOpts), 'https://duckduckgo.com/?q=receitas');
});

test('applySearchTemplate: substitui %s ou %25s corretamente e codifica queries', () => {
  const { applySearchTemplate } = require('../src/main/pure/navigation-utils');
  assert.strictEqual(applySearchTemplate('https://duckduckgo.com/?q=%s', 'gato preto'), 'https://duckduckgo.com/?q=gato%20preto');
  assert.strictEqual(applySearchTemplate('https://duckduckgo.com/?q=%25s', 'gato preto'), 'https://duckduckgo.com/?q=gato%20preto');
  assert.strictEqual(applySearchTemplate('https://www.google.com/search?q=%s', 'dragon browser'), 'https://www.google.com/search?q=dragon%20browser');
});

test('navigation (módulo principal): normalizeInput gera URL de pesquisa correta sem %25s', () => {
  const mainNav = require('../src/main/navigation');
  const result = mainNav.normalizeInput('gatos e cachorros');
  assert.strictEqual(result, 'https://duckduckgo.com/?q=gatos%20e%20cachorros');
  assert.ok(!result.includes('%25s'));
  assert.ok(result.includes('gatos%20e%20cachorros'));
});
