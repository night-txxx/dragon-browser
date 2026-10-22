// =============================================================================
// src/main/clear-data.js
// Módulo responsável pela exclusão completa e segura de dados de navegação
// Invocado durante a animação do Fogo do Dragão Azul
// =============================================================================

const { session } = require('electron');
const history = require('./history');
const downloads = require('./downloads');
const permissions = require('./permissions');
const bookmarks = require('./bookmarks');

/**
 * Lista de tipos de armazenamento suportados pelo Electron
 */
const STORAGE_TYPES = [
  'cookies',
  'localstorage',
  'indexdb',
  'serviceworkers',
  'cachestorage',
  'filesystem',
  'websql',
  'shadercache'
];

/**
 * Executa a limpeza completa e profunda de todos os dados do navegador.
 * A função é totalmente assíncrona e trata os erros de cada etapa de forma
 * isolada para registrar falhas no summary sem interromper os demais passos.
 *
 * @param {object} context Objeto contendo { mainWindow, tabManager, storage, includeBookmarks }
 * @param {object} [options] Opções adicionais como { includeBookmarks: boolean }
 * @returns {Promise<object>} Resumo estruturado do que foi apagado com success:boolean e errors:string[]
 */
async function clearAllData(context, options = {}) {
  const { mainWindow, tabManager, storage } = context || {};
  const includeBookmarks = Boolean(
    (options && options.includeBookmarks) ||
    (context && context.includeBookmarks)
  );

  const summary = {
    success: true,
    tabsDestroyed: 0,
    storageDataCleared: false,
    cacheCleared: false,
    codeCacheCleared: false,
    authCacheCleared: false,
    hostResolverCacheCleared: false,
    hstsCleared: false,
    localFilesRemoved: [],
    historyCleared: false,
    downloadsCleared: false,
    permissionsCleared: false,
    bookmarksCleared: false,
    zoomReset: false,
    customPartitionsCleared: 0,
    errors: []
  };

  // 1. Fechar e destruir TODAS as abas existentes (libera memória e encerra webContents)
  try {
    if (tabManager && typeof tabManager.destroyAllTabs === 'function') {
      summary.tabsDestroyed = tabManager.destroyAllTabs();
    }
    if (tabManager && typeof tabManager.clearClosedTabs === 'function') {
      tabManager.clearClosedTabs();
    }
  } catch (err) {
    console.error('[ClearData] Erro ao fechar abas:', err);
    summary.errors.push(`Erro ao fechar abas: ${err.message}`);
  }

  // 2. Limpar histórico de navegação (zera cache em memória e persiste history.json vazio)
  try {
    if (history && typeof history.clearAll === 'function') {
      history.clearAll();
      summary.historyCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar histórico:', err);
    summary.errors.push(`Erro ao limpar histórico: ${err.message}`);
  }

  // 3. Limpar histórico de downloads (zera cache em memória e persiste downloads.json vazio)
  try {
    if (downloads && typeof downloads.clearHistory === 'function') {
      downloads.clearHistory();
      summary.downloadsCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar downloads:', err);
    summary.errors.push(`Erro ao limpar downloads: ${err.message}`);
  }

  // 4. Limpar permissões concedidas a sites (zera cache em memória e persiste permissions.json vazio)
  try {
    if (permissions && typeof permissions.clearAll === 'function') {
      permissions.clearAll();
      summary.permissionsCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar permissões:', err);
    summary.errors.push(`Erro ao limpar permissões: ${err.message}`);
  }

  // 5. Favoritos: NÃO apagar por padrão; apagar apenas se includeBookmarks for verdadeiro
  if (includeBookmarks) {
    try {
      if (bookmarks && typeof bookmarks.clearAll === 'function') {
        bookmarks.clearAll();
        summary.bookmarksCleared = true;
      }
    } catch (err) {
      console.error('[ClearData] Erro ao limpar favoritos:', err);
      summary.errors.push(`Erro ao limpar favoritos: ${err.message}`);
    }
  }

  // Obter sessão padrão do Electron
  const defaultSession = session ? session.defaultSession : null;

  // 6. Limpar cada storage separadamente em try/catch individual (sem 'quotas')
  if (defaultSession && typeof defaultSession.clearStorageData === 'function') {
    let anyStorageError = false;
    for (const st of STORAGE_TYPES) {
      try {
        await defaultSession.clearStorageData({ storages: [st] });
      } catch (err) {
        anyStorageError = true;
        console.error(`[ClearData] Erro ao limpar storage '${st}':`, err);
        summary.errors.push(`Erro ao limpar storage '${st}': ${err.message}`);
      }
    }
    summary.storageDataCleared = !anyStorageError;
  }

  // 7. Limpar memória cache de rede
  try {
    if (defaultSession && typeof defaultSession.clearCache === 'function') {
      await defaultSession.clearCache();
      summary.cacheCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar cache de rede:', err);
    summary.errors.push(`Erro ao limpar cache de rede: ${err.message}`);
  }

  // 8. Limpar cache de código (clearCodeCaches)
  try {
    if (defaultSession && typeof defaultSession.clearCodeCaches === 'function') {
      await defaultSession.clearCodeCaches({});
      summary.codeCacheCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar cache de código:', err);
    summary.errors.push(`Erro ao limpar cache de código: ${err.message}`);
  }

  // 9. Limpar credenciais de autenticação HTTP
  try {
    if (defaultSession && typeof defaultSession.clearAuthCache === 'function') {
      await defaultSession.clearAuthCache();
      summary.authCacheCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar auth cache:', err);
    summary.errors.push(`Erro ao limpar auth cache: ${err.message}`);
  }

  // 10. Limpar DNS (host resolver cache)
  try {
    if (defaultSession && typeof defaultSession.clearHostResolverCache === 'function') {
      await defaultSession.clearHostResolverCache();
      summary.hostResolverCacheCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar host resolver cache:', err);
    summary.errors.push(`Erro ao limpar host resolver cache: ${err.message}`);
  }

  // 11. Limpar HSTS quando a API existir
  try {
    if (defaultSession && typeof defaultSession.clearHSTS === 'function') {
      await defaultSession.clearHSTS();
      summary.hstsCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar HSTS:', err);
    summary.errors.push(`Erro ao limpar HSTS: ${err.message}`);
  }

  // 12. Apagar arquivos auxiliares locais via storage.js
  try {
    if (storage && typeof storage.clearBrowserData === 'function') {
      summary.localFilesRemoved = storage.clearBrowserData();
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar dados locais do storage:', err);
    summary.errors.push(`Erro ao limpar dados locais do storage: ${err.message}`);
  }

  // 13. Zerar sessions.json no disco
  try {
    if (storage && typeof storage.writeJSON === 'function') {
      storage.writeJSON('sessions.json', { urls: [] });
    }
  } catch (err) {
    console.warn('[ClearData] Aviso ao zerar sessions.json:', err.message);
  }

  // 14. Zerar zoom por site na interface e redefinir níveis padrões
  try {
    if (mainWindow && (!mainWindow.isDestroyed || !mainWindow.isDestroyed()) && mainWindow.webContents) {
      mainWindow.webContents.setZoomLevel(0);
      summary.zoomReset = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao zerar zoom:', err);
    summary.errors.push(`Erro ao zerar zoom: ${err.message}`);
  }

  // 15. Limpar partições privadas ativas (mesmo sem abas abertas)
  try {
    if (tabManager && typeof tabManager.getActivePrivatePartitions === 'function') {
      const activePartitions = tabManager.getActivePrivatePartitions();
      for (const part of activePartitions) {
        try {
          if (session && typeof session.fromPartition === 'function') {
            const customSes = session.fromPartition(part);
            if (customSes) {
              for (const st of STORAGE_TYPES) {
                try {
                  if (typeof customSes.clearStorageData === 'function') {
                    await customSes.clearStorageData({ storages: [st] });
                  }
                } catch (e) {
                  summary.errors.push(`Erro ao limpar storage '${st}' em partição '${part}': ${e.message}`);
                }
              }
              if (typeof customSes.clearCache === 'function') {
                await customSes.clearCache();
              }
              if (typeof customSes.clearCodeCaches === 'function') {
                await customSes.clearCodeCaches({});
              }
              if (typeof customSes.clearHostResolverCache === 'function') {
                await customSes.clearHostResolverCache();
              }
              summary.customPartitionsCleared++;
            }
          }
        } catch (e) {
          summary.errors.push(`Erro ao limpar partição '${part}': ${e.message}`);
        }
      }

      if (typeof tabManager.clearPrivatePartitionsList === 'function') {
        tabManager.clearPrivatePartitionsList();
      }
    }
  } catch (err) {
    console.warn('[ClearData] Aviso ao limpar partições privadas:', err.message);
    summary.errors.push(`Erro ao limpar partições privadas: ${err.message}`);
  }

  // Define status de sucesso geral (verdadeiro se não houver erros registrados)
  summary.success = summary.errors.length === 0;

  return summary;
}

module.exports = {
  clearAllData
};
