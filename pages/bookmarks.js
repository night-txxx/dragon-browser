// =============================================================================
// pages/bookmarks.js
// Lógica da página interna de favoritos do Dragon
// =============================================================================

const inputSearch = document.getElementById('input-search');
const btnClearAll = document.getElementById('btn-clear-all');
const bookmarksContainer = document.getElementById('bookmarks-container');

async function loadBookmarks(query = '') {
  if (!window.bookmarksAPI) return;

  try {
    const items = await window.bookmarksAPI.getBookmarks(query);
    renderBookmarks(items);
  } catch (err) {
    console.error('[Bookmarks] Erro ao carregar favoritos:', err);
  }
}

function renderBookmarks(items) {
  if (!bookmarksContainer) return;

  if (!items || items.length === 0) {
    bookmarksContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 16 16">
          <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
        </svg>
        <p>Nenhum favorito encontrado</p>
      </div>
    `;
    return;
  }

  bookmarksContainer.innerHTML = '';

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'bookmark-item';

    const starSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    starSvg.setAttribute('viewBox', '0 0 16 16');
    starSvg.setAttribute('class', 'star-icon');
    starSvg.innerHTML = `
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
    `;

    const infoEl = document.createElement('div');
    infoEl.className = 'item-info';

    const titleEl = document.createElement('span');
    titleEl.className = 'item-title';
    titleEl.textContent = item.title || item.url;

    const urlEl = document.createElement('span');
    urlEl.className = 'item-url';
    urlEl.textContent = item.url;

    infoEl.appendChild(titleEl);
    infoEl.appendChild(urlEl);

    infoEl.addEventListener('click', () => {
      if (window.bookmarksAPI) {
        window.bookmarksAPI.openUrl(item.url);
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.title = 'Remover favorito';
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 16 16">
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
      </svg>
    `;

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.bookmarksAPI) {
        await window.bookmarksAPI.removeBookmark(item.id);
        row.remove();
        if (bookmarksContainer.children.length === 0) {
          renderBookmarks([]);
        }
      }
    });

    row.appendChild(starSvg);
    row.appendChild(infoEl);
    row.appendChild(deleteBtn);

    bookmarksContainer.appendChild(row);
  });
}

if (inputSearch) {
  let searchTimer = null;
  inputSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadBookmarks(inputSearch.value.trim());
    }, 200);
  });
}

if (btnClearAll) {
  btnClearAll.addEventListener('click', async () => {
    const confirmed = await window.dragonConfirm({
      title: 'Remover favoritos',
      message: 'Deseja remover todos os favoritos?',
      confirmText: 'Remover todos',
      cancelText: 'Cancelar',
      danger: true
    });
    if (!confirmed) return;

    if (window.bookmarksAPI) {
      await window.bookmarksAPI.clearAll();
      renderBookmarks([]);
    }
  });
}

loadBookmarks();
