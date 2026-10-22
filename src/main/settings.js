// =============================================================================
// src/main/settings.js
// Gerenciamento e persistência de preferências do usuário no Dragon
// Grava e lê settings.json via storage.js com mescla inteligente de novos campos
// =============================================================================

const fs = require('fs');
const path = require('path');
const { app, dialog, safeStorage, net } = require('electron');
const storage = require('./storage');
const {
  DEFAULT_SETTINGS,
  isValidSetting,
  mergeWithDefaults,
  isValidHttpUrl
} = require('./pure/settings-utils');
const {
  pickRandomConsistentPreset
} = require('./pure/fingerprint-utils');

// -----------------------------------------------------------------------------
// DEFINIÇÃO DOS BUSCADORES SUPORTADOS
// -----------------------------------------------------------------------------
const SEARCH_ENGINES = {
  duckduckgo: {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=%s'
  },
  google: {
    name: 'Google',
    url: 'https://www.google.com/search?q=%s'
  },
  bing: {
    name: 'Bing',
    url: 'https://www.bing.com/search?q=%s'
  },
  brave: {
    name: 'Brave',
    url: 'https://search.brave.com/search?q=%s'
  },
  startpage: {
    name: 'Startpage',
    url: 'https://www.startpage.com/sp/search?query=%s'
  },
  ecosia: {
    name: 'Ecosia',
    url: 'https://www.ecosia.org/search?q=%s'
  }
};

const MAX_BACKGROUND_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // ~8 MB

let currentSettings = { ...DEFAULT_SETTINGS };
const changeListeners = new Set();
let isInitialized = false;

/**
 * Inicializa o módulo de configurações, lendo settings.json ou criando com padrões.
 * @param {object} context Objeto de contexto do Electron
 */
function init(context) {
  if (isInitialized) return currentSettings;

  const saved = storage.readJSON('settings.json', null);
  currentSettings = mergeWithDefaults(saved);

  // Se o arquivo não existia ou precisou de novos campos padrão, salva imediatamente
  if (!saved || Object.keys(saved).length !== Object.keys(DEFAULT_SETTINGS).length) {
    storage.writeJSON('settings.json', currentSettings);
  }

  isInitialized = true;
  return currentSettings;
}

/**
 * Retorna o valor de uma chave específica ou uma cópia de todas as configurações.
 * @param {string} [key] Nome da chave opcional
 * @returns {*}
 */
function get(key) {
  if (!isInitialized) {
    init({});
  }

  if (typeof key === 'string') {
    return currentSettings[key] !== undefined ? currentSettings[key] : DEFAULT_SETTINGS[key];
  }

  return { ...currentSettings };
}

// Cache em memória para o Data URL da imagem de fundo
let cachedBgFilename = null;
let cachedBgDataUrl = null;

/**
 * Invalida o cache em memória da imagem de fundo quando ela mudar ou for removida
 */
function invalidateBgCache() {
  cachedBgFilename = null;
  cachedBgDataUrl = null;
}

/**
 * Retorna todas as configurações sem incluir o Data URL em base64 da imagem de fundo.
 * Mantém o payload IPC do estado ultraleve para notifyStateChange e browser:settings-updated.
 * @returns {object}
 */
function getAll() {
  return get();
}

/**
 * Retorna todas as configurações enriquecidas com o Data URL da imagem de fundo.
 * Utilizado exclusivamente pela aba interna de configurações (settings:get).
 * @returns {object}
 */
function getSettingsPageData() {
  const all = get();
  all.backgroundImageDataUrl = getBackgroundImageDataUrl(all.backgroundImage);
  delete all.proxyAuthPasswordEncrypted;
  all.hasProxyPassword = Boolean(getProxyPassword());
  return all;
}

/**
 * Atualiza e persiste imediatamente uma chave de configuração com validação estrita.
 * Notifica todos os ouvintes registrados via onChange.
 * Valor inválido é ignorado e retorna false.
 * @param {string} key Nome da propriedade
 * @param {*} value Novo valor
 * @returns {boolean}
 */
function set(key, value) {
  if (!isInitialized) {
    init({});
  }

  if (typeof key !== 'string' || !isValidSetting(key, value)) {
    return false;
  }

  if (key === 'backgroundImage') {
    invalidateBgCache();
  }

  currentSettings[key] = value;
  storage.writeJSON('settings.json', currentSettings);

  // Notifica ouvintes registrados
  for (const listener of changeListeners) {
    try {
      listener(key, value, currentSettings);
    } catch (err) {
      console.error(`[Settings] Erro no ouvinte onChange para chave "${key}":`, err.message);
    }
  }

  return true;
}

