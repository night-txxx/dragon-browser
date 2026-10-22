// =============================================================================
// pages/newtab.js
// Lógica da página inicial (Nova Aba) do Dragon
// Suporta personalização de fundo, tema, buscador e atalhos rápidos
// =============================================================================

// URL padrão de busca caso não haja configuração recebida
let currentSearchTemplate = 'https://duckduckgo.com/?q=%s';

/**
 * Aplica o conjunto de preferências recebido do processo principal
 * @param {object} settings Objeto com as preferências do usuário
 */
function applyDragonSettings(settings) {
  if (!settings || typeof settings !== 'object') return;

  const root = document.documentElement;

  // 1. Cor de destaque (accent color)
  if (settings.accentColor) {
    root.style.setProperty('--color-accent', settings.accentColor);
  }

  // 2. Tema claro / escuro / sistema
  if (settings.theme) {
    document.body.classList.remove('theme-light');
    if (settings.theme === 'light') {
      document.body.classList.add('theme-light');
    } else if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!prefersDark) {
        document.body.classList.add('theme-light');
      }
    }
  }

  // 3. Imagem de fundo, escurecimento e desfoque
  const bgLayer = document.getElementById('bg-image-layer');
  const dimLayer = document.getElementById('bg-dim-layer');

  if (settings.backgroundImageUrl) {
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url("${settings.backgroundImageUrl}")`;
      bgLayer.style.display = 'block';
    }
    if (dimLayer) dimLayer.style.display = 'block';
  } else {
    if (bgLayer) {
      bgLayer.style.backgroundImage = 'none';
      bgLayer.style.display = 'none';
    }
    if (dimLayer) dimLayer.style.display = 'none';
  }

  if (typeof settings.backgroundDim === 'number') {
    root.style.setProperty('--bg-dim-opacity', (settings.backgroundDim / 100).toString());
  }

  if (typeof settings.backgroundBlur === 'number') {
    root.style.setProperty('--bg-blur-amount', `${settings.backgroundBlur}px`);
  }

  // 4. Exibição do cartão de atalhos
  const shortcutsCard = document.getElementById('shortcuts-card');
  if (shortcutsCard) {
    shortcutsCard.style.display = settings.showShortcuts === false ? 'none' : 'block';
  }

  // 5. Mecanismo de busca e placeholder
  if (settings.searchUrlTemplate) {
    currentSearchTemplate = settings.searchUrlTemplate;
  }

  const engineName = settings.searchEngineName || 'DuckDuckGo';
  const subtitle = document.getElementById('subtitle-text');
  if (subtitle) {
    subtitle.textContent = `Navegação privada, rápida e segura com ${engineName}`;
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.placeholder = `Pesquisar no ${engineName} ou digitar endereço da web...`;
  }
}

// Expõe a função para ser invocada pelo TabManager via executeJavaScript em tempo real
window.__applyDragonSettings = applyDragonSettings;

// Leitura instantânea de configurações embutidas no hash da URL (#settings=...)
// Garante que a primeira renderização já ocorra com a cor, tema e fundo corretos sem flicker
try {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#settings=')) {
    const rawJson = decodeURIComponent(hash.slice('#settings='.length));
    const parsed = JSON.parse(rawJson);
    applyDragonSettings(parsed);
  }
} catch (err) {
  console.warn('[Nova Aba] Erro ao interpretar configurações iniciais do hash:', err);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;

      // 1. Se começar com protocolo explícito (http://, https://, etc.)
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(val)) {
        window.location.href = val;
        return;
      }

      // 2. Se for padrão de domínio com ponto (ex: github.com, uol.com.br)
      if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?(\/.*)?$/.test(val)) {
        window.location.href = 'https://' + val;
        return;
      }

      // 3. Caso contrário: termo de pesquisa usando o buscador configurado
      const targetUrl = currentSearchTemplate.includes('%s')
        ? currentSearchTemplate.replace('%s', encodeURIComponent(val))
        : (currentSearchTemplate.includes('%25s')
            ? currentSearchTemplate.replace('%25s', encodeURIComponent(val))
            : `${currentSearchTemplate}${currentSearchTemplate.includes('?') ? '&q=' : '?q='}${encodeURIComponent(val)}`);
      window.location.href = targetUrl;
    });
  }
});
