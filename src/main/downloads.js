// =============================================================================
// src/main/downloads.js
// Gerenciamento de downloads (will-download), progresso e histórico (downloads.json)
// =============================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const storage = require('./storage');
const { isRiskyDownload } = require('./pure/download-utils');

const DOWNLOADS_FILENAME = 'downloads.json';
const activeDownloads = new Map(); // id -> { item, record, isPrivate }
const pendingRiskDownloads = new Map(); // id -> { item, savePath, finalFilename, downloadRecord, isPrivate }
let downloadsHistory = null;
let onDownloadUpdateCallback = null;
let onDownloadRiskPromptCallback = null;

function getNonConflictingPath(saveDirectory, filename) {
  let savePath = path.join(saveDirectory, filename);
  if (!fs.existsSync(savePath)) {
    return { savePath, finalFilename: filename };
  }
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let counter = 1;
  while (fs.existsSync(savePath)) {
    const candidateName = `${base} (${counter})${ext}`;
    savePath = path.join(saveDirectory, candidateName);
    counter++;
  }
  return { savePath, finalFilename: path.basename(savePath) };
}

function loadHistory() {
  if (downloadsHistory === null) {
    downloadsHistory = storage.readJSON(DOWNLOADS_FILENAME, []);
    if (!Array.isArray(downloadsHistory)) {
      downloadsHistory = [];
    }
  }
  return downloadsHistory;
}

function persistHistory() {
  storage.writeJSON(DOWNLOADS_FILENAME, downloadsHistory);
}

/**
 * Registra o ouvinte para notificação de atualizações de download na interface
 * @param {Function} callback
 */
function setDownloadUpdateListener(callback) {
  onDownloadUpdateCallback = callback;
}

/**
 * Registra o ouvinte para prompt de confirmação de download perigoso
 * @param {Function} callback
 */
function setDownloadRiskListener(callback) {
  onDownloadRiskPromptCallback = callback;
}

function notifyUpdate(downloadData) {
  if (typeof onDownloadUpdateCallback === 'function') {
    onDownloadUpdateCallback(downloadData);
  }
}

/**
 * Anexa listeners de progresso e finalização para um DownloadItem do Electron
 */
function attachDownloadListeners(item, downloadRecord, downloadId, isPrivate) {
  item.on('updated', (updateEvent, state) => {
    downloadRecord.receivedBytes = item.getReceivedBytes();
    downloadRecord.totalBytes = item.getTotalBytes() || downloadRecord.totalBytes;
    downloadRecord.state = state;
    notifyUpdate({ ...downloadRecord });
  });

  item.once('done', (doneEvent, state) => {
    activeDownloads.delete(downloadId);
    pendingRiskDownloads.delete(downloadId);
    downloadRecord.receivedBytes = item.getReceivedBytes();
    downloadRecord.totalBytes = item.getTotalBytes() || downloadRecord.receivedBytes;
    downloadRecord.state = state; // 'completed' | 'cancelled' | 'interrupted'
    downloadRecord.endTime = Date.now();

    // Privacidade: downloads iniciados em sessão privada NÃO são persistidos no histórico
    if (!isPrivate) {
      loadHistory();
      downloadsHistory.unshift({ ...downloadRecord });
      if (downloadsHistory.length > 200) {
        downloadsHistory.length = 200;
      }
      persistHistory();
    }

    notifyUpdate({ ...downloadRecord });
  });
}

/**
 * Registra o manipulador de downloads em uma sessão do Electron
 * @param {Electron.Session} ses
 * @param {boolean} [isPrivate=false]
 */