/**
 * Atualiza múltiplos campos de uma só vez com validação estrita e persiste.
 * Valores inválidos são ignorados; se houver algum valor inválido ou nenhuma alteração válida, retorna false.
 * @param {object} partial Objeto contendo os campos a atualizar
 * @returns {boolean}
 */
function setAll(partial) {
  if (!isInitialized) {
    init({});
  }

  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return false;

  const entries = Object.entries(partial);
  if (entries.length === 0) return false;

  let anyValid = false;
  let allValid = true;

  for (const [k, v] of entries) {
    if (isValidSetting(k, v)) {
      if (k === 'backgroundImage') {
        invalidateBgCache();
      }
      currentSettings[k] = v;
      anyValid = true;
    } else {
      allValid = false;
    }
  }

  if (anyValid) {
    storage.writeJSON('settings.json', currentSettings);
    for (const listener of changeListeners) {
      try {
        listener('*', currentSettings, currentSettings);
      } catch (err) {
        console.error('[Settings] Erro no ouvinte onChange setAll:', err.message);
      }
    }
  }

  return anyValid && allValid;
}

/**
 * Registra um callback para ser disparado sempre que alguma configuração for alterada.
 * @param {Function} callback (key, value, allSettings) => void
 * @returns {Function} Função para cancelar a inscrição
 */
function onChange(callback) {
  if (typeof callback !== 'function') return () => {};
  changeListeners.add(callback);
  return () => {
    changeListeners.delete(callback);
  };
}

/**
 * Retorna o template de URL do buscador configurado.
 * @returns {string} Template contendo %s
 */
function getSearchUrlTemplate() {
  const engine = get('searchEngine');
  if (engine === 'custom') {
    const custom = (get('customSearchUrl') || '').trim();
    if (custom) {
      return custom.includes('%s') ? custom : `${custom}%s`;
    }
  }

  if (SEARCH_ENGINES[engine]) {
    return SEARCH_ENGINES[engine].url;
  }

  return SEARCH_ENGINES.duckduckgo.url;
}

/**
 * Gera uma URL completa de pesquisa para o termo informado usando o buscador ativo.
 * @param {string} query Termo pesquisado
 * @returns {string} URL pronta para navegação
 */
function getSearchUrl(query) {
  const template = getSearchUrlTemplate();
  return template.replace('%s', encodeURIComponent(query || ''));
}

/**
 * Retorna informações descritivas do buscador ativo (nome, template, id).
 * @returns {object} { id, name, template }
 */
function getSearchEngineInfo() {
  const engine = get('searchEngine');
  if (engine === 'custom') {
    return {
      id: 'custom',
      name: 'Personalizado',
      template: getSearchUrlTemplate()
    };
  }

  if (SEARCH_ENGINES[engine]) {
    return {
      id: engine,
      name: SEARCH_ENGINES[engine].name,
      template: SEARCH_ENGINES[engine].url
    };
  }

  return {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    template: SEARCH_ENGINES.duckduckgo.url
  };
}

/**
 * Retorna a imagem de fundo como Data URL em base64 com cache em memória.
 * Evita leituras de disco repetidas no carregamento de abas.
 * Garante compatibilidade total e segura sem expor caminhos locais nem violar sandbox.
 * @param {string} [filename] Nome do arquivo na pasta de backgrounds
 * @returns {string} Data URL ou string vazia
 */
function getBackgroundImageDataUrl(filename) {
  const name = filename || get('backgroundImage');
  if (!name) {
    cachedBgFilename = null;
    cachedBgDataUrl = null;
    return '';
  }

  // Retorna diretamente do cache em memória se já carregado anteriormente
  if (cachedBgFilename === name && cachedBgDataUrl !== null) {
    return cachedBgDataUrl;
  }

  try {
    const bgDir = path.join(app.getPath('userData'), 'backgrounds');
    const bgPath = path.join(bgDir, name);

    if (!fs.existsSync(bgPath)) {
      cachedBgFilename = null;
      cachedBgDataUrl = null;
      return '';
    }

    const ext = path.extname(bgPath).toLowerCase();
    let mime = 'image/jpeg';
    if (ext === '.png') mime = 'image/png';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.gif') mime = 'image/gif';
    else if (ext === '.bmp') mime = 'image/bmp';

    const buffer = fs.readFileSync(bgPath);
    cachedBgFilename = name;
    cachedBgDataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    return cachedBgDataUrl;
  } catch (err) {
    console.warn('[Settings] Erro ao carregar imagem de fundo:', err.message);
    cachedBgFilename = null;
    cachedBgDataUrl = null;
    return '';
  }
}

