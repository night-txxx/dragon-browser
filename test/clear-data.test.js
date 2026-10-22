const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

// 1. Configura diretório temporário isolado para a execução dos testes
const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dragon-test-cleardata-'));
const tempDownloads = path.join(tempUserData, 'downloads');
fs.mkdirSync(tempDownloads, { recursive: true });

// 2. Cria Electron simulado e injeta no cache do Node.js antes de importar os módulos
const clearedStorages = [];
const mockDefaultSession = {
  clearStorageData: async ({ storages }) => {
    if (Array.isArray(storages)) {
      clearedStorages.push(...storages);
    }
  },
  clearCache: async () => {},
  clearAuthCache: async () => {},
  clearHostResolverCache: async () => {},
  clearCodeCaches: async () => {},
  clearHSTS: async () => {}
};

const privatePartitionsCleared = [];
const mockSession = {
  defaultSession: mockDefaultSession,
  fromPartition: (part) => ({
    clearStorageData: async ({ storages }) => {
      privatePartitionsCleared.push({ part, storages });
    },
    clearCache: async () => {},
    clearCodeCaches: async () => {},
    clearHostResolverCache: async () => {}
  })
};

const mockApp = {
  getPath: (name) => {
    if (name === 'userData') return tempUserData;
    if (name === 'downloads') return tempDownloads;
    return tempUserData;
  }
};

const mockElectron = {
  app: mockApp,
  session: mockSession,
  shell: {
    openPath: async () => {},
    showItemInFolder: () => {}
  }
};

require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: mockElectron
};

// 3. Importa os módulos principais do Dragon
const storage = require('../src/main/storage');
storage.init({});

const history = require('../src/main/history');
const bookmarks = require('../src/main/bookmarks');
const downloads = require('../src/main/downloads');
const permissions = require('../src/main/permissions');
const clearData = require('../src/main/clear-data');

test('clearAllData: limpa histórico, downloads, permissões e preserva favoritos por padrão', async () => {
  // Grava dados de navegação iniciais
  history.addEntry({ url: 'https://exemplo1.com', title: 'Exemplo 1' });
  history.addEntry({ url: 'https://exemplo2.com', title: 'Exemplo 2' });
  assert.strictEqual(history.getEntries().length, 2);

  bookmarks.addBookmark({ url: 'https://favorito.com', title: 'Meu Favorito' });
  assert.strictEqual(bookmarks.getBookmarks().length, 1);

  storage.writeJSON('downloads.json', [
    { id: 'dl-1', filename: 'teste.pdf', state: 'completed' }
  ]);
  assert.strictEqual(downloads.getDownloads().length, 1);

  permissions.setPermission('https://camera.com', 'camera', 'allow');
  assert.strictEqual(permissions.getPermission('https://camera.com', 'camera'), 'allow');

  const mockTabManager = {
    destroyAllTabs: () => 3,
    getActivePrivatePartitions: () => ['private-test-session'],
    clearPrivatePartitionsList: () => {}
  };

  const mockMainWindow = {
    isDestroyed: () => false,
    webContents: {
      setZoomLevel: () => {}
    }
  };

  const context = {
    mainWindow: mockMainWindow,
    tabManager: mockTabManager,
    storage: storage
  };

  // Executa clearAllData sem a flag includeBookmarks (padrão)
  const summary = await clearData.clearAllData(context);

  // Valida retorno estruturado do summary
  assert.strictEqual(summary.success, true);
  assert.strictEqual(summary.errors.length, 0);
  assert.strictEqual(summary.tabsDestroyed, 3);
  assert.strictEqual(summary.historyCleared, true);
  assert.strictEqual(summary.downloadsCleared, true);
  assert.strictEqual(summary.permissionsCleared, true);
  assert.strictEqual(summary.bookmarksCleared, false);
  assert.strictEqual(summary.storageDataCleared, true);

  // Confirma que getEntries() retorna vazio
  assert.deepStrictEqual(history.getEntries(), []);

  // Confirma que downloads foram limpos
  assert.deepStrictEqual(downloads.getDownloads(), []);

  // Confirma que permissões foram limpas
  assert.strictEqual(permissions.getPermission('https://camera.com', 'camera'), null);

  // Confirma que favoritos foram preservados
  assert.strictEqual(bookmarks.getBookmarks().length, 1);
  assert.strictEqual(bookmarks.getBookmarks()[0].url, 'https://favorito.com');

  // Simula nova navegação pós-limpeza
  history.addEntry({ url: 'https://novapagina.com', title: 'Nova Página' });

  // Confirma que após nova navegação só existe a nova entrada
  const updatedEntries = history.getEntries();
  assert.strictEqual(updatedEntries.length, 1);
  assert.strictEqual(updatedEntries[0].url, 'https://novapagina.com');
  assert.strictEqual(updatedEntries[0].title, 'Nova Página');

  // Confirma que a partição privada foi processada
  assert.ok(privatePartitionsCleared.some(p => p.part === 'private-test-session'));
});

test('clearAllData: apaga favoritos quando includeBookmarks for true', async () => {
  assert.strictEqual(bookmarks.getBookmarks().length, 1);

  const mockTabManager = {
    destroyAllTabs: () => 0,
    getActivePrivatePartitions: () => [],
    clearPrivatePartitionsList: () => {}
  };

  const context = {
    mainWindow: { isDestroyed: () => false, webContents: { setZoomLevel: () => {} } },
    tabManager: mockTabManager,
    storage: storage
  };

  const summary = await clearData.clearAllData(context, { includeBookmarks: true });
  assert.strictEqual(summary.success, true);
  assert.strictEqual(summary.bookmarksCleared, true);

  // Confirma que favoritos foram apagados
  assert.deepStrictEqual(bookmarks.getBookmarks(), []);
});

test('clearAllData: limpa a pilha de abas fechadas (closedTabsStack) impedindo Ctrl+Shift+T de reabrir páginas apagadas', async () => {
  let closedTabsCleared = false;
  const mockTabManager = {
    destroyAllTabs: () => 2,
    clearClosedTabs: () => {
      closedTabsCleared = true;
    },
    getActivePrivatePartitions: () => [],
    clearPrivatePartitionsList: () => {}
  };

  const context = {
    mainWindow: null,
    tabManager: mockTabManager,
    storage: storage
  };

  const summary = await clearData.clearAllData(context);
  assert.strictEqual(closedTabsCleared, true);
  assert.strictEqual(summary.tabsDestroyed, 2);
});

test('clearAllData: registra falhas no summary.errors e define success:false caso ocorra erro', async () => {
  const failingSession = {
    clearStorageData: async ({ storages }) => {
      if (storages.includes('cookies')) {
        throw new Error('Falha simulada ao limpar cookies');
      }
    },
    clearCache: async () => {},
    clearAuthCache: async () => {},
    clearHostResolverCache: async () => {},
    clearCodeCaches: async () => {},
    clearHSTS: async () => {}
  };

  mockElectron.session.defaultSession = failingSession;

  const context = {
    mainWindow: null,
    tabManager: null,
    storage: storage
  };

  const summary = await clearData.clearAllData(context);
  assert.strictEqual(summary.success, false);
  assert.ok(summary.errors.length > 0);
  assert.ok(summary.errors.some(e => e.includes('cookies')));

  // Restaura session padrão
  mockElectron.session.defaultSession = mockDefaultSession;

  // Limpeza final do diretório temporário
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true });
  } catch (e) {}
});
