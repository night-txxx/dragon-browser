// =============================================================================
// pages/history.js
// Lógica da página interna de histórico do Dragon
// =============================================================================

const inputSearch = document.getElementById('input-search');
const btnClearAll = document.getElementById('btn-clear-all');
const historyContainer = document.getElementById('history-container');

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

async function loadHistory(query = '') {
  if (!window.historyAPI) return;

  try {
    const entries = await window.historyAPI.getEntries(query);
    renderEntries(entries);
  } catch (err) {
    console.error('[History] Erro ao carregar histórico:', err);
  }
}

function renderEntries(entries) {
  if (!historyContainer) return;

  if (!entries || entries.length === 0) {
    historyContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 16 16">
          <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.376.868a6.975 6.975 0 0 0-.757-.597l.5-.866c.348.202.68.431.996.685l-.739.778zM8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
        </svg>
        <p>Nenhum resultado encontrado</p>
      </div>
    `;
    return;
  }

  historyContainer.innerHTML = '';

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'history-item';

    const timeEl = document.createElement('span');
    timeEl.className = 'item-time';
    timeEl.textContent = formatTime(entry.timestamp);

    const infoEl = document.createElement('div');
    infoEl.className = 'item-info';

    const titleEl = document.createElement('span');
    titleEl.className = 'item-title';
    titleEl.textContent = entry.title || entry.url;

    const urlEl = document.createElement('span');
    urlEl.className = 'item-url';
    urlEl.textContent = entry.url;

    infoEl.appendChild(titleEl);
    infoEl.appendChild(urlEl);

    infoEl.addEventListener('click', () => {
      if (window.historyAPI) {
        window.historyAPI.openUrl(entry.url);
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.title = 'Remover do histórico';
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 16 16">
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
      </svg>
    `;

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.historyAPI) {
        await window.historyAPI.deleteEntry(entry.id);
        row.remove();
        if (historyContainer.children.length === 0) {
          renderEntries([]);
        }
      }
    });

    row.appendChild(timeEl);
    row.appendChild(infoEl);
    row.appendChild(deleteBtn);

    historyContainer.appendChild(row);
  });
}

if (inputSearch) {
  let searchTimer = null;
  inputSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadHistory(inputSearch.value.trim());
    }, 200);
  });
}

if (btnClearAll) {
  btnClearAll.addEventListener('click', async () => {
    if (confirm('Deseja limpar todo o histórico de navegação?')) {
      if (window.historyAPI) {
        await window.historyAPI.clearAll();
        renderEntries([]);
      }
    }
  });
}

loadHistory();
