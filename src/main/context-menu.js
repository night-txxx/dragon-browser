// =============================================================================
// src/main/context-menu.js
// Menu de contexto nativo nas páginas web (webContents 'context-menu')
// =============================================================================

const { Menu, clipboard } = require('electron');
const settings = require('./settings');

/**
 * Registra o manipulador de menu de contexto no WebContents da aba
 * @param {Electron.WebContents} contents
 * @param {object} context Objeto { mainWindow, tabManager, isPrivate }
 */
function attachContextMenu(contents, context) {
  if (!contents || contents.isDestroyed()) return;

  contents.on('context-menu', (event, params) => {
    event.preventDefault();

    const template = [];
    const { mainWindow, tabManager, isPrivate } = context;

    // 1. Se clicou sobre um link
    if (params.linkURL) {
      template.push(
        {
          label: 'Abrir link em nova aba',
          click: () => {
            if (tabManager) {
              tabManager.createTab(params.linkURL, { active: true, isPrivate: isPrivate });
            }
          }
        },
        {
          label: 'Copiar endereço do link',
          click: () => {
            clipboard.writeText(params.linkURL);
          }
        },
        { type: 'separator' }
      );
    }

    // 2. Se clicou sobre uma imagem
    if (params.mediaType === 'image' && params.srcURL) {
      template.push(
        {
          label: 'Salvar imagem como...',
          click: () => {
            contents.downloadURL(params.srcURL);
          }
        },
        {
          label: 'Copiar imagem',
          click: () => {
            contents.copyImageAt(params.x, params.y);
          }
        },
        {
          label: 'Copiar endereço da imagem',
          click: () => {
            clipboard.writeText(params.srcURL);
          }
        },
        { type: 'separator' }
      );
    }

    // 3. Se houver texto selecionado
    if (params.selectionText && params.selectionText.trim().length > 0) {
      template.push(
        {
          label: 'Copiar',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            contents.copy();
          }
        },
        {
          label: `Pesquisar "${params.selectionText.trim().slice(0, 25)}${params.selectionText.trim().length > 25 ? '...' : ''}"`,
          click: () => {
            if (tabManager) {
              const query = params.selectionText.trim();
              const searchUrl = settings.getSearchUrl(query);
              tabManager.createTab(searchUrl, { active: true, isPrivate: isPrivate });
            }
          }
        },
        { type: 'separator' }
      );
    }

    // 4. Se for campo editável (input/textarea)
    if (params.isEditable) {
      template.push(
        {
          label: 'Desfazer',
          role: 'undo'
        },
        {
          label: 'Refazer',
          role: 'redo'
        },
        { type: 'separator' },
        {
          label: 'Recortar',
          role: 'cut'
        },
        {
          label: 'Copiar',
          role: 'copy'
        },
        {
          label: 'Colar',
          role: 'paste'
        },
        { type: 'separator' }
      );
    }

    // 5. Ações gerais de navegação
    template.push(
      {
        label: 'Voltar',
        accelerator: 'Alt+Left',
        enabled: contents.navigationHistory && typeof contents.navigationHistory.canGoBack === 'function' ? contents.navigationHistory.canGoBack() : contents.canGoBack(),
        click: () => {
          if (contents.navigationHistory && typeof contents.navigationHistory.goBack === 'function') {
            contents.navigationHistory.goBack();
          } else {
            contents.goBack();
          }
        }
      },
      {
        label: 'Avançar',
        accelerator: 'Alt+Right',
        enabled: contents.navigationHistory && typeof contents.navigationHistory.canGoForward === 'function' ? contents.navigationHistory.canGoForward() : contents.canGoForward(),
        click: () => {
          if (contents.navigationHistory && typeof contents.navigationHistory.goForward === 'function') {
            contents.navigationHistory.goForward();
          } else {
            contents.goForward();
          }
        }
      },
      {
        label: 'Recarregar',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          contents.reload();
        }
      },
      { type: 'separator' },
      {
        label: 'Selecionar tudo',
        accelerator: 'CmdOrCtrl+A',
        click: () => {
          contents.selectAll();
        }
      },
      { type: 'separator' },
      {
        label: 'Inspecionar elemento',
        click: () => {
          contents.inspectElement(params.x, params.y);
          if (!contents.isDevToolsOpened()) {
            contents.openDevTools({ mode: 'detach' });
          }
        }
      }
    );

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: mainWindow });
  });
}

module.exports = {
  attachContextMenu
};