/**
 * Abre caixa de diálogo nativa para o usuário escolher uma imagem de fundo do computador.
 * A imagem é copiada com segurança para %APPDATA%\Dragon\backgrounds\ (o caminho original NUNCA é salvo).
 * @param {BrowserWindow} parentWindow Janela proprietária do diálogo
 * @returns {Promise<object|null>} Objeto com filename e dataUrl ou null se cancelado
 */
async function chooseBackgroundImage(parentWindow) {
  const result = await dialog.showOpenDialog(parentWindow, {
    title: 'Escolha uma imagem de fundo para a Nova Aba',
    buttonLabel: 'Usar como fundo',
    properties: ['openFile'],
    filters: [
      { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }
    ]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  let ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.jpeg') ext = '.jpg';
  const allowedExts = new Set(['.png', '.jpg', '.webp', '.gif', '.bmp']);
  if (!allowedExts.has(ext)) {
    ext = '.jpg';
  }

  const bgDir = path.join(app.getPath('userData'), 'backgrounds');

  if (!fs.existsSync(bgDir)) {
    fs.mkdirSync(bgDir, { recursive: true });
  }

  // Remove arquivos de fundo anteriores
  try {
    const files = fs.readdirSync(bgDir);
    for (const f of files) {
      if (f.startsWith('newtab-bg')) {
        fs.unlinkSync(path.join(bgDir, f));
      }
    }
  } catch (err) {
    console.warn('[Settings] Aviso ao limpar imagens antigas de fundo:', err.message);
  }

  const filename = `newtab-bg${ext}`;
  const destPath = path.join(bgDir, filename);

  // Limita o tamanho da imagem a ~8 MB redimensionando via nativeImage se necessário
  try {
    const stats = fs.statSync(sourcePath);
    if (stats.size > MAX_BACKGROUND_IMAGE_SIZE_BYTES) {
      const { nativeImage } = require('electron');
      const img = nativeImage.createFromPath(sourcePath);
      if (!img.isEmpty()) {
        const size = img.getSize();
        const maxDim = 1920;
        let targetWidth = size.width;
        let targetHeight = size.height;
        if (targetWidth > maxDim || targetHeight > maxDim) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
            targetWidth = maxDim;
          } else {
            targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
            targetHeight = maxDim;
          }
        }
        const resized = img.resize({ width: targetWidth, height: targetHeight, quality: 'good' });
        const buffer = ext === '.png' ? resized.toPNG() : resized.toJPEG(85);
        fs.writeFileSync(destPath, buffer);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  } catch (err) {
    console.warn('[Settings] Aviso ao processar imagem de fundo:', err.message);
    fs.copyFileSync(sourcePath, destPath);
  }

  invalidateBgCache();
  set('backgroundImage', filename);

  return {
    filename,
    dataUrl: getBackgroundImageDataUrl(filename)
  };
}

/**
 * Remove a imagem de fundo personalizada e apaga o arquivo da pasta userData.
 * @returns {boolean}
 */
function removeBackgroundImage() {
  const bgDir = path.join(app.getPath('userData'), 'backgrounds');
  try {
    if (fs.existsSync(bgDir)) {
      const files = fs.readdirSync(bgDir);
      for (const f of files) {
        if (f.startsWith('newtab-bg')) {
          fs.unlinkSync(path.join(bgDir, f));
        }
      }
    }
  } catch (err) {
    console.warn('[Settings] Aviso ao remover imagem de fundo:', err.message);
  }

  invalidateBgCache();
  set('backgroundImage', '');
  return true;
}

/**
 * Prepara o pacote de configurações necessário para renderizar ou atualizar a página de Nova Aba.
 * @returns {object}
 */
function getNewTabData() {
  const engineInfo = getSearchEngineInfo();
  return {
    accentColor: get('accentColor'),
    theme: get('theme'),
    searchEngine: get('searchEngine'),
    searchEngineName: engineInfo.name,
    searchUrlTemplate: engineInfo.template,
    backgroundImageUrl: getBackgroundImageDataUrl(),
    backgroundDim: get('backgroundDim'),
    backgroundBlur: get('backgroundBlur'),
    showShortcuts: get('showShortcuts')
  };
}

/**
 * Grava com segurança a senha do proxy autenticado via safeStorage (DPAPI no Windows)
 * @param {string} rawPassword
 * @returns {boolean}
 */
function setProxyPassword(rawPassword) {
  if (!rawPassword) {
    set('proxyAuthPasswordEncrypted', '');
    return true;
  }
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(rawPassword);
      set('proxyAuthPasswordEncrypted', encrypted.toString('hex'));
      return true;
    } else {
      const b64 = Buffer.from(rawPassword, 'utf-8').toString('base64');
      set('proxyAuthPasswordEncrypted', 'plain:' + b64);
      return true;
    }
  } catch (err) {
    console.warn('[Settings] Erro ao criptografar senha de proxy:', err.message);
    return false;
  }
}

