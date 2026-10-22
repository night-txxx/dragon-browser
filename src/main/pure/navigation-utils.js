// =============================================================================
// src/main/pure/navigation-utils.js
// Funções puras de normalização e validação de URLs sem dependência do Electron
// =============================================================================

/**
 * Aplica um termo de pesquisa ao template de URL do buscador com segurança.
 * Trata casos em que o template contenha %s, %25s ou seja uma URL base.
 * @param {string} template Template do buscador (ex: https://duckduckgo.com/?q=%s)
 * @param {string} query Termo pesquisado
 * @returns {string} URL completa de busca
 */
function applySearchTemplate(template, query) {
  const encoded = encodeURIComponent(query);
  const t = (typeof template === 'string' && template.trim()) ? template.trim() : 'https://duckduckgo.com/?q=%s';

  if (t.includes('%s')) {
    return t.replace('%s', encoded);
  }
  if (t.includes('%25s')) {
    return t.replace('%25s', encoded);
  }
  return `${t}${t.includes('?') ? '&q=' : '?q='}${encoded}`;
}

/**
 * Normaliza o texto digitado pelo usuário na barra de endereços
 * @param {string} rawInput Texto bruto digitado
 * @param {object} [options] Opções de configuração para busca e páginas internas
 * @returns {string} URL pronta para navegação
 */
function normalizeInput(rawInput, options = {}) {
  const text = (rawInput || '').trim();
  const defaultNewTab = options.newTabUrl || 'pages/newtab.html';
  const settingsUrl = options.settingsUrl || 'pages/settings.html';
  const downloadsUrl = options.downloadsUrl || 'pages/downloads.html';
  const historyUrl = options.historyUrl || 'pages/history.html';
  const bookmarksUrl = options.bookmarksUrl || 'pages/bookmarks.html';
  const searchTemplate = options.searchTemplate || 'https://duckduckgo.com/?q=%s';

  // 1. Entrada vazia -> abre a página de nova aba
  if (!text) {
    return defaultNewTab;
  }

  const lower = text.toLowerCase();

  // Atalhos amigáveis digitados na barra de endereços
  if (lower === 'dragon://settings' || lower === 'about:settings') {
    return settingsUrl;
  }
  if (lower === 'dragon://downloads' || lower === 'about:downloads') {
    return downloadsUrl;
  }
  if (lower === 'dragon://history' || lower === 'about:history') {
    return historyUrl;
  }
  if (lower === 'dragon://bookmarks' || lower === 'about:bookmarks') {
    return bookmarksUrl;
  }
  if (lower === 'dragon://newtab' || lower === 'about:newtab') {
    return defaultNewTab;
  }

  // 2. Protocolo já informado explicitamente
  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(text) || text.startsWith('about:') || text.startsWith('chrome:');
  if (hasProtocol) {
    try {
      new URL(text);
      return text;
    } catch {
      return applySearchTemplate(searchTemplate, text);
    }
  }

  // 3. Localhost (com ou sem porta e caminho) -> http://
  if (/^localhost(:\d+)?(\/.*)?$/i.test(text)) {
    return `http://${text}`;
  }

  // 4. Endereço IPv4 (ex: 127.0.0.1, 192.168.0.1:8080) -> http://
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d+)?(\/.*)?$/;
  if (ipv4Pattern.test(text)) {
    return `http://${text}`;
  }

  // 5. Se contiver espaços no meio, é busca
  if (/\s/.test(text)) {
    return applySearchTemplate(searchTemplate, text);
  }

  // 6. Verificação de padrão de domínio de internet (ex: site.com, blog.org.br/artigo)
  const domainPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?(\/.*)?$/;
  if (domainPattern.test(text)) {
    const candidate = `https://${text}`;
    try {
      new URL(candidate);
      return candidate;
    } catch {
      return applySearchTemplate(searchTemplate, text);
    }
  }

  // 7. Qualquer termo sem ponto (ex: "tempo", "noticias") -> busca
  return applySearchTemplate(searchTemplate, text);
}

module.exports = {
  applySearchTemplate,
  normalizeInput
};
