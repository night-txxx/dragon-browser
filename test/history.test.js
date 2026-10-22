const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. Configura diretório temporário isolado para os testes de histórico
const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dragon-test-history-'));

// 2. Injeta mock do electron no require.cache
const mockElectron = {
  app: {
    getPath: (name) => {
      if (name === 'userData') return tempUserData;
      return tempUserData;
    }
  }
};

require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: mockElectron
};

const storage = require('../src/main/storage');
storage.init({});

const history = require('../src/main/history');
const config = require('../src/main/config');

test('history: não registra páginas internas (dragon://, settings, downloads, history, bookmarks)', () => {
  history.clearAll();

  history.addEntry({ url: 'dragon://settings', title: 'Configurações' });
  history.addEntry({ url: config.SETTINGS_PAGE_URL, title: 'Configurações' });
  history.addEntry({ url: config.HISTORY_PAGE_URL, title: 'Histórico' });
  history.addEntry({ url: config.DOWNLOADS_PAGE_URL, title: 'Downloads' });
  history.addEntry({ url: config.BOOKMARKS_PAGE_URL, title: 'Favoritos' });
  history.addEntry({ url: config.NEW_TAB_URL, title: 'Nova Aba' });
  history.addEntry({ url: 'about:blank', title: 'Branco' });

  assert.strictEqual(history.getEntries().length, 0);
});

test('history.updateTitle: atualiza o título da entrada mais recente sem criar duplicatas', () => {
  history.clearAll();

  // 1. Navegação inicial (did-navigate grava com título inicial ou url)
  history.addEntry({ url: 'https://exemplo.org/artigo', title: 'https://exemplo.org/artigo' });
  let entries = history.getEntries();
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].title, 'https://exemplo.org/artigo');

  // 2. Quando o título da página é carregado (page-title-updated)
  history.updateTitle('https://exemplo.org/artigo', 'Título Real do Artigo');

  entries = history.getEntries();
  assert.strictEqual(entries.length, 1, 'Não deve criar uma segunda entrada duplicada');
  assert.strictEqual(entries[0].title, 'Título Real do Artigo');
});

test('history: flushHistorySync grava imediatamente em disco', () => {
  history.clearAll();
  history.addEntry({ url: 'https://persistencia.com', title: 'Persistência' });
  history.flushHistorySync();

  const historyFilePath = path.join(tempUserData, 'history.json');
  assert.strictEqual(fs.existsSync(historyFilePath), true);

  const raw = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
  assert.strictEqual(raw.length, 1);
  assert.strictEqual(raw[0].url, 'https://persistencia.com');

  // Cleanup
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true });
  } catch {}
});