/**
 * Recupera e descriptografa a senha de proxy
 * @returns {string}
 */
function getProxyPassword() {
  const enc = get('proxyAuthPasswordEncrypted') || '';
  if (!enc) return '';
  try {
    if (enc.startsWith('plain:')) {
      return Buffer.from(enc.slice(6), 'base64').toString('utf-8');
    }
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(enc, 'hex');
      return safeStorage.decryptString(buf);
    }
  } catch (err) {
    console.warn('[Settings] Erro ao descriptografar senha de proxy:', err.message);
  }
  return '';
}

/**
 * Testa a conexão com o servidor proxy através de uma requisição leve em partição isolada
 * @param {object} proxyConfig
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function testProxyConnection(proxyConfig = {}) {
  const { session } = require('electron');
  const testPartition = 'proxy-test-' + Date.now();
  const testSes = session.fromPartition(testPartition);

  let rules = proxyConfig.proxyRules || '';
  if (!rules && proxyConfig.host) {
    const proto = proxyConfig.protocol || 'http';
    const port = proxyConfig.port ? `:${proxyConfig.port}` : '';
    rules = `${proto}://${proxyConfig.host}${port}`;
  }
  if (!rules) {
    rules = get('proxyRules') || '';
  }
  const bypass = proxyConfig.proxyBypass || get('proxyBypass') || '';

  if (!rules) {
    return { success: false, message: 'Nenhuma regra de proxy configurada.' };
  }

  try {
    await testSes.setProxy({ proxyRules: rules, proxyBypassRules: bypass });
    return new Promise((resolve) => {
      const request = net.request({
        url: 'https://duckduckgo.com',
        session: testSes,
        method: 'HEAD'
      });

      const timer = setTimeout(() => {
        request.abort();
        resolve({ success: false, message: 'Tempo limite esgotado ao conectar ao proxy.' });
      }, 7000);

      request.on('response', (response) => {
        clearTimeout(timer);
        resolve({ success: true, message: `Conexão proxy bem-sucedida! Resposta HTTP: ${response.statusCode}` });
      });

      request.on('error', (error) => {
        clearTimeout(timer);
        resolve({ success: false, message: `Falha na conexão: ${error.message}` });
      });

      request.end();
    });
  } catch (err) {
    return { success: false, message: `Erro ao testar proxy: ${err.message}` };
  }
}

let tabManagerRef = null;

function setTabManager(tabManager) {
  tabManagerRef = tabManager;
}

/**
 * Gera uma nova identidade de fingerprint aleatória e consistente,
 * persiste em settings.json, notifica ouvintes e recarrega abas abertas.
 * @returns {object} { success: boolean, config: object, seed: number }
 */
function resetFingerprint() {
  const { config, seed } = pickRandomConsistentPreset();
  setAll(config);

  if (tabManagerRef && typeof tabManagerRef.reloadAllWebTabs === 'function') {
    tabManagerRef.reloadAllWebTabs();
  }

  return { success: true, config, seed };
}

module.exports = {
  DEFAULT_SETTINGS,
  SEARCH_ENGINES,
  isValidSetting,
  init,
  get,
  getAll,
  getSettingsPageData,
  invalidateBgCache,
  set,
  setAll,
  onChange,
  getSearchUrl,
  getSearchUrlTemplate,
  getSearchEngineInfo,
  getBackgroundImageDataUrl,
  chooseBackgroundImage,
  removeBackgroundImage,
  getNewTabData,
  setProxyPassword,
  getProxyPassword,
  testProxyConnection,
  setTabManager,
  resetFingerprint
};
