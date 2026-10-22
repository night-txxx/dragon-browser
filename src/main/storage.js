// =============================================================================
// src/main/storage.js
// Responsável pela persistência de dados em arquivos JSON na pasta do usuário
// Caminho padrão no Windows: %APPDATA%\Dragon\
// =============================================================================

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let storageDir = '';

/**
 * Inicializa o módulo de armazenamento garantindo que o diretório userData exista.
 * @param {object} context Objeto com instâncias e utilitários globais do app
 */
function init(context) {
  storageDir = app.getPath('userData');

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

/**
 * Lê um arquivo JSON da pasta userData.
 * Se o arquivo estiver corrompido, tenta o fallback em .bak e retorna defaultValue caso ambos falhem.
 * @param {string} filename Nome do arquivo (ex: 'bookmarks.json')
 * @param {*} defaultValue Valor retornado caso o arquivo não exista ou esteja corrompido
 * @returns {*} Conteúdo lido e parseado do arquivo JSON
 */
function readJSON(filename, defaultValue = null) {
  const filePath = path.join(storageDir, filename);
  const bakPath = `${filePath}.bak`;

  // 1. Tenta ler o arquivo principal
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (parseError) {
      console.warn(`[Storage] Arquivo ${filename} corrompido, tentando fallback para backup .bak:`, parseError.message);
    }
  }

  // 2. Fallback resiliente: tenta ler o backup anterior se o arquivo principal falhou
  if (fs.existsSync(bakPath)) {
    try {
      const bakRaw = fs.readFileSync(bakPath, 'utf-8');
      return JSON.parse(bakRaw);
    } catch (bakError) {
      console.error(`[Storage] Arquivo de backup ${filename}.bak também corrompido:`, bakError.message);
    }
  }

  return defaultValue;
}

/**
 * Grava dados em formato JSON formatado na pasta userData de forma atômica (grava em .tmp e renomeia).
 * Cria backup (.bak) antes de sobrescrever para garantir integridade caso ocorra desligamento repentino.
 * @param {string} filename Nome do arquivo (ex: 'bookmarks.json')
 * @param {*} data Dados serializáveis em JSON
 * @returns {boolean} Retorna true se a gravação foi bem-sucedida
 */
function writeJSON(filename, data, options = {}) {
  try {
    const filePath = path.join(storageDir, filename);
    const tmpPath = `${filePath}.tmp`;
    const bakPath = `${filePath}.bak`;
    const content = JSON.stringify(data, null, 2);

    // 1. Grava primeiramente no arquivo temporário .tmp
    fs.writeFileSync(tmpPath, content, 'utf-8');

    // 2. Se o destino atual já existir e não for gravação sem backup, preserva no .bak
    if (fs.existsSync(filePath) && (!options || !options.noBackup)) {
      try {
        fs.copyFileSync(filePath, bakPath);
      } catch {}
    }

    // 3. Substituição atômica no sistema operacional
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (error) {
    console.error(`[Storage] Erro ao gravar atomicamente o arquivo ${filename}:`, error.message);
    return false;
  }
}

/**
 * Remove os arquivos de backup (.bak) e temporários (.tmp) de um arquivo JSON.
 * Usado na limpeza completa para evitar ressurreição de dados antigos.
 * @param {string} filename Nome do arquivo (ex: 'history.json')
 */
function removeBackupAndTempFiles(filename) {
  try {
    const filePath = path.join(storageDir, filename);
    const bakPath = `${filePath}.bak`;
    const tmpPath = `${filePath}.tmp`;

    if (fs.existsSync(bakPath)) {
      fs.unlinkSync(bakPath);
    }
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  } catch (err) {
    console.warn(`[Storage] Aviso ao remover backups de ${filename}:`, err.message);
  }
}

/**
 * Remove com segurança todos os arquivos JSON de dados gerados pelo navegador
 * (histórico de navegação, lista de downloads, miniaturas, etc.)
 * @returns {string[]} Lista de arquivos removidos com sucesso
 */
function clearBrowserData() {
  const removedFiles = [];
  // Histórico, downloads, favoritos e permissões são limpos diretamente por seus respectivos
  // módulos (clearAll/clearHistory), garantindo que os caches em memória e os arquivos
  // sejam sincronizados sem deixar dados zumbis vivos na sessão.
  const knownDataFiles = [
    'thumbnails.json'
  ];

  for (const filename of knownDataFiles) {
    try {
      const filePath = path.join(storageDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedFiles.push(filename);
      }
    } catch (err) {
      console.warn(`[Storage] Não foi possível remover ${filename}:`, err.message);
    }
  }

  return removedFiles;
}

module.exports = {
  init,
  readJSON,
  writeJSON,
  removeBackupAndTempFiles,
  clearBrowserData
};

