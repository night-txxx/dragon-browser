// =============================================================================
// src/main/main.js
// Ponto de entrada do processo principal do Electron
// Responsabilidade única: orquestrar o ciclo de vida e inicializar os módulos
// =============================================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. Define o nome oficial da aplicação no Electron como "Dragon"
app.setName('Dragon');

// 2. Preservação de dados existentes (Migração de %APPDATA%\meu-navegador para %APPDATA%\Dragon)
// Executado imediatamente na primeira execução antes que qualquer outro módulo ou sessão leia dados.
// Se a pasta antiga existir e a nova ainda não tiver sido populada com os dados,
// copia o conteúdo integralmente (copiar, nunca mover nem apagar a pasta antiga).
function preserveExistingUserData() {
  try {
    const appData = app.getPath('appData');
    const oldUserDataPath = path.join(appData, 'meu-navegador');
    const newUserDataPath = path.join(appData, 'Dragon');

    const shouldMigrate = fs.existsSync(oldUserDataPath) && (
      !fs.existsSync(newUserDataPath) ||
      fs.readdirSync(newUserDataPath).length === 0 ||
      !fs.existsSync(path.join(newUserDataPath, 'Network'))
    );

    if (shouldMigrate) {
      console.log(`[Migração] Copiando dados de ${oldUserDataPath} para ${newUserDataPath}...`);
      fs.cpSync(oldUserDataPath, newUserDataPath, { recursive: true, errorOnExist: false });
      console.log('[Migração] Dados, cookies, logins e preferências preservados com sucesso em Dragon.');
    }
  } catch (err) {
    console.error('[Migração] Erro ao preservar dados da versão anterior:', err.message);
  }
}

preserveExistingUserData();

const config = require('./config');
const storage = require('./storage');
const settings = require('./settings');
const sessionModule = require('./session');
const windowModule = require('./window');
const tabsModule = require('./tabs');
const navigationModule = require('./navigation');
const ipcModule = require('./ipc');
const menuModule = require('./menu');
const privacy = require('./privacy');
const history = require('./history');
const clearData = require('./clear-data');

// Tratamento centralizado de erros não capturados para estabilidade e logs consistentes
process.on('uncaughtException', (err) => {
  console.error('[Dragon Main] Exceção não capturada no processo principal:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Dragon Main] Rejeição de Promise não tratada:', reason);
});

// 3. Garantir instância única da aplicação
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Se já houver outra instância aberta, encerra esta nova imediatamente
  console.log('[App] Outra instância do navegador já está em execução. Encerrando.');
  app.quit();
} else {
  let mainWindow = null;
  let tabManager = null;
  let windowManager = null;

  // Quando o usuário tenta abrir uma segunda instância, foca na janela já aberta
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // ETAPA 3 — Reforço explícito de Site Isolation (Process-per-site)
  // No Chromium e Electron (incluindo Electron v44.x testado no projeto), o Site Isolation
  // mantém documentos de diferentes origens (eTLD+1) em processos de renderer separados do SO.
  // O switch 'site-per-process' força categoricamente essa fronteira de isolamento de processo
  // para todas as páginas web externas, protegendo contra ataques de canal lateral (Spectre/Meltdown)
  // e garantindo que abas de origens diferentes nunca compartilhem o mesmo espaço de memória no SO.
  app.commandLine.appendSwitch('site-per-process');

  // Inicialização após o Electron estar totalmente carregado e pronto
  app.whenReady().then(() => {
    // Contexto base compartilhado
    const context = {
      app,
      config
    };

    // 2. Inicializa o armazenamento de dados locais (userData)
    storage.init(context);

    // 2.1. Inicializa o módulo de configurações do usuário
    settings.init(context);

    // 3. Inicializa as políticas de sessão, User-Agent e permissões de sites
    sessionModule.init(context);

    // 4. Cria a janela principal do navegador
    windowManager = windowModule.init(context);
    mainWindow = windowManager.getMainWindow();

    // 5. Inicializa o gerenciador de abas (TabManager)
    tabManager = tabsModule.init({
      mainWindow,
      windowManager,
      config
    });

    // Conecta o TabManager ao controlador de janela para ajustes de layout e overlay
    windowManager.setTabManager(tabManager);

    // Conecta o TabManager ao módulo de configurações para recarregar abas no reset de fingerprint
    settings.setTabManager(tabManager);

    // 6. Inicializa o módulo de normalização e comandos de navegação
    const navigation = navigationModule.init(context);

    // 7. Registra centralizadamente todos os canais IPC
    ipcModule.init({
      mainWindow,
      windowManager,
      tabManager,
      navigation,
      storage
    });

    // 8. Inicializa atalhos de teclado (globais da janela e internos das abas)
    menuModule.init({
      mainWindow,
      tabManager,
      navigation
    });

    // 9. Cria a(s) aba(s) inicial(is) conforme a preferência de inicialização do usuário
    const startupBehavior = settings.get('startupBehavior');
    if (startupBehavior === 'restore') {
      const savedSession = storage.readJSON('sessions.json', null);
      if (savedSession && Array.isArray(savedSession.urls) && savedSession.urls.length > 0) {
        // Valida o esquema das URLs restauradas da sessão anterior
        const validUrls = savedSession.urls.filter(url => typeof url === 'string' && tabManager.isAllowedNavigationUrl(url));
        if (validUrls.length > 0) {
          validUrls.forEach((url, idx) => {
            tabManager.createTab(url, { active: idx === 0 });
          });
        } else {
          tabManager.createTab(config.NEW_TAB_URL, { active: true });
        }
      } else {
        tabManager.createTab(config.NEW_TAB_URL, { active: true });
      }
    } else if (startupBehavior === 'custom') {
      let customUrl = settings.get('startupCustomUrl') || config.NEW_TAB_URL;
      if (!tabManager.isAllowedNavigationUrl(customUrl)) {
        customUrl = config.NEW_TAB_URL;
      }
      tabManager.createTab(customUrl, { active: true });
    } else {
      tabManager.createTab(config.NEW_TAB_URL, { active: true });
    }

    // Em macOS (darwin), recria a janela se clicar no ícone do dock sem janelas abertas
    app.on('activate', () => {
      if (windowModule.getMainWindow() === null) {
        windowModule.init(context);
      }
    });
  });

  // Trata erros de certificado SSL/TLS de forma estrita e segura (Bloco 1.8)
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      if (privacy.isCertAllowedForTab(webContents.id, host)) {
        event.preventDefault();
        callback(true);
        return;
      }
    } catch {}
    callback(false);
  });

  let isClearingOnExit = false;

  // Grava o histórico imediatamente de forma síncrona ao encerrar (Bloco 1.10)
  // e limpa todos os dados se 'clearDataOnExit' estiver ativado (ETAPA 3)
  app.on('before-quit', async (event) => {
    if (typeof history.flushHistorySync === 'function') {
      history.flushHistorySync();
    }

    if (settings.get('clearDataOnExit') && !isClearingOnExit) {
      isClearingOnExit = true;
      event.preventDefault();
      try {
        console.log('[App] clearDataOnExit ativo: limpando dados do navegador antes de encerrar...');
        await clearData.clearAllData({
          mainWindow,
          tabManager,
          storage
        });
        console.log('[App] Limpeza ao fechar concluída com sucesso.');
      } catch (err) {
        console.error('[App] Erro na limpeza ao fechar:', err.message);
      } finally {
        app.quit();
      }
    }
  });

  // Fecha o aplicativo quando todas as janelas forem fechadas
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
