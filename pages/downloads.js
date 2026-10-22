// =============================================================================
// pages/downloads.js
// Lógica da página interna de downloads do Dragon
// =============================================================================

const btnClearAll = document.getElementById('btn-clear-all');
const downloadsContainer = document.getElementById('downloads-container');

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function loadDownloads() {
  if (!window.downloadsAPI) return;

  try {
    const list = await window.downloadsAPI.getDownloads();
    renderDownloads(list);
  } catch (err) {
    console.error('[Downloads] Erro ao carregar downloads:', err);
  }
}

function renderDownloads(list) {
  if (!downloadsContainer) return;

  if (!list || list.length === 0) {
    downloadsContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
        <p>Nenhum download recente</p>
      </div>
    `;
    return;
  }

  downloadsContainer.innerHTML = '';

  list.forEach(item => {
    const row = document.createElement('div');
    row.className = 'download-item';

    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('viewBox', '0 0 16 16');
    iconSvg.setAttribute('class', 'download-icon');
    iconSvg.innerHTML = `
      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
    `;

    const infoEl = document.createElement('div');
    infoEl.className = 'item-info';

    const filenameEl = document.createElement('span');
    filenameEl.className = 'item-filename';
    filenameEl.textContent = item.filename;
    filenameEl.title = item.path || item.filename;

    filenameEl.addEventListener('click', () => {
      if (item.state === 'completed' && window.downloadsAPI) {
        window.downloadsAPI.openFile(item.path);
      }
    });

    const metaEl = document.createElement('div');
    metaEl.className = 'item-meta';

    let statusText = 'Concluído';
    let statusClass = 'status-completed';
    let percent = 0;
    if (item.state === 'cancelled') {
      statusText = 'Cancelado';
      statusClass = 'status-cancelled';
    } else if (item.state === 'interrupted') {
      statusText = 'Interrompido';
      statusClass = 'status-cancelled';
    } else if (item.state === 'progressing') {
      percent = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0;
      statusText = percent > 0 ? `Baixando (${percent}%)...` : 'Baixando...';
      statusClass = 'status-progressing';
    }

    const sizeStr = item.state === 'progressing' && item.totalBytes > 0
      ? `${formatBytes(item.receivedBytes)} de ${formatBytes(item.totalBytes)}`
      : formatBytes(item.receivedBytes || item.totalBytes);

    metaEl.innerHTML = `
      <span class="${statusClass}">${statusText}</span>
      <span>${sizeStr}</span>
      <span>${formatDate(item.startTime)}</span>
    `;

    infoEl.appendChild(filenameEl);
    infoEl.appendChild(metaEl);

    if (item.state === 'progressing') {
      const progressWrap = document.createElement('div');
      progressWrap.className = 'download-progress-wrap';
      const progressBar = document.createElement('div');
      progressBar.className = 'download-progress-bar';
      progressBar.style.width = `${percent}%`;
      progressWrap.appendChild(progressBar);
      infoEl.appendChild(progressWrap);
    }

    const actionsEl = document.createElement('div');
    actionsEl.className = 'download-actions';

    if (item.state === 'completed') {
      const btnFolder = document.createElement('button');
      btnFolder.className = 'btn-action';
      btnFolder.textContent = 'Mostrar na pasta';
      btnFolder.addEventListener('click', () => {
        if (window.downloadsAPI) {
          window.downloadsAPI.showInFolder(item.path);
        }
      });
      actionsEl.appendChild(btnFolder);
    } else if (item.state === 'progressing') {
      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn-action';
      btnCancel.textContent = 'Cancelar';
      btnCancel.addEventListener('click', async () => {
        if (window.downloadsAPI) {
          await window.downloadsAPI.cancelDownload(item.id);
          loadDownloads();
        }
      });
      actionsEl.appendChild(btnCancel);
    }

    row.appendChild(iconSvg);
    row.appendChild(infoEl);
    row.appendChild(actionsEl);

    downloadsContainer.appendChild(row);
  });
}

if (btnClearAll) {
  btnClearAll.addEventListener('click', async () => {
    if (confirm('Deseja limpar a lista de downloads? Os arquivos no seu disco não serão apagados.')) {
      if (window.downloadsAPI) {
        await window.downloadsAPI.clearHistory();
        renderDownloads([]);
      }
    }
  });
}

if (window.downloadsAPI && typeof window.downloadsAPI.onDownloadUpdate === 'function') {
  window.downloadsAPI.onDownloadUpdate(() => {
    loadDownloads();
  });
}

loadDownloads();