function registerSessionDownloads(ses, isPrivate = false) {
  if (!ses) return;

  ses.on('will-download', (event, item, webContents) => {
    const downloadId = crypto.randomUUID();
    const originalFilename = item.getFilename();
    const saveDirectory = app.getPath('downloads');
    const { savePath, finalFilename } = getNonConflictingPath(saveDirectory, originalFilename);

    const downloadRecord = {
      id: downloadId,
      filename: finalFilename,
      path: savePath,
      url: item.getURL(),
      totalBytes: item.getTotalBytes() || 0,
      receivedBytes: 0,
      state: 'progressing', // 'progressing' | 'completed' | 'cancelled' | 'interrupted'
      startTime: Date.now(),
      endTime: null,
      isPrivate: Boolean(isPrivate)
    };

    attachDownloadListeners(item, downloadRecord, downloadId, isPrivate);

    // ETAPA 4: Verificação de risco antes de definir savePath
    const isRisky = isRiskyDownload(originalFilename);
    if (isRisky) {
      item.pause();

      let originDomain = '';
      try {
        originDomain = new URL(item.getURL()).hostname;
      } catch {}

      pendingRiskDownloads.set(downloadId, {
        item,
        savePath,
        finalFilename,
        downloadRecord,
        isPrivate
      });

      console.warn(`[Downloads] Arquivo potencialmente perigoso detectado: ${originalFilename} (${originDomain}). Aguardando confirmação do usuário.`);

      if (typeof onDownloadRiskPromptCallback === 'function') {
        onDownloadRiskPromptCallback({
          downloadId,
          filename: finalFilename,
          domain: originDomain || 'Origem desconhecida'
        });
      }
      return;
    }

    // Extensões seguras continuam normalmente
    item.setSavePath(savePath);
    activeDownloads.set(downloadId, { item, record: downloadRecord, isPrivate: Boolean(isPrivate) });
    notifyUpdate({ ...downloadRecord });
  });
}

/**
 * Confirma e prossegue com o download pausado por risco
 * @param {string} downloadId
 * @returns {boolean}
 */
function confirmRiskDownload(downloadId) {
  const entry = pendingRiskDownloads.get(downloadId);
  if (!entry || !entry.item || entry.item.isDestroyed()) {
    pendingRiskDownloads.delete(downloadId);
    return false;
  }

  pendingRiskDownloads.delete(downloadId);
  entry.item.setSavePath(entry.savePath);
  activeDownloads.set(downloadId, {
    item: entry.item,
    record: entry.downloadRecord,
    isPrivate: entry.isPrivate
  });

  entry.item.resume();
  notifyUpdate({ ...entry.downloadRecord, state: 'progressing' });
  return true;
}

/**
 * Cancela e descarta o download pausado por risco
 * @param {string} downloadId
 * @returns {boolean}
 */
function cancelRiskDownload(downloadId) {
  const entry = pendingRiskDownloads.get(downloadId);
  if (!entry) return false;

  pendingRiskDownloads.delete(downloadId);
  if (entry.item && !entry.item.isDestroyed()) {
    entry.item.cancel();
  }
  notifyUpdate({ ...entry.downloadRecord, state: 'cancelled' });
  return true;
}

/**
 * Cancela um download ativo
 * @param {string} downloadId
 * @returns {boolean}
 */
function cancelDownload(downloadId) {
  const entry = activeDownloads.get(downloadId);
  if (entry && entry.item && !entry.item.isDestroyed()) {
    entry.item.cancel();
    activeDownloads.delete(downloadId);
    return true;
  }
  return false;
}

/**
 * Abre o arquivo baixado
 * @param {string} filePath
 */
function openFile(filePath) {
  if (filePath) {
    shell.openPath(filePath).catch(err => {
      console.warn('[Downloads] Falha ao abrir arquivo:', err.message);
    });
  }
}

/**
 * Exibe o arquivo na pasta de downloads do sistema operacional
 * @param {string} filePath
 */
function showInFolder(filePath) {
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
}

/**
 * Retorna todos os downloads (ativos em progresso no topo + histórico)
 * @returns {Array<object>}
 */
function getDownloads() {
  const activeList = [];
  for (const entry of activeDownloads.values()) {
    if (entry && entry.record) {
      activeList.push({ ...entry.record });
    }
  }
  loadHistory();
  return [...activeList, ...downloadsHistory];
}

/**
 * Limpa o histórico de downloads
 */
function clearHistory() {
  downloadsHistory = [];
  persistHistory();
}

module.exports = {
  registerSessionDownloads,
  setDownloadUpdateListener,
  setDownloadRiskListener,
  confirmRiskDownload,
  cancelRiskDownload,
  cancelDownload,
  openFile,
  showInFolder,
  getDownloads,
  clearHistory
};
