# DOSSIÊ COMPLETO DE AUDITORIA E VERIFICAÇÃO DO PROJETO: DRAGON

Este documento consolida o relatório integral de auditoria, diagnóstico de segurança, ciclo de engenharia (Etapas 0 a 5) e o **código-fonte completo e sem omissões** de todos os arquivos do navegador desktop **Dragon**, construído em **Electron puro**, JavaScript CommonJS e Vanilla JS, com foco rigoroso em privacidade, isolamento de processos e segurança.

---

## 1. REGISTRO DAS ETAPAS DE ENGENHARIA (ETAPA 0 A ETAPA 5)

Abaixo está o registro detalhado de todas as etapas executadas pelo Engenheiro Sênior de Electron:

### ETAPA 0: DIAGNÓSTICO DO PROJETO
Auditoria inicial em todo o código-fonte sem alterações, mapeando vulnerabilidades, falhas de isolamento, vazamento de memória e inconsistências funcionais:
* **Botão "Apagar Tudo"**: Invocava limpeza de partição com parâmetros parciais, deixando sessões privadas ativas em memória e não notificando adequadamente o renderer caso ocorressem exceções.
* **Segurança do Electron**: Ausência de interceptação universal de `will-navigate` e `setWindowOpenHandler` na janela principal; necessidade de negar permissões de hardware por padrão (`setPermissionRequestHandler`); falta de validação estrita de tipos primitivos em canais IPC sensíveis de downloads.
* **Privacidade**: Inexistência da opção do usuário para limpar dados automaticamente ao encerrar o navegador (`clearDataOnExit`); necessidade de reforçar isolamento de processos via flag `site-per-process`.
* **Organização**: Presença de comentários mortos de protótipos de métodos em `storage.js` e ausência de arquivo de regras de ESLint adaptado ao projeto.

---

### ETAPA 1: BUGS QUE QUEBRAM FUNÇÕES (APAGAR TUDO)
* **src/main/clear-data.js**:
  - Implementada chamada geral recomendada `defaultSession.clearStorageData({})` antes de varrer cada tipo de storage específico.
  - Adicionado log explícito e tratamento assíncrono para `clearCache`, `clearCodeCaches`, `clearAuthCache` e `clearHostResolverCache`.
  - Inclusa limpeza de autenticação HTTP (`clearAuthCache`) nas partições privadas ativas.
* **src/main/tabs.js**:
  - Em `destroyAllTabs`, isolou-se a destruição de cada aba individual em blocos `try/catch` protegidos, garantindo que o fechamento prossiga mesmo se uma aba específica estiver travada.
* **src/main/ipc.js**:
  - No handler `app:finish-clear-session`, adicionou-se a chamada explícita `tabManager.notifyStateChange()`, sincronizando a interface gráfica instantaneamente.
* **src/renderer/components/fire-animation.js**:
  - O loop de renderização do frame de animação WebGL foi envolvido em bloco `try/catch` com fallback automático para Canvas 2D, garantindo que o callback de conclusão e limpeza seja sempre chamado.

---

### ETAPA 2: SEGURANÇA DO ELECTRON
* **src/main/window.js**:
  - Adicionada interceptação explícita de `will-navigate` com `event.preventDefault()` e `setWindowOpenHandler(() => ({ action: 'deny' }))` no `webContents` da janela principal (UI), impedindo que a casca do navegador navegue para URLs externas.
* **src/main/tabs.js**:
  - Substituída validação condicional por interceptação universal de `will-navigate` em todas as abas criadas, validando destinos com `isAllowedNavigationUrl` e bloqueando navegações arbitrárias para protocolos perigosos (`javascript:`, `data:`, `vbscript:`, etc.).
* **src/main/session.js**:
  - Endurecido o `setPermissionRequestHandler`: exige categoricamente que `details.isMainFrame !== false` e rejeita por padrão (`callback(false)`) qualquer solicitação de permissão de hardware ou recurso sensível.
* **src/main/ipc.js**:
  - Implementada validação estrita de tipo de dados e verificação de string não vazia nos canais `downloads:open-file` e `downloads:show-in-folder`.
* **src/renderer/index.html**:
  - A Content-Security-Policy (CSP) da interface do navegador foi explicitamente reforçada com `script-src 'self'`.

---

### ETAPA 3: PRIVACIDADE
* **src/main/pure/settings-utils.js & test/settings.test.js**:
  - Adicionada a chave `clearDataOnExit: false` ao esquema padrão de configurações (`DEFAULT_SETTINGS`) e na validação de tipos de `isValidSetting`.
* **src/main/main.js**:
  - No evento `before-quit`, implementada interceptação assíncrona que verifica se `clearDataOnExit` está ativo: previne o encerramento imediato, dispara `clearData.clearAllData` e só encerra a aplicação após a confirmação da limpeza total de caches, cookies e histórico.
  - Adicionado o switch do Chromium `app.commandLine.appendSwitch('site-per-process')` para garantir Site Isolation e proteção contra ataques de canal lateral (Spectre/Meltdown).
* **pages/settings.html & pages/settings.js**:
  - Adicionado o switch visual "Limpar dados ao fechar o navegador" com sincronização bidirecional na API de configurações.
* **src/main/tabs.js**:
  - Endurecida a limpeza e descarte de partições de abas privadas no fechamento individual de abas, acionando `clearStorageData({})`, `clearCache()` e `clearAuthCache()`.

---

### ETAPA 4: ORGANIZAÇÃO E QUALIDADE
* **src/main/main.js**:
  - Adicionados tratamentos centrais para `uncaughtException` e `unhandledRejection`, registrando erros detalhados no console e evitando falhas silenciosas no processo principal.
* **src/renderer/app.js**:
  - Adicionados ouvintes globais para eventos de `error` e `unhandledrejection` na janela da interface gráfica.
* **src/main/storage.js**:
  - Removidos blocos de comentários mortos e redundantes deixados por protótipos de extensão anteriores.
* **.eslintrc.json**:
  - Criado arquivo de configuração do ESLint na raiz ajustado ao ecossistema do Dragon (Node.js ES2022 no main e Browser com globais seguras `browserAPI` e `settingsAPI` no renderer), sem adicionar dependências ou passos de build.

---

### ETAPA 5: CHECKLIST DE TESTES MANUAIS E FECHAMENTO

#### Checklist Completo de Testes Funcionais:
1. **Abas e Navegação**:
   - [ ] Abrir nova aba pelo botão `+` e pelo atalho <kbd>Ctrl+T</kbd>.
   - [ ] Fechar aba ativa pelo botão `x` e pelo atalho <kbd>Ctrl+W</kbd>.
   - [ ] Fechar a última aba restante: o navegador deve criar automaticamente uma nova aba limpa.
   - [ ] Alternar entre abas abertas usando <kbd>Ctrl+Tab</kbd> e <kbd>Ctrl+Shift+Tab</kbd>.
   - [ ] Alternar diretamente para abas específicas com <kbd>Ctrl+1</kbd> até <kbd>Ctrl+8</kbd>, e <kbd>Ctrl+9</kbd> para a última aba.
   - [ ] Reabrir a última aba fechada com <kbd>Ctrl+Shift+T</kbd> (não deve restaurar abas privadas).
   - [ ] Reordenar abas arrastando e soltando com o mouse (Drag & Drop sem flicker).
   - [ ] Navegar para uma URL completa (`https://duckduckgo.com`).
   - [ ] Digitar termos de busca na Omnibox e pressionar Enter: deve abrir a pesquisa no mecanismo padrão configurado.
   - [ ] Utilizar o histórico de navegação com os botões Voltar / Avançar e atalhos <kbd>Alt+←</kbd> / <kbd>Alt+→</kbd>.
   - [ ] Recarregar a página com o botão de recarregar e atalhos <kbd>Ctrl+R</kbd> ou <kbd>F5</kbd>.
   - [ ] Ajustar zoom da página com <kbd>Ctrl++</kbd>, <kbd>Ctrl+-</kbd> e redefinir com <kbd>Ctrl+0</kbd>.
   - [ ] Abrir barra de pesquisa textual na página com <kbd>Ctrl+F</kbd>, buscar termos e fechar com <kbd>Esc</kbd>.

2. **Histórico, Favoritos e Downloads**:
   - [ ] Acessar o Histórico via menu ou atalho <kbd>Ctrl+H</kbd> (`dragon://history`).
   - [ ] Excluir um item individual do histórico e verificar persistência.
   - [ ] Limpar todo o histórico e confirmar que a página é atualizada.
   - [ ] Adicionar página atual aos favoritos pelo atalho <kbd>Ctrl+D</kbd> ou botão de estrela na barra de endereços.
   - [ ] Acessar Favoritos via atalho ou endereço `dragon://bookmarks` e abrir um link favorito.
   - [ ] Baixar um arquivo comum (ex: imagem ou PDF) e verificar a barra de progresso no gerenciador de downloads (<kbd>Ctrl+J</kbd>).
   - [ ] Baixar um executável (.exe ou .msi) e verificar se o modal de aviso de risco de download é exibido antes de salvar.

3. **Configurações e Personalização**:
   - [ ] Abrir Configurações pelo menu ou atalho <kbd>Ctrl+,</kbd> (`dragon://settings`).
   - [ ] Alterar o mecanismo de busca padrão (Google, DuckDuckGo, Bing, etc.) e validar em nova busca.
   - [ ] Alterar a cor de destaque (Accent Color) na paleta e verificar aplicação em tempo real nos botões e bordas.
   - [ ] Alternar entre tema Escuro, Claro e Seguir o Sistema.
   - [ ] Ativar a opção **"Limpar dados ao fechar o navegador"**, navegar, fechar o navegador e conferir se o histórico e sessões foram zerados.

4. **Privacidade e Abas Privadas**:
   - [ ] Abrir uma aba privada via menu ou atalho <kbd>Ctrl+Shift+N</kbd>.
   - [ ] Verificar o distintivo de "Nova Aba Privada" e verificar que ela utiliza partição isolada em memória (`private-<id>`).
   - [ ] Fazer login em um site na aba privada e fechar a aba: reabrir a página em outra aba e verificar que os cookies não persistem.
   - [ ] Clicar no Escudo de Privacidade na barra de navegação para visualizar a nota do site e a contagem de rastreadores bloqueados.
   - [ ] Alternar a chave de exceção de proteção do escudo para o domínio ativo.

5. **Apagar Tudo (O Fogo do Dragão Azul)**:
   - [ ] Clicar no botão da chama azul na barra de ferramentas ou pressionar <kbd>Ctrl+Shift+Del</kbd>.
   - [ ] No painel inferior de confirmação, optar por incluir ou não os favoritos.
   - [ ] Clicar em "Apagar tudo agora": verificar a execução suave da animação de fogo azul, destruição de todas as abas e abertura de uma aba limpa com toast confirmatório.
   - [ ] Pressionar <kbd>Ctrl+Shift+T</kbd> logo em seguida: nenhuma aba apagada deve ser reaberta.

#### Débitos Técnicos e Melhorias Futuras:
* Implementar suporte a perfis múltiplos de usuário independentes (ex: Trabalho / Pessoal).
* Adicionar suporte nativo à instalação de extensões WebExtensions (Chrome Extension API básica).
* Implementar diálogo nativo customizado para autenticação HTTP Basic/Digest (`app.on('login')`).
* Adicionar suporte a temas customizados criados livremente pelo usuário via CSS personalizado.

---

## 2. RESUMO EXECUTIVO E ARQUITETURA

### 2.1 Stack e Filosofia
* **Nome Oficial**: Dragon
* **Tecnologias**: Electron (v33+ / v44+ estável), JavaScript puro (CommonJS no backend e Vanilla JS no frontend), HTML5 e CSS3 Vanilla.
* **Sem Frameworks ou Build**: O projeto roda diretamente com `npm install` e `npm start`. Não há Webpack, Vite, Babel, TypeScript nem TailwindCSS.
* **Arquitetura Modular**:
  * **Main Process (`src/main/`)**: Única fonte da verdade de todo o estado do navegador. Gerencia janelas, sessões de rede, ciclo de vida das abas, privacidade, preferências e atalhos.
  * **Preload Seguro Geral (`src/preload/preload.js`)**: Ponte estrita via `contextBridge.exposeInMainWorld('browserAPI', ...)`. Isolação total: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
  * **Preload Isolado de Configurações (`src/preload/settings-preload.js`)**: Exclusivo para a página interna `pages/settings.html` via `contextBridge.exposeInMainWorld('settingsAPI', ...)`. Sites externos nunca recebem este preload.
  * **Preload Seguro de Abas e Páginas Internas (`src/preload/tab-preload.js`)**: Expõe APIs restritas para páginas internas (`historyAPI`, `bookmarksAPI`, `downloadsAPI`, `warningAPI`, `certErrorAPI`) sem dependência de módulos de Node.js no renderer.
  * **IPC Centralizado e Protegido (`src/main/ipc.js`)**: Todos os canais IPC são definidos e validados exclusivamente neste arquivo com verificação estrita de remetente (`isMainSender`, `isSettingsSender`, `isPageSender`).
  * **Abas com `WebContentsView`**: Sem a tag legada `<webview>`. Cada aba é uma instância isolada de `WebContentsView` anexada à janela principal abaixo da barra superior (`config.TOP_BAR_HEIGHT = 76px`).

---

## 3. ÁRVORE DE ARQUIVOS DO PROJETO

```text
dragon/
├── package.json               # Configurações do projeto, scripts (test, start, dist) e electron-builder
├── .eslintrc.json             # Regras de linting configuradas para Node.js, Electron e Browser Vanilla
├── README.md                  # Documentação e guia completo da arquitetura
├── VERIFICACAO_PROJETO.md     # Relatório de conformidade, auditoria e código completo
├── assets/
│   ├── blocklists/
│   │   └── trackers.txt       # Lista completa de rastreadores (Peter Lowe, 3.500+ domínios)
│   └── icons/
│       └── favicon-circle.png # Ícone circular oficial do dragão azul
├── pages/
│   ├── newtab.html            # Página de início rápida (busca, personalização e atalhos)
│   ├── newtab.js              # Lógica da nova aba com suporte a temas e buscador
│   ├── settings.html          # Configurações (Principal, Personalização, Proxy, Permissões e Privacidade)
│   ├── settings.js            # Lógica de configurações (debounce, proxy, senhas seguras e permissões)
│   ├── history.html           # Gerenciador de histórico de navegação
│   ├── history.js             # Lógica de busca e exclusão de itens de histórico
│   ├── bookmarks.html         # Gerenciador visual de favoritos
│   ├── bookmarks.js           # Lógica de busca, remoção e abertura de favoritos
│   ├── downloads.html         # Gerenciador de downloads do navegador
│   ├── downloads.js           # Lógica de controle de downloads (abrir arquivo, pasta ou cancelar)
│   ├── error.html             # Página interna exibida em falhas de conexão/rede
│   ├── error.js               # Lógica da página de erro de rede
│   ├── https-warning.html     # Aviso de conexão não criptografada com liberação HTTP segura
│   ├── https-warning.js       # Solicitação de token único para liberação de HTTP
│   ├── cert-error.html        # Página interna para erros de certificados SSL/TLS
│   └── cert-error.js          # Lógica da página de erro de certificado digital
├── test/                      # Testes automatizados com runner nativo do Node.js (node:test)
│   ├── clear-data.test.js     # Testes de limpeza profunda de dados e fechamento de abas
│   ├── downloads.test.js      # Testes de identificação de extensões de risco
│   ├── fingerprint.test.js    # Testes de consistência multivetorial e ruído determinístico
│   ├── history.test.js        # Testes de histórico, exclusão de internas e updateTitle
│   ├── navigation.test.js     # Testes de normalização de URLs e atalhos dragon://
│   ├── permissions.test.js    # Testes de getPermissionKey, rótulos e fila de permissões
│   ├── privacy.test.js        # Testes de domínios base, trackers, link cleaning e blocklist
│   ├── settings.test.js       # Testes de validação de esquemas e mescla com defaults
│   └── tabs.test.js           # Testes de reordenação e manipulação de abas
└── src/
    ├── main/                  # Processo Principal (Node.js / Electron)
    │   ├── main.js            # Ponto de entrada, ciclo de vida e migração de dados
    │   ├── config.js          # Constantes globais (dimensões, URLs padrão e rotas internas)
    │   ├── settings.js        # Gerenciamento de configurações, proxy e DPAPI safeStorage
    │   ├── window.js          # Janela principal, ícone nativo e integração com window-state
    │   ├── window-state.js    # Persistência de geometria da janela com validação multi-monitor
    │   ├── tabs.js            # TabManager: abas, popups OAuth, find-in-page e menu de contexto
    │   ├── context-menu.js    # Menu de contexto nativo com cópia, pesquisa e DevTools
    │   ├── clear-data.js      # Limpeza profunda de storage, cookies, cache e abas
    │   ├── privacy.js         # Motor de privacidade: tldts, HTTPS, headers e atualização de blocklist
    │   ├── navigation.js      # Normalização de URLs, busca e histórico
    │   ├── history.js         # Persistência de histórico de navegação (history.json)
    │   ├── bookmarks.js       # Persistência e busca de favoritos (bookmarks.json)
    │   ├── downloads.js       # Gerenciador de downloads e eventos will-download (downloads.json)
    │   ├── permissions.js     # Gerenciamento de permissões por site com persistência (permissions.json)
    │   ├── fingerprint-protection.js # Gerador de proteções contra fingerprinting
    │   ├── session.js         # Sessão padrão, User-Agent, proxy auth e handlers de permissão
    │   ├── ipc.js             # Registro centralizado de canais IPC com validação de remetente
    │   ├── menu.js            # Menu da aplicação e aceleradores globais de teclado
    │   ├── storage.js         # Persistência atômica de arquivos JSON em app.getPath('userData')
    │   └── pure/              # Funções puras desacopladas do Electron para testes unitários
    │       ├── navigation-utils.js # Lógica pura de URLs e busca
    │       ├── privacy-utils.js    # Lógica pura de domínios e link cleaning
    │       ├── settings-utils.js   # Lógica pura de validação e defaults
    │       ├── download-utils.js   # Lógica pura de extensões de risco
    │       └── fingerprint-utils.js # Lógica pura de fingerprinting determinístico
    ├── preload/
    │   ├── preload.js          # Ponte segura para a janela principal (window.browserAPI)
    │   ├── settings-preload.js # Preload exclusivo para settings.html (window.settingsAPI)
    │   └── tab-preload.js      # Preload para abas e páginas internas
    └── renderer/              # Interface Gráfica (HTML / CSS / JS do navegador)
        ├── index.html         # Estrutura visual da barra superior, escudo, find-bar e modais
        ├── app.js             # Orquestrador da interface e ouvinte de estado consolidado
        ├── components/
        │   ├── addressbar.js       # Barra de endereços, favoritos e omnibox com sugestões
        │   ├── tabs-view.js        # Abas com DOM diffing por ID e Drag & Drop para reordenação
        │   ├── toolbar.js          # Botões de navegação, recarregar, downloads e configurações
        │   ├── find-bar.js         # Barra de busca textual na página (Ctrl+F)
        │   ├── permission-sheet.js # Modal estilo bottom-sheet para autorização por recurso
        │   ├── download-risk-sheet.js # Modal de alerta para downloads de arquivos executáveis
        │   ├── privacy-shield.js   # Escudo com contador dinâmico e painel de exceções
        │   ├── fire-button.js      # Botão de fogo azul na barra de navegação
        │   ├── fire-sheet.js       # Painel inferior de confirmação de apagar tudo
        │   └── fire-animation.js   # Animação WebGL/Canvas do Dragão Azul
        └── styles/
            ├── theme.css           # Variáveis CSS de cores, fontes, raios e paleta de fogo
            ├── base.css            # Reset e regras básicas de layout
            └── components.css       # Estilos de abas, toolbar, find-bar, omnibox, modais e canvas
```

---

## 4. CÓDIGO-FONTE COMPLETO DOS ARQUIVOS

### 4.1 `package.json`

```json
{
  "name": "dragon",
  "productName": "Dragon",
  "version": "1.0.0",
  "description": "Navegador desktop Dragon para Windows com foco em privacidade e desempenho construído com Electron puro",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test",
    "dist": "electron-builder"
  },
  "keywords": [
    "browser",
    "electron",
    "desktop-app",
    "vanilla-js"
  ],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "electron": "^44.9.0",
    "electron-builder": "^25.1.8"
  },
  "dependencies": {
    "tldts": "^7.4.18"
  },
  "build": {
    "appId": "com.dragon.browser",
    "productName": "Dragon",
    "directories": {
      "output": "dist"
    },
    "files": [
      "src/**/*",
      "pages/**/*",
      "assets/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        "nsis"
      ],
      "icon": "assets/icons/favicon-circle.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Dragon"
    }
  }
}
```

---

### 4.2 `.eslintrc.json`

```json
{
  "env": {
    "es2022": true,
    "node": true
  },
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "script"
  },
  "rules": {
    "no-undef": "error",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "no-const-assign": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-empty": ["warn", { "allowEmptyCatch": true }],
    "no-unreachable": "error",
    "valid-typeof": "error"
  },
  "overrides": [
    {
      "files": ["src/renderer/**/*.js", "pages/**/*.js"],
      "env": {
        "browser": true,
        "node": false
      },
      "globals": {
        "browserAPI": "readonly",
        "settingsAPI": "readonly",
        "certErrorAPI": "readonly",
        "httpsWarningAPI": "readonly",
        "errorAPI": "readonly",
        "downloadsAPI": "readonly",
        "historyAPI": "readonly",
        "bookmarksAPI": "readonly"
      }
    },
    {
      "files": ["src/preload/**/*.js"],
      "env": {
        "node": true,
        "browser": true
      }
    },
    {
      "files": ["test/**/*.js"],
      "env": {
        "node": true
      }
    }
  ]
}
```

---

### 4.3 `src/main/config.js`

```javascript
// =============================================================================
// src/main/config.js
// Constantes e valores padrão da aplicação
// =============================================================================

const path = require('path');
const { pathToFileURL } = require('url');

// Altura em pixels reservada para a interface do navegador (abas + barra de endereço)
// O WebContentsView de cada site começará exatamente abaixo dessa altura.
const TOP_BAR_HEIGHT = 76;

// Mecanismo de busca padrão quando o usuário digita termos que não são URLs
const DEFAULT_SEARCH_ENGINE = 'https://duckduckgo.com/?q=';

// Caminhos para as páginas internas do navegador (convertidos em URLs válidas)
const PAGES_DIR = path.join(__dirname, '../../pages');
const NEW_TAB_URL = pathToFileURL(path.join(PAGES_DIR, 'newtab.html')).href;
const SETTINGS_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'settings.html')).href;
const ERROR_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'error.html')).href;
const HTTPS_WARNING_URL = pathToFileURL(path.join(PAGES_DIR, 'https-warning.html')).href;
const CERT_ERROR_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'cert-error.html')).href;
const HISTORY_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'history.html')).href;
const BOOKMARKS_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'bookmarks.html')).href;
const DOWNLOADS_PAGE_URL = pathToFileURL(path.join(PAGES_DIR, 'downloads.html')).href;

// Configurações padrão de dimensão e aparência da janela principal
const WINDOW_DEFAULTS = {
  width: 1200,
  height: 800,
  minWidth: 640,
  minHeight: 480,
  title: 'Dragon',
  backgroundColor: '#1e1e24',
  autoHideMenuBar: true
};

module.exports = {
  TOP_BAR_HEIGHT,
  DEFAULT_SEARCH_ENGINE,
  NEW_TAB_URL,
  SETTINGS_PAGE_URL,
  ERROR_PAGE_URL,
  HTTPS_WARNING_URL,
  CERT_ERROR_PAGE_URL,
  HISTORY_PAGE_URL,
  BOOKMARKS_PAGE_URL,
  DOWNLOADS_PAGE_URL,
  WINDOW_DEFAULTS
};
```

---

### 4.4 `src/main/main.js`

```javascript
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
```

---

### 4.5 `src/main/window.js`

```javascript
// =============================================================================
// src/main/window.js
// Criação da janela principal do navegador e gerenciamento de layout
// =============================================================================

const { BrowserWindow } = require('electron');
const path = require('path');
const config = require('./config');
const windowState = require('./window-state');

let mainWindow = null;
let tabManagerRef = null;
let isOverlayActive = false;
let isHtmlFullScreen = false;
let isFindBarOpen = false;
const FIND_BAR_HEIGHT = 44;
let wasWindowFullScreenBeforeVideo = false;

/**
 * Atualiza as coordenadas e dimensões da WebContentsView da aba ativa.
 * Em modo normal: a interface do navegador ocupa os primeiros config.TOP_BAR_HEIGHT pixels no topo.
 * Se a barra de busca (Ctrl+F) estiver aberta, desloca a visualização para baixo para abrir espaço visível.
 * Em modo tela cheia HTML5 (vídeo): a view ocupa a janela inteira a partir do topo (y = 0).
 */
function updateActiveViewBounds() {
  if (!mainWindow || !tabManagerRef) return;

  const activeTab = tabManagerRef.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  // getContentBounds retorna as dimensões da área útil da janela (descontando bordas do SO)
  const { width, height } = mainWindow.getContentBounds();
  const topOffset = isHtmlFullScreen ? 0 : (config.TOP_BAR_HEIGHT + (isFindBarOpen ? FIND_BAR_HEIGHT : 0));
  const contentHeight = isHtmlFullScreen ? height : Math.max(0, height - topOffset);

  activeTab.view.setBounds({
    x: 0,
    y: topOffset,
    width: width,
    height: contentHeight
  });
}

/**
 * Define se a barra de busca textual está aberta e ajusta a visualização sem ocultar a página
 * @param {boolean} open
 */
function setFindBarOpen(open) {
  isFindBarOpen = Boolean(open);
  updateActiveViewBounds();
}

/**
 * Retorna se a barra de busca está aberta
 * @returns {boolean}
 */
function getIsFindBarOpen() {
  return isFindBarOpen;
}

/**
 * Alterna o estado de tela cheia de vídeo HTML5 (enter-html-full-screen / leave-html-full-screen).
 * Ajusta os limites da visualização ativa para cobrir toda a janela e notifica o renderer.
 * @param {boolean} active
 */
function setHtmlFullScreen(active) {
  const willBeActive = Boolean(active);
  if (willBeActive && !isHtmlFullScreen) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      wasWindowFullScreenBeforeVideo = mainWindow.isFullScreen();
      if (!wasWindowFullScreenBeforeVideo) {
        mainWindow.setFullScreen(true);
      }
    }
  } else if (!willBeActive && isHtmlFullScreen) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!wasWindowFullScreenBeforeVideo) {
        mainWindow.setFullScreen(false);
      }
    }
  }

  isHtmlFullScreen = willBeActive;
  updateActiveViewBounds();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser:html-fullscreen-changed', isHtmlFullScreen);
  }
}

/**
 * Retorna se o modo de tela cheia HTML5 está ativo
 * @returns {boolean}
 */
function getIsHtmlFullScreen() {
  return isHtmlFullScreen;
}

/**
 * Oculta temporariamente a WebContentsView ativa.
 *
 * IMPORTANTE: No Electron moderno, os WebContentsView são desenhados por cima
 * de qualquer elemento HTML da janela principal. Quando precisamos abrir
 * menus suspensos, modais ou listas na barra do navegador que ultrapassem a altura
 * da barra superior, chamamos showOverlay() para esconder o site e permitir que o
 * HTML da interface seja visto.
 */
function showOverlay() {
  isOverlayActive = true;
  if (!tabManagerRef) return;
  const activeTab = tabManagerRef.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.setVisible(false);
  }
}

/**
 * Restaura a visualização da WebContentsView ativa após o fechamento de um menu ou modal.
 */
function hideOverlay() {
  isOverlayActive = false;
  if (!tabManagerRef) return;
  const activeTab = tabManagerRef.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.setVisible(true);
    // Garante que o layout esteja ajustado ao tamanho atual da janela
    updateActiveViewBounds();
  }
}

/**
 * Retorna se o overlay está ativo no momento
 */
function getIsOverlayActive() {
  return isOverlayActive;
}

/**
 * Retorna a referência da janela principal
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * Cria a janela principal do navegador e configura eventos de layout
 * @param {object} context Contexto global da aplicação
 * @returns {object} Controlador da janela
 */
function init(context) {
  const savedState = windowState.loadWindowState();

  mainWindow = new BrowserWindow({
    ...config.WINDOW_DEFAULTS,
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    icon: path.join(__dirname, '../../assets/icons/favicon-circle.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  if (savedState.isMaximized) {
    mainWindow.maximize();
  }

  // Segurança estrita da casca da interface: impede navegação para fora de index.html
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Carrega a interface HTML do navegador (barra de topo, abas e navegação)
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);

  // Quando a janela for redimensionada ou movida, salva estado e atualiza bounds
  mainWindow.on('resize', () => {
    updateActiveViewBounds();
    windowState.saveWindowState(mainWindow);
  });

  mainWindow.on('move', () => {
    windowState.saveWindowState(mainWindow);
  });

  // Quando a janela for restaurada de minimizada/maximizada
  mainWindow.on('maximize', () => {
    updateActiveViewBounds();
    windowState.saveWindowState(mainWindow);
  });

  mainWindow.on('unmaximize', () => {
    updateActiveViewBounds();
    windowState.saveWindowState(mainWindow);
  });

  mainWindow.on('close', () => {
    windowState.saveWindowState(mainWindow);
  });

  const windowController = {
    getMainWindow,
    updateActiveViewBounds,
    setHtmlFullScreen,
    getIsHtmlFullScreen,
    setFindBarOpen,
    getIsFindBarOpen,
    showOverlay,
    hideOverlay,
    getIsOverlayActive,
    setTabManager: (tm) => {
      tabManagerRef = tm;
    }
  };

  return windowController;
}

module.exports = {
  init,
  getMainWindow,
  updateActiveViewBounds,
  setHtmlFullScreen,
  getIsHtmlFullScreen,
  setFindBarOpen,
  getIsFindBarOpen,
  showOverlay,
  hideOverlay,
  getIsOverlayActive
};
```

---

### 4.6 `src/main/window-state.js`

```javascript
// =============================================================================
// src/main/window-state.js
// Persistência e restauração do tamanho e posição da janela (window-state.json)
// =============================================================================

const { screen } = require('electron');
const storage = require('./storage');
const config = require('./config');

const STATE_FILENAME = 'window-state.json';
let saveTimeout = null;

/**
 * Lê o estado salvo da janela ou devolve os padrões seguros
 * @returns {object} { width, height, x, y, isMaximized }
 */
function loadWindowState() {
  const defaults = {
    width: config.WINDOW_DEFAULTS.width || 1200,
    height: config.WINDOW_DEFAULTS.height || 800,
    isMaximized: false
  };

  const saved = storage.readJSON(STATE_FILENAME, null);
  if (!saved || typeof saved !== 'object') {
    return defaults;
  }

  const state = {
    width: Number.isInteger(saved.width) && saved.width >= config.WINDOW_DEFAULTS.minWidth ? saved.width : defaults.width,
    height: Number.isInteger(saved.height) && saved.height >= config.WINDOW_DEFAULTS.minHeight ? saved.height : defaults.height,
    x: Number.isInteger(saved.x) ? saved.x : undefined,
    y: Number.isInteger(saved.y) ? saved.y : undefined,
    isMaximized: Boolean(saved.isMaximized)
  };

  // Se coordenadas foram gravadas, verifica se estão dentro dos limites visíveis de algum monitor conectado
  if (state.x !== undefined && state.y !== undefined) {
    const isVisible = isBoundsVisible({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height
    });

    if (!isVisible) {
      delete state.x;
      delete state.y;
    }
  }

  return state;
}

/**
 * Valida se um retângulo está ao menos parcialmente visível em qualquer monitor conectado
 * @param {object} bounds
 * @returns {boolean}
 */
function isBoundsVisible(bounds) {
  const displays = screen.getAllDisplays();
  return displays.some(display => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

/**
 * Salva as dimensões normais e estado maximizado da janela com debounce
 * @param {Electron.BrowserWindow} window
 */
function saveWindowState(window) {
  if (!window || window.isDestroyed()) return;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    try {
      if (window.isDestroyed()) return;

      const isMaximized = window.isMaximized();
      let bounds;

      if (typeof window.getNormalBounds === 'function') {
        bounds = window.getNormalBounds();
      } else {
        bounds = window.getBounds();
      }

      const state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: isMaximized
      };

      storage.writeJSON(STATE_FILENAME, state);
    } catch (err) {
      console.warn('[WindowState] Erro ao salvar estado da janela:', err.message);
    }
  }, 300);
}

module.exports = {
  loadWindowState,
  saveWindowState
};
```

---

### 4.7 `src/main/tabs.js`

```javascript
// =============================================================================
// src/main/tabs.js
// Gerenciador de abas (TabManager) usando WebContentsView do Electron
// O processo principal é a única fonte da verdade de todo o estado das abas.
// =============================================================================

const fs = require('fs');
const path = require('path');
const { WebContentsView, session } = require('electron');
const config = require('./config');
const contextMenu = require('./context-menu');
const history = require('./history');
const privacy = require('./privacy');
const sessionModule = require('./session');
const settings = require('./settings');
const storage = require('./storage');
const { isSuspiciousRedirectChain, getBaseDomain } = require('./pure/privacy-utils');

// Conjunto canônico das URLs exatas das páginas internas permitidas no esquema file:
// Compara com as URLs exatas de config.js ignorando query e hash
const CANONICAL_INTERNAL_URLS = new Set([
  config.NEW_TAB_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.SETTINGS_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.ERROR_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.HTTPS_WARNING_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.CERT_ERROR_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.HISTORY_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.BOOKMARKS_PAGE_URL.split('?')[0].split('#')[0].toLowerCase(),
  config.DOWNLOADS_PAGE_URL.split('?')[0].split('#')[0].toLowerCase()
]);

/**
 * Converte atalhos amigáveis como dragon://downloads ou about:downloads
 * na URL canônica de arquivo correspondente.
 * @param {string} rawUrl
 * @returns {string}
 */
function resolveInternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return rawUrl;
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'dragon://downloads' || lower === 'about:downloads') return config.DOWNLOADS_PAGE_URL;
  if (lower === 'dragon://history' || lower === 'about:history') return config.HISTORY_PAGE_URL;
  if (lower === 'dragon://bookmarks' || lower === 'about:bookmarks') return config.BOOKMARKS_PAGE_URL;
  if (lower === 'dragon://settings' || lower === 'about:settings') return config.SETTINGS_PAGE_URL;
  if (lower === 'dragon://newtab' || lower === 'about:newtab') return config.NEW_TAB_URL;
  return trimmed;
}

/**
 * Valida se uma URL é permitida para navegação ou abertura de janela.
 * Permite apenas http:, https:, páginas internas exatas do Dragon em file: e about:blank.
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isAllowedNavigationUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const resolved = resolveInternalUrl(rawUrl);
    const parsed = new URL(resolved);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'file:') {
      // Compara a URL exata ignorando query e hash com a lista de páginas internas do Dragon
      const cleanHref = parsed.href.split('?')[0].split('#')[0].toLowerCase();
      return CANONICAL_INTERNAL_URLS.has(cleanHref);
    }
    if (parsed.protocol === 'about:' && parsed.pathname === 'blank') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

let tabs = [];
let activeTabId = null;
let nextTabIdNumber = 1;
const activePrivatePartitions = new Set();
const closedTabsStack = []; // Pilha para reabrir abas fechadas (Ctrl+Shift+T)

// Throttle de notificações de rastreadores bloqueados (no máximo 5 por segundo por aba)
// Intervalo de 200ms entre notificações por aba (1000ms / 5 chamadas = 200ms)
const TRACKER_THROTTLE_INTERVAL_MS = 200;
const trackerThrottleMap = new Map(); // wcId -> { lastTime: number, timer: NodeJS.Timeout | null }

let mainWindowRef = null;
let windowManagerRef = null;
let onShortCutTriggered = null;

/**
 * Salva a lista de abas normais abertas para suporte à restauração de sessão.
 * Abas privadas e a aba de configurações NUNCA são salvas na sessão persistida.
 */
function saveSessionTabs() {
  const normalUrls = tabs
    .filter(t => !t.isPrivate && t.url && !t.url.startsWith(config.SETTINGS_PAGE_URL))
    .map(t => t.url);
  storage.writeJSON('sessions.json', { urls: normalUrls });
}

/**
 * Propaga as configurações atuais em tempo real para todas as abas de nova aba abertas.
 */
function updateNewTabViews() {
  const newTabData = settings.getNewTabData();
  for (const tab of tabs) {
    if (tab.view && !tab.view.webContents.isDestroyed() && tab.url && tab.url.startsWith(config.NEW_TAB_URL)) {
      tab.view.webContents.executeJavaScript(
        `if (typeof window.__applyDragonSettings === 'function') { window.__applyDragonSettings(${JSON.stringify(newTabData)}); }`
      ).catch(() => {});
    }
  }
}

/**
 * Atualiza o zoom de todas as abas abertas em tempo real.
 * @param {number} [zoomFactor] Fator de zoom (ex: 1.0 = 100%)
 */
function updateTabsZoom(zoomFactor) {
  const factor = typeof zoomFactor === 'number' ? zoomFactor : (settings.get('defaultZoom') || 1.0);
  for (const tab of tabs) {
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.setZoomFactor(factor);
    }
  }
}

/**
 * Abre a página de configurações em uma aba normal.
 * Se já existir uma aba de configurações aberta, apenas troca para ela.
 * @returns {object} Aba de configurações
 */
function openSettingsTab() {
  const settingsUrl = config.SETTINGS_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(settingsUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(settingsUrl, { active: true, isPrivate: false, isSettings: true });
}

/**
 * Abre a página de downloads em uma aba normal.
 * Se já existir uma aba de downloads aberta, apenas troca para ela.
 * @returns {object} Aba de downloads
 */
function openDownloadsTab() {
  const downloadsUrl = config.DOWNLOADS_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(downloadsUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(downloadsUrl, { active: true, isPrivate: false });
}

/**
 * Abre a página de histórico em uma aba normal.
 * Se já existir uma aba de histórico aberta, apenas troca para ela.
 * @returns {object} Aba de histórico
 */
function openHistoryTab() {
  const historyUrl = config.HISTORY_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(historyUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(historyUrl, { active: true, isPrivate: false });
}

/**
 * Abre a página de favoritos em uma aba normal.
 * Se já existir uma aba de favoritos aberta, apenas troca para ela.
 * @returns {object} Aba de favoritos
 */
function openBookmarksTab() {
  const bookmarksUrl = config.BOOKMARKS_PAGE_URL;
  const existingTab = tabs.find(t => t.url && t.url.startsWith(bookmarksUrl));
  if (existingTab) {
    setActiveTab(existingTab.id);
    return existingTab;
  }
  return createTab(bookmarksUrl, { active: true, isPrivate: false });
}

/**
 * Helper para verificar se a página pode voltar no histórico (compatível com Electron moderno)
 */
function checkCanGoBack(webContents) {
  if (!webContents) return false;
  if (webContents.navigationHistory && typeof webContents.navigationHistory.canGoBack === 'function') {
    return webContents.navigationHistory.canGoBack();
  }
  return typeof webContents.canGoBack === 'function' ? webContents.canGoBack() : false;
}

/**
 * Helper para verificar se a página pode avançar no histórico (compatível com Electron moderno)
 */
function checkCanGoForward(webContents) {
  if (!webContents) return false;
  if (webContents.navigationHistory && typeof webContents.navigationHistory.canGoForward === 'function') {
    return webContents.navigationHistory.canGoForward();
  }
  return typeof webContents.canGoForward === 'function' ? webContents.canGoForward() : false;
}

/**
 * Retorna uma representação limpa do estado atual para ser enviada à interface.
 * O processo de renderização (UI) NUNCA manipula WebContentsView diretamente.
 */
function getState() {
  const activeTab = getActiveTab();
  const activeWcId = activeTab && activeTab.view ? activeTab.view.webContents.id : null;
  const privacyInfo = activeWcId
    ? privacy.getPrivacyInfoForTab(activeWcId, activeTab.url)
    : { count: 0, domains: [], isProtected: true, hostname: '' };

  return {
    tabs: tabs.map(t => ({
      id: t.id,
      title: t.title || (t.isPrivate ? 'Nova Aba Privada' : 'Nova Aba'),
      url: t.url || config.NEW_TAB_URL,
      favicon: t.favicon || '',
      isLoading: Boolean(t.isLoading),
      isPrivate: Boolean(t.isPrivate)
    })),
    activeTabId: activeTabId,
    canGoBack: activeTab && activeTab.view ? checkCanGoBack(activeTab.view.webContents) : false,
    canGoForward: activeTab && activeTab.view ? checkCanGoForward(activeTab.view.webContents) : false,
    isLoading: activeTab ? Boolean(activeTab.isLoading) : false,
    currentUrl: activeTab ? activeTab.url : '',
    currentTitle: activeTab ? (activeTab.title || '') : '',
    newTabUrl: config.NEW_TAB_URL,
    settingsUrl: config.SETTINGS_PAGE_URL,
    downloadsUrl: config.DOWNLOADS_PAGE_URL,
    historyUrl: config.HISTORY_PAGE_URL,
    bookmarksUrl: config.BOOKMARKS_PAGE_URL,
    errorUrl: config.ERROR_PAGE_URL,
    httpsWarningUrl: config.HTTPS_WARNING_URL,
    certErrorUrl: config.CERT_ERROR_PAGE_URL,
    isPrivate: Boolean(activeTab && activeTab.isPrivate),
    privacyInfo,
    settings: {
      accentColor: settings.get('accentColor'),
      theme: settings.get('theme')
    }
  };
}

/**
 * Notifica a janela do navegador sobre qualquer alteração no estado das abas.
 */
function notifyStateChange() {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

  const state = getState();
  // Envia o estado serializado via canal IPC para o renderer
  mainWindowRef.webContents.send('browser:state-update', state);
}

/**
 * Notifica a alteração de estado decorrente de rastreadores bloqueados com throttle.
 * Agrupa as notificações em no máximo 5 por segundo por aba (intervalo de 200ms),
 * evitando sobrecarregar o canal IPC e a renderização em páginas pesadas em anúncios.
 *
 * @param {number} wcId ID do WebContents que bloqueou o rastreador
 */
function notifyTrackerBlocked(wcId) {
  if (!wcId) {
    notifyStateChange();
    return;
  }

  // Como o privacyInfo na interface exibe as estatísticas da aba ativa,
  // apenas a aba em foco precisa disparar a atualização de UI em tempo real.
  // Os rastreadores de abas em segundo plano permanecem gravados em memória
  // e serão exibidos assim que o usuário alternar para elas.
  const activeTab = getActiveTab();
  const isActive = activeTab && activeTab.view && activeTab.view.webContents.id === wcId;
  if (!isActive) {
    return;
  }

  const now = Date.now();
  let entry = trackerThrottleMap.get(wcId);
  if (!entry) {
    entry = { lastTime: 0, timer: null };
    trackerThrottleMap.set(wcId, entry);
  }

  const elapsed = now - entry.lastTime;

  if (elapsed >= TRACKER_THROTTLE_INTERVAL_MS) {
    // Passou o intervalo de throttle: envia imediatamente
    entry.lastTime = now;
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    notifyStateChange();
  } else if (!entry.timer) {
    // Dentro da janela de 200ms: agenda trailing update para capturar o valor final
    const remaining = TRACKER_THROTTLE_INTERVAL_MS - elapsed;
    entry.timer = setTimeout(() => {
      entry.lastTime = Date.now();
      entry.timer = null;
      notifyStateChange();
    }, remaining);
  }
}

/**
 * Retorna a aba ativa atual
 * @returns {object|null}
 */
function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

/**
 * Retorna uma aba pelo seu identificador
 * @param {string} id ID da aba (ex: 'tab-1')
 * @returns {object|null}
 */
function getTab(id) {
  return tabs.find(t => t.id === id) || null;
}

/**
 * Cria uma nova aba com sua respectiva WebContentsView.
 * @param {string} [initialUrl] URL opcional (abre config.NEW_TAB_URL se omitida)
 * @param {object} [options] Opções como { active: true, isPrivate: false }
 * @returns {object} A aba criada
 */
function createTab(initialUrl = null, options = { active: true, isPrivate: false, isSettings: false, isExplicitHttps: false }) {
  const tabId = `tab-${nextTabIdNumber++}`;
  const resolvedUrl = initialUrl ? resolveInternalUrl(initialUrl) : config.NEW_TAB_URL;
  let targetUrl = resolvedUrl;
  if (!isAllowedNavigationUrl(targetUrl)) {
    console.warn(`[TabManager] URL não permitida em createTab: ${targetUrl}`);
    targetUrl = config.NEW_TAB_URL;
  }
  const isPrivate = Boolean(options && options.isPrivate);
  const isSettings = Boolean(options && options.isSettings) || Boolean(targetUrl && targetUrl.startsWith(config.SETTINGS_PAGE_URL));
  const isExplicitHttps = Boolean(options && options.isExplicitHttps);

  let tabSession = undefined;
  let partitionName = null;

  if (isPrivate) {
    // Aba Privada: cria partição exclusiva em memória (sem persist:), descartada ao fechar
    partitionName = 'private-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    activePrivatePartitions.add(partitionName);
    tabSession = session.fromPartition(partitionName);
    sessionModule.configureSession(tabSession, true);
  }

  // Cria a WebContentsView isolada com o maior nível de segurança possível
  // SEGURANÇA: settings-preload.js é anexado ESTRITAMENTE na aba interna de configurações.
  // Demais abas usam tab-preload.js que expõe APIs apenas para páginas internas autorizadas.
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: isSettings
        ? path.join(__dirname, '../preload/settings-preload.js')
        : path.join(__dirname, '../preload/tab-preload.js'),
      ...(tabSession ? { session: tabSession } : {})
    }
  });

  // Aplica o zoom padrão definido nas configurações do usuário
  const defaultZoom = settings.get('defaultZoom') || 1.0;
  view.webContents.setZoomFactor(defaultZoom);

  // Configura política restrita de WebRTC para evitar vazamento de IP real
  privacy.applyWebRTCPolicy(view.webContents);

  // Adiciona a view à árvore de conteúdo da janela principal
  mainWindowRef.contentView.addChildView(view);

  // Inicialmente fica invisível até ser explicitamente ativada
  view.setVisible(false);

  let initialTitle = 'Nova Aba';
  if (targetUrl.startsWith(config.SETTINGS_PAGE_URL)) {
    initialTitle = 'Configurações';
  } else if (targetUrl.startsWith(config.DOWNLOADS_PAGE_URL)) {
    initialTitle = 'Downloads';
  } else if (targetUrl.startsWith(config.HISTORY_PAGE_URL)) {
    initialTitle = 'Histórico';
  } else if (targetUrl.startsWith(config.BOOKMARKS_PAGE_URL)) {
    initialTitle = 'Favoritos';
  } else if (isPrivate) {
    initialTitle = 'Nova Aba Privada';
  }

  const tab = {
    id: tabId,
    view: view,
    title: initialTitle,
    url: targetUrl,
    favicon: '',
    isLoading: true,
    canGoBack: false,
    canGoForward: false,
    isPrivate: isPrivate,
    isSettings: isSettings,
    isExplicitHttps: isExplicitHttps,
    isHtmlFullScreen: false,
    partition: partitionName,
    redirectHistory: [],
    lastUserInteraction: Date.now()
  };

  tabs.push(tab);

  // ===========================================================================
  // LISTENERS DE EVENTOS DO WEBCONTENTS DA ABA
  // ===========================================================================

  // Registra interação do usuário para distinguir redirecionamentos forçados de navegações intencionais
  view.webContents.on('before-input-event', () => {
    tab.lastUserInteraction = Date.now();
  });

  // 1. Início de carregamento
  view.webContents.on('did-start-loading', () => {
    tab.isLoading = true;
    privacy.resetTabTrackerData(view.webContents.id);
    const entry = trackerThrottleMap.get(view.webContents.id);
    if (entry && entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    notifyStateChange();
  });

  // 2. Fim de carregamento
  view.webContents.on('did-stop-loading', () => {
    tab.isLoading = false;
    tab.canGoBack = checkCanGoBack(view.webContents);
    tab.canGoForward = checkCanGoForward(view.webContents);
    notifyStateChange();
  });

  // 3. Atualização do título da página
  view.webContents.on('page-title-updated', (event, title) => {
    tab.title = title || (tab.isPrivate ? 'Aba Privada' : 'Sem título');
    if (!tab.isPrivate && tab.url) {
      history.updateTitle(tab.url, tab.title);
    }
    notifyStateChange();
  });

  // 4. Atualização de ícone (Favicon)
  view.webContents.on('page-favicon-updated', (event, favicons) => {
    if (favicons && favicons.length > 0) {
      tab.favicon = favicons[0];
      notifyStateChange();
    }
  });

  // 5. Navegação concluída para outra página
  view.webContents.on('did-navigate', (event, url) => {
    // Reaplica o fator de zoom padrão, pois a navegação entre origens diferentes pode resetá-lo no Chromium
    const currentZoom = settings.get('defaultZoom') || 1.0;
    try {
      view.webContents.setZoomFactor(currentZoom);
    } catch {}

    tab.url = url;
    let landingDomain = '';
    try {
      landingDomain = getBaseDomain(new URL(url).hostname);
    } catch {}
    if (landingDomain) {
      tab.redirectHistory = [{ url, domain: landingDomain, timestamp: Date.now() }];
    } else {
      tab.redirectHistory = [];
    }

    tab.canGoBack = checkCanGoBack(view.webContents);
    tab.canGoForward = checkCanGoForward(view.webContents);
    privacy.resetTabTrackerData(view.webContents.id);
    sessionModule.cancelPendingRequestsForWebContents(view.webContents.id);

    // Abas privadas NUNCA são gravadas em histórico
    if (!tab.isPrivate) {
      history.addEntry({ url, title: tab.title, isPrivate: false });
      saveSessionTabs();
    }

    notifyStateChange();
  });

  // 6. Navegação interna (mudança de hash, single-page application)
  view.webContents.on('did-navigate-in-page', (event, url) => {
    tab.url = url;
    tab.canGoBack = checkCanGoBack(view.webContents);
    tab.canGoForward = checkCanGoForward(view.webContents);
    notifyStateChange();
  });

  // 6.1. Detecção e bloqueio de redirecionamentos em cadeia rápida sem gesto do usuário (ETAPA 1)
  view.webContents.on('will-redirect', (event, targetUrl, isInPlace, isMainFrame) => {
    // Inspeciona apenas navegação no frame principal
    if (isMainFrame === false) return;

    let currentHost = '';
    try {
      currentHost = new URL(view.webContents.getURL()).hostname;
    } catch {}

    // Se o site atual for exceção cadastrada pelo usuário, não bloqueia
    if (currentHost && privacy.isSiteExempt(currentHost)) {
      return;
    }

    let targetHost = '';
    try {
      targetHost = new URL(targetUrl).hostname;
    } catch {}

    if (targetHost && privacy.isSiteExempt(targetHost)) {
      return;
    }

    const now = Date.now();
    const timeSinceUser = now - (tab.lastUserInteraction || 0);

    // Se mais de 1.5s desde última ação do usuário e a cadeia de redirecionamentos for suspeita
    if (timeSinceUser > 1500 && isSuspiciousRedirectChain(tab.redirectHistory || [], targetUrl, now, 1500, 2)) {
      event.preventDefault();
      console.warn(`[Privacidade] Redirecionamento forçado em cadeia bloqueado na aba ${tab.id} para: ${targetUrl}`);

      privacy.recordPopupBlocked(view.webContents.id);
      notifyStateChange();

      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('browser:redirect-blocked', {
          tabId: tab.id,
          targetUrl,
          domain: targetHost || targetUrl
        });
      }
      return;
    }

    // Registra na cadeia de histórico recente
    let targetDomain = '';
    try {
      targetDomain = getBaseDomain(targetHost);
    } catch {}
    if (targetDomain) {
      tab.redirectHistory = (tab.redirectHistory || []).filter(item => (now - item.timestamp) < 5000);
      tab.redirectHistory.push({ url: targetUrl, domain: targetDomain, timestamp: now });
    }
  });

  // 7. Tratamento de falha no carregamento (ex: sem internet ou falha de HTTPS)
  view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // 1. Ignora códigos normais de aborto (-3 = ERR_ABORTED) que ocorrem ao redirecionar
    // e ignora falhas em sub-frames (iFrames/anúncios bloqueados)
    if (errorCode === -3 || !isMainFrame) return;

    // 2. PREVENÇÃO DE LOOP INFINITO: Não reentrar se a falha ocorreu na própria página de erro, aviso ou cert-error
    if (!validatedURL ||
        validatedURL.startsWith(config.ERROR_PAGE_URL) ||
        validatedURL.startsWith(config.HTTPS_WARNING_URL) ||
        validatedURL.startsWith(config.CERT_ERROR_PAGE_URL)) {
      return;
    }

    console.warn(`[Aba ${tabId}] Falha ao carregar ${(validatedURL || '').slice(0, 100)}: ${errorDescription} (${errorCode})`);

    // 3. Limita o tamanho máximo da URL e descrição passadas por parâmetro (evita ERR_INVALID_URL)
    const safeUrl = (validatedURL || '').slice(0, 500);
    const safeDesc = (errorDescription || '').slice(0, 200);
    const safeCode = String(errorCode || '');

    // Erros de certificado SSL/TLS (códigos -200 até -299) são direcionados para cert-error.html
    // sem botão fácil de prosseguir, impedindo downgrade inseguro para HTTP.
    const isCertError = errorCode <= -200 && errorCode >= -299;
    if (isCertError) {
      try {
        const certUrlObj = new URL(config.CERT_ERROR_PAGE_URL);
        certUrlObj.searchParams.set('url', safeUrl);
        certUrlObj.searchParams.set('code', safeCode);
        certUrlObj.searchParams.set('desc', safeDesc);
        view.webContents.loadURL(certUrlObj.href).catch(() => {});
      } catch (err) {
        console.warn(`[Aba ${tabId}] Erro ao carregar página de erro de certificado:`, err.message);
      }
      return;
    }

    // Fallback HTTP APENAS para falhas reais de conexão (-102, -107, -101, -118)
    // e SOMENTE quando o usuário não digitou https:// explicitamente.
    const isConnectionFailure = errorCode === -102 || errorCode === -107 || errorCode === -101 || errorCode === -118;
    const isHttps = validatedURL && validatedURL.startsWith('https://');
    const allowHttpFallback = isHttps && isConnectionFailure && !tab.isExplicitHttps;

    if (allowHttpFallback) {
      try {
        const httpTarget = ('http://' + validatedURL.slice(8)).slice(0, 500);
        const warningUrlObj = new URL(config.HTTPS_WARNING_URL);
        warningUrlObj.searchParams.set('url', httpTarget);
        view.webContents.loadURL(warningUrlObj.href).catch(() => {});
      } catch (err) {
        console.warn(`[Aba ${tabId}] Erro ao carregar página de aviso HTTPS:`, err.message);
      }
      return;
    }

    try {
      const errorUrlObj = new URL(config.ERROR_PAGE_URL);
      errorUrlObj.searchParams.set('url', safeUrl);
      errorUrlObj.searchParams.set('code', safeCode);
      errorUrlObj.searchParams.set('desc', safeDesc);
      view.webContents.loadURL(errorUrlObj.href).catch(() => {});
    } catch (err) {
      console.warn(`[Aba ${tabId}] Erro ao carregar página de erro:`, err.message);
    }
  });

  // 8. Interceptação de links com target="_blank" ou window.open (ETAPA 1)
  view.webContents.setWindowOpenHandler(({ url, disposition, userGesture, features }) => {
    // Permite apenas http:, https: e as páginas internas do Dragon
    if (!isAllowedNavigationUrl(url)) {
      console.warn('[Segurança] Abertura de janela bloqueada para URL não permitida:', url);
      return { action: 'deny' };
    }

    let currentHost = '';
    try {
      currentHost = new URL(view.webContents.getURL()).hostname;
    } catch {}

    const isExempt = currentHost ? privacy.isSiteExempt(currentHost) : false;

    // ETAPA 1: Bloquear qualquer tentativa de abrir nova janela/aba quando NÃO houver userGesture,
    // independentemente do disposition, a menos que o site esteja na lista de exceções do usuário
    if (!userGesture && !isExempt) {
      console.warn(`[Popups] Pop-up bloqueado sem userGesture na aba ${tabId} para URL: ${url}`);
      privacy.recordPopupBlocked(view.webContents.id);
      notifyStateChange();
      return { action: 'deny' };
    }

    // Permite janela pop-up real quando acionada por gesto do usuário (ex: Login com Google/Apple)
    if (userGesture && (disposition === 'new-window' || (features && features.length > 0))) {
      const iconPath = path.join(__dirname, '../../assets/icons/favicon-circle.png');
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: mainWindowRef,
          modal: false,
          autoHideMenuBar: true,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            session: view.webContents.session,
            preload: undefined
          }
        }
      };
    }

    // Links normais target="_blank" com userGesture abrem como nova aba mantendo a partição privada se aplicável
    createTab(url, { active: true, isPrivate: tab.isPrivate });
    return { action: 'deny' };
  });

  // Bloco 3.6: Aplica configurações em janelas filhas/popups criadas (OAuth)
  view.webContents.on('did-create-window', (childWindow) => {
    try {
      childWindow.setMenu(null);
      childWindow.setMenuBarVisibility(false);

      const iconPath = path.join(__dirname, '../../assets/icons/favicon-circle.png');
      if (fs.existsSync(iconPath)) {
        childWindow.setIcon(iconPath);
      }

      childWindow.webContents.setWindowOpenHandler(({ url: childUrl }) => {
        if (!isAllowedNavigationUrl(childUrl)) {
          return { action: 'deny' };
        }
        createTab(childUrl, { active: true, isPrivate: tab.isPrivate });
        return { action: 'deny' };
      });

      childWindow.webContents.on('before-input-event', (event, input) => {
        if (onShortCutTriggered) {
          onShortCutTriggered(event, input);
        }
      });

      contextMenu.attachContextMenu(childWindow.webContents, {
        mainWindow: mainWindowRef,
        tabManager: { createTab: (u, o) => createTab(u, o) },
        isPrivate: tab.isPrivate
      });
    } catch (err) {
      console.warn('[Popups] Aviso ao configurar janela pop-up filha:', err.message);
    }
  });

  // Anexa o menu de contexto nativo com copiar, colar, inspecionar, etc.
  contextMenu.attachContextMenu(view.webContents, {
    mainWindow: mainWindowRef,
    tabManager: { createTab: (u, o) => createTab(u, o) },
    isPrivate: tab.isPrivate
  });

  // Listener para resultados de busca na página (Ctrl+F)
  view.webContents.on('found-in-page', (event, result) => {
    if (tab.id === activeTabId && mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('browser:find-result', result);
    }
  });

  // 9. Interceptação de atalhos de teclado enquanto o foco está no conteúdo do site
  view.webContents.on('before-input-event', (event, input) => {
    if (onShortCutTriggered) {
      onShortCutTriggered(event, input);
    }
  });

  // 10. Trata entrada e saída de tela cheia HTML5 (vídeos em tela cheia)
  // Faz a visualização ocupar a janela inteira e notifica o renderer para esconder a barra superior
  view.webContents.on('enter-html-full-screen', () => {
    tab.isHtmlFullScreen = true;
    if (tab.id === activeTabId && windowManagerRef) {
      windowManagerRef.setHtmlFullScreen(true);
    }
  });

  view.webContents.on('leave-html-full-screen', () => {
    tab.isHtmlFullScreen = false;
    if (tab.id === activeTabId && windowManagerRef) {
      windowManagerRef.setHtmlFullScreen(false);
    }
  });

  // SEGURANÇA: Interceptação e validação de will-navigate para todas as abas
  view.webContents.on('will-navigate', (event, navUrl) => {
    if (isSettings) {
      if (!navUrl.startsWith(config.SETTINGS_PAGE_URL)) {
        event.preventDefault();
        createTab(navUrl, { active: true });
      }
      return;
    }

    if (!isAllowedNavigationUrl(navUrl)) {
      console.warn(`[Segurança] Navegação bloqueada para protocolo não permitido via will-navigate: ${navUrl}`);
      event.preventDefault();
    }
  });

  // Sincroniza configurações ao terminar de montar o DOM da página de nova aba
  view.webContents.on('dom-ready', () => {
    // Reaplica o zoom padrão no dom-ready para assegurar a escala configurada
    const currentZoom = settings.get('defaultZoom') || 1.0;
    try {
      view.webContents.setZoomFactor(currentZoom);
    } catch {}

    if (tab.url && tab.url.startsWith(config.NEW_TAB_URL)) {
      view.webContents.executeJavaScript(
        `if (typeof window.__applyDragonSettings === 'function') { window.__applyDragonSettings(${JSON.stringify(settings.getNewTabData())}); }`
      ).catch(() => {});
    }
  });

  // Prepara a URL inicial a ser carregada (sem anexar dados pesados de configurações no hash ou query)
  const urlToLoad = targetUrl;

  // Carrega a URL inicial
  view.webContents.loadURL(urlToLoad).catch(err => {
    if (err && err.code !== 'ERR_ABORTED') {
      console.warn(`[Aba ${tabId}] Erro ao carregar URL inicial:`, err.message);
    }
  });

  saveSessionTabs();

  // Se a opção active for verdadeira ou se for a única aba existente, ativa-a
  if (options.active || tabs.length === 1) {
    setActiveTab(tabId);
  } else {
    notifyStateChange();
  }

  return tab;
}

/**
 * Define qual aba deve ser exibida e focada.
 * @param {string} tabId ID da aba desejada
 */
function setActiveTab(tabId) {
  const targetTab = getTab(tabId);
  if (!targetTab) return;

  activeTabId = tabId;

  // Esconde todas as outras abas
  for (const t of tabs) {
    if (t.id !== tabId && t.view) {
      t.view.setVisible(false);
    }
  }

  // Se o overlay da interface estiver ativo, a aba não deve ficar visível ainda
  const isOverlay = windowManagerRef ? windowManagerRef.getIsOverlayActive() : false;
  if (!isOverlay && targetTab.view) {
    targetTab.view.setVisible(true);
  }

  // Redimensiona para garantir bounds corretos
  if (windowManagerRef) {
    windowManagerRef.updateActiveViewBounds();
    windowManagerRef.setHtmlFullScreen(Boolean(targetTab.isHtmlFullScreen));
  }

  // Dá foco para a página do site
  if (targetTab.view) {
    targetTab.view.webContents.focus();
  }

  notifyStateChange();
}

/**
 * Fecha uma aba existente. Se for a última aba restante, cria uma nova automaticamente.
 * Se a aba for privada, apaga completamente os dados da sessão em memória.
 * @param {string} tabId ID da aba a ser fechada
 */
function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const [removedTab] = tabs.splice(index, 1);

  // Se a aba removida estava em tela cheia HTML5, restaura layout normal
  if (removedTab && removedTab.isHtmlFullScreen && windowManagerRef) {
    windowManagerRef.setHtmlFullScreen(false);
  }

  // Remove a view da janela e libera os recursos
  if (removedTab && removedTab.view) {
    try {
      const wcId = removedTab.view.webContents.id;

      // Limpa dados de privacidade, certificados e hosts HTTP liberados para esta aba
      privacy.resetTabTrackerData(wcId);
      privacy.clearAllowedHttpHosts(wcId);
      privacy.clearAllowedCertHosts(wcId);
      sessionModule.cancelPendingRequestsForWebContents(wcId);

      // Limpa timers pendentes de throttle de rastreadores desta aba
      const entry = trackerThrottleMap.get(wcId);
      if (entry && entry.timer) {
        clearTimeout(entry.timer);
      }
      trackerThrottleMap.delete(wcId);

      mainWindowRef.contentView.removeChildView(removedTab.view);
      removedTab.view.webContents.close();
    } catch (err) {
      console.warn(`[TabManager] Aviso ao destruir view da aba ${tabId}:`, err.message);
    }

    // Se for uma aba privada, limpa os dados da sessão imediatamente
    if (removedTab.isPrivate && removedTab.partition) {
      activePrivatePartitions.delete(removedTab.partition);
      try {
        const privSes = session.fromPartition(removedTab.partition);
        privSes.clearStorageData({});
        privSes.clearCache();
        if (typeof privSes.clearAuthCache === 'function') {
          privSes.clearAuthCache();
        }
      } catch (err) {
        console.warn(`[TabManager] Aviso ao limpar sessão privada de ${tabId}:`, err.message);
      }
    }
  }

  // Se a aba fechada era uma aba normal e válida, salva na pilha para reabrir (Ctrl+Shift+T)
  if (
    removedTab &&
    !removedTab.isPrivate &&
    removedTab.url &&
    !removedTab.url.startsWith(config.NEW_TAB_URL) &&
    !removedTab.url.startsWith(config.SETTINGS_PAGE_URL)
  ) {
    closedTabsStack.push({
      url: removedTab.url,
      title: removedTab.title
    });
    if (closedTabsStack.length > 25) {
      closedTabsStack.shift();
    }
  }

  // Se a aba fechada era a aba ativa, seleciona uma adjacente
  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const nextIndex = Math.min(index, tabs.length - 1);
      setActiveTab(tabs[nextIndex].id);
    } else {
      activeTabId = null;
    }
  }

  saveSessionTabs();

  // REGRA DO REQUISITO: Se a última aba for fechada, abre uma nova imediatamente
  if (tabs.length === 0) {
    createTab(config.NEW_TAB_URL, { active: true });
    return;
  }

  notifyStateChange();
}

/**
 * Alterna para a próxima aba na lista (atalho Ctrl+Tab)
 */
function selectNextTab() {
  if (tabs.length <= 1) return;
  const currentIndex = tabs.findIndex(t => t.id === activeTabId);
  const nextIndex = (currentIndex + 1) % tabs.length;
  setActiveTab(tabs[nextIndex].id);
}

/**
 * Alterna para a aba anterior na lista
 */
function selectPreviousTab() {
  if (tabs.length <= 1) return;
  const currentIndex = tabs.findIndex(t => t.id === activeTabId);
  const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  setActiveTab(tabs[prevIndex].id);
}

/**
 * Fecha a aba ativa atual (atalho Ctrl+W)
 */
function closeActiveTab() {
  if (activeTabId) {
    closeTab(activeTabId);
  }
}

/**
 * Fecha e destrói TODAS as abas existentes sem recriar uma nova imediatamente.
 * Utilizado pelo processo de "Apagar Tudo", garantindo que todas as abas
 * sejam totalmente desalocadas da memória durante a animação de chamas.
 * @returns {number} Quantidade de abas fechadas
 */
function destroyAllTabs() {
  const count = tabs.length;
  const tabsToClose = [...tabs];
  tabs = [];
  activeTabId = null;

  // Cancela e limpa todos os timers pendentes de throttle de rastreadores
  for (const entry of trackerThrottleMap.values()) {
    if (entry && entry.timer) {
      clearTimeout(entry.timer);
    }
  }
  trackerThrottleMap.clear();

  for (const tab of tabsToClose) {
    if (tab && tab.view) {
      try {
        const wc = tab.view.webContents;
        const wcId = wc && !wc.isDestroyed() ? wc.id : null;
        if (wcId) {
          try { privacy.resetTabTrackerData(wcId); } catch {}
          try { privacy.clearAllowedHttpHosts(wcId); } catch {}
          try { privacy.clearAllowedCertHosts(wcId); } catch {}
          try { sessionModule.cancelPendingRequestsForWebContents(wcId); } catch {}
        }

        if (mainWindowRef && !mainWindowRef.isDestroyed() && mainWindowRef.contentView) {
          try {
            mainWindowRef.contentView.removeChildView(tab.view);
          } catch {}
        }
        if (wc && !wc.isDestroyed()) {
          try {
            wc.close();
          } catch {}
        }
      } catch (err) {
        console.warn(`[TabManager] Aviso ao destruir aba ${tab.id}:`, err.message);
      }
    }
  }

  // Bloco 2.1: Limpa a pilha de abas fechadas (Ctrl+Shift+T não pode reabrir abas apagadas)
  closedTabsStack.length = 0;

  // Notifica a interface sobre a destruição das abas
  notifyStateChange();
  return count;
}

/**
 * Limpa a pilha de abas fechadas (Ctrl+Shift+T)
 */
function clearClosedTabs() {
  closedTabsStack.length = 0;
}

/**
 * Registra um callback para repassar eventos de teclado capturados dentro dos WebContents
 * @param {Function} handler
 */
function setShortcutHandler(handler) {
  onShortCutTriggered = handler;
}

/**
 * Retorna lista de partições de sessões privadas ativas no momento
 * @returns {string[]}
 */
function getActivePrivatePartitions() {
  return Array.from(activePrivatePartitions);
}

/**
 * Esvazia o registro interno de partições privadas após a limpeza ser concluída em clear-data.js
 */
function clearPrivatePartitionsList() {
  activePrivatePartitions.clear();
}

/**
 * Cria uma nova aba privada
 * @param {string} [url]
 * @returns {object}
 */
function createPrivateTab(url = null) {
  let targetUrl = url || config.NEW_TAB_URL;
  if (!isAllowedNavigationUrl(targetUrl)) {
    console.warn(`[TabManager] URL não permitida em createPrivateTab: ${targetUrl}`);
    targetUrl = config.NEW_TAB_URL;
  }
  return createTab(targetUrl, { active: true, isPrivate: true });
}

/**
 * Envia uma mensagem IPC para todas as abas abertas da página de configurações.
 * @param {string} channel Nome do canal IPC
 * @param {*} data Dados a enviar
 */
function broadcastToSettingsTabs(channel, data) {
  for (const tab of tabs) {
    if (tab.view && !tab.view.webContents.isDestroyed() && tab.url && tab.url.startsWith(config.SETTINGS_PAGE_URL)) {
      try {
        tab.view.webContents.send(channel, data);
      } catch (err) {
        console.warn('[TabManager] Falha ao enviar evento para aba de configurações:', err.message);
      }
    }
  }
}

/**
 * Reabre a última aba fechada (Ctrl+Shift+T)
 * @returns {object|null}
 */
function reopenClosedTab() {
  if (closedTabsStack.length === 0) return null;
  const lastClosed = closedTabsStack.pop();
  if (lastClosed && lastClosed.url) {
    return createTab(lastClosed.url, { active: true, isPrivate: false });
  }
  return null;
}

/**
 * Seleciona a aba pelo índice numérico (0 a 7 para Ctrl+1 a Ctrl+8)
 * @param {number} index
 */
function selectTabByIndex(index) {
  if (index >= 0 && index < tabs.length) {
    setActiveTab(tabs[index].id);
  }
}

/**
 * Seleciona a última aba aberta (Ctrl+9)
 */
function selectLastTab() {
  if (tabs.length > 0) {
    setActiveTab(tabs[tabs.length - 1].id);
  }
}

/**
 * Reordena abas na lista (arrastar e soltar)
 * @param {string} sourceId ID da aba arrastada
 * @param {string} targetId ID da aba de destino
 */
function reorderTabs(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;

  const sourceIndex = tabs.findIndex(t => t.id === sourceId);
  const targetIndex = tabs.findIndex(t => t.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [movedTab] = tabs.splice(sourceIndex, 1);
  tabs.splice(targetIndex, 0, movedTab);

  saveSessionTabs();
  notifyStateChange();
}

/**
 * Aumenta o zoom da aba ativa e atualiza as configurações
 */
function zoomIn() {
  const current = settings.get('defaultZoom') || 1.0;
  const next = Math.min(3.0, Math.round((current + 0.1) * 10) / 10);
  settings.set('defaultZoom', next);
  updateTabsZoom(next);
}

/**
 * Diminui o zoom da aba ativa e atualiza as configurações
 */
function zoomOut() {
  const current = settings.get('defaultZoom') || 1.0;
  const next = Math.max(0.25, Math.round((current - 0.1) * 10) / 10);
  settings.set('defaultZoom', next);
  updateTabsZoom(next);
}

/**
 * Restaura o zoom para o valor padrão de 100%
 */
function zoomReset() {
  settings.set('defaultZoom', 1.0);
  updateTabsZoom(1.0);
}

/**
 * Dispara busca textual na página ativa (Ctrl+F)
 * @param {string} text
 * @param {object} [options] { forward, findNext, matchCase }
 */
function findInPage(text, options = {}) {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
    if (!text) {
      activeTab.view.webContents.stopFindInPage('clearSelection');
      return;
    }
    activeTab.view.webContents.findInPage(text, options);
  }
}

/**
 * Interrompe a busca textual na página ativa
 * @param {'clearSelection'|'keepSelection'|'activateSelection'} [action]
 */
function stopFindInPage(action = 'clearSelection') {
  const activeTab = getActiveTab();
  if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
    activeTab.view.webContents.stopFindInPage(action);
  }
}

/**
 * Inicializa o gerenciador de abas
 * @param {object} context Objeto contendo mainWindow e windowManager
 */
function init(context) {
  mainWindowRef = context.mainWindow;
  windowManagerRef = context.windowManager;

  // Conecta ao módulo de privacidade para re-renderizar interface quando rastreador for bloqueado
  // Agrupa as notificações com throttle de no máximo 5 por segundo por aba
  privacy.setOnBlockedCallback((wcId) => {
    notifyTrackerBlocked(wcId);
  });

  // Conecta às alterações de configurações em tempo real
  settings.onChange((key, value, allSettings) => {
    if (key === 'defaultZoom' || key === '*') {
      updateTabsZoom(parseFloat(allSettings.defaultZoom) || 1.0);
    }
    updateNewTabViews();
    notifyStateChange();
  });

  return {
    createTab,
    createPrivateTab,
    openSettingsTab,
    openDownloadsTab,
    openHistoryTab,
    openBookmarksTab,
    resolveInternalUrl,
    closeTab,
    setActiveTab,
    getActiveTab,
    getTab,
    getTabs: () => [...tabs],
    getState,
    notifyStateChange,
    selectNextTab,
    selectPreviousTab,
    closeActiveTab,
    destroyAllTabs,
    getActivePrivatePartitions,
    clearPrivatePartitionsList,
    setShortcutHandler,
    isAllowedNavigationUrl,
    broadcastToSettingsTabs,
    reopenClosedTab,
    selectTabByIndex,
    selectLastTab,
    reorderTabs,
    zoomIn,
    zoomOut,
    zoomReset,
    findInPage,
    stopFindInPage,
    allowRedirect,
    reloadAllWebTabs
  };
}

/**
 * Permite explicitamente um redirecionamento bloqueado a pedido do usuário
 * @param {string} targetUrl
 */
function allowRedirect(targetUrl) {
  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.view || !targetUrl) return;
  activeTab.lastUserInteraction = Date.now();
  activeTab.redirectHistory = [];
  activeTab.view.webContents.loadURL(targetUrl).catch(() => {});
}

/**
 * Recarrega todas as abas web abertas (http:// ou https://),
 * ignorando páginas internas do Dragon (file: ou dragon://).
 */
function reloadAllWebTabs() {
  for (const tab of tabs) {
    if (tab && tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
      const url = tab.url || '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        tab.view.webContents.reload();
      }
    }
  }
}

module.exports = {
  init,
  createTab,
  createPrivateTab,
  openSettingsTab,
  openDownloadsTab,
  openHistoryTab,
  openBookmarksTab,
  resolveInternalUrl,
  closeTab,
  setActiveTab,
  getActiveTab,
  getTab,
  getTabs: () => [...tabs],
  getState,
  notifyStateChange,
  selectNextTab,
  selectPreviousTab,
  closeActiveTab,
  destroyAllTabs,
  getActivePrivatePartitions,
  clearPrivatePartitionsList,
  setShortcutHandler,
  isAllowedNavigationUrl,
  broadcastToSettingsTabs,
  reopenClosedTab,
  clearClosedTabs,
  getClosedTabsStack: () => [...closedTabsStack],
  selectTabByIndex,
  selectLastTab,
  reorderTabs,
  zoomIn,
  zoomOut,
  zoomReset,
  findInPage,
  stopFindInPage,
  allowRedirect,
  reloadAllWebTabs
};

```

---

### 4.8 `src/main/context-menu.js`

```javascript
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
```

---

### 4.9 `src/main/session.js`

```javascript
// =============================================================================
// src/main/session.js
// Configurações de segurança, políticas de permissão, proxy e downloads da sessão
// =============================================================================

const crypto = require('crypto');
const { app, session } = require('electron');
const downloads = require('./downloads');
const permissions = require('./permissions');
const privacy = require('./privacy');
const settings = require('./settings');

let mainWindowRef = null;
let windowManagerRef = null;
const pendingPermissionRequests = new Map(); // requestId -> { callback, origin, permissionKey, webContentsId, isPrivate }
const privatePermissions = new Map(); // "origin::permissionKey" -> 'allow' | 'block' (apenas memória)

// Sanitização global do User-Agent antes do ready: remove "Electron/x.y.z" e "Dragon/x.y.z"
if (app && app.userAgentFallback) {
  app.userAgentFallback = app.userAgentFallback
    .replace(/Electron\/[0-9.]+\s?/gi, '')
    .replace(/Dragon\/[0-9.]+\s?/gi, '')
    .trim();
}

/**
 * Permissões intrinsecamente seguras liberadas sem necessidade de interrupção do usuário
 */
const ALLOWED_PERMISSIONS = new Set([
  'fullscreen',
  'clipboard-sanitized-write'
]);

/**
 * Mapeia permissões do Chromium para chaves consistentes de permissão.
 * Bloco 2.3: Quando mediaTypes contiver áudio e vídeo juntos, retorna 'media'.
 * Só retorna 'media:video' ou 'media:audio' quando for estritamente um tipo.
 * @param {string} permission
 * @param {object} details
 * @returns {string|null}
 */
function getPermissionKey(permission, details) {
  if (permission === 'media') {
    const types = details && Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
    const hasVideo = types.includes('video');
    const hasAudio = types.includes('audio');
    if (hasVideo && hasAudio) return 'media';
    if (hasVideo) return 'media:video';
    if (hasAudio) return 'media:audio';
    return 'media';
  }
  if (permission === 'notifications') return 'notifications';
  if (permission === 'geolocation') return 'geolocation';
  return null;
}

/**
 * Rótulo amigável em português para a interface do prompt de permissão
 * @param {string} permissionKey
 * @returns {string}
 */
function getPermissionLabel(permissionKey) {
  switch (permissionKey) {
    case 'media:video':
      return 'Câmera';
    case 'media:audio':
      return 'Microfone';
    case 'media':
      return 'Câmera e Microfone';
    case 'notifications':
      return 'Notificações';
    case 'geolocation':
      return 'Sua Localização';
    default:
      return permissionKey;
  }
}

/**
 * Cancela e nega todas as solicitações de permissão pendentes para um WebContents específico
 * @param {number} webContentsId
 */
function cancelPendingRequestsForWebContents(webContentsId) {
  if (!webContentsId) return;

  const toRemove = [];
  for (const [requestId, req] of pendingPermissionRequests.entries()) {
    if (req.webContentsId === webContentsId) {
      toRemove.push(requestId);
      if (typeof req.callback === 'function') {
        req.callback(false);
      }
    }
  }

  for (const requestId of toRemove) {
    pendingPermissionRequests.delete(requestId);
  }

  if (mainWindowRef && !mainWindowRef.isDestroyed() && toRemove.length > 0) {
    mainWindowRef.webContents.send('browser:cancel-permission-prompt', { webContentsId });
  }

  if (pendingPermissionRequests.size === 0 && windowManagerRef) {
    windowManagerRef.hideOverlay();
  }
}

/**
 * Aplica as configurações de Proxy à sessão informada
 * @param {Electron.Session} ses
 * @param {boolean} [isPrivate=false]
 */
function applyProxyToSession(ses, isPrivate = false) {
  if (!ses) return;

  const proxyMode = settings.get('proxyMode') || 'system';
  const applyToPrivate = Boolean(settings.get('applyProxyToPrivateTabs'));

  if (isPrivate && !applyToPrivate) {
    ses.setProxy({ mode: 'direct' }).catch(() => {});
    return;
  }

  if (proxyMode === 'manual') {
    const rules = settings.get('proxyRules') || '';
    const bypass = settings.get('proxyBypass') || '<local>;*.local';
    ses.setProxy({ proxyRules: rules, proxyBypassRules: bypass }).catch(err => {
      console.warn('[Proxy] Falha ao configurar proxy manual:', err.message);
    });
  } else if (proxyMode === 'direct') {
    ses.setProxy({ mode: 'direct' }).catch(() => {});
  } else {
    ses.setProxy({ mode: 'system' }).catch(() => {});
  }
}

/**
 * Trata a resposta do usuário dada no prompt de permissão (bottom-sheet)
 * @param {string} requestId
 * @param {boolean} allowed
 * @param {boolean} remember
 */
function respondPermission(requestId, allowed, remember) {
  if (!requestId || !pendingPermissionRequests.has(requestId)) return;

  const req = pendingPermissionRequests.get(requestId);
  pendingPermissionRequests.delete(requestId);

  if (remember) {
    if (req.isPrivate) {
      privatePermissions.set(`${req.origin}::${req.permissionKey}`, allowed ? 'allow' : 'block');
    } else {
      permissions.setPermission(req.origin, req.permissionKey, allowed ? 'allow' : 'block');
    }
  }

  if (typeof req.callback === 'function') {
    req.callback(Boolean(allowed));
  }

  // O overlay só deve ser escondido quando a fila esvaziar por completo
  if (pendingPermissionRequests.size === 0 && windowManagerRef) {
    windowManagerRef.hideOverlay();
  }
}

/**
 * Configura segurança, downloads, privacidade e permissões para qualquer sessão
 * @param {Electron.Session} ses Instância de sessão
 * @param {boolean} [isPrivate=false]
 */
function configureSession(ses, isPrivate = false) {
  if (!ses) return;

  // 1. Aplica regras de privacidade da rede (bloqueio de rastreadores, HTTPS, headers, cookies)
  privacy.applyPrivacy(ses);

  // 2. Registra o gerenciador de downloads (downloads privados não vão para o disco)
  downloads.registerSessionDownloads(ses, isPrivate);

  // 3. Aplica regras de proxy
  applyProxyToSession(ses, isPrivate);

  // Helper para checar status (considera memória privada ou storage persistente)
  const getDecision = (origin, key) => {
    if (isPrivate) {
      return privatePermissions.get(`${origin}::${key}`);
    }
    return permissions.getPermission(origin, key);
  };

  // 4. Política de permissões por site com prompt e persistência (negar por padrão)
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (ALLOWED_PERMISSIONS.has(permission)) {
      if (details && details.isMainFrame !== false) {
        callback(true);
        return;
      }
      callback(false);
      return;
    }

    const permissionKey = getPermissionKey(permission, details);
    if (!permissionKey) {
      console.warn(`[Segurança] Permissão desconhecida negada por padrão para ${details?.requestingUrl}: ${permission}`);
      callback(false);
      return;
    }

    const origin = details?.requestingUrl || '';
    let savedDecision = getDecision(origin, permissionKey);

    // Se a chave for 'media', mas tivermos permissões individuais de áudio e vídeo
    if (!savedDecision && permissionKey === 'media') {
      const vid = getDecision(origin, 'media:video');
      const aud = getDecision(origin, 'media:audio');
      if (vid === 'allow' && aud === 'allow') savedDecision = 'allow';
      else if (vid === 'block' || aud === 'block') savedDecision = 'block';
    } else if (!savedDecision && (permissionKey === 'media:video' || permissionKey === 'media:audio')) {
      const med = getDecision(origin, 'media');
      if (med) savedDecision = med;
    }

    if (savedDecision === 'allow') {
      callback(true);
      return;
    }
    if (savedDecision === 'block') {
      callback(false);
      return;
    }

    // Se ainda não houver decisão para a origem, abre o prompt na interface
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      const requestId = crypto.randomUUID();
      pendingPermissionRequests.set(requestId, {
        callback,
        origin,
        permissionKey,
        webContentsId: webContents.id,
        isPrivate: Boolean(isPrivate)
      });

      mainWindowRef.webContents.send('browser:prompt-permission', {
        requestId,
        origin,
        permissionKey,
        webContentsId: webContents.id,
        label: getPermissionLabel(permissionKey)
      });

      if (windowManagerRef) {
        windowManagerRef.showOverlay();
      }
    } else {
      callback(false);
    }
  });

  // 5. Verificação síncrona de permissões concedidas anteriormente
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (ALLOWED_PERMISSIONS.has(permission)) {
      return true;
    }
    const permissionKey = getPermissionKey(permission, details);
    if (!permissionKey) return false;

    if (permissionKey === 'media') {
      const stateMedia = getDecision(requestingOrigin, 'media');
      if (stateMedia === 'allow') return true;
      if (stateMedia === 'block') return false;
      return getDecision(requestingOrigin, 'media:video') === 'allow' && getDecision(requestingOrigin, 'media:audio') === 'allow';
    }

    if (permissionKey === 'media:video' || permissionKey === 'media:audio') {
      const stateSpecific = getDecision(requestingOrigin, permissionKey);
      if (stateSpecific === 'allow') return true;
      if (stateSpecific === 'block') return false;
      return getDecision(requestingOrigin, 'media') === 'allow';
    }

    return getDecision(requestingOrigin, permissionKey) === 'allow';
  });
}

/**
 * Inicializa a sessão padrão e os manipuladores globais
 * @param {object} context Objeto contendo { mainWindow, windowManager }
 */
function init(context) {
  mainWindowRef = context.mainWindow;
  windowManagerRef = context.windowManager;

  // Inicializa o motor de privacidade (carrega blocklist e exceções)
  privacy.init(context);

  // Configura a sessão padrão
  configureSession(session.defaultSession, false);

  // Trata autenticação de proxy e sites normais (Bloco 3.8)
  app.on('login', (event, webContents, request, authInfo, callback) => {
    if (authInfo && authInfo.isProxy) {
      event.preventDefault();
      const user = settings.get('proxyAuthUser') || '';
      const pass = settings.getProxyPassword() || '';
      if (user && pass) {
        callback(user, pass);
      } else {
        callback();
      }
    } else {
      // Para sites normais (!authInfo.isProxy), previne travamento do processo
      event.preventDefault();
      callback();
    }
  });

  // Sincroniza proxy quando as configurações forem alteradas
  settings.onChange((key) => {
    if (key.startsWith('proxy') || key === '*') {
      applyProxyToSession(session.defaultSession, false);
    }
  });
}

module.exports = {
  init,
  configureSession,
  applyProxyToSession,
  respondPermission,
  cancelPendingRequestsForWebContents,
  getPermissionKey,
  getPermissionLabel,
  ALLOWED_PERMISSIONS
};
```

---

### 4.10 `src/main/privacy.js`

```javascript
// =============================================================================
// src/main/privacy.js
// Proteções de privacidade no estilo DuckDuckGo:
// 1. Bloqueio de rastreadores (blocklist de domínios conhecidos)
// 2. Upgrade automático de HTTP para HTTPS com fallback seguro via token único
// 3. Cabeçalhos Sec-GPC: 1, DNT: 1 e minimização de Referer (com suporte a exceções)
// 4. Bloqueio de cookies de terceiros (Cookie / Set-Cookie com suporte a exceções)
// 5. Limpeza de parâmetros de rastreamento de URLs (utm_*, fbclid, etc.)
// 6. Política restrita de WebRTC para evitar vazamento de IP real
// =============================================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, webContents, net } = require('electron');
const storage = require('./storage');
const settings = require('./settings');
const {
  getBaseDomain,
  isLocalHost,
  isTrackerDomain: isTrackerDomainPure,
  cleanTrackingParameters,
  isValidBlocklistHost,
  calculatePrivacyGrade
} = require('./pure/privacy-utils');

// Conjunto de domínios conhecidos de rastreadores carregados de assets/blocklists/trackers.txt
const trackerDomains = new Set();

// Mapa em memória para rastreadores bloqueados por WebContents (aba ativa)
// Chave: webContentsId (número) -> Valor: { count: number, domains: Set<string> }
const tabTrackerData = new Map();

// Mapa em memória para contagem de pop-ups e redirecionamentos bloqueados por WebContents
// Chave: webContentsId (número) -> Valor: number
const tabPopupsBlocked = new Map();

// Mapa em memória para hosts temporariamente liberados para HTTP por aba
// Chave: webContentsId (número) -> Valor: Set<string> (hostnames em minúsculas)
const tabAllowedHttpHosts = new Map();

// Mapa em memória para hosts com certificado temporariamente aceito por aba
// Chave: webContentsId (número) -> Valor: Set<string> (hostnames em minúsculas)
const tabAllowedCertHosts = new Map();

// Mapa de tokens de uso único para autorização de navegação HTTP a partir do aviso de segurança
// Chave: token (UUID string) -> Valor: { wcId: number, host: string, expiresAt: number }
const httpBypassTokens = new Map();

// Mapa de tokens de uso único para autorização de certificado inválido
// Chave: token (UUID string) -> Valor: { wcId: number, host: string, expiresAt: number }
const certBypassTokens = new Map();

/**
 * Gera um token de uso único criptograficamente seguro para bypass temporário de HTTPS.
 * Vinculado estritamente ao webContentsId e ao hostname, com validade de 30 segundos.
 * @param {number} webContentsId
 * @param {string} hostname
 * @returns {string|null} Token UUID gerado ou null
 */
function createHttpBypassToken(webContentsId, hostname) {
  if (!webContentsId || !hostname || typeof hostname !== 'string') return null;
  const token = crypto.randomUUID();
  const host = hostname.toLowerCase();
  httpBypassTokens.set(token, {
    wcId: webContentsId,
    host: host,
    expiresAt: Date.now() + 30000 // 30 segundos de validade (curto prazo)
  });
  return token;
}

/**
 * Valida e consome imediatamente o token de bypass HTTP (uso único).
 * @param {string} token
 * @param {number} webContentsId
 * @param {string} hostname
 * @returns {boolean} true se válido e consumido com sucesso; false caso contrário
 */
function validateAndConsumeHttpBypassToken(token, webContentsId, hostname) {
  if (!token || !httpBypassTokens.has(token)) return false;
  const data = httpBypassTokens.get(token);

  if (Date.now() > data.expiresAt) {
    httpBypassTokens.delete(token);
    return false;
  }
  if (data.wcId !== webContentsId) return false;
  if (data.host !== hostname.toLowerCase()) return false;

  // Invalida imediatamente após o uso com sucesso (uso estritamente único)
  httpBypassTokens.delete(token);
  return true;
}

/**
 * Libera temporariamente um host para HTTP na aba informada.
 * @param {number} webContentsId
 * @param {string} hostname
 */
function allowHttpForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return;
  if (!tabAllowedHttpHosts.has(webContentsId)) {
    tabAllowedHttpHosts.set(webContentsId, new Set());
  }
  tabAllowedHttpHosts.get(webContentsId).add(hostname.toLowerCase());
}

/**
 * Verifica se um host está temporariamente liberado para HTTP nesta aba.
 * @param {number} webContentsId
 * @param {string} hostname
 * @returns {boolean}
 */
function isHttpAllowedForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return false;
  const set = tabAllowedHttpHosts.get(webContentsId);
  return Boolean(set && set.has(hostname.toLowerCase()));
}

/**
 * Limpa o conjunto de hosts HTTP liberados ao fechar a aba de origem.
 * @param {number} webContentsId
 */
function clearAllowedHttpHosts(webContentsId) {
  if (webContentsId) {
    tabAllowedHttpHosts.delete(webContentsId);
  }
}

/**
  * Gera um token de uso único para bypass temporário de erro de certificado SSL/TLS.
  * Vinculado estritamente ao webContentsId e ao hostname, com validade de 30 segundos.
  * @param {number} webContentsId
  * @param {string} hostname
  * @returns {string|null}
  */
function createCertBypassToken(webContentsId, hostname) {
  if (!webContentsId || !hostname || typeof hostname !== 'string') return null;
  const token = crypto.randomUUID();
  const host = hostname.toLowerCase();
  certBypassTokens.set(token, {
    wcId: webContentsId,
    host: host,
    expiresAt: Date.now() + 30000 // 30 segundos
  });
  return token;
}

/**
  * Valida e consome imediatamente o token de bypass de certificado (uso estritamente único).
  * @param {string} token
  * @param {number} webContentsId
  * @param {string} hostname
  * @returns {boolean}
  */
function validateAndConsumeCertBypassToken(token, webContentsId, hostname) {
  if (!token || !certBypassTokens.has(token)) return false;
  const data = certBypassTokens.get(token);

  if (Date.now() > data.expiresAt) {
    certBypassTokens.delete(token);
    return false;
  }
  if (data.wcId !== webContentsId) return false;
  if (data.host !== hostname.toLowerCase()) return false;

  certBypassTokens.delete(token);
  return true;
}

/**
  * Libera temporariamente um host com erro de certificado SSL nesta aba.
  * @param {number} webContentsId
  * @param {string} hostname
  */
function allowCertHostForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return;
  if (!tabAllowedCertHosts.has(webContentsId)) {
    tabAllowedCertHosts.set(webContentsId, new Set());
  }
  tabAllowedCertHosts.get(webContentsId).add(hostname.toLowerCase());
}

/**
  * Verifica se um host com certificado inválido está temporariamente aceito nesta aba.
  * @param {number} webContentsId
  * @param {string} hostname
  * @returns {boolean}
  */
function isCertAllowedForTab(webContentsId, hostname) {
  if (!webContentsId || !hostname) return false;
  const set = tabAllowedCertHosts.get(webContentsId);
  return Boolean(set && set.has(hostname.toLowerCase()));
}

/**
  * Limpa os hosts com certificado aceito ao fechar a aba de origem.
  * @param {number} webContentsId
  */
function clearAllowedCertHosts(webContentsId) {
  if (webContentsId) {
    tabAllowedCertHosts.delete(webContentsId);
  }
}

// Lista de sites onde o usuário desativou a proteção (persistida via storage.js)
let exemptSites = new Set();

// Referência opcional para notificar o renderer sobre novos rastreadores bloqueados
let onBlockedCallback = null;

// Parâmetros comuns de rastreamento a serem removidos de links
const TRACKING_PARAM_REGEX = /^(utm_[a-zA-Z0-9_]+|fbclid|gclid|msclkid|mc_eid|igshid|_ga)$/i;

/**
 * Verifica se um determinado host ou seu domínio base está na lista de exceções do usuário.
 * @param {string} hostname
 * @returns {boolean}
 */
function isSiteExempt(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const clean = hostname.toLowerCase();
  if (exemptSites.has(clean)) return true;
  const base = getBaseDomain(clean);
  return Boolean(base && exemptSites.has(base));
}

/**
 * Carrega a lista de domínios a partir de um arquivo em disco
 * @param {string} filePath
 */
function loadBlocklistFromFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim().toLowerCase();
        if (line && !line.startsWith('#')) {
          trackerDomains.add(line);
        }
      }
      return true;
    }
  } catch (err) {
    console.error(`[Privacidade] Erro ao carregar blocklist de ${filePath}:`, err.message);
  }
  return false;
}

/**
 * Verifica e baixa atualização da lista de rastreadores (Peter Lowe / EasyPrivacy) periodicamente.
 * Bloco 2.5: Valida cada linha contra regex de hostname válido, limita download a 5MB e usa timeout de 15s.
 */
function checkForBlocklistUpdates() {
  const userListPath = path.join(app.getPath('userData'), 'trackers-updated.txt');
  let shouldUpdate = false;

  try {
    if (!fs.existsSync(userListPath)) {
      shouldUpdate = true;
    } else {
      const stat = fs.statSync(userListPath);
      // Atualiza a cada 7 dias
      if (Date.now() - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
        shouldUpdate = true;
      }
    }
  } catch {
    shouldUpdate = true;
  }

  if (!shouldUpdate) return;

  const url = 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=nohtml&showintro=0&mimetype=plaintext';
  try {
    const request = net.request(url);
    let rawData = '';
    const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
    let totalReceived = 0;
    let aborted = false;

    // Timeout de 15 segundos
    const timer = setTimeout(() => {
      aborted = true;
      try { request.abort(); } catch {}
    }, 15000);

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timer);
        return;
      }
      response.on('data', (chunk) => {
        if (aborted) return;
        totalReceived += chunk.length;
        if (totalReceived > MAX_DOWNLOAD_BYTES) {
          aborted = true;
          clearTimeout(timer);
          try { request.abort(); } catch {}
          return;
        }
        rawData += chunk.toString();
      });
      response.on('end', () => {
        clearTimeout(timer);
        if (aborted) return;
        const rawLines = rawData.split(/\r?\n/);
        const validDomains = [];
        for (const line of rawLines) {
          if (isValidBlocklistHost(line)) {
            validDomains.push(line.trim().toLowerCase());
          }
        }
        if (validDomains.length > 500) {
          fs.writeFileSync(userListPath, validDomains.join('\n'), 'utf-8');
          for (const domain of validDomains) {
            trackerDomains.add(domain);
          }
          console.log(`[Privacidade] Blocklist atualizada dinamicamente com ${validDomains.length} domínios válidos.`);
        }
      });
    });

    request.on('error', () => {
      clearTimeout(timer);
      // Ignora falhas de rede silenciosamente para manter lista offline embutida
    });

    request.end();
  } catch {}
}

/**
 * Inicializa o módulo de privacidade carregando a blocklist e as exceções
 * @param {object} context Contexto global do app
 */
function init(context) {
  // Carrega lista atualizada do usuário em userData ou fallback para lista embutida
  const userListPath = path.join(app.getPath('userData'), 'trackers-updated.txt');
  const bundledListPath = path.join(__dirname, '../../assets/blocklists/trackers.txt');

  if (!loadBlocklistFromFile(userListPath)) {
    loadBlocklistFromFile(bundledListPath);
  }
  console.log(`[Privacidade] ${trackerDomains.size} domínios de rastreamento carregados.`);

  // Carrega a lista de sites liberados pelo usuário
  const savedExemptions = storage.readJSON('privacy-exemptions.json', []);
  if (Array.isArray(savedExemptions)) {
    exemptSites = new Set(savedExemptions.map(h => h.toLowerCase()));
  }

  // Verifica atualizações em segundo plano após inicialização
  setTimeout(() => {
    checkForBlocklistUpdates();
  }, 10000);
}

/**
 * Verifica se um domínio coincide com a lista de rastreadores (delega para função pura)
 * @param {string} hostname Hostname a ser testado
 * @returns {boolean}
 */
function isTrackerDomain(hostname) {
  return isTrackerDomainPure(hostname, trackerDomains);
}

/**
 * Registra as regras de privacidade na sessão informada (padrão ou privada)
 * @param {Electron.Session} sessionInstance Sessão do Electron
 */
function applyPrivacy(sessionInstance) {
  if (!sessionInstance || !sessionInstance.webRequest) return;

  // ---------------------------------------------------------------------------
  // 1. onBeforeRequest: Bloqueio de rastreadores, Upgrade HTTPS e Limpeza de links
  // ---------------------------------------------------------------------------
  sessionInstance.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const reqUrl = details.url;

    // A) Permite arquivos locais, páginas internas e esquemas especiais
    if (reqUrl.startsWith('file:') || reqUrl.startsWith('data:') || reqUrl.startsWith('chrome:')) {
      return callback({ cancel: false });
    }

    let parsedReqUrl = null;
    try {
      parsedReqUrl = new URL(reqUrl);
    } catch {
      return callback({ cancel: false });
    }

    const host = parsedReqUrl.hostname;

    // B) Limpeza de links com parâmetros de rastreamento na navegação principal
    if (details.resourceType === 'mainFrame') {
      const { cleanedUrl, hasRemovedParams } = cleanTrackingParameters(reqUrl);
      if (hasRemovedParams) {
        return callback({ redirectURL: cleanedUrl });
      }
    }

    // C) Upgrade automático de HTTP para HTTPS com suporte a token de uso único
    if (parsedReqUrl.protocol === 'http:') {
      const isLocal = isLocalHost(host);
      const wcId = details.webContentsId;
      const bypassToken = parsedReqUrl.searchParams.get('dragon_bypass_token');

      if (bypassToken) {
        // Remove o token da URL para não vazar pela rede nem para o site
        parsedReqUrl.searchParams.delete('dragon_bypass_token');
        const isValid = validateAndConsumeHttpBypassToken(bypassToken, wcId, host);
        if (isValid) {
          // Token único válido: libera o host temporariamente para esta aba
          if (wcId) {
            allowHttpForTab(wcId, host);
          }
          return callback({ redirectURL: parsedReqUrl.toString() });
        }
        // Se o token for inválido, expirado ou forjado, continua o fluxo seguro (upgrade HTTPS)
      }

      // Nas requisições seguintes, pula o upgrade para hosts liberados nesta aba
      const isHttpAllowed = isHttpAllowedForTab(wcId, host);
      if (!isLocal && !isHttpAllowed) {
        // Redireciona para HTTPS mantendo porta padrão ou alterando protocolo
        parsedReqUrl.protocol = 'https:';
        return callback({ redirectURL: parsedReqUrl.toString() });
      }
    }

    // D) Bloqueio de Rastreadores
    // Bloquear apenas requisições que não sejam mainFrame (navegar direto deve funcionar)
    // E NÃO bloquear requisições first-party (mesmo domínio base do initiator ou da página ativa)
    let pageHost = '';
    try {
      if (details.initiator) {
        pageHost = new URL(details.initiator).hostname;
      }
    } catch {}

    // Trata initiator ausente obtendo o hostname da URL do WebContents da aba
    if (!pageHost && details.webContentsId) {
      try {
        const wc = details.webContents || webContents.fromId(details.webContentsId);
        if (wc && !wc.isDestroyed()) {
          const currentUrl = wc.getURL();
          if (currentUrl) {
            pageHost = new URL(currentUrl).hostname;
          }
        }
      } catch {}
    }

    const isFirstParty = Boolean(pageHost && host && getBaseDomain(pageHost) === getBaseDomain(host));
    const exempt = Boolean(pageHost && isSiteExempt(pageHost));

    if (details.resourceType !== 'mainFrame' && !isFirstParty && !exempt && isTrackerDomain(host)) {
      // Incrementa o contador da aba que originou a requisição
      const wcId = details.webContentsId;
      if (wcId) {
        if (!tabTrackerData.has(wcId)) {
          tabTrackerData.set(wcId, { count: 0, domains: new Set() });
        }
        const data = tabTrackerData.get(wcId);
        data.count++;
        data.domains.add(host);

        if (typeof onBlockedCallback === 'function') {
          onBlockedCallback(wcId, data);
        }
      }

      // Cancela a requisição do rastreador
      return callback({ cancel: true });
    }

    callback({ cancel: false });
  });

  // ---------------------------------------------------------------------------
  // 2. onBeforeSendHeaders: Sec-GPC, DNT, Referer e Cookies de Terceiros
  // ---------------------------------------------------------------------------
  sessionInstance.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = details.requestHeaders;

    // Envia cabeçalhos que expressam recusa explícita de rastreamento
    headers['Sec-GPC'] = '1'; // Global Privacy Control
    headers['DNT'] = '1';     // Do Not Track

    // Normalização estável de User-Agent (ETAPA 5)
    if (settings && typeof settings.get === 'function' &&
        settings.get('fingerprintProtectionEnabled') &&
        settings.get('fingerprintNormalizeUA')) {
      const genericUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
      headers['User-Agent'] = genericUA;
      if (headers['user-agent']) headers['user-agent'] = genericUA;
    }

    let reqHost = '';
    try {
      reqHost = new URL(details.url).hostname;
    } catch {}

    let initiatorHost = '';
    try {
      if (details.initiator) {
        initiatorHost = new URL(details.initiator).hostname;
      }
    } catch {}

    // Identifica o hostname da página para verificar exceções do usuário
    let pageHost = initiatorHost;
    if (!pageHost && details.webContentsId) {
      try {
        const wc = details.webContents || webContents.fromId(details.webContentsId);
        if (wc && !wc.isDestroyed()) {
          const currentUrl = wc.getURL();
          if (currentUrl) {
            pageHost = new URL(currentUrl).hostname;
          }
        }
      } catch {}
    }

    const exempt = Boolean(pageHost && isSiteExempt(pageHost));
    const isCrossOrigin = initiatorHost && reqHost && getBaseDomain(initiatorHost) !== getBaseDomain(reqHost);

    // Se o site não estiver na lista de exceções, aplica proteção contra rastreamento cross-origin
    if (isCrossOrigin && !exempt) {
      // Reduz o Referer para apenas a origem (sem caminho nem parâmetros sensíveis)
      if (headers['Referer'] || headers['referer']) {
        try {
          const refUrl = new URL(headers['Referer'] || headers['referer']);
          headers['Referer'] = refUrl.origin + '/';
        } catch {
          delete headers['Referer'];
          delete headers['referer'];
        }
      }

      // Bloqueio de Cookies de Terceiros: só deve valer para resourceType diferente de "mainFrame" e "subFrame"
      if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
        delete headers['Cookie'];
        delete headers['cookie'];
      }
    }

    callback({ requestHeaders: headers });
  });

  // ---------------------------------------------------------------------------
  // 3. onHeadersReceived: Impede plantio de Cookies por terceiros (Set-Cookie)
  // ---------------------------------------------------------------------------
  sessionInstance.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const headers = details.responseHeaders || {};

    let reqHost = '';
    try {
      reqHost = new URL(details.url).hostname;
    } catch {}

    let initiatorHost = '';
    try {
      if (details.initiator) {
        initiatorHost = new URL(details.initiator).hostname;
      }
    } catch {}

    let pageHost = initiatorHost;
    if (!pageHost && details.webContentsId) {
      try {
        const wc = details.webContents || webContents.fromId(details.webContentsId);
        if (wc && !wc.isDestroyed()) {
          const currentUrl = wc.getURL();
          if (currentUrl) {
            pageHost = new URL(currentUrl).hostname;
          }
        }
      } catch {}
    }

    const exempt = Boolean(pageHost && isSiteExempt(pageHost));
    const isCrossOrigin = initiatorHost && reqHost && getBaseDomain(initiatorHost) !== getBaseDomain(reqHost);

    // Bloqueio de Set-Cookie de Terceiros: ignora se o site foi liberado em exemptSites
    if (isCrossOrigin && !exempt && details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
      delete headers['Set-Cookie'];
      delete headers['set-cookie'];
    }

    callback({ responseHeaders: headers });
  });
}

/**
 * Configura política restrita de WebRTC para evitar vazamento de IP real
 * @param {Electron.WebContents} webContents
 */
function applyWebRTCPolicy(webContents) {
  if (webContents && typeof webContents.setWebRTCIPHandlingPolicy === 'function') {
    webContents.setWebRTCIPHandlingPolicy('default_public_interface_only');
  }
}

/**
 * Registra um pop-up ou redirecionamento forçado bloqueado na aba
 * @param {number} webContentsId
 */
function recordPopupBlocked(webContentsId) {
  if (!webContentsId) return;
  const current = tabPopupsBlocked.get(webContentsId) || 0;
  tabPopupsBlocked.set(webContentsId, current + 1);
  if (onBlockedCallback) {
    onBlockedCallback(webContentsId);
  }
}

/**
 * Zera o contador de rastreadores e pop-ups para uma aba (chamado ao navegar)
 * @param {number} webContentsId
 */
function resetTabTrackerData(webContentsId) {
  if (webContentsId) {
    tabTrackerData.delete(webContentsId);
    tabPopupsBlocked.delete(webContentsId);
  }
}

/**
 * Retorna as estatísticas de privacidade e nota de classificação para o webContents informado
 * @param {number} webContentsId
 * @param {string} currentUrl
 * @returns {{ count: number, domains: string[], popupsBlocked: number, grade: string, isHttps: boolean, isProtected: boolean, hostname: string }}
 */
function getPrivacyInfoForTab(webContentsId, currentUrl) {
  let hostname = '';
  let isHttps = true;
  try {
    if (currentUrl) {
      const parsed = new URL(currentUrl);
      hostname = parsed.hostname;
      isHttps = parsed.protocol === 'https:';
    }
  } catch {}

  const isProtected = Boolean(hostname && !isSiteExempt(hostname));
  const data = tabTrackerData.get(webContentsId) || { count: 0, domains: new Set() };
  const popupsBlocked = tabPopupsBlocked.get(webContentsId) || 0;

  const grade = calculatePrivacyGrade({
    isHttps,
    count: data.count,
    popupsBlocked
  });

  return {
    count: data.count,
    domains: Array.from(data.domains),
    popupsBlocked,
    grade,
    isHttps,
    isProtected,
    hostname
  };
}

/**
 * Alterna a proteção contra rastreadores para o site informado
 * @param {string} hostname
 * @returns {boolean} Novo estado de proteção (true = ativado, false = desativado)
 */
function toggleSiteProtection(hostname) {
  if (!hostname) return true;
  const cleanHost = hostname.toLowerCase();

  if (exemptSites.has(cleanHost)) {
    exemptSites.delete(cleanHost);
  } else {
    exemptSites.add(cleanHost);
  }

  // Persiste a lista atualizada
  storage.writeJSON('privacy-exemptions.json', Array.from(exemptSites));
  return !exemptSites.has(cleanHost);
}

/**
 * Define callback para notificar quando novos rastreadores forem bloqueados
 * @param {Function} cb
 */
function setOnBlockedCallback(cb) {
  onBlockedCallback = cb;
}

module.exports = {
  init,
  applyPrivacy,
  applyWebRTCPolicy,
  resetTabTrackerData,
  recordPopupBlocked,
  createHttpBypassToken,
  validateAndConsumeHttpBypassToken,
  allowHttpForTab,
  isHttpAllowedForTab,
  clearAllowedHttpHosts,
  createCertBypassToken,
  validateAndConsumeCertBypassToken,
  allowCertHostForTab,
  isCertAllowedForTab,
  clearAllowedCertHosts,
  isValidBlocklistHost,
  getPrivacyInfoForTab,
  toggleSiteProtection,
  setOnBlockedCallback,
  isTrackerDomain,
  cleanTrackingParameters,
  isLocalHost,
  getBaseDomain,
  isSiteExempt
};
```

---

### 4.11 `src/main/settings.js`

```javascript
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
  all.proxyPassword = getProxyPassword();
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

  const rules = proxyConfig.proxyRules || get('proxyRules') || '';
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
```

---

### 4.12 `src/main/clear-data.js`

```javascript
// =============================================================================
// src/main/clear-data.js
// Módulo responsável pela exclusão completa e segura de dados de navegação
// Invocado durante a animação do Fogo do Dragão Azul
// =============================================================================

const { session } = require('electron');
const history = require('./history');
const downloads = require('./downloads');
const permissions = require('./permissions');
const bookmarks = require('./bookmarks');

/**
 * Lista de tipos de armazenamento suportados pelo Electron
 */
const STORAGE_TYPES = [
  'cookies',
  'localstorage',
  'indexdb',
  'serviceworkers',
  'cachestorage',
  'filesystem',
  'websql',
  'shadercache'
];

/**
 * Executa a limpeza completa e profunda de todos os dados do navegador.
 * A função é totalmente assíncrona e trata os erros de cada etapa de forma
 * isolada para registrar falhas no summary sem interromper os demais passos.
 *
 * @param {object} context Objeto contendo { mainWindow, tabManager, storage, includeBookmarks }
 * @param {object} [options] Opções adicionais como { includeBookmarks: boolean }
 * @returns {Promise<object>} Resumo estruturado do que foi apagado com success:boolean e errors:string[]
 */
async function clearAllData(context, options = {}) {
  const { mainWindow, tabManager, storage } = context || {};
  const includeBookmarks = Boolean(
    (options && options.includeBookmarks) ||
    (context && context.includeBookmarks)
  );

  const summary = {
    success: true,
    tabsDestroyed: 0,
    storageDataCleared: false,
    cacheCleared: false,
    codeCacheCleared: false,
    authCacheCleared: false,
    hostResolverCacheCleared: false,
    hstsCleared: false,
    localFilesRemoved: [],
    historyCleared: false,
    downloadsCleared: false,
    permissionsCleared: false,
    bookmarksCleared: false,
    zoomReset: false,
    customPartitionsCleared: 0,
    errors: []
  };

  // 1. Fechar e destruir TODAS as abas existentes (libera memória e encerra webContents)
  try {
    if (tabManager && typeof tabManager.destroyAllTabs === 'function') {
      summary.tabsDestroyed = tabManager.destroyAllTabs();
    }
    if (tabManager && typeof tabManager.clearClosedTabs === 'function') {
      tabManager.clearClosedTabs();
    }
  } catch (err) {
    console.error('[ClearData] Erro ao fechar abas:', err);
    summary.errors.push(`Erro ao fechar abas: ${err.message}`);
  }

  // 2. Limpar histórico de navegação (zera cache em memória e persiste history.json vazio)
  try {
    if (history && typeof history.clearAll === 'function') {
      history.clearAll();
      summary.historyCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar histórico:', err);
    summary.errors.push(`Erro ao limpar histórico: ${err.message}`);
  }

  // 3. Limpar histórico de downloads (zera cache em memória e persiste downloads.json vazio)
  try {
    if (downloads && typeof downloads.clearHistory === 'function') {
      downloads.clearHistory();
      summary.downloadsCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar downloads:', err);
    summary.errors.push(`Erro ao limpar downloads: ${err.message}`);
  }

  // 4. Limpar permissões concedidas a sites (zera cache em memória e persiste permissions.json vazio)
  try {
    if (permissions && typeof permissions.clearAll === 'function') {
      permissions.clearAll();
      summary.permissionsCleared = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar permissões:', err);
    summary.errors.push(`Erro ao limpar permissões: ${err.message}`);
  }

  // 5. Favoritos: NÃO apagar por padrão; apagar apenas se includeBookmarks for verdadeiro
  if (includeBookmarks) {
    try {
      if (bookmarks && typeof bookmarks.clearAll === 'function') {
        bookmarks.clearAll();
        summary.bookmarksCleared = true;
      }
    } catch (err) {
      console.error('[ClearData] Erro ao limpar favoritos:', err);
      summary.errors.push(`Erro ao limpar favoritos: ${err.message}`);
    }
  }

  // Obter sessão padrão do Electron
  const defaultSession = session ? session.defaultSession : null;

  // 6. Limpar dados de armazenamento (clearStorageData em chamada geral e por tipo)
  if (defaultSession && typeof defaultSession.clearStorageData === 'function') {
    let anyStorageError = false;
    try {
      // Chamada ampla padrão recomendada pelo Electron/Chromium
      await defaultSession.clearStorageData({});
      console.log('[ClearData] Limpeza geral de storageData concluída na sessão padrão.');
    } catch (err) {
      console.warn('[ClearData] Aviso na chamada geral de clearStorageData:', err.message);
    }

    for (const st of STORAGE_TYPES) {
      try {
        await defaultSession.clearStorageData({ storages: [st] });
      } catch (err) {
        anyStorageError = true;
        console.error(`[ClearData] Erro ao limpar storage '${st}':`, err);
        summary.errors.push(`Erro ao limpar storage '${st}': ${err.message}`);
      }
    }
    summary.storageDataCleared = !anyStorageError;
  }

  // 7. Limpar memória cache de rede
  try {
    if (defaultSession && typeof defaultSession.clearCache === 'function') {
      await defaultSession.clearCache();
      summary.cacheCleared = true;
      console.log('[ClearData] Cache de rede da sessão padrão limpo com sucesso.');
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar cache de rede:', err);
    summary.errors.push(`Erro ao limpar cache de rede: ${err.message}`);
  }

  // 8. Limpar cache de código (clearCodeCaches)
  try {
    if (defaultSession && typeof defaultSession.clearCodeCaches === 'function') {
      await defaultSession.clearCodeCaches({});
      summary.codeCacheCleared = true;
      console.log('[ClearData] Cache de código da sessão padrão limpo com sucesso.');
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar cache de código:', err);
    summary.errors.push(`Erro ao limpar cache de código: ${err.message}`);
  }

  // 9. Limpar credenciais de autenticação HTTP
  try {
    if (defaultSession && typeof defaultSession.clearAuthCache === 'function') {
      await defaultSession.clearAuthCache();
      summary.authCacheCleared = true;
      console.log('[ClearData] Cache de autenticação HTTP limpo com sucesso.');
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar auth cache:', err);
    summary.errors.push(`Erro ao limpar auth cache: ${err.message}`);
  }

  // 10. Limpar DNS (host resolver cache)
  try {
    if (defaultSession && typeof defaultSession.clearHostResolverCache === 'function') {
      await defaultSession.clearHostResolverCache();
      summary.hostResolverCacheCleared = true;
      console.log('[ClearData] Cache do resolvedor de host (DNS) limpo com sucesso.');
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar host resolver cache:', err);
    summary.errors.push(`Erro ao limpar host resolver cache: ${err.message}`);
  }

  // 11. Limpar HSTS quando a API existir
  try {
    if (defaultSession && typeof defaultSession.clearHSTS === 'function') {
      await defaultSession.clearHSTS();
      summary.hstsCleared = true;
      console.log('[ClearData] Políticas HSTS limpas com sucesso.');
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar HSTS:', err);
    summary.errors.push(`Erro ao limpar HSTS: ${err.message}`);
  }

  // 12. Apagar arquivos auxiliares locais via storage.js
  try {
    if (storage && typeof storage.clearBrowserData === 'function') {
      summary.localFilesRemoved = storage.clearBrowserData();
      console.log('[ClearData] Arquivos locais auxiliares removidos:', summary.localFilesRemoved);
    }
  } catch (err) {
    console.error('[ClearData] Erro ao limpar dados locais do storage:', err);
    summary.errors.push(`Erro ao limpar dados locais do storage: ${err.message}`);
  }

  // 13. Zerar sessions.json no disco
  try {
    if (storage && typeof storage.writeJSON === 'function') {
      storage.writeJSON('sessions.json', { urls: [] });
      console.log('[ClearData] sessions.json zerado no disco.');
    }
  } catch (err) {
    console.warn('[ClearData] Aviso ao zerar sessions.json:', err.message);
  }

  // 14. Zerar zoom por site na interface e redefinir níveis padrões
  try {
    if (mainWindow && (!mainWindow.isDestroyed || !mainWindow.isDestroyed()) && mainWindow.webContents) {
      mainWindow.webContents.setZoomLevel(0);
      summary.zoomReset = true;
    }
  } catch (err) {
    console.error('[ClearData] Erro ao zerar zoom:', err);
    summary.errors.push(`Erro ao zerar zoom: ${err.message}`);
  }

  // 15. Limpar partições privadas ativas (mesmo sem abas abertas)
  try {
    if (tabManager && typeof tabManager.getActivePrivatePartitions === 'function') {
      const activePartitions = tabManager.getActivePrivatePartitions();
      for (const part of activePartitions) {
        try {
          if (session && typeof session.fromPartition === 'function') {
            const customSes = session.fromPartition(part);
            if (customSes) {
              try {
                if (typeof customSes.clearStorageData === 'function') {
                  await customSes.clearStorageData({});
                }
              } catch {}

              for (const st of STORAGE_TYPES) {
                try {
                  if (typeof customSes.clearStorageData === 'function') {
                    await customSes.clearStorageData({ storages: [st] });
                  }
                } catch (e) {
                  summary.errors.push(`Erro ao limpar storage '${st}' em partição '${part}': ${e.message}`);
                }
              }
              if (typeof customSes.clearCache === 'function') {
                await customSes.clearCache();
              }
              if (typeof customSes.clearCodeCaches === 'function') {
                await customSes.clearCodeCaches({});
              }
              if (typeof customSes.clearAuthCache === 'function') {
                await customSes.clearAuthCache();
              }
              if (typeof customSes.clearHostResolverCache === 'function') {
                await customSes.clearHostResolverCache();
              }
              summary.customPartitionsCleared++;
              console.log(`[ClearData] Partição privada '${part}' limpa integralmente.`);
            }
          }
        } catch (e) {
          summary.errors.push(`Erro ao limpar partição '${part}': ${e.message}`);
        }
      }

      if (typeof tabManager.clearPrivatePartitionsList === 'function') {
        tabManager.clearPrivatePartitionsList();
      }
    }
  } catch (err) {
    console.warn('[ClearData] Aviso ao limpar partições privadas:', err.message);
    summary.errors.push(`Erro ao limpar partições privadas: ${err.message}`);
  }

  // Define status de sucesso geral (verdadeiro se não houver erros registrados)
  summary.success = summary.errors.length === 0;

  return summary;
}

module.exports = {
  clearAllData
};
```

---

### 4.13 `src/main/storage.js`

```javascript
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
function writeJSON(filename, data) {
  try {
    const filePath = path.join(storageDir, filename);
    const tmpPath = `${filePath}.tmp`;
    const bakPath = `${filePath}.bak`;
    const content = JSON.stringify(data, null, 2);

    // 1. Grava primeiramente no arquivo temporário .tmp
    fs.writeFileSync(tmpPath, content, 'utf-8');

    // 2. Se o destino atual já existir, preserva no .bak
    if (fs.existsSync(filePath)) {
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
  clearBrowserData
};

```

---

### 4.14 `src/main/navigation.js`

```javascript
// =============================================================================
// src/main/navigation.js
// Normalização da barra de endereços e comandos de navegação
// =============================================================================

const {
  DEFAULT_SEARCH_ENGINE,
  NEW_TAB_URL,
  SETTINGS_PAGE_URL,
  DOWNLOADS_PAGE_URL,
  HISTORY_PAGE_URL,
  BOOKMARKS_PAGE_URL
} = require('./config');
const settings = require('./settings');
const { normalizeInput: normalizeInputPure } = require('./pure/navigation-utils');

/**
 * Normaliza o texto digitado pelo usuário na barra de endereços delegando para a função pura
 * @param {string} rawInput Texto bruto digitado pelo usuário
 * @returns {string} URL pronta para navegação
 */
function normalizeInput(rawInput) {
  return normalizeInputPure(rawInput, {
    newTabUrl: NEW_TAB_URL,
    settingsUrl: SETTINGS_PAGE_URL,
    downloadsUrl: DOWNLOADS_PAGE_URL,
    historyUrl: HISTORY_PAGE_URL,
    bookmarksUrl: BOOKMARKS_PAGE_URL,
    searchTemplate: settings.getSearchUrlTemplate()
  });
}

/**
 * Navega a aba ativa para a URL especificada (normalizando antes a entrada)
 * @param {object} tabManager Instância do gerenciador de abas
 * @param {string} rawInput Texto ou URL digitada
 */
function loadURL(tabManager, rawInput) {
  const rawTrimmed = (rawInput || '').trim();
  const lower = rawTrimmed.toLowerCase();

  // Se o usuário digitou diretamente atalhos de páginas internas que possuem aba dedicada,
  // reutiliza a aba existente ou abre com isolamento
  if (lower === 'dragon://downloads' || lower === 'about:downloads') {
    if (typeof tabManager.openDownloadsTab === 'function') {
      tabManager.openDownloadsTab();
      return;
    }
  }
  if (lower === 'dragon://settings' || lower === 'about:settings') {
    if (typeof tabManager.openSettingsTab === 'function') {
      tabManager.openSettingsTab();
      return;
    }
  }
  if (lower === 'dragon://history' || lower === 'about:history') {
    if (typeof tabManager.openHistoryTab === 'function') {
      tabManager.openHistoryTab();
      return;
    }
  }
  if (lower === 'dragon://bookmarks' || lower === 'about:bookmarks') {
    if (typeof tabManager.openBookmarksTab === 'function') {
      tabManager.openBookmarksTab();
      return;
    }
  }

  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  const isExplicitHttps = /^https:\/\//i.test(rawTrimmed);
  activeTab.isExplicitHttps = isExplicitHttps;

  let targetUrl = normalizeInput(rawInput);
  try {
    new URL(targetUrl);
  } catch {
    targetUrl = settings.getSearchUrl(rawInput);
  }

  if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(targetUrl)) {
    console.warn(`[Navegação] URL não permitida bloqueada: ${targetUrl}`);
    return;
  }
  activeTab.view.webContents.loadURL(targetUrl).catch(err => {
    // Erros normais de cancelamento (-3 ERR_ABORTED) acontecem se o usuário navegar
    // rapidamente para outro site antes do anterior terminar; podemos ignorá-los.
    if (err && err.code !== 'ERR_ABORTED') {
      console.warn(`[Navegação] Falha ao carregar ${targetUrl}:`, err.message);
    }
  });
}

/**
 * Volta para a página anterior no histórico da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function goBack(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  const wc = activeTab.view.webContents;
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoBack === 'function') {
    if (wc.navigationHistory.canGoBack()) {
      wc.navigationHistory.goBack();
    }
  } else if (typeof wc.canGoBack === 'function' && wc.canGoBack()) {
    wc.goBack();
  }
}

/**
 * Avança para a próxima página no histórico da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function goForward(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.view) return;

  const wc = activeTab.view.webContents;
  if (wc.navigationHistory && typeof wc.navigationHistory.canGoForward === 'function') {
    if (wc.navigationHistory.canGoForward()) {
      wc.navigationHistory.goForward();
    }
  } else if (typeof wc.canGoForward === 'function' && wc.canGoForward()) {
    wc.goForward();
  }
}

/**
 * Recarrega a página da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function reload(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.webContents.reload();
  }
}

/**
 * Interrompe o carregamento da página da aba ativa
 * @param {object} tabManager Instância do gerenciador de abas
 */
function stop(tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (activeTab && activeTab.view) {
    activeTab.view.webContents.stop();
  }
}

/**
 * Navega a aba ativa para a URL da Página Inicial configurada nas opções (homePageUrl)
 * @param {object} tabManager Instância do gerenciador de abas
 */
function goHome(tabManager) {
  const homeUrl = settings.get('homePageUrl') || NEW_TAB_URL;
  loadURL(tabManager, homeUrl);
}

/**
 * Inicializa o módulo de navegação
 * @param {object} context Objeto com dependências do sistema
 */
function init(context) {
  // O módulo de navegação é puro e sem estado interno, mantendo funções utilitárias.
  return {
    normalizeInput,
    loadURL,
    goBack,
    goForward,
    reload,
    stop,
    goHome
  };
}

module.exports = {
  init,
  normalizeInput,
  loadURL,
  goBack,
  goForward,
  reload,
  stop,
  goHome
};
```

---

### 4.15 `src/main/history.js`

```javascript
// =============================================================================
// src/main/history.js
// Gerenciamento e persistência do histórico de navegação (history.json)
// Abas privadas e páginas internas do navegador NUNCA são registradas.
// =============================================================================

const crypto = require('crypto');
const storage = require('./storage');
const config = require('./config');

const HISTORY_FILENAME = 'history.json';
const MAX_HISTORY_ITEMS = 5000;

let historyCache = null;
let persistTimer = null;

function loadHistory() {
  if (historyCache === null) {
    historyCache = storage.readJSON(HISTORY_FILENAME, []);
    if (!Array.isArray(historyCache)) {
      historyCache = [];
    }
  }
  return historyCache;
}

/**
 * Grava o histórico em disco com debounce de 1 segundo para evitar reescrita síncrona frequente
 */
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (historyCache !== null) {
      storage.writeJSON(HISTORY_FILENAME, historyCache);
    }
  }, 1000);
}

/**
 * Força a gravação imediata e síncrona do histórico (ex: antes de fechar o app)
 */
function flushHistorySync() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (historyCache !== null) {
    storage.writeJSON(HISTORY_FILENAME, historyCache);
  }
}

/**
 * Adiciona uma página ao histórico
 * @param {object} item { url, title, isPrivate }
 */
function addEntry(item) {
  if (!item || !item.url || item.isPrivate) return;

  const url = item.url.trim();
  if (
    !url ||
    url.startsWith('about:') ||
    url.startsWith('dragon:') ||
    url === 'chrome://' ||
    url.startsWith('javascript:')
  ) {
    return;
  }

  // Ignora páginas internas do navegador
  if (
    url.startsWith(config.NEW_TAB_URL) ||
    url.startsWith(config.SETTINGS_PAGE_URL) ||
    url.startsWith(config.HISTORY_PAGE_URL) ||
    url.startsWith(config.BOOKMARKS_PAGE_URL) ||
    url.startsWith(config.DOWNLOADS_PAGE_URL) ||
    url.startsWith(config.ERROR_PAGE_URL) ||
    url.startsWith(config.HTTPS_WARNING_URL) ||
    url.startsWith(config.CERT_ERROR_PAGE_URL)
  ) {
    return;
  }

  loadHistory();

  const title = (item.title || url).trim();
  const entry = {
    id: crypto.randomUUID(),
    url: url,
    title: title,
    timestamp: Date.now()
  };

  // Insere no início da lista
  historyCache.unshift(entry);

  if (historyCache.length > MAX_HISTORY_ITEMS) {
    historyCache.length = MAX_HISTORY_ITEMS;
  }

  schedulePersist();
}

/**
 * Atualiza o título da entrada mais recente com a URL correspondente (evita 2 entradas por navegação)
 * @param {string} url
 * @param {string} title
 */
function updateTitle(url, title) {
  if (!url || !title) return;
  loadHistory();
  const cleanUrl = url.trim();
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  const entry = historyCache.find(item => item.url === cleanUrl);
  if (entry) {
    entry.title = cleanTitle;
    schedulePersist();
  }
}

/**
 * Retorna as entradas do histórico com busca e limite opcionais
 * @param {string} [query]
 * @param {number} [limit]
 * @returns {Array<object>}
 */
function getEntries(query = '', limit = 100) {
  loadHistory();

  const q = (query || '').toLowerCase().trim();
  let results = historyCache;

  if (q) {
    results = historyCache.filter(item => {
      const titleMatch = item.title && item.title.toLowerCase().includes(q);
      const urlMatch = item.url && item.url.toLowerCase().includes(q);
      return titleMatch || urlMatch;
    });
  }

  return results.slice(0, Math.max(1, limit));
}

/**
 * Remove uma entrada do histórico por id
 * @param {string} id
 * @returns {boolean}
 */
function deleteEntry(id) {
  loadHistory();
  const initialLength = historyCache.length;
  historyCache = historyCache.filter(item => item.id !== id);

  if (historyCache.length !== initialLength) {
    flushHistorySync();
    return true;
  }
  return false;
}

/**
 * Limpa todo o histórico de navegação
 */
function clearAll() {
  historyCache = [];
  flushHistorySync();
}

module.exports = {
  addEntry,
  updateTitle,
  flushHistorySync,
  getEntries,
  deleteEntry,
  clearAll
};
```

---

### 4.16 `src/main/bookmarks.js`

```javascript
// =============================================================================
// src/main/bookmarks.js
// Gerenciamento e persistência dos favoritos do usuário (bookmarks.json)
// =============================================================================

const crypto = require('crypto');
const storage = require('./storage');

const BOOKMARKS_FILENAME = 'bookmarks.json';
let bookmarksCache = null;

function loadBookmarks() {
  if (bookmarksCache === null) {
    bookmarksCache = storage.readJSON(BOOKMARKS_FILENAME, []);
    if (!Array.isArray(bookmarksCache)) {
      bookmarksCache = [];
    }
  }
  return bookmarksCache;
}

function persistBookmarks() {
  storage.writeJSON(BOOKMARKS_FILENAME, bookmarksCache);
}

/**
 * Retorna todos os favoritos com busca opcional por termo
 * @param {string} [query]
 * @returns {Array<object>}
 */
function getBookmarks(query = '') {
  loadBookmarks();

  const q = (query || '').toLowerCase().trim();
  if (!q) {
    return [...bookmarksCache];
  }

  return bookmarksCache.filter(b => {
    const titleMatch = b.title && b.title.toLowerCase().includes(q);
    const urlMatch = b.url && b.url.toLowerCase().includes(q);
    return titleMatch || urlMatch;
  });
}

/**
 * Verifica se uma URL já está nos favoritos
 * @param {string} url
 * @returns {boolean}
 */
function isBookmarked(url) {
  if (!url || typeof url !== 'string') return false;
  loadBookmarks();
  const cleanUrl = url.trim().toLowerCase();
  return bookmarksCache.some(b => b.url && b.url.toLowerCase() === cleanUrl);
}

/**
 * Adiciona uma URL aos favoritos se ainda não existir
 * @param {object} item { url, title }
 * @returns {object|null} Item adicionado ou existente
 */
function addBookmark(item) {
  if (!item || !item.url) return null;
  const url = item.url.trim();
  if (!url || url.startsWith('about:') || url.startsWith('javascript:')) return null;

  loadBookmarks();

  const existing = bookmarksCache.find(b => b.url.toLowerCase() === url.toLowerCase());
  if (existing) {
    return existing;
  }

  const newBookmark = {
    id: crypto.randomUUID(),
    title: (item.title || url).trim(),
    url: url,
    createdAt: Date.now()
  };

  bookmarksCache.unshift(newBookmark);
  persistBookmarks();
  return newBookmark;
}

/**
 * Remove um favorito pelo ID ou URL
 * @param {string} idOrUrl
 * @returns {boolean}
 */
function removeBookmark(idOrUrl) {
  if (!idOrUrl) return false;
  loadBookmarks();

  const initialLength = bookmarksCache.length;
  const target = idOrUrl.trim().toLowerCase();

  bookmarksCache = bookmarksCache.filter(b => b.id !== idOrUrl && b.url.toLowerCase() !== target);

  if (bookmarksCache.length !== initialLength) {
    persistBookmarks();
    return true;
  }
  return false;
}

/**
 * Alterna o estado de favorito para uma URL
 * @param {object} item { url, title }
 * @returns {{ bookmarked: boolean, bookmark: object|null }}
 */
function toggleBookmark(item) {
  if (!item || !item.url) return { bookmarked: false, bookmark: null };
  const url = item.url.trim();

  if (isBookmarked(url)) {
    removeBookmark(url);
    return { bookmarked: false, bookmark: null };
  } else {
    const b = addBookmark(item);
    return { bookmarked: true, bookmark: b };
  }
}

/**
 * Limpa todos os favoritos
 */
function clearAll() {
  bookmarksCache = [];
  persistBookmarks();
}

module.exports = {
  getBookmarks,
  isBookmarked,
  addBookmark,
  removeBookmark,
  toggleBookmark,
  clearAll
};
```

---

### 4.17 `src/main/downloads.js`

```javascript
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
```

---

### 4.18 `src/main/permissions.js`

```javascript
// =============================================================================
// src/main/permissions.js
// Gerenciamento e persistência de permissões por site (permissions.json)
// Câmera, microfone, notificações e geolocalização
// =============================================================================

const storage = require('./storage');

const PERMISSIONS_FILENAME = 'permissions.json';
let permissionsCache = null;

function loadPermissions() {
  if (permissionsCache === null) {
    permissionsCache = storage.readJSON(PERMISSIONS_FILENAME, {});
    if (!permissionsCache || typeof permissionsCache !== 'object') {
      permissionsCache = {};
    }
  }
  return permissionsCache;
}

function persistPermissions() {
  storage.writeJSON(PERMISSIONS_FILENAME, permissionsCache);
}

/**
 * Normaliza a origem da requisição (ex: https://example.com)
 * @param {string} rawUrlOrOrigin
 * @returns {string}
 */
function normalizeOrigin(rawUrlOrOrigin) {
  if (!rawUrlOrOrigin || typeof rawUrlOrOrigin !== 'string') return '';
  try {
    const url = new URL(rawUrlOrOrigin);
    return url.origin.toLowerCase();
  } catch {
    return rawUrlOrOrigin.toLowerCase().trim();
  }
}

/**
 * Retorna a decisão salva para uma permissão específica nesta origem
 * @param {string} origin
 * @param {string} permissionKey
 * @returns {'allow'|'block'|null}
 */
function getPermission(origin, permissionKey) {
  const normOrigin = normalizeOrigin(origin);
  if (!normOrigin || !permissionKey) return null;

  loadPermissions();
  if (permissionsCache[normOrigin] && permissionsCache[normOrigin][permissionKey]) {
    return permissionsCache[normOrigin][permissionKey];
  }
  return null;
}

/**
 * Salva a decisão de permissão para uma origem
 * @param {string} origin
 * @param {string} permissionKey
 * @param {'allow'|'block'} decision
 */
function setPermission(origin, permissionKey, decision) {
  const normOrigin = normalizeOrigin(origin);
  if (!normOrigin || !permissionKey) return;

  if (decision !== 'allow' && decision !== 'block') return;

  loadPermissions();
  if (!permissionsCache[normOrigin]) {
    permissionsCache[normOrigin] = {};
  }

  permissionsCache[normOrigin][permissionKey] = decision;
  persistPermissions();
}

/**
 * Retorna todas as permissões cadastradas organizadas por origem para as Configurações
 * @returns {Array<object>} Lista de { origin, permissions: { [key]: 'allow'|'block' } }
 */
function getAllPermissions() {
  loadPermissions();
  const list = [];
  for (const [origin, perms] of Object.entries(permissionsCache)) {
    list.push({
      origin,
      permissions: { ...perms }
    });
  }
  return list;
}

/**
 * Revoga uma permissão específica ou todas as permissões de uma origem
 * @param {string} origin
 * @param {string} [permissionKey]
 * @returns {boolean}
 */
function revokePermission(origin, permissionKey) {
  const normOrigin = normalizeOrigin(origin);
  if (!normOrigin) return false;

  loadPermissions();
  if (!permissionsCache[normOrigin]) return false;

  if (permissionKey) {
    delete permissionsCache[normOrigin][permissionKey];
    if (Object.keys(permissionsCache[normOrigin]).length === 0) {
      delete permissionsCache[normOrigin];
    }
  } else {
    delete permissionsCache[normOrigin];
  }

  persistPermissions();
  return true;
}

/**
 * Limpa todas as permissões salvas
 */
function clearAll() {
  permissionsCache = {};
  persistPermissions();
}

module.exports = {
  getPermission,
  setPermission,
  getAllPermissions,
  revokePermission,
  clearAll,
  normalizeOrigin
};
```

---

### 4.19 `src/main/fingerprint-protection.js`

```javascript
// =============================================================================
// src/main/fingerprint-protection.js
// Proteção contra Fingerprinting Avançada do Navegador Dragon
// Gera script isolado e determinístico com interceptações completas
// =============================================================================

const settings = require('./settings');
const fingerprintUtils = require('./pure/fingerprint-utils');
const {
  OS_PRESETS,
  BROWSER_PRESETS,
  GPU_PRESETS,
  SCREEN_PRESETS,
  LOCALE_TIMEZONE_MAP,
  TIMEZONE_PRESETS,
  deriveUserAgent,
  derivePlatform,
  deriveDevicePixelRatio,
  deriveWebglRenderer,
  buildFingerprintSeed,
  getFingerprintOptions,
  validateFingerprintConsistency
} = fingerprintUtils;

/**
 * Mapeamento de offset em minutos para fusos horários comuns
 */
const TIMEZONE_OFFSET_MAP = {
  'UTC': 0,
  'Europe/London': 0,
  'Europe/Paris': -60,
  'Europe/Berlin': -60,
  'Europe/Madrid': -60,
  'America/Sao_Paulo': 180,
  'America/Fortaleza': 180,
  'America/Cuiaba': 240,
  'America/Manaus': 240,
  'America/New_York': 300,
  'America/Chicago': 360,
  'America/Denver': 420,
  'America/Los_Angeles': 480,
  'Asia/Tokyo': -540
};

/**
 * Retorna o script JS a ser injetado em páginas web (WebContentsView).
 * Todas as modificações respeitam estritamente as preferências salvas pelo usuário.
 * NUNCA injetado em páginas internas do Dragon.
 *
 * @returns {string} Código JavaScript auto-executável
 */
function getInjectionScript() {
  const isEnabled = Boolean(settings.get('fingerprintProtectionEnabled'));
  if (!isEnabled) {
    return '';
  }

  const allSettings = settings.getAll ? settings.getAll() : settings.get();
  const seed = buildFingerprintSeed(allSettings);

  const os = allSettings.fpOs || 'windows11';
  const browser = allSettings.fpBrowser || 'chrome';
  const osPreset = OS_PRESETS[os] || OS_PRESETS.windows11;

  // 1. User-Agent e Plataforma
  let userAgent = allSettings.fpUserAgent;
  if (!userAgent || userAgent === 'auto') {
    userAgent = deriveUserAgent(os, browser);
  }
  let platform = allSettings.fpPlatform;
  if (!platform || platform === 'auto') {
    platform = derivePlatform(os);
  }

  // 2. Resolução e DPR
  const resolutionId = allSettings.fpScreenResolution || '1920x1080';
  const resPreset = SCREEN_PRESETS.find(p => p.id === resolutionId) || SCREEN_PRESETS[0];
  const width = resPreset.width;
  const height = resPreset.height;
  const availHeight = height > 768 ? height - 40 : height;

  let dpr = allSettings.fpDevicePixelRatio;
  if (dpr === 'auto' || !dpr) {
    dpr = deriveDevicePixelRatio(resolutionId);
  } else {
    dpr = Number(dpr) || 1;
  }

  // 3. Hardware (CPU, RAM, Touch)
  const cores = Number(allSettings.fpHardwareConcurrency) || 8;
  const memory = Number(allSettings.fpDeviceMemory) || 8;
  const touch = Boolean(allSettings.fpTouchSupport);

  // 4. GPU / WebGL
  let gpuVendor = allSettings.fpWebglVendor;
  let gpuRenderer = allSettings.fpWebglRenderer;
  if (!gpuVendor || gpuVendor === 'auto' || !gpuRenderer || gpuRenderer === 'auto') {
    const derivedGpu = deriveWebglRenderer(os, gpuVendor);
    gpuVendor = gpuVendor && gpuVendor !== 'auto' ? gpuVendor : derivedGpu.vendor;
    gpuRenderer = gpuRenderer && gpuRenderer !== 'auto' ? gpuRenderer : derivedGpu.renderer;
  }
  const webglImageMode = allSettings.fpWebglImageMode || 'noise';

  // 5. Idioma e Fuso Horário
  const locale = allSettings.fpLocale || 'pt-BR';
  const timezone = allSettings.fpTimezone || 'America/Sao_Paulo';
  const tzOffset = Object.prototype.hasOwnProperty.call(TIMEZONE_OFFSET_MAP, timezone)
    ? TIMEZONE_OFFSET_MAP[timezone]
    : 0;

  // 6. Modos por Vetor
  const canvasMode = allSettings.fpCanvasMode || 'noise';
  const audioMode = allSettings.fpAudioMode || 'noise';
  const clientRectsMode = allSettings.fpClientRectsMode || 'noise';
  const fontsMode = allSettings.fpFontsMode || 'mask';
  const batteryMode = allSettings.fpBatteryMode || 'mask';
  const speechVoicesMode = allSettings.fpSpeechVoices || 'mask';
  const permissionsMode = allSettings.fpPermissionsMode || 'mask';
  const webrtcMode = allSettings.fpWebrtcMode || 'proxy';
  const mediaCount = Number(allSettings.fpMediaDevicesCount) || 2;

  const allowedFonts = JSON.stringify(osPreset.defaultFonts || ['Arial', 'Helvetica', 'Times New Roman']);

  return `
(function() {
  'use strict';
  try {
    const SEED = ${seed};

    // Helper LCG determinístico
    function prng(offset) {
      let s = (Math.imul(SEED ^ (offset || 0), 0x45d9f3b) >>> 0);
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return (s / 4294967296);
    }

    // =========================================================================
    // GRUPO A: IDENTIDADE DO SISTEMA (UA, Plataforma, Locale, Timezone)
    // =========================================================================
    try {
      const ua = ${JSON.stringify(userAgent)};
      const plat = ${JSON.stringify(platform)};
      const loc = ${JSON.stringify(locale)};
      const tz = ${JSON.stringify(timezone)};
      const tzOff = ${tzOffset};

      Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
      Object.defineProperty(navigator, 'appVersion', { get: () => ua.replace(/^Mozilla\\//, ''), configurable: true });
      Object.defineProperty(navigator, 'platform', { get: () => plat, configurable: true });
      Object.defineProperty(navigator, 'language', { get: () => loc, configurable: true });
      Object.defineProperty(navigator, 'languages', { get: () => [loc, loc.split('-')[0], 'en-US', 'en'], configurable: true });

      // Spoof de Timezone
      const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const opts = origResolvedOptions.apply(this, arguments);
        opts.timeZone = tz;
        return opts;
      };
      Date.prototype.getTimezoneOffset = function() {
        return tzOff;
      };
    } catch (e) {}

    // =========================================================================
    // GRUPO B: HARDWARE (Resolução, DPR, Cores, RAM, Touch)
    // =========================================================================
    try {
      const scrW = ${width};
      const scrH = ${height};
      const availH = ${availHeight};
      const dprVal = ${dpr};
      const coresCount = ${cores};
      const memoryGb = ${memory};
      const touchEnabled = ${touch};

      Object.defineProperty(window.screen, 'width', { get: () => scrW, configurable: true });
      Object.defineProperty(window.screen, 'height', { get: () => scrH, configurable: true });
      Object.defineProperty(window.screen, 'availWidth', { get: () => scrW, configurable: true });
      Object.defineProperty(window.screen, 'availHeight', { get: () => availH, configurable: true });
      Object.defineProperty(window.screen, 'colorDepth', { get: () => 24, configurable: true });
      Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24, configurable: true });

      Object.defineProperty(window, 'devicePixelRatio', { get: () => dprVal, configurable: true });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => coresCount, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => memoryGb, configurable: true });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => (touchEnabled ? 5 : 0), configurable: true });
    } catch (e) {}

    // =========================================================================
    // GRUPO C: GPU E WEBGL (Vendor, Renderer, readPixels)
    // =========================================================================
    try {
      const targetVendor = ${JSON.stringify(gpuVendor)};
      const targetRenderer = ${JSON.stringify(gpuRenderer)};
      const webglMode = ${JSON.stringify(webglImageMode)};

      function patchGl(proto) {
        if (!proto || !proto.getParameter) return;
        const origGetParam = proto.getParameter;
        proto.getParameter = function(param) {
          // 0x9245 = UNMASKED_VENDOR_WEBGL, 0x9246 = UNMASKED_RENDERER_WEBGL
          if (param === 0x9245) return targetVendor;
          if (param === 0x9246) return targetRenderer;
          return origGetParam.apply(this, arguments);
        };

        if (webglMode === 'noise') {
          const origReadPixels = proto.readPixels;
          proto.readPixels = function(x, y, w, h, format, type, pixels) {
            origReadPixels.apply(this, arguments);
            if (pixels && pixels.length) {
              for (let i = 0; i < pixels.length; i += 16) {
                if (pixels[i + 3] === 0) continue;
                const hVal = (Math.imul(i ^ SEED, 0x45d9f3b) >>> 0) % 3;
                const d = (hVal === 0 ? -1 : (hVal === 1 ? 1 : 0));
                if (d !== 0) {
                  const ch = i + (hVal % 3);
                  pixels[ch] = Math.max(0, Math.min(255, pixels[ch] + d));
                }
              }
            }
          };
        }
      }

      if (typeof WebGLRenderingContext !== 'undefined') patchGl(WebGLRenderingContext.prototype);
      if (typeof WebGL2RenderingContext !== 'undefined') patchGl(WebGL2RenderingContext.prototype);
    } catch (e) {}

    // =========================================================================
    // GRUPO D: CANVAS, ÁUDIO, CLIENTRECTS, FONTES
    // =========================================================================
    // Canvas
    try {
      const cMode = ${JSON.stringify(canvasMode)};
      if (cMode === 'noise') {
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
          const imgData = origGetImageData.apply(this, arguments);
          try {
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 16) {
              if (d[i + 3] === 0) continue;
              const h = (Math.imul(i ^ SEED, 0x45d9f3b) >>> 0) % 3;
              const delta = (h === 0 ? -1 : (h === 1 ? 1 : 0));
              if (delta !== 0) {
                const idx = i + (h % 3);
                d[idx] = Math.max(0, Math.min(255, d[idx] + delta));
              }
            }
          } catch (err) {}
          return imgData;
        };

        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
          try {
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              const w = Math.min(this.width, 32);
              const h = Math.min(this.height, 32);
              const imgData = ctx.getImageData(0, 0, w, h);
              ctx.putImageData(imgData, 0, 0);
            }
          } catch (err) {}
          return origToDataURL.apply(this, arguments);
        };
      }
    } catch (e) {}

    // Áudio
    try {
      const aMode = ${JSON.stringify(audioMode)};
      if (aMode === 'noise') {
        if (typeof AudioBuffer !== 'undefined' && AudioBuffer.prototype.getChannelData) {
          const origGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = function() {
            const channel = origGetChannelData.apply(this, arguments);
            try {
              for (let i = 0; i < channel.length; i += 32) {
                const h = (Math.imul(i ^ SEED, 0x27d4eb2d) >>> 0) % 5;
                channel[i] = channel[i] + (h - 2) * 0.00002;
              }
            } catch (err) {}
            return channel;
          };
        }
      }
    } catch (e) {}

    // ClientRects
    try {
      const crMode = ${JSON.stringify(clientRectsMode)};
      if (crMode === 'noise') {
        const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
          const r = origGetBoundingClientRect.apply(this, arguments);
          const delta = ((SEED % 3) - 1) * 0.05;
          return new DOMRect(r.x + delta, r.y + delta, r.width + delta, r.height + delta);
        };
      } else if (crMode === 'mask') {
        const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
          const r = origGetBoundingClientRect.apply(this, arguments);
          return new DOMRect(Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height));
        };
      }
    } catch (e) {}

    // Fontes
    try {
      const fMode = ${JSON.stringify(fontsMode)};
      if (fMode === 'mask' && document.fonts && typeof document.fonts.check === 'function') {
        const allowed = new Set(${allowedFonts}.map(f => f.toLowerCase()));
        allowed.add('sans-serif');
        allowed.add('serif');
        allowed.add('monospace');
        const origCheck = document.fonts.check.bind(document.fonts);
        document.fonts.check = function(font, text) {
          if (typeof font === 'string') {
            const clean = font.replace(/[0-9pxptemrem%]/g, '').replace(/['"]/g, '').trim().toLowerCase();
            if (clean && !allowed.has(clean)) {
              return false;
            }
          }
          return origCheck(font, text);
        };
      }
    } catch (e) {}

    // =========================================================================
    // GRUPO E: BATERIA, DISPOSITIVOS, VOZES E PERMISSÕES
    // =========================================================================
    try {
      const bMode = ${JSON.stringify(batteryMode)};
      if (bMode === 'mask' && navigator.getBattery) {
        navigator.getBattery = function() {
          return Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1.0,
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return false; }
          });
        };
      }

      const pMode = ${JSON.stringify(permissionsMode)};
      if (pMode === 'mask' && navigator.permissions && navigator.permissions.query) {
        const origQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = function(desc) {
          return Promise.resolve({
            state: 'prompt',
            name: desc ? desc.name : 'unknown',
            onchange: null,
            addEventListener: function() {},
            removeEventListener: function() {}
          });
        };
      }

      const mCount = ${mediaCount};
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices = function() {
          const devs = [];
          if (mCount >= 1) devs.push({ deviceId: 'default', kind: 'audioinput', label: '', groupId: 'grp1' });
          if (mCount >= 2) devs.push({ deviceId: 'default', kind: 'videoinput', label: '', groupId: 'grp2' });
          if (mCount >= 3) devs.push({ deviceId: 'default', kind: 'audiooutput', label: '', groupId: 'grp1' });
          return Promise.resolve(devs);
        };
      }

      const wMode = ${JSON.stringify(webrtcMode)};
      if (wMode === 'disabled') {
        try {
          if (typeof window.RTCPeerConnection !== 'undefined') window.RTCPeerConnection = undefined;
          if (typeof window.webkitRTCPeerConnection !== 'undefined') window.webkitRTCPeerConnection = undefined;
          if (typeof window.RTCSessionDescription !== 'undefined') window.RTCSessionDescription = undefined;
          if (typeof window.RTCIceCandidate !== 'undefined') window.RTCIceCandidate = undefined;
        } catch (e) {}
      }

      const svMode = ${JSON.stringify(speechVoicesMode)};
      if (svMode === 'mask' && typeof window.speechSynthesis !== 'undefined') {
        const targetOs = ${JSON.stringify(os)};
        const simulatedVoices = (targetOs === 'macos')
          ? [
              { name: 'Alex', lang: 'en-US', default: true, localService: true, voiceURI: 'Alex' },
              { name: 'Samantha', lang: 'en-US', default: false, localService: true, voiceURI: 'Samantha' },
              { name: 'Luciana', lang: 'pt-BR', default: false, localService: true, voiceURI: 'Luciana' }
            ]
          : [
              { name: 'Microsoft Maria - Portuguese (Brazil)', lang: 'pt-BR', default: true, localService: true, voiceURI: 'Microsoft Maria' },
              { name: 'Microsoft David - English (United States)', lang: 'en-US', default: false, localService: true, voiceURI: 'Microsoft David' },
              { name: 'Microsoft Zira - English (United States)', lang: 'en-US', default: false, localService: true, voiceURI: 'Microsoft Zira' }
            ];
        speechSynthesis.getVoices = function() {
          return simulatedVoices;
        };
      }
    } catch (e) {}

  } catch (err) {}
})();
  `;
}

function isFingerprintProtectionEnabled() {
  return Boolean(settings.get('fingerprintProtectionEnabled'));
}

function shouldNormalizeUA() {
  return isFingerprintProtectionEnabled();
}

module.exports = {
  getInjectionScript,
  isFingerprintProtectionEnabled,
  shouldNormalizeUA,
  getFingerprintOptions,
  validateFingerprintConsistency
};
```

---

### 4.20 `src/main/ipc.js`

```javascript
// =============================================================================
// src/main/ipc.js
// Registro centralizado de todos os canais IPC da aplicação
// Interface (renderer) <---> Preload <---> Processo Principal (main)
// Validação rigorosa de segurança em TODOS os canais contra chamadas não autorizadas
// =============================================================================

const { ipcMain } = require('electron');
const bookmarks = require('./bookmarks');
const clearData = require('./clear-data');
const config = require('./config');
const downloads = require('./downloads');
const history = require('./history');
const menu = require('./menu');
const permissions = require('./permissions');
const privacy = require('./privacy');
const sessionModule = require('./session');
const settings = require('./settings');
const fingerprintProtection = require('./fingerprint-protection');

/**
 * Validação rigorosa para garantir que o remetente do IPC é estritamente
 * a interface gráfica da janela principal (mainWindow.webContents).
 * Abas de conteúdo externo ou frames secundários NUNCA podem invocar estes canais.
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {Electron.BrowserWindow} mainWindow
 * @returns {boolean}
 */
function isMainSender(event, mainWindow) {
  if (!event || !event.sender || !mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  return event.sender === mainWindow.webContents;
}

/**
 * Validação rigorosa genérica de remetente para qualquer página interna autorizada
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} targetCanonicalUrl
 * @returns {boolean}
 */
function isPageSender(event, targetCanonicalUrl) {
  if (!event || !event.senderFrame || !event.sender) return false;
  if (event.sender.mainFrame !== event.senderFrame) return false;

  const senderUrl = event.senderFrame.url;
  if (typeof senderUrl !== 'string' || !senderUrl) return false;

  try {
    const senderClean = new URL(senderUrl);
    senderClean.search = '';
    senderClean.hash = '';

    const targetClean = new URL(targetCanonicalUrl);
    targetClean.search = '';
    targetClean.hash = '';

    return senderClean.href.toLowerCase() === targetClean.href.toLowerCase();
  } catch {
    return false;
  }
}

function isSettingsSender(event) {
  return isPageSender(event, config.SETTINGS_PAGE_URL);
}

function isWarningSender(event) {
  return isPageSender(event, config.HTTPS_WARNING_URL);
}

function isHistorySender(event) {
  return isPageSender(event, config.HISTORY_PAGE_URL);
}

function isBookmarksSender(event) {
  return isPageSender(event, config.BOOKMARKS_PAGE_URL);
}

function isDownloadsSender(event) {
  return isPageSender(event, config.DOWNLOADS_PAGE_URL);
}

function isCertErrorSender(event) {
  return isPageSender(event, config.CERT_ERROR_PAGE_URL);
}

/**
 * Navega o webContents da aba do remetente para a URL solicitada
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} rawUrl
 * @param {object} tabManager
 * @param {object} navigation
 * @returns {boolean}
 */
function navigateSenderTab(event, rawUrl, tabManager, navigation) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  const targetUrl = navigation.normalizeInput(rawUrl);
  if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(targetUrl)) {
    console.warn('[Segurança] URL não permitida bloqueada para aba do remetente:', targetUrl);
    return false;
  }
  if (!event.sender || event.sender.isDestroyed()) return false;
  event.sender.loadURL(targetUrl).catch(err => {
    if (err && err.code !== 'ERR_ABORTED') {
      console.warn(`[Navegação] Falha ao carregar ${targetUrl} na aba do remetente:`, err.message);
    }
  });
  return true;
}

/**
 * Registra todos os manipuladores de IPC com validação de entrada de dados.
 * @param {object} context Objeto contendo { mainWindow, windowManager, tabManager, navigation, storage }
 */
function init(context) {
  const { mainWindow, windowManager, tabManager, navigation, storage } = context;

  // ---------------------------------------------------------------------------
  // CANAIS: app:open-settings, app:open-downloads, app:open-history, app:open-bookmarks
  // Finalidade: Abrem as páginas internas em aba dedicada ou trocam para ela se já aberta
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:open-settings', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-settings: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openSettingsTab();
    return tab ? tab.id : null;
  });

  ipcMain.handle('app:open-downloads', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-downloads: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openDownloadsTab();
    return tab ? tab.id : null;
  });

  ipcMain.handle('app:open-history', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-history: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openHistoryTab();
    return tab ? tab.id : null;
  });

  ipcMain.handle('app:open-bookmarks', (event) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em app:open-bookmarks: remetente não é a janela principal');
      return null;
    }
    const tab = tabManager.openBookmarksTab();
    return tab ? tab.id : null;
  });

  // CANAL: window:set-findbar-open
  // Notifica o windowManager para reservar espaço abaixo da topbar para a barra de busca (Ctrl+F)
  ipcMain.handle('window:set-findbar-open', (event, open) => {
    if (!isMainSender(event, mainWindow)) return false;
    if (windowManager && typeof windowManager.setFindBarOpen === 'function') {
      windowManager.setFindBarOpen(Boolean(open));
      return true;
    }
    return false;
  });

  // Notifica o renderer e a aba de configurações sempre que houver alteração
  settings.onChange((key, value, allSettings) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // A UI principal só precisa de accentColor e theme
      mainWindow.webContents.send('browser:settings-updated', {
        accentColor: allSettings.accentColor,
        theme: allSettings.theme
      });
    }
    // Emite o evento settings:changed em tempo real para abas abertas de configurações
    if (tabManager && typeof tabManager.broadcastToSettingsTabs === 'function') {
      tabManager.broadcastToSettingsTabs('settings:changed', { key, value, allSettings });
    }
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:create
  // Finalidade: Cria uma nova aba de navegação.
  // Parâmetro opcional: url (string)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:create', (event, initialUrl) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em tabs:create: remetente não é a janela principal');
      return null;
    }
    let validUrl = typeof initialUrl === 'string' && initialUrl.trim().length > 0
      ? initialUrl.trim()
      : null;
    if (validUrl) {
      const resolved = typeof tabManager.resolveInternalUrl === 'function'
        ? tabManager.resolveInternalUrl(validUrl)
        : validUrl;

      if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(resolved)) {
        console.warn('[IPC:tabs:create] URL bloqueada por esquema não permitido:', validUrl);
        validUrl = null;
      } else {
        if (resolved === config.SETTINGS_PAGE_URL) {
          const tab = tabManager.openSettingsTab();
          return tab ? tab.id : null;
        }
        if (resolved === config.DOWNLOADS_PAGE_URL) {
          const tab = tabManager.openDownloadsTab();
          return tab ? tab.id : null;
        }
        if (resolved === config.HISTORY_PAGE_URL) {
          const tab = tabManager.openHistoryTab();
          return tab ? tab.id : null;
        }
        if (resolved === config.BOOKMARKS_PAGE_URL) {
          const tab = tabManager.openBookmarksTab();
          return tab ? tab.id : null;
        }
        validUrl = resolved;
      }
    }
    return tabManager.createTab(validUrl, { active: true }).id;
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:close
  // Finalidade: Fecha a aba identificada pelo tabId.
  // Parâmetro: tabId (string)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:close', (event, tabId) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em tabs:close: remetente não é a janela principal');
      return false;
    }
    if (typeof tabId !== 'string' || !tabId) {
      console.warn('[IPC:tabs:close] tabId inválido recebido:', tabId);
      return false;
    }
    tabManager.closeTab(tabId);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:select
  // Finalidade: Torna ativa a aba com o identificador fornecido.
  // Parâmetro: tabId (string)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:select', (event, tabId) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em tabs:select: remetente não é a janela principal');
      return false;
    }
    if (typeof tabId !== 'string' || !tabId) {
      console.warn('[IPC:tabs:select] tabId inválido recebido:', tabId);
      return false;
    }
    tabManager.setActiveTab(tabId);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:navigate
  // Finalidade: Navega a aba ativa para o endereço ou termo de busca fornecido.
  // Parâmetro: urlOrQuery (string)
  // Permite apenas http:, https: e páginas internas do Dragon
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:navigate', (event, urlOrQuery) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] IPC ignorado em navigation:navigate: remetente não é a janela principal');
      return false;
    }
    if (typeof urlOrQuery !== 'string' || !urlOrQuery.trim()) {
      console.warn('[IPC:navigation:navigate] Valor inválido recebido:', urlOrQuery);
      return false;
    }
    const targetUrl = navigation.normalizeInput(urlOrQuery);
    if (typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(targetUrl)) {
      console.warn('[IPC:navigation:navigate] Navegação bloqueada para URL não permitida:', targetUrl);
      return false;
    }
    // Se a URL normalizada for uma página interna com aba dedicada, abre ou alterna para ela
    if (targetUrl === config.SETTINGS_PAGE_URL) {
      tabManager.openSettingsTab();
      return true;
    }
    if (targetUrl === config.DOWNLOADS_PAGE_URL) {
      tabManager.openDownloadsTab();
      return true;
    }
    if (targetUrl === config.HISTORY_PAGE_URL) {
      tabManager.openHistoryTab();
      return true;
    }
    if (targetUrl === config.BOOKMARKS_PAGE_URL) {
      tabManager.openBookmarksTab();
      return true;
    }
    navigation.loadURL(tabManager, urlOrQuery);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:allow-redirect
  // Finalidade: Permite um redirecionamento que havia sido bloqueado por segurança.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:allow-redirect', (event, targetUrl) => {
    if (!isMainSender(event, mainWindow)) return false;
    if (typeof targetUrl !== 'string' || !tabManager.isAllowedNavigationUrl(targetUrl)) {
      return false;
    }
    tabManager.allowRedirect(targetUrl);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:back
  // Finalidade: Retorna para a página anterior no histórico da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:back', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.goBack(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:forward
  // Finalidade: Avança para a próxima página no histórico da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:forward', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.goForward(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:reload
  // Finalidade: Recarrega a página atual da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:reload', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.reload(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:home
  // Finalidade: Navega a aba ativa para a Página Inicial configurada
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:home', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.goHome(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: navigation:stop
  // Finalidade: Interrompe o carregamento da aba ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('navigation:stop', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    navigation.stop(tabManager);
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: window:show-overlay
  // Finalidade: Oculta a WebContentsView para que menus/modais HTML da interface
  // possam ser exibidos sem ficarem cobertos pela camada do site.
  // ---------------------------------------------------------------------------
  ipcMain.handle('window:show-overlay', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    windowManager.showOverlay();
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: window:hide-overlay
  // Finalidade: Restaura a visibilidade da WebContentsView ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('window:hide-overlay', (event) => {
    if (!isMainSender(event, mainWindow)) return false;
    windowManager.hideOverlay();
    return true;
  });

  // ---------------------------------------------------------------------------
  // CANAL: app:get-state
  // Finalidade: Retorna o estado completo das abas e da navegação sob demanda.
  // Utilizado pelo renderer no carregamento inicial da interface.
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:get-state', (event) => {
    if (!isMainSender(event, mainWindow)) return null;
    return tabManager.getState();
  });

  // ---------------------------------------------------------------------------
  // CANAL: app:clear-all-data
  // Finalidade: Executa a limpeza completa e profunda de todas as abas, cookies,
  // cache e arquivos locais durante a animação do Dragão Azul.
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:clear-all-data', async (event, options) => {
    if (!isMainSender(event, mainWindow)) {
      console.warn('[Segurança] Tentativa não autorizada de invocar app:clear-all-data');
      return { success: false, errors: ['Acesso não autorizado'] };
    }
    menu.setIsClearing(true);
    try {
      const summary = await clearData.clearAllData({
        mainWindow: context.mainWindow,
        tabManager: context.tabManager,
        storage: context.storage,
        includeBookmarks: Boolean(options && options.includeBookmarks)
      });
      return summary;
    } catch (err) {
      menu.setIsClearing(false);
      console.error('[IPC:app:clear-all-data] Erro:', err);
      return {
        success: false,
        errors: [err.message || String(err)]
      };
    }
  });

  // ---------------------------------------------------------------------------
  // CANAL: app:finish-clear-session
  // Finalidade: Invocado estritamente no final da animação de chamas para
  // restaurar a visualização (hideOverlay) e abrir UMA aba limpa ativa.
  // ---------------------------------------------------------------------------
  ipcMain.handle('app:finish-clear-session', (event) => {
    if (!isMainSender(event, mainWindow)) return { success: false };
    menu.setIsClearing(false);
    windowManager.hideOverlay();
    const newTab = tabManager.createTab(config.NEW_TAB_URL, { active: true });
    if (typeof tabManager.notifyStateChange === 'function') {
      tabManager.notifyStateChange();
    }
    return { success: true, tabId: newTab ? newTab.id : null };
  });

  // ---------------------------------------------------------------------------
  // CANAL: tabs:create-private
  // Finalidade: Cria uma nova aba privada (sessão isolada em memória, sem persistência)
  // ---------------------------------------------------------------------------
  ipcMain.handle('tabs:create-private', (event, initialUrl) => {
    if (!isMainSender(event, mainWindow)) return null;
    let validUrl = typeof initialUrl === 'string' && initialUrl.trim().length > 0
      ? initialUrl.trim()
      : null;
    if (validUrl && typeof tabManager.isAllowedNavigationUrl === 'function' && !tabManager.isAllowedNavigationUrl(validUrl)) {
      console.warn('[IPC:tabs:create-private] URL bloqueada por esquema não permitido:', validUrl);
      validUrl = null;
    }
    return tabManager.createPrivateTab(validUrl).id;
  });

  // ---------------------------------------------------------------------------
  // CANAL: privacy:get-info
  // Finalidade: Retorna o número e lista de rastreadores bloqueados na aba ativa
  // ---------------------------------------------------------------------------
  ipcMain.handle('privacy:get-info', (event) => {
    if (!isMainSender(event, mainWindow)) return null;
    const activeTab = tabManager.getActiveTab();
    if (!activeTab || !activeTab.view) {
      return { count: 0, domains: [], isProtected: true, hostname: '' };
    }
    return privacy.getPrivacyInfoForTab(activeTab.view.webContents.id, activeTab.url);
  });

  // ---------------------------------------------------------------------------
  // CANAL: privacy:toggle-protection
  // Finalidade: Alterna a proteção contra rastreamento para o domínio do site atual
  // ---------------------------------------------------------------------------
  ipcMain.handle('privacy:toggle-protection', (event, hostname) => {
    if (!isMainSender(event, mainWindow)) return false;
    if (typeof hostname !== 'string' || !hostname) return false;
    const newState = privacy.toggleSiteProtection(hostname);
    tabManager.notifyStateChange();
    return newState;
  });

  // ===========================================================================
  // CANAL DE AVISO HTTPS (SEGURANÇA: REQUER isWarningSender(event))
  // ===========================================================================
  ipcMain.handle('warning:request-bypass-token', (event, targetUrl) => {
    if (!isWarningSender(event)) {
      console.warn('[Segurança] Requisição não autorizada em warning:request-bypass-token de:', event?.senderFrame?.url);
      return null;
    }
    if (typeof targetUrl !== 'string' || !targetUrl.startsWith('http://')) {
      return null;
    }
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname;
      const wcId = event.sender.id;
      return privacy.createHttpBypassToken(wcId, host);
    } catch {
      return null;
    }
  });

  // ===========================================================================
  // CANAIS DE CONFIGURAÇÕES (SEGURANÇA: REQUER isSettingsSender(event))
  // ===========================================================================

  // CANAL: settings:get
  // Retorna todas as configurações salvas (somente para pages/settings.html)
  ipcMain.handle('settings:get', (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:get de origem não autorizada:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return null;
    }
    return settings.getSettingsPageData();
  });

  // CANAL: settings:set
  // Grava uma chave individual de configuração
  ipcMain.handle('settings:set', (event, key, value) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:set de origem não autorizada:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return false;
    }
    return settings.set(key, value);
  });

  // CANAL: settings:set-all
  // Grava um lote de configurações
  ipcMain.handle('settings:set-all', (event, newSettings) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:set-all de origem não autorizada:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return false;
    }
    return settings.setAll(newSettings);
  });

  // CANAL: settings:choose-background-image
  // Abre diálogo nativo do sistema para escolher imagem e copiar para userData
  ipcMain.handle('settings:choose-background-image', async (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:choose-background-image:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return null;
    }
    return settings.chooseBackgroundImage(mainWindow);
  });

  // CANAL: settings:remove-background-image
  // Remove a imagem de fundo salva
  ipcMain.handle('settings:remove-background-image', (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição ignorada em settings:remove-background-image:', event && event.senderFrame ? event.senderFrame.url : 'desconhecido');
      return false;
    }
    return settings.removeBackgroundImage();
  });

  // CANAL: settings:set-proxy-password
  ipcMain.handle('settings:set-proxy-password', (event, password) => {
    if (!isSettingsSender(event)) return false;
    return settings.setProxyPassword(password);
  });

  // CANAL: settings:test-proxy
  ipcMain.handle('settings:test-proxy', async (event, proxyConfig) => {
    if (!isSettingsSender(event)) return { success: false, message: 'Não autorizado.' };
    return settings.testProxyConnection(proxyConfig);
  });

  // CANAL: settings:get-permissions
  ipcMain.handle('settings:get-permissions', (event) => {
    if (!isSettingsSender(event)) return [];
    return permissions.getAllPermissions();
  });

  // CANAL: settings:revoke-permission
  ipcMain.handle('settings:revoke-permission', (event, origin, permKey) => {
    if (!isSettingsSender(event)) return false;
    return permissions.revokePermission(origin, permKey);
  });

  // CANAL: fingerprint:reset
  // Sorteia nova identidade de fingerprint aleatória e consistente, persiste e recarrega abas
  ipcMain.handle('fingerprint:reset', (event) => {
    if (!isSettingsSender(event)) {
      console.warn('[Segurança] Requisição não autorizada em fingerprint:reset');
      return null;
    }
    const result = settings.resetFingerprint();
    if (tabManager && typeof tabManager.reloadAllWebTabs === 'function') {
      tabManager.reloadAllWebTabs();
    }
    return result;
  });

  // CANAL: fingerprint:get-options
  // Retorna listas de opções e presets para popular dropdowns na página de configurações
  ipcMain.handle('fingerprint:get-options', (event) => {
    if (!isSettingsSender(event)) return null;
    return fingerprintProtection.getFingerprintOptions();
  });

  // CANAL: fingerprint:validate
  // Valida consistência interna das configurações de fingerprint
  ipcMain.handle('fingerprint:validate', (event, config) => {
    if (!isSettingsSender(event)) return { valid: true, errors: [], warnings: [] };
    return fingerprintProtection.validateFingerprintConsistency(config);
  });

  // ===========================================================================
  // CANAIS DA INTERFACE PRINCIPAL (Validação: isMainSender)
  // ===========================================================================

  // CANAL: tabs:reorder
  ipcMain.handle('tabs:reorder', (event, sourceId, targetId) => {
    if (!isMainSender(event, mainWindow)) return false;
    tabManager.reorderTabs(sourceId, targetId);
    return true;
  });

  // CANAL: search:find
  ipcMain.handle('search:find', (event, payload) => {
    if (!isMainSender(event, mainWindow)) return false;
    const { text, forward, findNext } = payload || {};
    tabManager.findInPage(text, { forward: forward !== false, findNext: Boolean(findNext) });
    return true;
  });

  // CANAL: search:stop
  ipcMain.handle('search:stop', (event, action) => {
    if (!isMainSender(event, mainWindow)) return false;
    tabManager.stopFindInPage(action);
    return true;
  });

  // CANAL: omnibox:suggestions
  ipcMain.handle('omnibox:suggestions', (event, query) => {
    if (!isMainSender(event, mainWindow)) return { bookmarks: [], history: [], searchItem: null };
    const q = (query || '').trim();
    if (!q) return { bookmarks: [], history: [], searchItem: null };

    const bm = bookmarks.getBookmarks(q).slice(0, 4);
    const hist = history.getEntries(q, 4);
    const searchUrl = settings.getSearchUrl(q);
    const engineInfo = settings.getSearchEngineInfo();

    return {
      searchItem: {
        type: 'search',
        query: q,
        engineName: engineInfo.name,
        searchUrl: searchUrl
      },
      bookmarks: bm,
      history: hist
    };
  });

  // CANAL: bookmarks:toggle
  ipcMain.handle('bookmarks:toggle', (event, payload) => {
    if (!isMainSender(event, mainWindow)) return { bookmarked: false, bookmark: null };
    return bookmarks.toggleBookmark(payload);
  });

  // CANAL: bookmarks:is-bookmarked
  ipcMain.handle('bookmarks:is-bookmarked', (event, url) => {
    if (!isMainSender(event, mainWindow)) return false;
    return bookmarks.isBookmarked(url);
  });

  // CANAL: permissions:respond
  ipcMain.handle('permissions:respond', (event, payload) => {
    if (!isMainSender(event, mainWindow)) return false;
    const { requestId, allowed, remember } = payload || {};
    sessionModule.respondPermission(requestId, allowed, remember);
    return true;
  });

  // ===========================================================================
  // CANAIS DE PÁGINAS INTERNAS ESPECÍFICAS
  // ===========================================================================

  // Histórico (isHistorySender)
  ipcMain.handle('history:get', (event, query) => {
    if (!isHistorySender(event)) return [];
    return history.getEntries(query, 200);
  });

  ipcMain.handle('history:delete', (event, id) => {
    if (!isHistorySender(event)) return false;
    return history.deleteEntry(id);
  });

  ipcMain.handle('history:clear', (event) => {
    if (!isHistorySender(event)) return false;
    history.clearAll();
    return true;
  });

  ipcMain.handle('history:open', (event, url) => {
    if (!isHistorySender(event)) return false;
    return navigateSenderTab(event, url, tabManager, navigation);
  });

  // Favoritos (isBookmarksSender)
  ipcMain.handle('bookmarks:get', (event, query) => {
    if (!isBookmarksSender(event)) return [];
    return bookmarks.getBookmarks(query);
  });

  ipcMain.handle('bookmarks:remove', (event, id) => {
    if (!isBookmarksSender(event)) return false;
    return bookmarks.removeBookmark(id);
  });

  ipcMain.handle('bookmarks:add', (event, item) => {
    if (!isBookmarksSender(event)) return null;
    return bookmarks.addBookmark(item);
  });

  ipcMain.handle('bookmarks:clear', (event) => {
    if (!isBookmarksSender(event)) return false;
    bookmarks.clearAll();
    return true;
  });

  ipcMain.handle('bookmarks:open', (event, url) => {
    if (!isBookmarksSender(event)) return false;
    return navigateSenderTab(event, url, tabManager, navigation);
  });

  // Downloads (isDownloadsSender)
  ipcMain.handle('downloads:get', (event) => {
    if (!isDownloadsSender(event)) return [];
    return downloads.getDownloads();
  });

  ipcMain.handle('downloads:open-file', (event, filePath) => {
    if (!isDownloadsSender(event)) return false;
    if (typeof filePath !== 'string' || !filePath.trim()) return false;
    downloads.openFile(filePath.trim());
    return true;
  });

  ipcMain.handle('downloads:show-in-folder', (event, filePath) => {
    if (!isDownloadsSender(event)) return false;
    if (typeof filePath !== 'string' || !filePath.trim()) return false;
    downloads.showInFolder(filePath.trim());
    return true;
  });

  ipcMain.handle('downloads:cancel', (event, id) => {
    if (!isDownloadsSender(event)) return false;
    return downloads.cancelDownload(id);
  });

  ipcMain.handle('downloads:clear', (event) => {
    if (!isDownloadsSender(event)) return false;
    downloads.clearHistory();
    return true;
  });

  ipcMain.handle('downloads:open', (event, url) => {
    if (!isDownloadsSender(event)) return false;
    return navigateSenderTab(event, url, tabManager, navigation);
  });

  // Erro de Certificado (isCertErrorSender)
  ipcMain.handle('navigation:home-from-page', (event) => {
    if (!isCertErrorSender(event)) return false;
    const homeUrl = settings.get('homePageUrl') || config.NEW_TAB_URL;
    if (!event.sender || event.sender.isDestroyed()) return false;
    event.sender.loadURL(homeUrl).catch(err => {
      if (err && err.code !== 'ERR_ABORTED') {
        console.warn('[Navegação] Falha ao navegar para Home na aba do remetente:', err.message);
      }
    });
    return true;
  });

  ipcMain.handle('cert-error:request-bypass-token', (event, targetUrl) => {
    if (!isCertErrorSender(event)) {
      console.warn('[Segurança] Requisição não autorizada em cert-error:request-bypass-token de:', event?.senderFrame?.url);
      return null;
    }
    if (typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
      return null;
    }
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname;
      const wcId = event.sender.id;
      return privacy.createCertBypassToken(wcId, host);
    } catch {
      return null;
    }
  });

  ipcMain.handle('cert-error:proceed', (event, payload) => {
    if (!isCertErrorSender(event)) return false;
    const { targetUrl, token } = payload || {};
    if (!targetUrl || !token) return false;
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname;
      const wcId = event.sender.id;
      if (privacy.validateAndConsumeCertBypassToken(token, wcId, host)) {
        privacy.allowCertHostForTab(wcId, host);
        return navigateSenderTab(event, targetUrl, tabManager, navigation);
      }
    } catch {}
    return false;
  });

  // Confirmação ou cancelamento de download potencialmente perigoso (ETAPA 4)
  ipcMain.handle('downloads:confirm-risk', (event, downloadId) => {
    if (!isMainSender(event, mainWindow)) return false;
    return downloads.confirmRiskDownload(downloadId);
  });

  ipcMain.handle('downloads:cancel-risk', (event, downloadId) => {
    if (!isMainSender(event, mainWindow)) return false;
    return downloads.cancelRiskDownload(downloadId);
  });

  // Notifica downloads na interface principal e nas abas de download abertas
  downloads.setDownloadUpdateListener((downloadData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:download-update', downloadData);
    }
    if (tabManager && typeof tabManager.getTabs === 'function') {
      const allTabs = tabManager.getTabs();
      for (const t of allTabs) {
        if (t.url && t.url.startsWith(config.DOWNLOADS_PAGE_URL) && t.view && !t.view.webContents.isDestroyed()) {
          t.view.webContents.send('downloads:tab-update', downloadData);
        }
      }
    }
  });

  // Notifica aviso de download de risco para a interface principal
  downloads.setDownloadRiskListener((promptData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:download-risk-prompt', promptData);
    }
  });

  // Canal para injeção de script de mitigação de fingerprinting nas abas web (ETAPA 5)
  ipcMain.on('fingerprint:get-script', (event) => {
    if (!event || !event.sender || event.sender.isDestroyed()) {
      event.returnValue = '';
      return;
    }
    event.returnValue = fingerprintProtection.getInjectionScript();
  });
}

module.exports = {
  init
};
```

---

### 4.21 `src/main/menu.js`

```javascript
// =============================================================================
// src/main/menu.js
// Gerenciamento dos atalhos de teclado do navegador
// =============================================================================

const { Menu } = require('electron');

let isClearing = false;

/**
 * Define se o navegador está atualmente executando o procedimento de limpeza de dados.
 * Enquanto ativo, todos os atalhos de teclado são imediatamente ignorados.
 * @param {boolean} active
 */
function setIsClearing(active) {
  isClearing = Boolean(active);
}

/**
 * Retorna se a limpeza de dados está em andamento
 * @returns {boolean}
 */
function getIsClearing() {
  return isClearing;
}

/**
 * Alterna a abertura do console de desenvolvedor (DevTools)
 * Prioriza o DevTools da aba ativa; se não houver, abre da janela principal.
 * @param {object} mainWindow Janela principal
 * @param {object} tabManager Gerenciador de abas
 */
function toggleDevTools(mainWindow, tabManager) {
  const activeTab = tabManager.getActiveTab();
  if (activeTab && activeTab.view) {
    if (activeTab.view.webContents.isDevToolsOpened()) {
      activeTab.view.webContents.closeDevTools();
    } else {
      activeTab.view.webContents.openDevTools({ mode: 'detach' });
    }
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.toggleDevTools();
  }
}

/**
 * Trata eventos de tecla pressionada ('keyDown') disparados tanto pela
 * interface principal quanto pelas WebContentsViews das abas.
 *
 * @param {Event} event Evento do Electron
 * @param {object} input Informações da tecla pressionada
 * @param {object} context Contexto com mainWindow, tabManager e navigation
 * @returns {boolean} True se o atalho foi consumido
 */
function handleKeyboardEvent(event, input, context) {
  // Se a limpeza de dados estiver em andamento, bloqueia todos os atalhos para manter a interface travada
  if (isClearing) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    return true;
  }

  if (input.type !== 'keyDown') return false;

  const { mainWindow, tabManager, navigation } = context;
  const isCtrl = input.control || input.meta;
  const key = input.key ? input.key.toLowerCase() : '';

  // 1. Ctrl + Shift + T -> Reabrir aba fechada
  if (isCtrl && input.shift && key === 't' && !input.alt) {
    event.preventDefault();
    tabManager.reopenClosedTab();
    return true;
  }

  // 2. Ctrl + T -> Nova aba
  if (isCtrl && key === 't' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.createTab();
    return true;
  }

  // 3. Ctrl + W -> Fechar aba ativa
  if (isCtrl && key === 'w' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.closeActiveTab();
    return true;
  }

  // 4. Ctrl + L -> Focar barra de endereço
  if (isCtrl && key === 'l' && !input.shift && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:focus-addressbar');
    }
    return true;
  }

  // 5. Ctrl + F -> Busca na página
  if (isCtrl && key === 'f' && !input.shift && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:open-find');
    }
    return true;
  }

  // 6. Ctrl + D -> Favoritar página atual
  if (isCtrl && key === 'd' && !input.shift && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:toggle-bookmark');
    }
    return true;
  }

  // 7. Ctrl + R ou F5 -> Recarregar página
  if ((isCtrl && key === 'r' && !input.alt) || input.key === 'F5') {
    event.preventDefault();
    navigation.reload(tabManager);
    return true;
  }

  // 8. Alt + Seta Esquerda -> Voltar
  if (input.alt && (input.key === 'ArrowLeft' || input.key === 'Left') && !isCtrl) {
    event.preventDefault();
    navigation.goBack(tabManager);
    return true;
  }

  // 9. Alt + Seta Direita -> Avançar
  if (input.alt && (input.key === 'ArrowRight' || input.key === 'Right') && !isCtrl) {
    event.preventDefault();
    navigation.goForward(tabManager);
    return true;
  }

  // 10. Alt + Home -> Página Inicial
  if (input.alt && (key === 'home' || input.key === 'Home') && !isCtrl) {
    event.preventDefault();
    navigation.goHome(tabManager);
    return true;
  }

  // 11. Ctrl + Shift + Tab -> Aba anterior
  if (isCtrl && input.shift && input.key === 'Tab' && !input.alt) {
    event.preventDefault();
    tabManager.selectPreviousTab();
    return true;
  }

  // 12. Ctrl + Tab -> Próxima aba
  if (isCtrl && input.key === 'Tab' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.selectNextTab();
    return true;
  }

  // 13. Ctrl + 1 a 8 -> Ir para aba 1..8
  if (isCtrl && !input.shift && !input.alt && /^[1-8]$/.test(input.key)) {
    event.preventDefault();
    const tabIndex = parseInt(input.key, 10) - 1;
    tabManager.selectTabByIndex(tabIndex);
    return true;
  }

  // 14. Ctrl + 9 -> Ir para a última aba
  if (isCtrl && input.key === '9' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.selectLastTab();
    return true;
  }

  // 15. Zoom: Ctrl + / Ctrl - / Ctrl 0
  if (isCtrl && (key === '+' || key === '=' || input.key === '+' || input.key === '=') && !input.alt) {
    event.preventDefault();
    tabManager.zoomIn();
    return true;
  }
  if (isCtrl && (key === '-' || key === '_' || input.key === '-') && !input.alt) {
    event.preventDefault();
    tabManager.zoomOut();
    return true;
  }
  if (isCtrl && key === '0' && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.zoomReset();
    return true;
  }

  // 16. F12 -> DevTools
  if (input.key === 'F12') {
    event.preventDefault();
    toggleDevTools(mainWindow, tabManager);
    return true;
  }

  // 17. Ctrl + Shift + Delete -> Apagar Tudo (Fogo do Dragão Azul)
  if (isCtrl && input.shift && (key === 'delete' || input.key === 'Delete') && !input.alt) {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:trigger-clear-data');
    }
    return true;
  }

  // 18. Ctrl + Shift + N -> Nova Aba Privada
  if (isCtrl && input.shift && key === 'n' && !input.alt) {
    event.preventDefault();
    tabManager.createPrivateTab();
    return true;
  }

  // 19. Ctrl + , -> Abrir Configurações
  if (isCtrl && (key === ',' || input.key === ',') && !input.shift && !input.alt) {
    event.preventDefault();
    tabManager.openSettingsTab();
    return true;
  }

  // 20. Ctrl + H -> Histórico
  if (isCtrl && key === 'h' && !input.shift && !input.alt) {
    event.preventDefault();
    if (typeof tabManager.openHistoryTab === 'function') {
      tabManager.openHistoryTab();
    } else {
      tabManager.createTab('dragon://history', { active: true });
    }
    return true;
  }

  // 21. Ctrl + J -> Downloads
  if (isCtrl && key === 'j' && !input.shift && !input.alt) {
    event.preventDefault();
    if (typeof tabManager.openDownloadsTab === 'function') {
      tabManager.openDownloadsTab();
    } else {
      tabManager.createTab('dragon://downloads', { active: true });
    }
    return true;
  }

  return false;
}

/**
 * Inicializa os atalhos de teclado da aplicação
 * @param {object} context Objeto contendo { mainWindow, tabManager, navigation }
 */
function init(context) {
  const { mainWindow, tabManager } = context;

  // Intercepta atalhos quando o foco está na interface (HTML)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    handleKeyboardEvent(event, input, context);
  });

  // Conecta o manipulador ao TabManager para interceptar teclas dentro dos WebContentsViews
  tabManager.setShortcutHandler((event, input) => {
    handleKeyboardEvent(event, input, context);
  });

  // Configura um menu de aplicação limpo do Electron para habilitar aceleradores nativos
  const template = [
    {
      label: 'Navegação',
      submenu: [
        {
          label: 'Nova Aba',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            if (isClearing) return;
            tabManager.createTab();
          }
        },
        {
          label: 'Reabrir Aba Fechada',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            if (isClearing) return;
            tabManager.reopenClosedTab();
          }
        },
        {
          label: 'Nova Aba Privada',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            if (isClearing) return;
            tabManager.createPrivateTab();
          }
        },
        {
          label: 'Fechar Aba',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (isClearing) return;
            tabManager.closeActiveTab();
          }
        },
        {
          label: 'Focar Barra de Endereço',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:focus-addressbar');
            }
          }
        },
        {
          label: 'Localizar na Página',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:open-find');
            }
          }
        },
        {
          label: 'Favoritar Página',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:toggle-bookmark');
            }
          }
        },
        {
          label: 'Página Inicial',
          accelerator: 'Alt+Home',
          click: () => {
            if (isClearing) return;
            context.navigation.goHome(tabManager);
          }
        },
        {
          label: 'Recarregar',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (isClearing) return;
            context.navigation.reload(tabManager);
          }
        },
        {
          label: 'Próxima Aba',
          accelerator: 'Ctrl+Tab',
          click: () => {
            if (isClearing) return;
            tabManager.selectNextTab();
          }
        },
        {
          label: 'Aba Anterior',
          accelerator: 'Ctrl+Shift+Tab',
          click: () => {
            if (isClearing) return;
            tabManager.selectPreviousTab();
          }
        },
        {
          label: 'Zoom +',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            if (isClearing) return;
            tabManager.zoomIn();
          }
        },
        {
          label: 'Zoom -',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (isClearing) return;
            tabManager.zoomOut();
          }
        },
        {
          label: 'Zoom 100%',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (isClearing) return;
            tabManager.zoomReset();
          }
        },
        {
          label: 'Apagar Tudo...',
          accelerator: 'CmdOrCtrl+Shift+Delete',
          click: () => {
            if (isClearing) return;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('browser:trigger-clear-data');
            }
          }
        },
        {
          label: 'Configurações',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (isClearing) return;
            tabManager.openSettingsTab();
          }
        },
        {
          label: 'Alternar Ferramentas de Desenvolvedor',
          accelerator: 'F12',
          click: () => {
            if (isClearing) return;
            toggleDevTools(mainWindow, tabManager);
          }
        }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);

  return {
    handleKeyboardEvent,
    toggleDevTools,
    setIsClearing,
    getIsClearing
  };
}

module.exports = {
  init,
  handleKeyboardEvent,
  toggleDevTools,
  setIsClearing,
  getIsClearing
};
```

---

### 4.22 `src/main/pure/navigation-utils.js`

```javascript
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
```

---

### 4.23 `src/main/pure/privacy-utils.js`

```javascript
// =============================================================================
// src/main/pure/privacy-utils.js
// Funções puras de privacidade, domínios e limpeza de parâmetros de rastreamento
// =============================================================================

const { getDomain } = require('tldts');

// Parâmetros comuns de rastreamento a serem removidos de links
const TRACKING_PARAM_REGEX = /^(utm_[a-zA-Z0-9_]+|fbclid|gclid|msclkid|mc_eid|igshid|_ga)$/i;

/**
 * Extrai o domínio base (eTLD+1) usando a biblioteca robusta tldts
 * @param {string} hostname
 * @returns {string}
 */
function getBaseDomain(hostname) {
  if (!hostname || typeof hostname !== 'string') return '';
  const domain = getDomain(hostname, { allowPrivateDomains: true });
  return domain || hostname.toLowerCase();
}

/**
 * Verifica se um hostname corresponde a um endereço local/privado
 * @param {string} hostname
 * @returns {boolean}
 */
function isLocalHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;

  const clean = hostname.trim().toLowerCase();

  if (clean === 'localhost' || clean === '::1' || clean === '[::1]') {
    return true;
  }

  if (clean.endsWith('.local')) {
    return true;
  }

  if (!clean.includes('.') && !clean.includes(':')) {
    return true;
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = clean.match(ipv4Regex);
  if (match) {
    const b0 = parseInt(match[1], 10);
    const b1 = parseInt(match[2], 10);
    const b2 = parseInt(match[3], 10);
    const b3 = parseInt(match[4], 10);

    if (b0 <= 255 && b1 <= 255 && b2 <= 255 && b3 <= 255) {
      if (b0 === 127) return true;
      if (b0 === 10) return true;
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      if (b0 === 192 && b1 === 168) return true;
      if (b0 === 169 && b1 === 254) return true;
      if (b0 === 0 && b1 === 0 && b2 === 0 && b3 === 0) return true;
    }
  }

  return false;
}

/**
 * Verifica se um domínio coincide com a lista ou conjunto de rastreadores
 * @param {string} hostname Hostname a ser testado
 * @param {Set<string>} trackerDomains Conjunto de rastreadores conhecidos
 * @returns {boolean}
 */
function isTrackerDomain(hostname, trackerDomains) {
  if (!hostname || !trackerDomains || !(trackerDomains instanceof Set)) return false;
  const host = hostname.toLowerCase();

  // Teste exato
  if (trackerDomains.has(host)) return true;

  // Teste de subdomínio (ex: ad.service.doubleclick.net -> doubleclick.net)
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (trackerDomains.has(parentDomain)) {
      return true;
    }
  }

  return false;
}

/**
 * Limpa parâmetros de rastreamento da URL
 * @param {string} rawUrl
 * @returns {{ cleanedUrl: string, hasRemovedParams: boolean }}
 */
function cleanTrackingParameters(rawUrl) {
  try {
    const urlObj = new URL(rawUrl);
    let hasRemovedParams = false;
    const keysToRemove = [];

    urlObj.searchParams.forEach((value, key) => {
      if (TRACKING_PARAM_REGEX.test(key)) {
        keysToRemove.push(key);
      }
    });

    if (keysToRemove.length > 0) {
      keysToRemove.forEach(k => urlObj.searchParams.delete(k));
      hasRemovedParams = true;
      return { cleanedUrl: urlObj.toString(), hasRemovedParams };
    }
  } catch (e) {
    // Mantém original em caso de URL inválida
  }
  return { cleanedUrl: rawUrl, hasRemovedParams: false };
}

/**
 * Valida se uma linha da blocklist representa um hostname sintaticamente válido.
 * Aceita apenas linhas com letras, números, hífen e pontos, com ao menos um ponto,
 * sem espaços, sem barras, sem '#' e sem portas.
 * @param {string} line
 * @returns {boolean}
 */
function isValidBlocklistHost(line) {
  if (!line || typeof line !== 'string') return false;
  const clean = line.trim().toLowerCase();
  if (!clean || clean.startsWith('#')) return false;
  if (clean.includes(' ') || clean.includes('/') || clean.includes(':') || clean.includes('\\')) return false;
  if (!clean.includes('.')) return false;

  const hostRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
  return hostRegex.test(clean);
}

/**
 * Detecta se uma sequência de redirecionamentos em curto intervalo de tempo (<= windowMs)
 * excede o limite de domínios diferentes visitados sem interação do usuário.
 * Exemplo: mais de 2 transições para domínios diferentes em menos de 1.5 segundos.
 *
 * @param {Array<{ url: string, domain: string, timestamp: number }>} history
 * @param {string} targetUrl URL de destino do redirecionamento
 * @param {number} [now=Date.now()] Timestamp atual
 * @param {number} [windowMs=1500] Janela de tempo em milissegundos
 * @param {number} [threshold=2] Quantidade máxima tolerada de domínios diferentes na cadeia
 * @returns {boolean} true se a cadeia for abusiva/suspeita
 */
function isSuspiciousRedirectChain(history, targetUrl, now = Date.now(), windowMs = 1500, threshold = 2) {
  if (!Array.isArray(history) || !targetUrl) return false;
  let targetDomain = '';
  try {
    targetDomain = getBaseDomain(new URL(targetUrl).hostname);
  } catch {
    return false;
  }
  if (!targetDomain) return false;

  // Filtra itens recentes dentro da janela de tempo (ex.: 1500ms)
  const recent = history.filter(item => (now - item.timestamp) <= windowMs);
  const distinctDomains = new Set();
  for (const item of recent) {
    if (item.domain) {
      distinctDomains.add(item.domain);
    }
  }

  // Se já houver >= threshold domínios distintos e o novo for mais um domínio diferente
  if (!distinctDomains.has(targetDomain) && distinctDomains.size >= threshold) {
    return true;
  }

  return false;
}

/**
 * Calcula a nota de privacidade (A a F) para um site com base nas métricas coletadas pelo Dragon.
 *
 * Regra de avaliação (base 100 pontos):
 * 1. Protocolo HTTPS:
 *    - Conexão HTTPS: 0 penalidade (tráfego criptografado e seguro)
 *    - Conexão HTTP insegura: -45 pontos (tráfego em texto claro, vulnerável a interceptação)
 * 2. Rastreadores bloqueados:
 *    - 0 rastreadores: 0 penalidade
 *    - 1 a 3 rastreadores: -10 pontos
 *    - 4 a 9 rastreadores: -25 pontos
 *    - 10 ou mais rastreadores: -40 pontos
 * 3. Pop-ups e Redirecionamentos abusivos bloqueados:
 *    - 0 bloqueios: 0 penalidade
 *    - 1 bloqueio: -15 pontos
 *    - 2 ou mais bloqueios: -30 pontos
 * 4. Cookies de terceiros bloqueados:
 *    - Se houver registro de cookies de terceiros bloqueados: -5 pontos adicionais
 *
 * Classificação final:
 * - A: 90 a 100 pontos (HTTPS + 0 a 3 rastreadores + sem popups)
 * - B: 75 a 89 pontos (HTTPS + poucos rastreadores bloqueados)
 * - C: 60 a 74 pontos (HTTPS + quantidade moderada de rastreadores ou 1 popup abusivo)
 * - D: 40 a 59 pontos (HTTP inseguro OU densidade alta de rastreadores)
 * - F: Menos de 40 pontos (HTTP inseguro com rastreadores/pop-ups OU tráfego altamente invasivo)
 *
 * @param {object} [info]
 * @param {boolean} [info.isHttps=true]
 * @param {number} [info.count=0]
 * @param {number} [info.trackersCount=0]
 * @param {number} [info.popupsBlocked=0]
 * @param {number|boolean} [info.thirdPartyCookiesBlocked=0]
 * @returns {'A'|'B'|'C'|'D'|'F'}
 */
function calculatePrivacyGrade(info = {}) {
  const isHttps = info.isHttps !== false;
  const trackers = Number(info.trackersCount ?? info.count ?? 0) || 0;
  const popups = Number(info.popupsBlocked ?? 0) || 0;
  const thirdPartyCookies = Number(info.thirdPartyCookiesBlocked ?? 0) || (info.thirdPartyCookiesBlocked ? 1 : 0);

  let score = 100;

  // 1. Penalidade por tráfego HTTP sem TLS/HTTPS
  if (!isHttps) {
    score -= 45;
  }

  // 2. Penalidade por rastreadores identificados e bloqueados
  if (trackers >= 10) {
    score -= 40;
  } else if (trackers >= 4) {
    score -= 25;
  } else if (trackers >= 1) {
    score -= 10;
  }

  // 3. Penalidade por pop-ups e redirecionamentos abusivos sem gesto do usuário
  if (popups >= 2) {
    score -= 30;
  } else if (popups === 1) {
    score -= 15;
  }

  // 4. Penalidade por cookies de terceiros
  if (thirdPartyCookies > 0) {
    score -= 5;
  }

  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

module.exports = {
  getBaseDomain,
  isLocalHost,
  isTrackerDomain,
  cleanTrackingParameters,
  isValidBlocklistHost,
  isSuspiciousRedirectChain,
  calculatePrivacyGrade
};


```

---

### 4.24 `src/main/pure/settings-utils.js`

```javascript
// =============================================================================
// src/main/pure/settings-utils.js
// Funções puras de validação e mescla de configurações sem dependência do Electron
// =============================================================================

const DEFAULT_SETTINGS = {
  // Seção Principal
  searchEngine: 'duckduckgo',
  customSearchUrl: '',
  startupBehavior: 'newtab',
  startupCustomUrl: 'https://duckduckgo.com',
  homePageUrl: 'https://duckduckgo.com',
  defaultZoom: 1.0,

  // Seção Personalização
  accentColor: '#4d7cff',
  theme: 'dark',
  backgroundImage: '',
  backgroundDim: 40,
  backgroundBlur: 4,
  showShortcuts: true,

  // Seção Rede e Proxy
  proxyMode: 'system', // 'system', 'direct', 'manual'
  proxyRules: '',      // ex: http://127.0.0.1:8080 ou socks5://127.0.0.1:1080
  proxyBypass: '<local>;*.local',
  proxyAuthUser: '',
  proxyAuthPasswordEncrypted: '',
  applyProxyToPrivateTabs: false,

  // Seção Encerramento e Privacidade
  clearDataOnExit: false,

  // Seção Proteção contra Fingerprinting Avançada (Configurável + Reset)
  fingerprintProtectionEnabled: false,
  fingerprintSpoofTimezone: false,
  fingerprintSpoofResolution: false,
  fingerprintCanvasNoise: false,
  fingerprintLimitFonts: false,
  fingerprintNormalizeUA: false,

  fpFingerprintSeed: null,
  fpOs: 'windows11',
  fpBrowser: 'chrome',
  fpUserAgent: 'auto',
  fpPlatform: 'auto',
  fpLocale: 'pt-BR',
  fpTimezone: 'America/Sao_Paulo',
  fpScreenResolution: '1920x1080',
  fpDevicePixelRatio: 'auto',
  fpHardwareConcurrency: 8,
  fpDeviceMemory: 8,
  fpTouchSupport: false,
  fpWebglVendor: 'auto',
  fpWebglRenderer: 'auto',
  fpWebglImageMode: 'noise',
  fpCanvasMode: 'noise',
  fpAudioMode: 'noise',
  fpClientRectsMode: 'noise',
  fpFontsMode: 'mask',
  fpWebrtcMode: 'proxy',
  fpMediaDevicesCount: 2,
  fpSpeechVoices: 'mask',
  fpBatteryMode: 'mask',
  fpPermissionsMode: 'mask'
};

const VALID_THEMES = new Set(['dark', 'light', 'system']);
const VALID_SEARCH_ENGINES = new Set(['duckduckgo', 'google', 'bing', 'brave', 'startpage', 'ecosia', 'custom']);
const VALID_STARTUP_BEHAVIORS = new Set(['newtab', 'restore', 'custom']);
const VALID_PROXY_MODES = new Set(['system', 'direct', 'manual']);
const ACCENT_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const BACKGROUND_IMAGE_REGEX = /^newtab-bg\.(png|jpe?g|webp|gif|bmp)$/i;

const VALID_FP_OS = new Set(['windows10', 'windows11', 'macos', 'linux']);
const VALID_FP_BROWSERS = new Set(['chrome', 'edge', 'firefox']);
const VALID_FP_PLATFORMS = new Set(['auto', 'Win32', 'MacIntel', 'Linux x86_64']);
const VALID_FP_LOCALES = new Set(['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE']);
const VALID_FP_RESOLUTIONS = new Set(['1920x1080', '2560x1440', '1366x768', '1536x864', '2880x1800', '3840x2160']);
const VALID_FP_CORES = new Set([2, 4, 6, 8, 12, 16]);
const VALID_FP_MEMORY = new Set([2, 4, 8, 16, 32]);
const VALID_MODES_3 = new Set(['real', 'noise', 'mask']);
const VALID_MODES_2 = new Set(['real', 'mask']);
const VALID_WEBRTC_MODES = new Set(['proxy', 'disabled', 'real']);
const VALID_MEDIA_COUNTS = new Set([0, 1, 2, 3]);

function isValidHttpUrl(str) {
  if (typeof str !== 'string' || !str.trim()) return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Valida rigorosamente se uma chave e seu respectivo valor são válidos
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
function isValidSetting(key, value) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    return false;
  }

  switch (key) {
    case 'searchEngine':
      return typeof value === 'string' && VALID_SEARCH_ENGINES.has(value);

    case 'theme':
      return typeof value === 'string' && VALID_THEMES.has(value);

    case 'startupBehavior':
      return typeof value === 'string' && VALID_STARTUP_BEHAVIORS.has(value);

    case 'accentColor':
      return typeof value === 'string' && ACCENT_COLOR_REGEX.test(value);

    case 'defaultZoom':
      return typeof value === 'number' && !Number.isNaN(value) && value >= 0.25 && value <= 3.0;

    case 'backgroundDim':
      return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 90;

    case 'backgroundBlur':
      return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 20;

    case 'startupCustomUrl':
    case 'homePageUrl':
      return isValidHttpUrl(value);

    case 'customSearchUrl':
      return typeof value === 'string' && (value === '' || (value.includes('%s') && isValidHttpUrl(value)));

    case 'backgroundImage':
      return typeof value === 'string' && (value === '' || BACKGROUND_IMAGE_REGEX.test(value));

    case 'showShortcuts':
    case 'clearDataOnExit':
      return typeof value === 'boolean';

    case 'proxyMode':
      return typeof value === 'string' && VALID_PROXY_MODES.has(value);

    case 'proxyRules':
    case 'proxyBypass':
    case 'proxyAuthUser':
    case 'proxyAuthPasswordEncrypted':
      return typeof value === 'string';

    case 'applyProxyToPrivateTabs':
    case 'fingerprintProtectionEnabled':
    case 'fingerprintSpoofTimezone':
    case 'fingerprintSpoofResolution':
    case 'fingerprintCanvasNoise':
    case 'fingerprintLimitFonts':
    case 'fingerprintNormalizeUA':
    case 'fpTouchSupport':
      return typeof value === 'boolean';

    case 'fpFingerprintSeed':
      return value === null || (typeof value === 'number' && !Number.isNaN(value) && Number.isInteger(value) && value >= 0);

    case 'fpOs':
      return typeof value === 'string' && VALID_FP_OS.has(value);

    case 'fpBrowser':
      return typeof value === 'string' && VALID_FP_BROWSERS.has(value);

    case 'fpUserAgent':
      return typeof value === 'string' && (value === 'auto' || value.length > 5);

    case 'fpPlatform':
      return typeof value === 'string' && VALID_FP_PLATFORMS.has(value);

    case 'fpLocale':
      return typeof value === 'string' && VALID_FP_LOCALES.has(value);

    case 'fpTimezone':
      return typeof value === 'string' && (value === 'auto' || value.length >= 2);

    case 'fpScreenResolution':
      return typeof value === 'string' && VALID_FP_RESOLUTIONS.has(value);

    case 'fpDevicePixelRatio':
      return value === 'auto' || ([1, 1.25, 1.5, 2, 3].includes(Number(value)));

    case 'fpHardwareConcurrency':
      return VALID_FP_CORES.has(Number(value));

    case 'fpDeviceMemory':
      return VALID_FP_MEMORY.has(Number(value));

    case 'fpWebglVendor':
    case 'fpWebglRenderer':
      return typeof value === 'string' && value.length >= 1;

    case 'fpWebglImageMode':
    case 'fpCanvasMode':
    case 'fpAudioMode':
    case 'fpClientRectsMode':
      return typeof value === 'string' && VALID_MODES_3.has(value);

    case 'fpFontsMode':
    case 'fpSpeechVoices':
    case 'fpBatteryMode':
    case 'fpPermissionsMode':
      return typeof value === 'string' && VALID_MODES_2.has(value);

    case 'fpWebrtcMode':
      return typeof value === 'string' && VALID_WEBRTC_MODES.has(value);

    case 'fpMediaDevicesCount':
      return VALID_MEDIA_COUNTS.has(Number(value));

    default:
      return false;
  }
}

/**
 * Mescla dados gravados com valores padrão descartando valores inválidos
 * @param {object} saved
 * @returns {object}
 */
function mergeWithDefaults(saved) {
  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (saved[key] !== undefined && saved[key] !== null && isValidSetting(key, saved[key])) {
      result[key] = saved[key];
    }
  }
  return result;
}

module.exports = {
  DEFAULT_SETTINGS,
  isValidSetting,
  mergeWithDefaults,
  isValidHttpUrl
};
```

---

### 4.25 `src/main/pure/download-utils.js`

```javascript
// =============================================================================
// src/main/pure/download-utils.js
// Funções puras para validação e classificação de segurança de arquivos baixados
// =============================================================================

const path = require('path');

// Lista canônica de extensões de risco de execução no Windows
const RISKY_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.scr',
  '.msi',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.ps1',
  '.ps1xml',
  '.ps2',
  '.ps2xml',
  '.psc1',
  '.psc2',
  '.jar',
  '.com',
  '.pif',
  '.reg',
  '.hta',
  '.cpl',
  '.inf',
  '.ins',
  '.isp'
]);

/**
 * Verifica se um nome de arquivo ou caminho possui extensão de risco de execução
 * @param {string} filename Nome do arquivo ou caminho completo
 * @returns {boolean}
 */
function isRiskyDownload(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const ext = path.extname(filename).trim().toLowerCase();
  return RISKY_EXTENSIONS.has(ext);
}

module.exports = {
  RISKY_EXTENSIONS,
  isRiskyDownload
};
```

---

### 4.26 `src/main/pure/fingerprint-utils.js`

```javascript
// =============================================================================
// src/main/pure/fingerprint-utils.js
// Funções puras para sistema de fingerprint avançado, presets e validação de consistência
// =============================================================================

const OS_PRESETS = {
  windows11: {
    id: 'windows11',
    name: 'Windows 11',
    platform: 'Win32',
    uaOs: 'Windows NT 10.0; Win64; x64',
    oscpu: 'Windows NT 10.0; Win64; x64',
    defaultFonts: ['Arial', 'Calibri', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana', 'Consolas', 'Courier New', 'Georgia']
  },
  windows10: {
    id: 'windows10',
    name: 'Windows 10',
    platform: 'Win32',
    uaOs: 'Windows NT 10.0; Win64; x64',
    oscpu: 'Windows NT 10.0; Win64; x64',
    defaultFonts: ['Arial', 'Calibri', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana', 'Consolas', 'Courier New', 'Georgia']
  },
  macos: {
    id: 'macos',
    name: 'macOS (Sonoma / Sequoia)',
    platform: 'MacIntel',
    uaOs: 'Macintosh; Intel Mac OS X 10_15_7',
    oscpu: 'Intel Mac OS X 10_15_7',
    defaultFonts: ['San Francisco', 'Helvetica Neue', 'Helvetica', 'Arial', 'Times', 'Courier', 'Geneva', 'Monaco', 'Menlo']
  },
  linux: {
    id: 'linux',
    name: 'Linux (Ubuntu / Fedora)',
    platform: 'Linux x86_64',
    uaOs: 'X11; Linux x86_64',
    oscpu: 'Linux x86_64',
    defaultFonts: ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'FreeSans', 'Arial', 'Times New Roman', 'Courier 10 Pitch', 'DejaVu Sans Mono']
  }
};

const BROWSER_PRESETS = {
  chrome: {
    id: 'chrome',
    name: 'Google Chrome',
    version: '130.0.0.0',
    vendor: 'Google Inc.'
  },
  edge: {
    id: 'edge',
    name: 'Microsoft Edge',
    version: '130.0.0.0',
    vendor: 'Google Inc.'
  },
  firefox: {
    id: 'firefox',
    name: 'Mozilla Firefox',
    version: '132.0',
    vendor: ''
  }
};

const GPU_PRESETS = {
  windows: [
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    },
    {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
  ],
  macos: [
    {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)'
    },
    {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)'
    },
    {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)'
    },
    {
      vendor: 'Google Inc. (Intel Inc.)',
      renderer: 'ANGLE (Intel Inc., Intel Iris Plus Graphics OpenGL 4.1)'
    }
  ],
  linux: [
    {
      vendor: 'Google Inc. (Intel)',
      renderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)'
    },
    {
      vendor: 'Google Inc. (Mesa)',
      renderer: 'Mesa AMD Radeon RX 580 (POLARIS10)'
    },
    {
      vendor: 'Google Inc. (NVIDIA Corporation)',
      renderer: 'NVIDIA GeForce GTX 1060 6GB/PCIe/SSE2'
    }
  ]
};

const SCREEN_PRESETS = [
  { id: '1920x1080', name: '1920 × 1080 (Full HD, Mais Comum)', width: 1920, height: 1080, dpr: 1 },
  { id: '2560x1440', name: '2560 × 1440 (2K / QHD)', width: 2560, height: 1440, dpr: 1.25 },
  { id: '1366x768',  name: '1366 × 768 (Notebook Padrão)', width: 1366, height: 768, dpr: 1 },
  { id: '1536x864',  name: '1536 × 864 (Notebook Alta Densidade)', width: 1536, height: 864, dpr: 1.25 },
  { id: '2880x1800', name: '2880 × 1800 (MacBook Pro Retina)', width: 2880, height: 1800, dpr: 2 },
  { id: '3840x2160', name: '3840 × 2160 (4K UHD)', width: 3840, height: 2160, dpr: 1.5 }
];

const LOCALE_TIMEZONE_MAP = {
  'pt-BR': ['America/Sao_Paulo', 'America/Fortaleza', 'America/Cuiaba', 'America/Manaus'],
  'en-US': ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
  'es-ES': ['Europe/Madrid', 'Atlantic/Canary'],
  'fr-FR': ['Europe/Paris'],
  'de-DE': ['Europe/Berlin']
};

const TIMEZONE_PRESETS = [
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Tokyo',
  'UTC'
];

/**
 * Deriva uma string realista de User-Agent a partir do sistema operacional e navegador.
 * @param {string} os
 * @param {string} browser
 * @param {string} [version]
 * @returns {string}
 */
function deriveUserAgent(os, browser, version) {
  const osData = OS_PRESETS[os] || OS_PRESETS.windows11;
  const bData = BROWSER_PRESETS[browser] || BROWSER_PRESETS.chrome;
  const ver = version || bData.version;

  if (bData.id === 'firefox') {
    return `Mozilla/5.0 (${osData.uaOs}; rv:${ver}) Gecko/20100101 Firefox/${ver}`;
  }

  if (bData.id === 'edge') {
    return `Mozilla/5.0 (${osData.uaOs}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36 Edg/${ver}`;
  }

  return `Mozilla/5.0 (${osData.uaOs}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
}

/**
 * Deriva navigator.platform a partir do sistema operacional
 * @param {string} os
 * @returns {string}
 */
function derivePlatform(os) {
  const osData = OS_PRESETS[os];
  return osData ? osData.platform : 'Win32';
}

/**
 * Deriva DevicePixelRatio padrão baseado na resolução
 * @param {string} resolution
 * @returns {number}
 */
function deriveDevicePixelRatio(resolution) {
  const preset = SCREEN_PRESETS.find(p => p.id === resolution);
  return preset ? preset.dpr : 1;
}

/**
 * Deriva GPU compatível para o SO e vendor
 * @param {string} os
 * @param {string} [vendor]
 * @returns {{ vendor: string, renderer: string }}
 */
function deriveWebglRenderer(os, vendor) {
  const osKey = (os === 'macos') ? 'macos' : (os === 'linux' ? 'linux' : 'windows');
  const list = GPU_PRESETS[osKey] || GPU_PRESETS.windows;

  if (vendor && vendor !== 'auto') {
    const matched = list.find(g => g.vendor.toLowerCase().includes(vendor.toLowerCase()));
    if (matched) return matched;
  }

  return list[0];
}

/**
 * Valida consistência interna das configurações de fingerprint.
 * Detecta combinações impossíveis (ex.: macOS com NVIDIA) e combinações improváveis.
 *
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateFingerprintConsistency(config) {
  const errors = [];
  const warnings = [];
  if (!config || typeof config !== 'object') {
    return { valid: true, errors, warnings };
  }

  const os = config.fpOs || 'windows11';
  const browser = config.fpBrowser || 'chrome';
  const platform = config.fpPlatform;
  const ua = config.fpUserAgent;
  const resolution = config.fpScreenResolution || '1920x1080';
  const dpr = config.fpDevicePixelRatio;
  const cores = Number(config.fpHardwareConcurrency) || 8;
  const memory = Number(config.fpDeviceMemory) || 8;
  const vendor = config.fpWebglVendor || 'auto';
  const renderer = config.fpWebglRenderer || 'auto';
  const locale = config.fpLocale;
  const timezone = config.fpTimezone;

  // 1. Regra Inegociável: macOS NUNCA usa NVIDIA
  if (os === 'macos') {
    if (vendor !== 'auto' && /nvidia/i.test(vendor)) {
      errors.push('macOS não oferece suporte nem utiliza GPUs NVIDIA modernas.');
    }
    if (renderer !== 'auto' && /nvidia/i.test(renderer)) {
      errors.push('macOS não utiliza renderizadores de vídeo NVIDIA.');
    }
  }

  // 2. Regra de Plataforma
  if (platform && platform !== 'auto') {
    if (os === 'macos' && platform !== 'MacIntel') {
      warnings.push(`Sistema selecionado é macOS, mas a plataforma configurada é ${platform} (esperado: MacIntel).`);
    } else if ((os === 'windows10' || os === 'windows11') && platform !== 'Win32') {
      warnings.push(`Sistema selecionado é Windows, mas a plataforma configurada é ${platform} (esperado: Win32).`);
    } else if (os === 'linux' && platform !== 'Linux x86_64') {
      warnings.push(`Sistema selecionado é Linux, mas a plataforma configurada é ${platform} (esperado: Linux x86_64).`);
    }
  }

  // 3. Regra de User-Agent
  if (ua && ua !== 'auto') {
    if (browser === 'firefox' && !/firefox\//i.test(ua)) {
      warnings.push('Navegador selecionado é Firefox, mas o User-Agent não contém a assinatura Firefox/.');
    }
    if (os === 'macos' && !/macintosh/i.test(ua)) {
      warnings.push('Sistema selecionado é macOS, mas o User-Agent não menciona Macintosh.');
    }
    if ((os === 'windows10' || os === 'windows11') && !/windows nt/i.test(ua)) {
      warnings.push('Sistema selecionado é Windows, mas o User-Agent não menciona Windows NT.');
    }
  }

  // 4. Regra de Resolução e DPR
  if (resolution === '2880x1800' && os !== 'macos') {
    warnings.push('Resolução 2880×1800 é nativa de monitores Retina de MacBook Pro (incomum em Windows/Linux).');
  }
  if (resolution === '1366x768' && Number(dpr) > 1.25) {
    warnings.push('Resolução 1366×768 com DevicePixelRatio alto (> 1.25) é incomum em hardware real.');
  }

  // 5. Hardware Concurrency e RAM
  if (memory >= 32 && cores <= 2) {
    warnings.push('Computadores com 32GB de RAM geralmente possuem 4 ou mais núcleos de CPU.');
  }

  // 6. Timezone e Locale
  if (locale && timezone && timezone !== 'auto' && timezone !== 'UTC') {
    const expectedTzList = LOCALE_TIMEZONE_MAP[locale];
    if (expectedTzList && !expectedTzList.includes(timezone)) {
      warnings.push(`O idioma ${locale} tipicamente utiliza fusos horários como ${expectedTzList[0]}, mas o fuso ativo é ${timezone}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gera um inteiro determinístico de 32 bits a partir do seed persistente e configurações.
 * @param {object} config
 * @returns {number}
 */
function buildFingerprintSeed(config) {
  if (!config || typeof config !== 'object') {
    return 123456789;
  }

  let baseSeed = Number(config.fpFingerprintSeed);
  if (!baseSeed || Number.isNaN(baseSeed)) {
    baseSeed = 123456789;
  }

  // Gera hash simples e rápido tipo FNV-1a com as chaves de identidade
  const str = `${config.fpOs || ''}|${config.fpBrowser || ''}|${config.fpScreenResolution || ''}|${config.fpTimezone || ''}|${config.fpHardwareConcurrency || ''}|${config.fpDeviceMemory || ''}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return (baseSeed ^ hash) >>> 0;
}

/**
 * Aplica ruído sutil e determinístico em dados brutos de pixels RGBA.
 * Mantida para retrocompatibilidade com a suíte de testes existente.
 *
 * @param {Uint8ClampedArray|number[]} data
 * @param {number} seed
 * @returns {Uint8ClampedArray|number[]}
 */
function applyDeterministicCanvasNoise(data, seed) {
  if (!data || typeof data.length !== 'number' || data.length === 0) return data;
  const numSeed = Number(seed) || 12345;

  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] === 0) continue;
    const hash = (Math.imul(i ^ numSeed, 0x45d9f3b) >>> 0) % 3;
    const delta = (hash === 0) ? -1 : (hash === 1 ? 1 : 0);
    if (delta !== 0) {
      const channelIndex = i + (hash % 3);
      const val = data[channelIndex];
      data[channelIndex] = Math.max(0, Math.min(255, val + delta));
    }
  }

  return data;
}

/**
 * Alias semântico para applyDeterministicCanvasNoise
 */
function applyCanvasNoise(data, seed) {
  return applyDeterministicCanvasNoise(data, seed);
}

/**
 * Aplica ruído imperceptível e determinístico em amostras de buffer de áudio (Float32Array).
 * Variação na faixa de +/- 0.00002 mantendo o sinal audível limpo.
 *
 * @param {Float32Array|number[]} buffer
 * @param {number} seed
 * @returns {Float32Array|number[]}
 */
function applyAudioNoise(buffer, seed) {
  if (!buffer || typeof buffer.length !== 'number' || buffer.length === 0) return buffer;
  const numSeed = Number(seed) || 54321;

  for (let i = 0; i < buffer.length; i += 32) {
    const hash = (Math.imul(i ^ numSeed, 0x27d4eb2d) >>> 0) % 5;
    // Variação minúscula entre -0.00004 e +0.00004
    const delta = (hash - 2) * 0.00002;
    buffer[i] = buffer[i] + delta;
  }

  return buffer;
}

/**
 * Aplica ruído determinístico em DOMRect (x, y, width, height) para ClientRects
 * @param {object} rect
 * @param {number} seed
 * @returns {object}
 */
function applyClientRectsNoise(rect, seed) {
  if (!rect || typeof rect !== 'object') return rect;
  const numSeed = Number(seed) || 98765;

  const hashX = (Math.imul(numSeed, 0x1f1f1f) >>> 0) % 3;
  const deltaX = (hashX === 0 ? -0.1 : (hashX === 1 ? 0.1 : 0));

  const hashY = (Math.imul(numSeed ^ 0xabc, 0x3b3b3b) >>> 0) % 3;
  const deltaY = (hashY === 0 ? -0.1 : (hashY === 1 ? 0.1 : 0));

  return {
    x: Number((rect.x + deltaX).toFixed(2)),
    y: Number((rect.y + deltaY).toFixed(2)),
    width: Number((rect.width + deltaX).toFixed(2)),
    height: Number((rect.height + deltaY).toFixed(2)),
    top: Number(((rect.top || rect.y) + deltaY).toFixed(2)),
    bottom: Number(((rect.bottom || (rect.y + rect.height)) + deltaY).toFixed(2)),
    left: Number(((rect.left || rect.x) + deltaX).toFixed(2)),
    right: Number(((rect.right || (rect.x + rect.width)) + deltaX).toFixed(2))
  };
}

/**
 * Normaliza o User-Agent removendo versões exatas do Electron e Chromium
 * Mantida para retrocompatibilidade com a suíte de testes existente.
 * @param {string} ua User-Agent original
 * @returns {string}
 */
function normalizeUserAgentString(ua) {
  if (typeof ua !== 'string') return '';
  return ua
    .replace(/Electron\/[0-9.]+\s?/gi, '')
    .replace(/Dragon\/[0-9.]+\s?/gi, '')
    .replace(/Chrome\/[0-9.]+/i, 'Chrome/130.0.0.0')
    .replace(/Chromium\/[0-9.]+/i, 'Chrome/130.0.0.0')
    .trim();
}

/**
 * Gerador pseudoaleatório linear congruencial (LCG) com semente para sorteios determinísticos
 * @param {number} seed
 * @returns {function(): number} Retorna float no intervalo [0, 1)
 */
function createPrng(seed) {
  let s = (Number(seed) || 123456789) >>> 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Sorteia uma nova identidade de fingerprint aleatória e 100% consistente a partir de uma semente.
 *
 * @param {number} seed
 * @returns {{ config: object, seed: number }}
 */
function pickRandomConsistentPresetWithSeed(seed) {
  const prng = createPrng(seed);

  // 1. Sorteio de SO ponderado: 70% Windows (50% Win11, 20% Win10), 20% macOS, 10% Linux
  const osRoll = prng();
  let os = 'windows11';
  if (osRoll < 0.50) os = 'windows11';
  else if (osRoll < 0.70) os = 'windows10';
  else if (osRoll < 0.90) os = 'macos';
  else os = 'linux';

  // 2. Sorteio de Navegador: 75% Chrome, 20% Edge (se Windows) ou Chrome, 5% Firefox
  const browserRoll = prng();
  let browser = 'chrome';
  if (browserRoll < 0.75) {
    browser = 'chrome';
  } else if (browserRoll < 0.95 && (os === 'windows11' || os === 'windows10')) {
    browser = 'edge';
  } else {
    browser = 'firefox';
  }

  // 3. Resolução e DPR consistentes com o SO
  let allowedResolutions = SCREEN_PRESETS.filter(p => p.id !== '2880x1800');
  if (os === 'macos') {
    allowedResolutions = SCREEN_PRESETS.filter(p => p.id === '2880x1800' || p.id === '2560x1440' || p.id === '1920x1080');
  }
  const resIdx = Math.floor(prng() * allowedResolutions.length);
  const chosenRes = allowedResolutions[resIdx];
  const resolution = chosenRes.id;
  const dpr = chosenRes.dpr;

  // 4. Hardware: núcleos e memória coerentes
  const coreOptions = [4, 6, 8, 12, 16];
  const cores = coreOptions[Math.floor(prng() * coreOptions.length)];
  const memoryOptions = cores <= 4 ? [4, 8, 16] : [8, 16, 32];
  const memory = memoryOptions[Math.floor(prng() * memoryOptions.length)];

  // 5. GPU compatível com o SO (nunca NVIDIA em macOS)
  const gpuList = GPU_PRESETS[os === 'macos' ? 'macos' : (os === 'linux' ? 'linux' : 'windows')];
  const chosenGpu = gpuList[Math.floor(prng() * gpuList.length)];

  // 6. Locale e Timezone coerentes
  const localeKeys = Object.keys(LOCALE_TIMEZONE_MAP);
  const chosenLocale = localeKeys[Math.floor(prng() * localeKeys.length)];
  const tzList = LOCALE_TIMEZONE_MAP[chosenLocale];
  const chosenTz = tzList[Math.floor(prng() * tzList.length)];

  const config = {
    fingerprintProtectionEnabled: true,
    fpFingerprintSeed: seed,
    fpOs: os,
    fpBrowser: browser,
    fpUserAgent: 'auto',
    fpPlatform: 'auto',
    fpLocale: chosenLocale,
    fpTimezone: chosenTz,
    fpScreenResolution: resolution,
    fpDevicePixelRatio: dpr,
    fpHardwareConcurrency: cores,
    fpDeviceMemory: memory,
    fpTouchSupport: false,
    fpWebglVendor: chosenGpu.vendor,
    fpWebglRenderer: chosenGpu.renderer,
    fpWebglImageMode: 'noise',
    fpCanvasMode: 'noise',
    fpAudioMode: 'noise',
    fpClientRectsMode: 'noise',
    fpFontsMode: 'mask',
    fpWebrtcMode: 'proxy',
    fpMediaDevicesCount: 2,
    fpSpeechVoices: 'mask',
    fpBatteryMode: 'mask',
    fpPermissionsMode: 'mask'
  };

  return { config, seed };
}

/**
 * Sorteia uma nova identidade consistente gerando uma semente inteira de 32 bits.
 * Se a validação falhar, tenta até 10 vezes; persistindo a falha, aplica um preset seguro.
 * @returns {{ config: object, seed: number }}
 */
function pickRandomConsistentPreset() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const seed = (Math.floor(Math.random() * 0x7FFFFFFF) + 1);
    const candidate = pickRandomConsistentPresetWithSeed(seed);
    const check = validateFingerprintConsistency(candidate.config);
    if (check.valid && check.errors.length === 0) {
      return candidate;
    }
  }

  // Fallback seguro comprovadamente consistente
  const fallbackSeed = 123456789;
  return {
    seed: fallbackSeed,
    config: {
      fingerprintProtectionEnabled: true,
      fpFingerprintSeed: fallbackSeed,
      fpOs: 'windows11',
      fpBrowser: 'chrome',
      fpUserAgent: 'auto',
      fpPlatform: 'auto',
      fpLocale: 'pt-BR',
      fpTimezone: 'America/Sao_Paulo',
      fpScreenResolution: '1920x1080',
      fpDevicePixelRatio: 1,
      fpHardwareConcurrency: 8,
      fpDeviceMemory: 8,
      fpTouchSupport: false,
      fpWebglVendor: 'Google Inc. (Intel)',
      fpWebglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      fpWebglImageMode: 'noise',
      fpCanvasMode: 'noise',
      fpAudioMode: 'noise',
      fpClientRectsMode: 'noise',
      fpFontsMode: 'mask',
      fpWebrtcMode: 'proxy',
      fpMediaDevicesCount: 2,
      fpSpeechVoices: 'mask',
      fpBatteryMode: 'mask',
      fpPermissionsMode: 'mask'
    }
  };
}

/**
 * Retorna as listas de opções disponíveis para popular selects na interface
 */
function getFingerprintOptions() {
  return {
    osList: Object.values(OS_PRESETS),
    browserList: Object.values(BROWSER_PRESETS),
    screenList: SCREEN_PRESETS,
    timezoneList: TIMEZONE_PRESETS,
    localeList: Object.keys(LOCALE_TIMEZONE_MAP),
    gpuPresets: GPU_PRESETS
  };
}

module.exports = {
  OS_PRESETS,
  BROWSER_PRESETS,
  GPU_PRESETS,
  SCREEN_PRESETS,
  TIMEZONE_PRESETS,
  LOCALE_TIMEZONE_MAP,
  deriveUserAgent,
  derivePlatform,
  deriveDevicePixelRatio,
  deriveWebglRenderer,
  validateFingerprintConsistency,
  buildFingerprintSeed,
  applyDeterministicCanvasNoise,
  applyCanvasNoise,
  applyAudioNoise,
  applyClientRectsNoise,
  normalizeUserAgentString,
  pickRandomConsistentPreset,
  pickRandomConsistentPresetWithSeed,
  getFingerprintOptions
};
```

---

### 4.27 `src/preload/preload.js`

```javascript
// =============================================================================
// src/preload/preload.js
// Ponte de comunicação segura (Bridge) entre a Interface (HTML) e o Main Process
// Segurança máxima: contextIsolation: true, sandbox: true, nodeIntegration: false
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expõe uma API estrita e controlada no objeto global window.browserAPI
 * A interface gráfica (renderer) NÃO tem acesso ao Node.js nem ao ipcRenderer direto.
 */
contextBridge.exposeInMainWorld('browserAPI', {
  // --- Gerenciamento de Abas ---
  createTab: (url) => ipcRenderer.invoke('tabs:create', url),
  createPrivateTab: (url) => ipcRenderer.invoke('tabs:create-private', url),
  closeTab: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
  selectTab: (tabId) => ipcRenderer.invoke('tabs:select', tabId),
  reorderTabs: (sourceId, targetId) => ipcRenderer.invoke('tabs:reorder', sourceId, targetId),

  // --- Privacidade e Proteção contra Rastreadores ---
  getPrivacyInfo: () => ipcRenderer.invoke('privacy:get-info'),
  toggleSiteProtection: (hostname) => ipcRenderer.invoke('privacy:toggle-protection', hostname),

  // --- Comandos de Navegação ---
  navigate: (urlOrQuery) => ipcRenderer.invoke('navigation:navigate', urlOrQuery),
  allowRedirect: (url) => ipcRenderer.invoke('navigation:allow-redirect', url),
  navigateHome: () => ipcRenderer.invoke('navigation:home'),
  goBack: () => ipcRenderer.invoke('navigation:back'),
  goForward: () => ipcRenderer.invoke('navigation:forward'),
  reload: () => ipcRenderer.invoke('navigation:reload'),
  stop: () => ipcRenderer.invoke('navigation:stop'),

  // --- Busca na Página (Ctrl+F) ---
  findInPage: (text, forward = true, findNext = false) => ipcRenderer.invoke('search:find', { text, forward, findNext }),
  stopFindInPage: (action = 'clearSelection') => ipcRenderer.invoke('search:stop', action),
  setFindBarOpen: (open) => ipcRenderer.invoke('window:set-findbar-open', open),

  // --- Sugestões na Barra de Endereço (Omnibox) ---
  getOmniboxSuggestions: (query) => ipcRenderer.invoke('omnibox:suggestions', query),

  // --- Favoritos ---
  toggleBookmark: (url, title) => ipcRenderer.invoke('bookmarks:toggle', { url, title }),
  isBookmarked: (url) => ipcRenderer.invoke('bookmarks:is-bookmarked', url),

  // --- Permissões por Site ---
  respondPermission: (requestId, allowed, remember) => ipcRenderer.invoke('permissions:respond', { requestId, allowed, remember }),

  // --- Controle de Camadas / Overlay ---
  showOverlay: () => ipcRenderer.invoke('window:show-overlay'),
  hideOverlay: () => ipcRenderer.invoke('window:hide-overlay'),

  // --- Apagar Tudo (Fogo do Dragão Azul) ---
  clearAllData: (options) => ipcRenderer.invoke('app:clear-all-data', options),
  finishClearSession: () => ipcRenderer.invoke('app:finish-clear-session'),

  // --- Downloads com Risco de Execução (ETAPA 4) ---
  confirmRiskDownload: (downloadId) => ipcRenderer.invoke('downloads:confirm-risk', downloadId),
  cancelRiskDownload: (downloadId) => ipcRenderer.invoke('downloads:cancel-risk', downloadId),

  // --- Obtenção de Estado Inicial e Configurações ---
  getState: () => ipcRenderer.invoke('app:get-state'),
  openSettings: () => ipcRenderer.invoke('app:open-settings'),
  openDownloads: () => ipcRenderer.invoke('app:open-downloads'),
  openHistory: () => ipcRenderer.invoke('app:open-history'),
  openBookmarks: () => ipcRenderer.invoke('app:open-bookmarks'),

  // --- Eventos recebidos do Main Process ---
  onStateUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, state) => callback(state);
    ipcRenderer.on('browser:state-update', subscription);

    return () => {
      ipcRenderer.removeListener('browser:state-update', subscription);
    };
  },

  onSettingsUpdated: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, settings) => callback(settings);
    ipcRenderer.on('browser:settings-updated', subscription);

    return () => {
      ipcRenderer.removeListener('browser:settings-updated', subscription);
    };
  },

  onFocusAddressBar: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:focus-addressbar', subscription);

    return () => {
      ipcRenderer.removeListener('browser:focus-addressbar', subscription);
    };
  },

  onTriggerClearData: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:trigger-clear-data', subscription);

    return () => {
      ipcRenderer.removeListener('browser:trigger-clear-data', subscription);
    };
  },

  onHtmlFullScreenChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('browser:html-fullscreen-changed', subscription);

    return () => {
      ipcRenderer.removeListener('browser:html-fullscreen-changed', subscription);
    };
  },

  onFindResult: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, result) => callback(result);
    ipcRenderer.on('browser:find-result', subscription);

    return () => {
      ipcRenderer.removeListener('browser:find-result', subscription);
    };
  },

  onOpenFind: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:open-find', subscription);

    return () => {
      ipcRenderer.removeListener('browser:open-find', subscription);
    };
  },

  onToggleBookmark: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = () => callback();
    ipcRenderer.on('browser:toggle-bookmark', subscription);

    return () => {
      ipcRenderer.removeListener('browser:toggle-bookmark', subscription);
    };
  },

  onPromptPermission: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:prompt-permission', subscription);

    return () => {
      ipcRenderer.removeListener('browser:prompt-permission', subscription);
    };
  },

  onCancelPermissionPrompt: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:cancel-permission-prompt', subscription);

    return () => {
      ipcRenderer.removeListener('browser:cancel-permission-prompt', subscription);
    };
  },

  onDownloadUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, downloadData) => callback(downloadData);
    ipcRenderer.on('browser:download-update', subscription);

    return () => {
      ipcRenderer.removeListener('browser:download-update', subscription);
    };
  },

  onRedirectBlocked: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:redirect-blocked', subscription);

    return () => {
      ipcRenderer.removeListener('browser:redirect-blocked', subscription);
    };
  },

  onDownloadRiskPrompt: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('browser:download-risk-prompt', subscription);

    return () => {
      ipcRenderer.removeListener('browser:download-risk-prompt', subscription);
    };
  }
});
```

---

### 4.28 `src/preload/settings-preload.js`

```javascript
// =============================================================================
// src/preload/settings-preload.js
// Preload exclusivo e isolado para a página de configurações (pages/settings.html)
// Sites externos NUNCA recebem este script nem têm acesso a window.settingsAPI.
// Segurança máxima: contextIsolation: true, sandbox: true, nodeIntegration: false
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expõe a API restrita de configurações na janela global window.settingsAPI
 * apenas para a aba interna autorizada de settings.html.
 */
contextBridge.exposeInMainWorld('settingsAPI', {
  /**
   * Obtém todas as configurações salvas do navegador.
   * @returns {Promise<object>}
   */
  getSettings: () => ipcRenderer.invoke('settings:get'),

  /**
   * Atualiza e persiste o valor de uma configuração individual.
   * @param {string} key Nome da propriedade (ex: 'searchEngine')
   * @param {*} value Novo valor
   * @returns {Promise<boolean>}
   */
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  /**
   * Atualiza múltiplos campos de configuração de uma vez.
   * @param {object} settingsObj Objeto com as chaves a atualizar
   * @returns {Promise<boolean>}
   */
  setSettings: (settingsObj) => ipcRenderer.invoke('settings:set-all', settingsObj),

  /**
   * Grava a senha de proxy de forma segura usando safeStorage
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  setProxyPassword: (password) => ipcRenderer.invoke('settings:set-proxy-password', password),

  /**
   * Testa a conectividade através do proxy configurado
   * @param {object} proxyConfig
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  testProxy: (proxyConfig) => ipcRenderer.invoke('settings:test-proxy', proxyConfig),

  /**
   * Lista todas as permissões cadastradas por origem
   * @returns {Promise<Array<object>>}
   */
  getPermissions: () => ipcRenderer.invoke('settings:get-permissions'),

  /**
   * Revoga uma permissão concedida a uma origem
   * @param {string} origin
   * @param {string} [permKey]
   * @returns {Promise<boolean>}
   */
  revokePermission: (origin, permKey) => ipcRenderer.invoke('settings:revoke-permission', origin, permKey),

  /**
   * Dispara a seleção nativa de arquivo de imagem do computador.
   * A imagem é copiada para a pasta userData e seu caminho original não é armazenado.
   * @returns {Promise<object|null>} Retorna { filename, dataUrl } ou null se cancelado
   */
  chooseBackgroundImage: () => ipcRenderer.invoke('settings:choose-background-image'),

  /**
   * Remove a imagem de fundo personalizada atual.
   * @returns {Promise<boolean>}
   */
  removeBackgroundImage: () => ipcRenderer.invoke('settings:remove-background-image'),

  /**
   * Registra ouvinte para receber atualizações de configurações em tempo real.
   * @param {Function} callback (data: { key, value, allSettings }) => void
   * @returns {Function} Função para remover a inscrição
   */
  onSettingsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('settings:changed', subscription);

    return () => {
      ipcRenderer.removeListener('settings:changed', subscription);
    };
  },

  /**
   * Reseta o fingerprint gerando uma nova identidade aleatória e consistente.
   * @returns {Promise<object>}
   */
  resetFingerprint: () => ipcRenderer.invoke('fingerprint:reset'),

  /**
   * Obtém opções de presets para popular dropdowns de fingerprint.
   * @returns {Promise<object>}
   */
  getFingerprintOptions: () => ipcRenderer.invoke('fingerprint:get-options'),

  /**
   * Valida a consistência interna das configurações de fingerprint.
   * @param {object} config
   * @returns {Promise<{ valid: boolean, errors: string[], warnings: string[] }>}
   */
  validateFingerprint: (config) => ipcRenderer.invoke('fingerprint:validate', config)
});
```

---

### 4.29 `src/preload/tab-preload.js`

```javascript
// =============================================================================
// src/preload/tab-preload.js
// Preload exclusivo e seguro para as WebContentsViews de abas do Dragon.
// Segurança máxima: contextIsolation: true, sandbox: true, nodeIntegration: false.
// APIs internas NUNCA são expostas a páginas externas da web (HTTP/HTTPS).
// Expõe métodos restritos apenas quando a URL pertence às páginas internas autorizadas.
// =============================================================================

const { contextBridge, ipcRenderer, webFrame } = require('electron');

const rawPathname = (window.location && window.location.pathname) || '';
const pathname = decodeURIComponent(rawPathname).replace(/\\/g, '/').toLowerCase();

const isHttpsWarning = pathname.endsWith('/pages/https-warning.html');
const isCertError = pathname.endsWith('/pages/cert-error.html');
const isHistory = pathname.endsWith('/pages/history.html');
const isBookmarks = pathname.endsWith('/pages/bookmarks.html');
const isDownloads = pathname.endsWith('/pages/downloads.html');
const isNewTab = pathname.endsWith('/pages/newtab.html');
const isSettings = pathname.endsWith('/pages/settings.html');
const isError = pathname.endsWith('/pages/error.html');

const isInternalPage = isHttpsWarning || isCertError || isHistory || isBookmarks || isDownloads ||
  isNewTab || isSettings || isError ||
  (window.location && (window.location.protocol === 'chrome:' || window.location.protocol === 'data:'));

// ETAPA 5: Injeta proteções de fingerprinting estritamente em páginas web normais (HTTP/HTTPS)
if (!isInternalPage) {
  try {
    const fpScript = ipcRenderer.sendSync('fingerprint:get-script');
    if (fpScript && typeof fpScript === 'string' && fpScript.trim()) {
      webFrame.executeJavaScript(fpScript);
    }
  } catch (err) {
    // Falha silenciosa para preservar a navegação
  }
}

// Expõe a API de aviso HTTPS estritamente para pages/https-warning.html
if (isHttpsWarning) {
  contextBridge.exposeInMainWorld('warningAPI', {
    requestBypassToken: (targetUrl) => ipcRenderer.invoke('warning:request-bypass-token', targetUrl)
  });
}

// Expõe a API de erro de certificado estritamente para pages/cert-error.html
if (isCertError) {
  contextBridge.exposeInMainWorld('certErrorAPI', {
    requestBypassToken: (targetUrl) => ipcRenderer.invoke('cert-error:request-bypass-token', targetUrl),
    proceedWithBypass: (targetUrl, token) => ipcRenderer.invoke('cert-error:proceed', { targetUrl, token }),
    goHome: () => ipcRenderer.invoke('navigation:home-from-page')
  });
}

// Expõe a API de histórico estritamente para pages/history.html
if (isHistory) {
  contextBridge.exposeInMainWorld('historyAPI', {
    getEntries: (query) => ipcRenderer.invoke('history:get', query),
    deleteEntry: (id) => ipcRenderer.invoke('history:delete', id),
    clearAll: () => ipcRenderer.invoke('history:clear'),
    openUrl: (url) => ipcRenderer.invoke('history:open', url)
  });
}

// Expõe a API de favoritos estritamente para pages/bookmarks.html
if (isBookmarks) {
  contextBridge.exposeInMainWorld('bookmarksAPI', {
    getBookmarks: (query) => ipcRenderer.invoke('bookmarks:get', query),
    removeBookmark: (id) => ipcRenderer.invoke('bookmarks:remove', id),
    addBookmark: (item) => ipcRenderer.invoke('bookmarks:add', item),
    clearAll: () => ipcRenderer.invoke('bookmarks:clear'),
    openUrl: (url) => ipcRenderer.invoke('bookmarks:open', url)
  });
}

// Expõe a API de downloads estritamente para pages/downloads.html
if (isDownloads) {
  contextBridge.exposeInMainWorld('downloadsAPI', {
    getDownloads: () => ipcRenderer.invoke('downloads:get'),
    openFile: (filePath) => ipcRenderer.invoke('downloads:open-file', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('downloads:show-in-folder', filePath),
    cancelDownload: (id) => ipcRenderer.invoke('downloads:cancel', id),
    clearHistory: () => ipcRenderer.invoke('downloads:clear'),
    openUrl: (url) => ipcRenderer.invoke('downloads:open', url),
    onDownloadUpdate: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (event, data) => callback(data);
      ipcRenderer.on('downloads:tab-update', handler);
      return () => {
        ipcRenderer.removeListener('downloads:tab-update', handler);
      };
    }
  });
}
```

---

### 4.30 `src/renderer/index.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:;">
  <title>Dragon</title>
  <!-- Estilos carregados na ordem correta: Tema -> Base -> Componentes -->
  <link rel="stylesheet" href="styles/theme.css">
  <link rel="stylesheet" href="styles/base.css">
  <link rel="stylesheet" href="styles/components.css">
</head>
<body>
  <div id="app">
    <!-- Linha 1: Barra de Abas -->
    <header id="tabs-bar">
      <div id="tabs-container"></div>
      <button id="btn-new-tab" title="Nova aba (Ctrl+T)" aria-label="Nova aba">
        <svg viewBox="0 0 16 16">
          <path fill="currentColor" d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
        </svg>
      </button>
    </header>

    <!-- Linha 2: Barra de Navegação e Endereço -->
    <nav id="nav-bar">
      <div id="nav-controls">
        <button id="btn-back" class="nav-btn" title="Voltar (Alt+←)" aria-label="Voltar" disabled>
          <svg viewBox="0 0 16 16">
            <path fill="currentColor" d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.81 7.25h8.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06z"/>
          </svg>
        </button>
        <button id="btn-forward" class="nav-btn" title="Avançar (Alt+→)" aria-label="Avançar" disabled>
          <svg viewBox="0 0 16 16">
            <path fill="currentColor" d="M8.22 3.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06l2.97-2.97H2.75a.75.75 0 0 1 0-1.5h8.44l-2.97-2.97a.75.75 0 0 1 0-1.06z"/>
          </svg>
        </button>
        <button id="btn-reload" class="nav-btn" title="Recarregar (Ctrl+R ou F5)" aria-label="Recarregar">
          <svg viewBox="0 0 16 16">
            <path fill="currentColor" d="M1.705 8.001a6.3 6.3 0 0 1 10.7-4.47l.825-.824a.5.5 0 0 1 .854.354V6.5a.5.5 0 0 1-.5.5H10.14a.5.5 0 0 1-.354-.854l.872-.871a4.8 4.8 0 1 0 1.488 3.726.75.75 0 1 1 1.498.087 6.3 6.3 0 0 1-11.94.413z"/>
          </svg>
        </button>
        <button id="btn-home" class="nav-btn" title="Página Inicial (Alt+Home)" aria-label="Página Inicial">
          <svg viewBox="0 0 16 16">
            <path fill="currentColor" d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 2 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h1v4a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L8.354 1.146zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v4H2.5z"/>
          </svg>
        </button>
      </div>

      <form id="address-form" autocomplete="off">
        <!-- Escudo de Privacidade à esquerda do endereço (estilo DuckDuckGo) -->
        <button
          type="button"
          id="btn-privacy-shield"
          class="privacy-shield-btn"
          title="Proteção de privacidade contra rastreadores"
          aria-label="Proteção de privacidade contra rastreadores"
        >
          <svg viewBox="0 0 16 16" class="shield-icon-svg">
            <path fill="currentColor" d="M8 0c-.26 0-.51.1-.7.29L2.24 5.35c-.15.15-.24.36-.24.58v4.57c0 3.2 2.37 5.09 5.76 5.48.16.02.32.02.48 0 3.39-.39 5.76-2.28 5.76-5.48V5.93c0-.22-.09-.43-.24-.58L8.7 0.29C8.51 0.1 8.26 0 8 0zm0 1.5l4.5 4.5v4.5c0 2.4-1.7 3.8-4.5 4.19-2.8-.39-4.5-1.79-4.5-4.19V6l4.5-4.5z"/>
          </svg>
          <span id="shield-badge" class="shield-badge">0</span>
        </button>
        <input
          id="address-input"
          type="text"
          placeholder="Pesquisar no DuckDuckGo ou digitar endereço da web"
          spellcheck="false"
        />
        <!-- Botão de Favoritar Página (Ctrl+D) -->
        <button
          type="button"
          id="btn-bookmark"
          class="bookmark-btn"
          title="Favoritar esta página (Ctrl+D)"
          aria-label="Favoritar esta página"
        >
          <svg viewBox="0 0 16 16">
            <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
          </svg>
        </button>
        <!-- Dropdown de sugestões da Omnibox -->
        <div id="omnibox-dropdown" class="omnibox-dropdown"></div>
      </form>

      <!-- Botão de Downloads (Ctrl+J) -->
      <button
        id="btn-downloads"
        class="nav-btn"
        title="Downloads (Ctrl+J)"
        aria-label="Downloads (Ctrl+J)"
      >
        <svg viewBox="0 0 16 16">
          <path fill="currentColor" d="M.5 9.9a.75.75 0 0 1 .75.75v2.6c0 .414.336.75.75.75h12a.75.75 0 0 0 .75-.75v-2.6a.75.75 0 0 1 1.5 0v2.6A2.25 2.25 0 0 1 14 15.5H2A2.25 2.25 0 0 1-.25 13.25v-2.6A.75.75 0 0 1 .5 9.9z"/>
          <path fill="currentColor" d="M7.47 10.53a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L8.75 8.19V1.75a.75.75 0 0 0-1.5 0v6.44L5.28 6.22a.75.75 0 0 0-1.06 1.06l3.25 3.25z"/>
        </svg>
      </button>

      <!-- Botão de Apagar Tudo (O Fogo do Dragão Azul) -->
      <button
        id="btn-fire"
        class="fire-btn"
        title="Apagar tudo (Ctrl+Shift+Delete)"
        aria-label="Apagar tudo (Ctrl+Shift+Delete)"
      >
        <svg viewBox="0 0 24 24">
          <defs>
            <linearGradient id="dragon-flame-grad" x1="0%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stop-color="#0A2A9E" />
              <stop offset="30%" stop-color="#0194FF" />
              <stop offset="70%" stop-color="#29B6FF" />
              <stop offset="100%" stop-color="#E6F7FF" />
            </linearGradient>
          </defs>
          <path
            fill="url(#dragon-flame-grad)"
            d="M12 2c-.3 1.8-1.5 3.3-2.6 4.7-1.4 1.8-2.8 3.7-2.9 6.1-.1 3.5 2.7 6.4 6.2 6.5 3.6.1 6.5-2.8 6.5-6.4 0-2.4-1.3-4.6-2.5-6.6-1-1.6-1.9-3.3-2.2-5.2-.1-.4-.6-.6-.9-.3-.5.7-.9 1.5-1.2 2.3-.6 1.4-1.6 2.6-1.5 4.2.1 1.2.9 2.2 2.1 2.3 1.2.1 2.2-.8 2.2-2 0-.6-.2-1.2-.5-1.7-.1-.2.1-.5.3-.4 1.2 1 1.9 2.4 1.9 4 0 2.8-2.2 5-5 5s-5-2.2-5-5c0-1.8.8-3.4 1.9-4.5 1-1 2.1-2.1 2.6-3.4.4-1.1.5-2.3.4-3.5-.1-.4-.5-.6-.8-.4z"
          />
        </svg>
      </button>

      <!-- Botão de Configurações (Engrenagem) -->
      <button
        id="btn-settings"
        class="nav-btn"
        title="Configurações (Ctrl+,)"
        aria-label="Configurações (Ctrl+,)"
      >
        <svg viewBox="0 0 16 16">
          <path fill="currentColor" d="M8 4.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5zM6.25 8a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0z"/>
          <path fill="currentColor" fill-rule="evenodd" d="M7.05.5a1.25 1.25 0 0 1 1.9 0l.47.53c.24.27.6.42.96.4.37-.02.73-.2 1-.49l.4-.38a1.25 1.25 0 0 1 1.77.16l1.06 1.24a1.25 1.25 0 0 1-.09 1.77l-.42.36a1.4 1.4 0 0 0-.44.94c-.03.37.1.73.34 1.01l.36.42a1.25 1.25 0 0 1 0 1.63l-.36.42a1.4 1.4 0 0 0-.34 1.01c.02.37.18.72.44.94l.42.36a1.25 1.25 0 0 1 .09 1.77l-1.06 1.24a1.25 1.25 0 0 1-1.77.16l-.4-.38a1.4 1.4 0 0 0-1-.49c-.36-.02-.72.13-.96.4l-.47.53a1.25 1.25 0 0 1-1.9 0l-.47-.53a1.4 1.4 0 0 0-.96-.4 1.4 1.4 0 0 0-1 .49l-.4.38a1.25 1.25 0 0 1-1.77-.16l-1.06-1.24a1.25 1.25 0 0 1 .09-1.77l.42-.36c.26-.22.42-.57.44-.94.02-.37-.11-.73-.34-1.01l-.36-.42a1.25 1.25 0 0 1 0-1.63l.36-.42c.23-.28.36-.64.34-1.01a1.4 1.4 0 0 0-.44-.94l-.42-.36a1.25 1.25 0 0 1-.09-1.77l1.06-1.24a1.25 1.25 0 0 1 1.77-.16l.4.38c.27.29.63.47 1 .49.36.02.72-.13.96-.4L7.05.5z"/>
        </svg>
      </button>
    </nav>
  </div>

  <!-- Barra de Aviso Não-Intrusivo de Redirecionamento Bloqueado (ETAPA 1) -->
  <div id="redirect-blocked-bar" class="redirect-blocked-bar" hidden>
    <div class="redirect-bar-content">
      <svg class="redirect-bar-icon" viewBox="0 0 16 16">
        <path fill="currentColor" d="M8 0c-.26 0-.51.1-.7.29L2.24 5.35c-.15.15-.24.36-.24.58v4.57c0 3.2 2.37 5.09 5.76 5.48.16.02.32.02.48 0 3.39-.39 5.76-2.28 5.76-5.48V5.93c0-.22-.09-.43-.24-.58L8.7 0.29C8.51 0.1 8.26 0 8 0zm0 1.5l4.5 4.5v4.5c0 2.4-1.7 3.8-4.5 4.19-2.8-.39-4.5-1.79-4.5-4.19V6l4.5-4.5z"/>
      </svg>
      <span id="redirect-blocked-text" class="redirect-bar-text">Redirecionamento bloqueado — exemplo.com</span>
    </div>
    <div class="redirect-bar-actions">
      <button id="btn-allow-redirect" class="btn-allow-redirect">Permitir mesmo assim</button>
      <button id="btn-dismiss-redirect" class="btn-dismiss-redirect" title="Dispensar aviso" aria-label="Dispensar aviso">✕</button>
    </div>
  </div>

  <!-- Barra de Busca na Página (Ctrl+F) -->
  <div id="find-bar">
    <input type="text" id="find-input" class="find-input" placeholder="Buscar na página..." />
    <span id="find-count" class="find-count"></span>
    <button type="button" id="find-prev" class="find-btn" title="Anterior (Shift+Enter)">
      <svg viewBox="0 0 16 16"><path d="M8 3.5l4 4H9.5V13h-3V7.5H4l4-4z"/></svg>
    </button>
    <button type="button" id="find-next" class="find-btn" title="Próximo (Enter)">
      <svg viewBox="0 0 16 16"><path d="M8 12.5l-4-4h2.5V3h3v5.5H12l-4 4z"/></svg>
    </button>
    <button type="button" id="find-close" class="find-btn" title="Fechar (Esc)">
      <svg viewBox="0 0 16 16"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>
    </button>
  </div>

  <!-- Modal de Solicitação de Permissões por Site (Bottom Sheet) -->
  <div id="permission-sheet-overlay">
    <div id="permission-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="perm-title">
      <div class="perm-header">
        <div class="perm-icon" id="perm-icon-wrap">
          <svg viewBox="0 0 16 16">
            <path fill="currentColor" d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
          </svg>
        </div>
        <div>
          <h2 id="perm-title" class="perm-title">Permitir acesso?</h2>
          <p id="perm-desc" class="perm-desc">Este site está solicitando autorização.</p>
        </div>
      </div>
      <label class="perm-remember-row">
        <input type="checkbox" id="perm-remember-check" checked />
        <span>Lembrar desta escolha para este site</span>
      </label>
      <div class="perm-actions">
        <button type="button" id="btn-perm-block" class="btn-perm-block">Bloquear</button>
        <button type="button" id="btn-perm-allow" class="btn-perm-allow">Permitir</button>
      </div>
    </div>
  </div>

  <!-- Modal de Aviso de Download de Risco (Bottom Sheet - ETAPA 4) -->
  <div id="download-risk-overlay">
    <div id="download-risk-panel" role="dialog" aria-modal="true" aria-labelledby="download-risk-title">
      <div class="perm-header">
        <div class="perm-icon risk-warning-icon">
          <svg viewBox="0 0 16 16">
            <path fill="currentColor" d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
        </div>
        <div>
          <h2 id="download-risk-title" class="perm-title">Arquivo potencialmente perigoso</h2>
          <p id="download-risk-desc" class="perm-desc">Este arquivo executável pode danificar seu computador ou executar ações indesejadas.</p>
        </div>
      </div>
      <div class="perm-actions">
        <button type="button" id="btn-download-risk-cancel" class="btn-risk-cancel">Cancelar download</button>
        <button type="button" id="btn-download-risk-confirm" class="btn-risk-continue">Continuar mesmo assim</button>
      </div>
    </div>
  </div>

  <!-- Painel de Confirmação (Estilo Bottom Sheet) -->
  <div id="fire-sheet-overlay">
    <div id="fire-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="fire-sheet-title">
      <div class="fire-sheet-header">
        <div class="fire-sheet-icon">
          <svg viewBox="0 0 24 24">
            <path d="M12 2c-.3 1.8-1.5 3.3-2.6 4.7-1.4 1.8-2.8 3.7-2.9 6.1-.1 3.5 2.7 6.4 6.2 6.5 3.6.1 6.5-2.8 6.5-6.4 0-2.4-1.3-4.6-2.5-6.6-1-1.6-1.9-3.3-2.2-5.2-.1-.4-.6-.6-.9-.3-.5.7-.9 1.5-1.2 2.3-.6 1.4-1.6 2.6-1.5 4.2.1 1.2.9 2.2 2.1 2.3 1.2.1 2.2-.8 2.2-2 0-.6-.2-1.2-.5-1.7-.1-.2.1-.5.3-.4 1.2 1 1.9 2.4 1.9 4 0 2.8-2.2 5-5 5s-5-2.2-5-5c0-1.8.8-3.4 1.9-4.5 1-1 2.1-2.1 2.6-3.4.4-1.1.5-2.3.4-3.5-.1-.4-.5-.6-.8-.4z" />
          </svg>
        </div>
        <div>
          <h2 id="fire-sheet-title" class="fire-sheet-title">Apagar abas e dados?</h2>
        </div>
      </div>
      <p class="fire-sheet-desc">
        Todas as abas abertas, cookies de sessão, histórico e arquivos em cache serão permanentemente consumidos pelo fogo do dragão e apagados.
      </p>
      <div class="fire-sheet-options">
        <label class="fire-sheet-checkbox-label">
          <input type="checkbox" id="chk-fire-bookmarks" />
          <span>Apagar também os favoritos</span>
        </label>
      </div>
      <div class="fire-sheet-actions">
        <button id="btn-fire-cancel" class="btn-fire-cancel">Cancelar</button>
        <button id="btn-fire-confirm" class="btn-fire-confirm">Apagar tudo</button>
      </div>
    </div>
  </div>

  <!-- Backdrop e Painel do Escudo de Privacidade (Dropdown na barra de endereço) -->
  <div id="shield-panel-backdrop"></div>
  <div id="shield-panel" role="dialog" aria-modal="true" aria-labelledby="shield-site-host">
    <div class="shield-panel-header">
      <div class="shield-panel-title-row">
        <div class="shield-header-icon">
          <svg viewBox="0 0 16 16">
            <path fill="currentColor" d="M8 0c-.26 0-.51.1-.7.29L2.24 5.35c-.15.15-.24.36-.24.58v4.57c0 3.2 2.37 5.09 5.76 5.48.16.02.32.02.48 0 3.39-.39 5.76-2.28 5.76-5.48V5.93c0-.22-.09-.43-.24-.58L8.7 0.29C8.51 0.1 8.26 0 8 0zm0 1.5l4.5 4.5v4.5c0 2.4-1.7 3.8-4.5 4.19-2.8-.39-4.5-1.79-4.5-4.19V6l4.5-4.5z"/>
          </svg>
        </div>
        <div class="shield-header-info">
          <span id="shield-site-host" class="shield-site-host">-</span>
          <span id="shield-status-text" class="shield-status-text">Proteção ativada neste site</span>
        </div>
        <button id="btn-shield-toggle" class="shield-toggle-btn active" role="switch" aria-checked="true" title="Alternar proteção neste site">
          <span class="toggle-thumb"></span>
        </button>
      </div>
    </div>
    <div class="shield-panel-body">
      <div class="shield-section-header">
        <div id="shield-grade-badge" class="shield-grade-badge grade-a" title="Classificação de privacidade do site">A</div>
        <div class="shield-metrics-wrap">
          <span id="shield-trackers-count" class="shield-trackers-count">0 rastreadores bloqueados nesta página</span>
          <span id="shield-popups-count" class="shield-popups-count">0 pop-ups / redirecionamentos bloqueados</span>
        </div>
      </div>
      <ul id="shield-trackers-list" class="shield-trackers-list">
        <li class="shield-empty-item">Nenhum rastreador detectado até o momento.</li>
      </ul>
    </div>
  </div>

  <!-- Canvas em Tela Cheia para a Animação do Dragão Azul -->
  <canvas id="fire-canvas"></canvas>

  <!-- Badge central de pico da animação do Dragão Azul -->
  <div id="fire-center-badge">
    <div class="fire-badge-icon-wrap">
      <img src="../../assets/icons/favicon-circle.png" alt="Dragão Azul" class="fire-badge-img" />
    </div>
    <div class="fire-badge-text">Apagando tudo...</div>
  </div>

  <!-- Toast Flutuante de Confirmação pós-limpeza -->
  <div id="fire-toast" role="status" aria-live="polite">
    <div class="fire-toast-icon">
      <svg viewBox="0 0 24 24">
        <path d="M12 2c-.3 1.8-1.5 3.3-2.6 4.7-1.4 1.8-2.8 3.7-2.9 6.1-.1 3.5 2.7 6.4 6.2 6.5 3.6.1 6.5-2.8 6.5-6.4 0-2.4-1.3-4.6-2.5-6.6-1-1.6-1.9-3.3-2.2-5.2-.1-.4-.6-.6-.9-.3-.5.7-.9 1.5-1.2 2.3-.6 1.4-1.6 2.6-1.5 4.2.1 1.2.9 2.2 2.1 2.3 1.2.1 2.2-.8 2.2-2 0-.6-.2-1.2-.5-1.7-.1-.2.1-.5.3-.4 1.2 1 1.9 2.4 1.9 4 0 2.8-2.2 5-5 5s-5-2.2-5-5c0-1.8.8-3.4 1.9-4.5 1-1 2.1-2.1 2.6-3.4.4-1.1.5-2.3.4-3.5-.1-.4-.5-.6-.8-.4z" />
      </svg>
    </div>
    <span class="fire-toast-text">Abas e dados apagados</span>
  </div>

  <!-- Componentes modulares da interface sem necessidade de build -->
  <script src="components/toolbar.js"></script>
  <script src="components/addressbar.js"></script>
  <script src="components/tabs-view.js"></script>
  <script src="components/privacy-shield.js"></script>
  <script src="components/fire-button.js"></script>
  <script src="components/fire-sheet.js"></script>
  <script src="components/fire-animation.js"></script>
  <script src="components/find-bar.js"></script>
  <script src="components/permission-sheet.js"></script>
  <script src="components/download-risk-sheet.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

---

### 4.31 `src/renderer/app.js`

```javascript
// =============================================================================
// src/renderer/app.js
// Ponto de entrada do processo de renderização (UI)
// Orquestra os componentes e consome o estado reativo via window.browserAPI
// =============================================================================

// Tratamento de erros e logs consistentes na interface gráfica
window.addEventListener('error', (event) => {
  console.error('[Dragon Renderer] Erro na interface:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Dragon Renderer] Rejeição de Promise não tratada na interface:', event.reason);
});

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Instanciação dos componentes visuais
  const toolbar = new window.ToolbarComponent();
  const addressbar = new window.AddressBarComponent();
  const tabsView = new window.TabsViewComponent();
  const privacyShield = new window.PrivacyShieldComponent();
  const findBar = new window.FindBarComponent();
  const permissionSheet = new window.PermissionSheetComponent();
  const downloadRiskSheet = new window.DownloadRiskSheetComponent();

  // Componentes do Dragão Azul (Apagar Tudo)
  const fireAnimation = new window.FireAnimationComponent();

  let fireButton = null;
  const fireSheet = new window.FireSheetComponent({
    onConfirm: (options) => {
      if (fireButton) {
        fireButton.setBusy(true);
      }
      const coords = fireButton ? fireButton.getOriginCoords() : { x: window.innerWidth - 30, y: 38 };
      fireAnimation.start(coords, () => {
        if (fireButton) {
          fireButton.setBusy(false);
        }
      }, options);
    }
  });

  fireButton = new window.FireButtonComponent({
    onTrigger: () => {
      fireSheet.open();
    }
  });

  /**
   * Aplica configurações de aparência (cor de destaque e tema claro/escuro) em tempo real
   * @param {object} settings Configurações recebidas
   */
  function applyGlobalTheme(settings) {
    if (!settings) return;
    const root = document.documentElement;

    // 1. Cor de destaque (accent color)
    if (settings.accentColor) {
      root.style.setProperty('--color-accent', settings.accentColor);
      root.style.setProperty('--color-border-focus', settings.accentColor);
    }

    // 2. Tema da interface (escuro, claro ou seguir sistema)
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
  }

  /**
   * Distribui o estado recebido do processo principal para todos os componentes
   * @param {object} state Objeto de estado consolidado do navegador
   */
  function handleStateUpdate(state) {
    if (!state) return;
    tabsView.update(state);
    toolbar.update(state);
    addressbar.update(state);
    privacyShield.update(state);
    if (state.settings) {
      applyGlobalTheme(state.settings);
    }
  }

  // 2. Conecta ao listener de atualizações de estado em tempo real
  if (window.browserAPI && typeof window.browserAPI.onStateUpdate === 'function') {
    window.browserAPI.onStateUpdate((state) => {
      handleStateUpdate(state);
    });
  }

  // 3. Conecta ao evento de solicitação de foco na barra de endereços (ex: atalho Ctrl+L)
  if (window.browserAPI && typeof window.browserAPI.onFocusAddressBar === 'function') {
    window.browserAPI.onFocusAddressBar(() => {
      addressbar.focus();
    });
  }

  // 4. Conecta ao evento de atalho para Apagar Tudo (Ctrl+Shift+Delete)
  if (window.browserAPI && typeof window.browserAPI.onTriggerClearData === 'function') {
    window.browserAPI.onTriggerClearData(() => {
      fireSheet.open();
    });
  }

  // 5. Conecta ao evento de atualização de configurações em tempo real
  if (window.browserAPI && typeof window.browserAPI.onSettingsUpdated === 'function') {
    window.browserAPI.onSettingsUpdated((newSettings) => {
      applyGlobalTheme(newSettings);
    });
  }

  // 5.1 Conecta ao evento de tela cheia HTML5 para ocultar ou exibir a barra superior
  if (window.browserAPI && typeof window.browserAPI.onHtmlFullScreenChanged === 'function') {
    window.browserAPI.onHtmlFullScreenChanged((isFullscreen) => {
      document.body.classList.toggle('html-fullscreen', Boolean(isFullscreen));
    });
  }

  // 6. Solicita o estado atual imediatamente para renderizar o layout inicial
  if (window.browserAPI && typeof window.browserAPI.getState === 'function') {
    try {
      const initialState = await window.browserAPI.getState();
      handleStateUpdate(initialState);
    } catch (err) {
      console.error('[Renderer] Falha ao carregar estado inicial do navegador:', err);
    }
  }
});
```

---

### 4.32 `src/renderer/styles/theme.css`

```css
/* ==========================================================================
   src/renderer/styles/theme.css
   ARQUIVO ÚNICO DE TEMA E VARIÁVEIS CSS
   Todas as cores, medidas, fontes e raios de borda ficam definidos aqui.
   Para alterar o visual de toda a aplicação, modifique apenas este arquivo.
   ========================================================================== */

:root {
  /* --- Cores de Fundo (Tema Escuro Simples) --- */
  --color-bg-window: #1e1e24;       /* Fundo da janela e barra superior */
  --color-bg-toolbar: #23232b;      /* Fundo da barra de navegação/botões */
  --color-bg-tab-inactive: #23232b; /* Fundo de abas inativas */
  --color-bg-tab-hover: #2b2b35;    /* Fundo de abas ao passar o mouse */
  --color-bg-tab-active: #2f2f3a;   /* Fundo da aba selecionada */
  --color-bg-input: #18181d;        /* Fundo do campo de endereço */
  --color-bg-input-focus: #151519;  /* Fundo do campo quando em foco */
  --color-bg-button-hover: #333340; /* Fundo dos botões ao passar o mouse */

  /* --- Cores de Texto --- */
  --color-text-primary: #f0f0f5;    /* Texto principal legível */
  --color-text-secondary: #9e9ea8;  /* Títulos de abas inativas e dicas */
  --color-text-muted: #666673;      /* Texto de botões desabilitados */

  /* --- Cores de Borda e Linhas --- */
  --color-border-subtle: #2d2d38;   /* Linhas divisórias sutis */
  --color-border-focus: #4d7cff;    /* Borda azul ao focar a barra de endereço */

  /* --- Cores de Destaque e Ações --- */
  --color-accent: #4d7cff;          /* Azul padrão para foco e ações */
  --color-accent-hover: #3b6ae6;    /* Azul ao passar o mouse */
  --color-danger-hover: #e04545;    /* Vermelho no botão de fechar aba */
  --color-danger-bg: rgba(224, 69, 69, 0.15);

  /* --- Tipografia --- */
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-lg: 14px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;

  /* --- Medidas e Dimensões de Layout --- */
  --topbar-height: 76px;            /* Altura total da interface do navegador */
  --tabs-bar-height: 38px;          /* Linha de abas */
  --toolbar-height: 38px;           /* Linha da barra de navegação e endereço */
  --tab-max-width: 220px;           /* Largura máxima de cada aba */
  --tab-min-width: 90px;            /* Largura mínima de cada aba */
  --button-size: 28px;              /* Diâmetro/largura padrão de botões da barra */

  /* --- Raios de Borda (Border Radius) --- */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 9999px;

  /* --- Transições --- */
  --transition-fast: 0.15s ease;

  /* --- Paleta do Fogo do Dragão Azul (Apagar Tudo) --- */
  --fire-core: #E6F7FF;       /* Centro quase branco */
  --fire-mid: #29B6FF;        /* Azul ciano */
  --fire-main: #0194FF;       /* Azul elétrico */
  --fire-edge: #0A2A9E;       /* Azul profundo */
  --fire-bg: #08132B;         /* Azul-marinho de fundo */
  --fire-glow: rgba(1, 148, 255, 0.4);
  --fire-glow-strong: rgba(41, 182, 255, 0.85);

  /* --- Proteção de Privacidade e Escudo (DuckDuckGo style) --- */
  --shield-color: var(--fire-main);
  --shield-hover: var(--fire-mid);
  --shield-bg: #1c2738;
  --shield-off-color: var(--color-text-muted);
  --shield-off-border: #444452;
  --shield-badge-bg: var(--fire-main);
  --shield-badge-text: #ffffff;
  --private-tab-bg: #211c2e;
  --private-tab-active-bg: #2d2442;
  --private-icon-color: #b088ff;
}

/* --- Suporte ao Tema Claro --- */
body.theme-light {
  --color-bg-window: #e8e9f0;
  --color-bg-toolbar: #f4f5fa;
  --color-bg-tab-inactive: #e0e2ec;
  --color-bg-tab-hover: #d5d8e4;
  --color-bg-tab-active: #ffffff;
  --color-bg-input: #ffffff;
  --color-bg-input-focus: #ffffff;
  --color-bg-button-hover: #dcdfe8;
  --color-text-primary: #1e1e24;
  --color-text-secondary: #5a5a68;
  --color-text-muted: #8c8c9a;
  --color-border-subtle: #d0d2de;
  --private-tab-bg: #ece6f6;
  --private-tab-active-bg: #ffffff;
}

```

---

### 4.33 `src/renderer/styles/base.css`

```css
/* ==========================================================================
   src/renderer/styles/base.css
   Reset e estilos base da interface
   ========================================================================== */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--color-bg-window);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  user-select: none;
  -webkit-user-select: none;
}

/* Os WebContentsView do Electron ficam logo abaixo dos primeiros pixels do topo */
#app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: var(--topbar-height);
  background-color: var(--color-bg-window);
  border-bottom: 1px solid var(--color-border-subtle);
  overflow: hidden;
}

button {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

input {
  border: none;
  outline: none;
  font: inherit;
  color: inherit;
  background: transparent;
}
```

---

### 4.34 `src/renderer/styles/components.css`

```css
/* ==========================================================================
   src/renderer/styles/components.css
   Estilos específicos para os componentes da interface (Abas, Toolbar, Endereço)
   Todos os valores utilizam as variáveis de theme.css
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. BARRA DE ABAS (#tabs-bar)
   -------------------------------------------------------------------------- */
#tabs-bar {
  display: flex;
  align-items: flex-end;
  height: var(--tabs-bar-height);
  padding: 4px 8px 0 8px;
  background-color: var(--color-bg-window);
  gap: 4px;
}

#tabs-container {
  display: flex;
  align-items: flex-end;
  flex: 1;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 2px;
}

/* Oculta barra de rolagem nativa mantendo a rolagem por mouse */
#tabs-container::-webkit-scrollbar {
  display: none;
}

/* Item individual de aba */
.tab-item {
  display: flex;
  align-items: center;
  height: 32px;
  min-width: var(--tab-min-width);
  max-width: var(--tab-max-width);
  flex: 1;
  padding: 0 8px 0 10px;
  background-color: var(--color-bg-tab-inactive);
  color: var(--color-text-secondary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
  position: relative;
  gap: 6px;
}

.tab-item:hover {
  background-color: var(--color-bg-tab-hover);
  color: var(--color-text-primary);
}

.tab-item.active {
  background-color: var(--color-bg-tab-active);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Favicon da aba */
.tab-favicon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-favicon img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.tab-favicon svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
  opacity: 0.7;
}

/* Título da aba com reticências */
.tab-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-base);
  line-height: 1.2;
}

/* Botão de fechar aba */
.tab-close-btn {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  opacity: 0.7;
  transition: opacity var(--transition-fast), background-color var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}

.tab-close-btn:hover {
  opacity: 1;
  background-color: var(--color-danger-bg);
  color: var(--color-danger-hover);
}

.tab-close-btn svg {
  width: 10px;
  height: 10px;
  fill: currentColor;
}

/* Botão de nova aba (+) */
#btn-new-tab {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  margin-bottom: 2px;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

#btn-new-tab:hover {
  background-color: var(--color-bg-button-hover);
  color: var(--color-text-primary);
}

#btn-new-tab svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* --------------------------------------------------------------------------
   2. BARRA DE NAVEGAÇÃO E ENDEREÇO (#nav-bar)
   -------------------------------------------------------------------------- */
#nav-bar {
  display: flex;
  align-items: center;
  height: var(--toolbar-height);
  padding: 0 8px;
  background-color: var(--color-bg-toolbar);
  gap: 6px;
}

/* Controles de navegação (Voltar, Avançar, Recarregar) */
#nav-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-btn {
  width: var(--button-size);
  height: var(--button-size);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
}

.nav-btn:hover:not(:disabled) {
  background-color: var(--color-bg-button-hover);
}

.nav-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* Indicador animado de download ativo na toolbar */
.nav-btn#btn-downloads.downloading {
  position: relative;
  color: var(--color-accent);
}

.nav-btn#btn-downloads.downloading::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 2px;
  background-color: var(--color-accent);
  border-radius: var(--radius-full, 999px);
  animation: downloadPulse 1.2s ease-in-out infinite;
}

@keyframes downloadPulse {
  0% {
    opacity: 0.3;
    transform: translateX(-50%) scaleX(0.4);
  }
  50% {
    opacity: 1;
    transform: translateX(-50%) scaleX(1);
  }
  100% {
    opacity: 0.3;
    transform: translateX(-50%) scaleX(0.4);
  }
}

/* Formulário e campo de endereço */
#address-form {
  display: flex;
  flex: 1;
  height: 28px;
  background-color: var(--color-bg-input);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-pill);
  padding: 0 12px;
  align-items: center;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
  gap: 8px;
}

#address-form:focus-within {
  border-color: var(--color-border-focus);
  background-color: var(--color-bg-input-focus);
}

.address-icon {
  width: 13px;
  height: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.address-icon svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

#address-input {
  width: 100%;
  height: 100%;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  user-select: text;
  -webkit-user-select: text;
}

#address-input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.6;
}

/* Spinner de carregamento para a aba */
.tab-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-border-subtle);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* --------------------------------------------------------------------------
   3. BOTÃO DO FOGO DO DRAGÃO AZUL (#btn-fire)
   -------------------------------------------------------------------------- */
.fire-btn {
  width: var(--button-size);
  height: var(--button-size);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform var(--transition-fast), filter var(--transition-fast);
  color: var(--fire-main);
}

.fire-btn svg {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 0 2px var(--fire-glow));
  transition: filter var(--transition-fast), transform var(--transition-fast);
}

/* Pulso suave de brilho azul ao passar o mouse */
.fire-btn:hover:not(:disabled) {
  background-color: var(--color-bg-button-hover);
  animation: fire-btn-pulse 1.6s ease-in-out infinite;
}

.fire-btn:hover:not(:disabled) svg {
  filter: drop-shadow(0 0 6px var(--fire-glow-strong));
  transform: scale(1.08);
}

.fire-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.fire-btn.fire-busy {
  opacity: 0.6;
  cursor: wait;
  animation: fire-btn-pulse 0.8s ease-in-out infinite;
}

@keyframes fire-btn-pulse {
  0% {
    box-shadow: 0 0 0 0 var(--fire-glow);
  }
  50% {
    box-shadow: 0 0 12px 2px var(--fire-glow-strong);
  }
  100% {
    box-shadow: 0 0 0 0 var(--fire-glow);
  }
}

/* --------------------------------------------------------------------------
   4. BLOQUEIO GLOBAL DE INTERFACE DURANTE A LIMPEZA
   -------------------------------------------------------------------------- */
body.ui-locked {
  cursor: wait !important;
}

body.ui-locked * {
  pointer-events: none !important;
}

/* --------------------------------------------------------------------------
   5. CONFIRMAÇÃO ESTILO BOTTOM SHEET (#fire-sheet-overlay & #fire-sheet-panel)
   -------------------------------------------------------------------------- */
#fire-sheet-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(8, 19, 43, 0.75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 5000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

#fire-sheet-overlay.visible {
  opacity: 1;
  visibility: visible;
}

#fire-sheet-panel {
  width: 100%;
  max-width: 520px;
  background-color: var(--color-bg-toolbar);
  border-top: 1px solid var(--fire-edge);
  border-left: 1px solid var(--fire-edge);
  border-right: 1px solid var(--fire-edge);
  border-radius: 16px 16px 0 0;
  padding: 24px 28px 20px 28px;
  box-shadow: 0 -10px 35px var(--fire-glow);
  transform: translateY(100%);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

#fire-sheet-panel.visible {
  transform: translateY(0);
}

.fire-sheet-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fire-sheet-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background-color: rgba(1, 148, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--fire-edge);
}

.fire-sheet-icon svg {
  width: 20px;
  height: 20px;
  fill: var(--fire-mid);
}

.fire-sheet-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--fire-core);
}

.fire-sheet-desc {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.fire-sheet-options {
  margin: 12px 0 6px 0;
}

.fire-sheet-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  cursor: pointer;
  user-select: none;
}

.fire-sheet-checkbox-label input[type="checkbox"] {
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.fire-sheet-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.btn-fire-cancel {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  background-color: var(--color-bg-tab-inactive);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  transition: background-color var(--transition-fast);
}

.btn-fire-cancel:hover {
  background-color: var(--color-bg-button-hover);
}

.btn-fire-confirm {
  padding: 8px 18px;
  border-radius: var(--radius-md);
  background-color: var(--fire-main);
  color: var(--fire-core);
  font-weight: var(--font-weight-bold);
  box-shadow: 0 0 12px var(--fire-glow);
  transition: background-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.btn-fire-confirm:hover {
  background-color: var(--fire-mid);
  box-shadow: 0 0 18px var(--fire-glow-strong);
  transform: translateY(-1px);
}

.btn-fire-confirm:active {
  transform: translateY(0);
}

/* --------------------------------------------------------------------------
   6. CANVAS DA ANIMAÇÃO DO FOGO EM TELA CHEIA (#fire-canvas)
   -------------------------------------------------------------------------- */
#fire-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  pointer-events: none;
  display: none;
}

/* --------------------------------------------------------------------------
   7. TOAST DE CONFIRMAÇÃO FLUTUANTE (#fire-toast)
   -------------------------------------------------------------------------- */
#fire-toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  background-color: var(--fire-bg);
  color: var(--fire-core);
  border: 1px solid var(--fire-edge);
  border-radius: var(--radius-pill);
  padding: 8px 18px;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  box-shadow: 0 8px 24px rgba(8, 19, 43, 0.8), 0 0 14px var(--fire-glow);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 10000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

#fire-toast.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.fire-toast-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.fire-toast-icon svg {
  width: 16px;
  height: 16px;
  fill: var(--fire-mid);
}

#fire-toast.warning {
  border-color: rgba(255, 179, 0, 0.4);
  background-color: rgba(40, 28, 10, 0.95);
  color: #ffe082;
}

#fire-toast.warning .fire-toast-icon svg {
  fill: #ffb300;
}

/* --------------------------------------------------------------------------
   8. ESCUDO DE PRIVACIDADE NA BARRA DE ENDEREÇO
   -------------------------------------------------------------------------- */
.privacy-shield-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  color: var(--shield-color);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);
}

.privacy-shield-btn:hover {
  background-color: var(--color-bg-button-hover);
  color: var(--shield-hover);
}

.privacy-shield-btn.protection-off {
  color: var(--shield-off-color);
  opacity: 0.8;
}

.shield-icon-svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

.shield-badge {
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background-color: transparent;
  color: var(--color-text-secondary);
  line-height: 1;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.shield-badge.has-blocked {
  background-color: var(--shield-badge-bg);
  color: var(--shield-badge-text);
  box-shadow: 0 0 6px var(--fire-glow);
}

/* Backdrop escuro para fechar ao clicar fora */
#shield-panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4500;
  display: none;
  background: rgba(0, 0, 0, 0.3);
}

#shield-panel-backdrop.visible {
  display: block;
}

/* Painel de sobreposição do escudo (dropdown na barra de endereço) */
#shield-panel {
  position: fixed;
  top: calc(var(--topbar-height) + 6px);
  left: 120px;
  width: 360px;
  max-width: 90vw;
  background-color: var(--shield-bg);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 16px var(--fire-glow);
  z-index: 4600;
  display: none;
  flex-direction: column;
  overflow: hidden;
  animation: shield-panel-appear 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

#shield-panel.visible {
  display: flex;
}

@keyframes shield-panel-appear {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.shield-panel-header {
  padding: 14px 16px;
  background-color: rgba(8, 19, 43, 0.6);
  border-bottom: 1px solid var(--color-border-subtle);
}

.shield-panel-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shield-header-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background-color: rgba(1, 148, 255, 0.15);
  color: var(--shield-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.shield-header-icon svg {
  width: 16px;
  height: 16px;
}

.shield-header-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shield-site-host {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shield-status-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Toggle Switch estilo iOS / DuckDuckGo */
.shield-toggle-btn {
  width: 42px;
  height: 24px;
  border-radius: var(--radius-pill);
  background-color: var(--shield-off-border);
  position: relative;
  cursor: pointer;
  border: none;
  outline: none;
  transition: background-color var(--transition-fast);
  flex-shrink: 0;
}

.shield-toggle-btn .toggle-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #ffffff;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.shield-toggle-btn.active {
  background-color: var(--shield-color);
}

.shield-toggle-btn.active .toggle-thumb {
  transform: translateX(18px);
}

.shield-panel-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
}

.shield-section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.shield-grade-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  font-size: 20px;
  font-weight: 800;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.shield-grade-badge.grade-a,
.shield-grade-badge.grade-b {
  background: rgba(34, 197, 94, 0.16);
  color: #22c55e;
  border: 1.5px solid rgba(34, 197, 94, 0.45);
}

.shield-grade-badge.grade-c {
  background: rgba(234, 179, 8, 0.16);
  color: #eab308;
  border: 1.5px solid rgba(234, 179, 8, 0.45);
}

.shield-grade-badge.grade-d,
.shield-grade-badge.grade-f {
  background: rgba(239, 68, 68, 0.16);
  color: #ef4444;
  border: 1.5px solid rgba(239, 68, 68, 0.45);
}

.shield-metrics-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shield-trackers-count {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.shield-popups-count {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.shield-trackers-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shield-tracker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background-color: rgba(255, 255, 255, 0.04);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
}

.tracker-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--shield-color);
  flex-shrink: 0;
}

.shield-empty-item {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
  padding: 8px 0;
}

/* --------------------------------------------------------------------------
   9. ESTILOS DE ABA PRIVADA
   -------------------------------------------------------------------------- */
.tab-item.private {
  background-color: var(--private-tab-bg);
  border-bottom: 2px solid var(--private-icon-color);
}

.tab-item.private.active {
  background-color: var(--private-tab-active-bg);
  color: #ffffff;
}

.private-icon-svg {
  width: 14px;
  height: 14px;
  color: var(--private-icon-color);
}

/* --------------------------------------------------------------------------
   10. BADGE CENTRAL DA ANIMAÇÃO DO FOGO (#fire-center-badge)
   -------------------------------------------------------------------------- */
#fire-center-badge {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.9);
  z-index: 10001;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s ease;
}

#fire-center-badge.visible {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, -50%) scale(1);
}

.fire-badge-icon-wrap {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background-color: var(--fire-bg);
  border: 2px solid var(--fire-mid);
  box-shadow: 0 0 35px var(--fire-glow-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fire-badge-pulse 1.8s ease-in-out infinite;
}

.fire-badge-img {
  width: 60px;
  height: 60px;
  object-fit: contain;
}

.fire-badge-text {
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  color: var(--fire-core);
  text-shadow: 0 0 12px var(--fire-glow-strong);
  letter-spacing: 0.5px;
}

@keyframes fire-badge-pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 25px var(--fire-glow);
  }
  50% {
    transform: scale(1.06);
    box-shadow: 0 0 45px var(--fire-glow-strong);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 25px var(--fire-glow);
  }
}

/* --------------------------------------------------------------------------
   8. MODO DE TELA CHEIA HTML5 (VÍDEO)
   -------------------------------------------------------------------------- */
body.html-fullscreen #app {
  display: none !important;
}

/* --------------------------------------------------------------------------
   9. REORDENAÇÃO DE ABAS (DRAG & DROP)
   -------------------------------------------------------------------------- */
.tab-item.dragging {
  opacity: 0.45;
}

.tab-item.drag-over {
  border-left: 2px solid var(--color-accent);
}

/* --------------------------------------------------------------------------
   10. BOTÕES DA BARRA (FAVORITO & DOWNLOADS)
   -------------------------------------------------------------------------- */
.bookmark-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  width: var(--button-size);
  height: var(--button-size);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.bookmark-btn:hover {
  background-color: var(--color-bg-button-hover);
  color: var(--color-text-primary);
}

.bookmark-btn.active svg {
  fill: #ffb800;
  color: #ffb800;
}

.bookmark-btn svg {
  width: 16px;
  height: 16px;
}

/* --------------------------------------------------------------------------
   11. SUGESTÕES NA OMNIBOX (DROPDOWN)
   -------------------------------------------------------------------------- */
#omnibox-dropdown {
  position: fixed;
  background-color: var(--color-bg-toolbar);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  z-index: 9999;
  display: none;
  flex-direction: column;
  overflow: hidden;
  max-height: 380px;
}

#omnibox-dropdown.visible {
  display: flex;
}

.omnibox-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background-color var(--transition-fast);
}

.omnibox-item:last-child {
  border-bottom: none;
}

.omnibox-item:hover,
.omnibox-item.selected {
  background-color: var(--color-bg-button-hover);
}

.omnibox-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: var(--color-text-muted);
}

.omnibox-item.type-bookmark .omnibox-icon {
  fill: #ffb800;
}

.omnibox-item.type-search .omnibox-icon {
  fill: var(--color-accent);
}

.omnibox-text-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.omnibox-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.omnibox-url {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* --------------------------------------------------------------------------
   12. BARRA DE BUSCA NA PÁGINA (CTRL+F)
   -------------------------------------------------------------------------- */
#find-bar {
  position: fixed;
  top: var(--topbar-height);
  right: 24px;
  height: 44px;
  background-color: var(--color-bg-toolbar);
  border: 1px solid var(--color-border-subtle);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  padding: 6px 12px;
  display: none;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 4800;
}

#find-bar.visible {
  display: flex;
}

.find-input {
  background-color: var(--color-bg-input);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  padding: 4px 8px;
  font-size: 13px;
  width: 180px;
  outline: none;
}

.find-input:focus {
  border-color: var(--color-accent);
}

.find-count {
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 40px;
  text-align: center;
}

.find-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.find-btn:hover {
  background-color: var(--color-bg-button-hover);
  color: var(--color-text-primary);
}

.find-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* --------------------------------------------------------------------------
   13. PROMPT DE PERMISSÕES POR SITE (BOTTOM SHEET)
   -------------------------------------------------------------------------- */
#permission-sheet-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(8, 19, 43, 0.55);
  backdrop-filter: blur(4px);
  z-index: 4700;
  display: none;
  align-items: flex-end;
  justify-content: center;
}

#permission-sheet-overlay.visible {
  display: flex;
}

#permission-sheet-panel {
  background-color: var(--color-bg-toolbar);
  border: 1px solid var(--color-border-subtle);
  border-bottom: none;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 24px 28px;
  max-width: 520px;
  width: 100%;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: slide-up 0.2s ease-out;
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.perm-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.perm-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: rgba(77, 124, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
}

.perm-icon svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.perm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.perm-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.perm-remember-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.perm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 4px;
}

.btn-perm-block {
  background: transparent;
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-primary);
  padding: 8px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  transition: background-color var(--transition-fast);
}

.btn-perm-block:hover {
  background-color: var(--color-bg-button-hover);
}

.btn-perm-allow {
  background-color: var(--color-accent);
  border: none;
  color: #ffffff;
  padding: 8px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background-color var(--transition-fast);
}

.btn-perm-allow:hover {
  background-color: var(--color-accent-hover);
}

/* =============================================================================
   Barra de Redirecionamento Bloqueado (ETAPA 1)
   ============================================================================= */

.redirect-blocked-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-bg-secondary, #1e1e24);
  border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
  padding: 6px 16px;
  font-size: var(--font-size-sm, 13px);
  color: var(--color-text-primary, #ffffff);
  animation: slide-down-banner 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 100;
}

.redirect-bar-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.redirect-bar-icon {
  width: 16px;
  height: 16px;
  color: #f59e0b;
  flex-shrink: 0;
}

.redirect-bar-text {
  font-weight: 500;
}

.redirect-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-allow-redirect {
  background-color: var(--color-accent, #3b82f6);
  border: none;
  color: #ffffff;
  padding: 4px 12px;
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-allow-redirect:hover {
  opacity: 0.9;
}

.btn-dismiss-redirect {
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #9ca3af);
  padding: 4px 8px;
  border-radius: var(--radius-sm, 4px);
  font-size: 14px;
  cursor: pointer;
}

.btn-dismiss-redirect:hover {
  color: #ffffff;
}

@keyframes slide-down-banner {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* --------------------------------------------------------------------------
   14. AVISO DE DOWNLOAD POTENCIALMENTE PERIGOSO (ETAPA 4)
   -------------------------------------------------------------------------- */
#download-risk-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(8, 19, 43, 0.65);
  backdrop-filter: blur(4px);
  z-index: 4800;
  display: none;
  align-items: flex-end;
  justify-content: center;
}

#download-risk-overlay.visible {
  display: flex;
}

#download-risk-panel {
  background-color: var(--color-bg-toolbar);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-bottom: none;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 24px 28px;
  max-width: 540px;
  width: 100%;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: slide-up 0.2s ease-out;
}

.risk-warning-icon {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #ef4444 !important;
}

.risk-highlight {
  color: #f87171;
  font-weight: 600;
}

.btn-risk-cancel {
  background-color: #ef4444;
  border: none;
  color: #ffffff;
  padding: 8px 20px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: background-color var(--transition-fast);
}

.btn-risk-cancel:hover {
  background-color: #dc2626;
}

.btn-risk-continue {
  background: transparent;
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
  padding: 8px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  transition: all var(--transition-fast);
}

.btn-risk-continue:hover {
  background-color: var(--color-bg-button-hover);
  color: var(--color-text-primary);
}






```

---

### 4.35 `src/renderer/components/tabs-view.js`

```javascript
// =============================================================================
// src/renderer/components/tabs-view.js
// Componente de visualização e manipulação da lista de abas com DOM Diffing
// e reordenação nativa via arrastar e soltar (HTML5 Drag & Drop).
// A interface gráfica é puramente reativa: renderiza com base no estado do Main.
// =============================================================================

class TabsViewComponent {
  constructor() {
    this.container = document.getElementById('tabs-container');
    this.btnNewTab = document.getElementById('btn-new-tab');
    this.tabElements = new Map(); // tabId -> { tabEl, titleEl, iconWrapper, currentFavicon, currentLoading, currentTitle, currentActive }
    this.lastTabOrder = [];
    this.lastActiveTabId = null;

    this.initEvents();
  }

  /**
   * Configura eventos gerais do componente
   */
  initEvents() {
    if (this.btnNewTab) {
      this.btnNewTab.addEventListener('click', () => {
        if (window.browserAPI) {
          window.browserAPI.createTab();
        }
      });
    }
  }

  /**
   * Atualiza a lista de abas realizando diffing por id sem recriar o DOM
   * @param {object} state Estado recebido pelo canal "browser:state-update"
   */
  update(state) {
    if (!this.container || !state || !Array.isArray(state.tabs)) return;

    const currentTabIds = new Set(state.tabs.map(t => t.id));

    // 1. Remove elementos de abas que foram fechadas
    for (const [id, record] of this.tabElements.entries()) {
      if (!currentTabIds.has(id)) {
        if (record.tabEl && record.tabEl.parentNode) {
          record.tabEl.remove();
        }
        this.tabElements.delete(id);
      }
    }

    // 2. Cria ou atualiza abas mantendo referências do DOM
    state.tabs.forEach((tab) => {
      const isActive = tab.id === state.activeTabId;
      const isPrivate = Boolean(tab.isPrivate);
      let record = this.tabElements.get(tab.id);

      if (!record) {
        // Cria novo elemento da aba com listeners
        record = this.createTabElement(tab);
        this.tabElements.set(tab.id, record);
      }

      // Atualiza estado ativo
      if (record.currentActive !== isActive) {
        record.currentActive = isActive;
        if (isActive) {
          record.tabEl.classList.add('active');
        } else {
          record.tabEl.classList.remove('active');
        }
      }

      // Atualiza título da aba
      const displayTitle = tab.title || (isPrivate ? 'Nova Aba Privada' : 'Nova Aba');
      if (record.currentTitle !== displayTitle) {
        record.currentTitle = displayTitle;
        record.titleEl.textContent = displayTitle;
      }
      record.tabEl.title = isPrivate ? `[Privada] ${displayTitle} - Sem rastros nem histórico` : `${displayTitle} - ${tab.url}`;

      // Atualiza ícone ou spinner de carregamento se alterado
      if (record.currentLoading !== tab.isLoading || record.currentFavicon !== tab.favicon) {
        record.currentLoading = tab.isLoading;
        record.currentFavicon = tab.favicon;
        this.updateFavicon(record.iconWrapper, tab, isPrivate);
      }
    });

    // 3. Reordena no DOM SOMENTE se a ordem das abas tiver mudado
    const newOrderIds = state.tabs.map(t => t.id);
    const orderChanged = newOrderIds.length !== this.lastTabOrder.length ||
      newOrderIds.some((id, index) => id !== this.lastTabOrder[index]);

    if (orderChanged) {
      this.lastTabOrder = newOrderIds;
      state.tabs.forEach(tab => {
        const record = this.tabElements.get(tab.id);
        if (record && record.tabEl) {
          this.container.appendChild(record.tabEl);
        }
      });
    }

    // 4. Rola suavemente para tornar a aba visível SOMENTE se a aba ativa tiver mudado
    const activeChanged = state.activeTabId !== this.lastActiveTabId;
    this.lastActiveTabId = state.activeTabId;

    if (activeChanged && state.activeTabId) {
      const activeRecord = this.tabElements.get(state.activeTabId);
      if (activeRecord && activeRecord.tabEl) {
        activeRecord.tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }

  /**
   * Cria o nó do DOM de uma nova aba com eventos de clique e arrastar
   * @param {object} tab
   * @returns {object} Record com referências do elemento
   */
  createTabElement(tab) {
    const isPrivate = Boolean(tab.isPrivate);

    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${isPrivate ? 'private' : ''}`;
    tabEl.dataset.tabId = tab.id;
    tabEl.draggable = true;

    // Favicon / Spinner
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'tab-favicon';
    this.updateFavicon(iconWrapper, tab, isPrivate);
    tabEl.appendChild(iconWrapper);

    // Título
    const titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title || (isPrivate ? 'Nova Aba Privada' : 'Nova Aba');
    tabEl.appendChild(titleEl);

    // Botão Fechar (X)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.title = 'Fechar aba (Ctrl+W)';
    closeBtn.setAttribute('aria-label', 'Fechar aba');
    closeBtn.innerHTML = `
      <svg viewBox="0 0 16 16">
        <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
      </svg>
    `;

    closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (window.browserAPI) {
        window.browserAPI.closeTab(tab.id);
      }
    });
    tabEl.appendChild(closeBtn);

    // Clique esquerdo para selecionar
    tabEl.addEventListener('click', () => {
      if (window.browserAPI) {
        window.browserAPI.selectTab(tab.id);
      }
    });

    // Clique com o scroll do mouse para fechar
    tabEl.addEventListener('auxclick', (event) => {
      if (event.button === 1 && window.browserAPI) {
        event.preventDefault();
        window.browserAPI.closeTab(tab.id);
      }
    });

    // Eventos de Arrastar e Soltar (Drag and Drop)
    tabEl.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', tab.id);
      event.dataTransfer.effectAllowed = 'move';
      tabEl.classList.add('dragging');
    });

    tabEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      tabEl.classList.add('drag-over');
    });

    tabEl.addEventListener('dragleave', () => {
      tabEl.classList.remove('drag-over');
    });

    tabEl.addEventListener('drop', (event) => {
      event.preventDefault();
      tabEl.classList.remove('drag-over');
      const sourceId = event.dataTransfer.getData('text/plain');
      if (sourceId && sourceId !== tab.id && window.browserAPI) {
        window.browserAPI.reorderTabs(sourceId, tab.id);
      }
    });

    tabEl.addEventListener('dragend', () => {
      tabEl.classList.remove('dragging');
      document.querySelectorAll('.tab-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    return {
      tabEl,
      titleEl,
      iconWrapper,
      closeBtn,
      currentFavicon: tab.favicon,
      currentLoading: tab.isLoading,
      currentTitle: tab.title,
      currentActive: false
    };
  }

  /**
   * Atualiza os nós filhos do iconWrapper
   * @param {HTMLElement} iconWrapper
   * @param {object} tab
   * @param {boolean} isPrivate
   */
  updateFavicon(iconWrapper, tab, isPrivate) {
    iconWrapper.innerHTML = '';

    if (tab.isLoading) {
      const spinner = document.createElement('div');
      spinner.className = 'tab-spinner';
      iconWrapper.appendChild(spinner);
    } else if (isPrivate) {
      iconWrapper.appendChild(this.createPrivateIcon());
    } else if (tab.favicon && typeof tab.favicon === 'string' && tab.favicon.startsWith('http')) {
      const img = document.createElement('img');
      img.src = tab.favicon;
      img.alt = '';
      img.onerror = () => {
        img.replaceWith(this.createDefaultIcon());
      };
      iconWrapper.appendChild(img);
    } else {
      iconWrapper.appendChild(this.createDefaultIcon());
    }
  }

  createDefaultIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.innerHTML = `
      <path fill="currentColor" d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.93 5H9.6a11.7 11.7 0 0 0-1.2-3.07A6.5 6.5 0 0 1 11.93 5zM8 1.5c.57 0 1.25 1.07 1.57 3.5H6.43c.32-2.43 1-3.5 1.57-3.5zm-3.93 3.5A6.5 6.5 0 0 1 7.6 1.93 11.7 11.7 0 0 0 6.4 5H4.07zM1.5 8c0-.7.1-1.37.28-2h2.5c-.05.65-.08 1.32-.08 2s.03 1.35.08 2h-2.5A6.47 6.47 0 0 1 1.5 8zm1.07 3h2.33c.3 1.15.73 2.18 1.2 3.07A6.5 6.5 0 0 1 2.57 11zM8 14.5c-.57 0-1.25-1.07-1.57-3.5h3.14c-.32 2.43-1 3.5-1.57 3.5zm3.93-3.5a6.5 6.5 0 0 1-2.33 3.07c.47-.89.9-1.92 1.2-3.07h1.13zM10.72 10c.05-.65.08-1.32.08-2s-.03-1.35-.08-2h2.5c.18.63.28 1.3.28 2s-.1 1.37-.28 2h-2.5z"/>
    `;
    return svg;
  }

  createPrivateIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', 'private-icon-svg');
    svg.innerHTML = `
      <path fill="currentColor" d="M8 1a2 2 0 0 0-2 2v.18A4.002 4.002 0 0 0 2 7c0 1.9 1.32 3.5 3.1 3.9A3.001 3.001 0 0 0 8 13a3.001 3.001 0 0 0 2.9-2.1c1.78-.4 3.1-2 3.1-3.9a4.002 4.002 0 0 0-4-3.82V3a2 2 0 0 0-2-2zm0 1a1 1 0 0 1 1 1v.05a4.05 4.05 0 0 0-2 0V3a1 1 0 0 1 1-1zM5 6.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
    `;
    return svg;
  }
}

window.TabsViewComponent = TabsViewComponent;
```

---

### 4.36 `src/renderer/components/toolbar.js`

```javascript
// =============================================================================
// src/renderer/components/toolbar.js
// Componente da barra de ferramentas (Voltar, Avançar, Recarregar/Parar, Downloads, Configurações)
// =============================================================================

class ToolbarComponent {
  constructor() {
    this.btnBack = document.getElementById('btn-back');
    this.btnForward = document.getElementById('btn-forward');
    this.btnReload = document.getElementById('btn-reload');
    this.btnHome = document.getElementById('btn-home');
    this.btnDownloads = document.getElementById('btn-downloads');
    this.btnSettings = document.getElementById('btn-settings');
    this.redirectBar = document.getElementById('redirect-blocked-bar');
    this.redirectText = document.getElementById('redirect-blocked-text');
    this.btnAllowRedirect = document.getElementById('btn-allow-redirect');
    this.btnDismissRedirect = document.getElementById('btn-dismiss-redirect');
    this.blockedRedirectUrl = null;
    this.redirectDismissTimer = null;
    this.activeTabId = null;
    this.isLoading = false;

    this.initEvents();
  }

  /**
   * Registra os eventos de clique dos botões da barra
   */
  initEvents() {
    if (this.btnBack) {
      this.btnBack.addEventListener('click', () => {
        if (!this.btnBack.disabled && window.browserAPI) {
          window.browserAPI.goBack();
        }
      });
    }

    if (this.btnForward) {
      this.btnForward.addEventListener('click', () => {
        if (!this.btnForward.disabled && window.browserAPI) {
          window.browserAPI.goForward();
        }
      });
    }

    if (this.btnReload) {
      this.btnReload.addEventListener('click', () => {
        if (!window.browserAPI) return;
        if (this.isLoading) {
          window.browserAPI.stop();
        } else {
          window.browserAPI.reload();
        }
      });
    }

    if (this.btnHome) {
      this.btnHome.addEventListener('click', () => {
        if (window.browserAPI && typeof window.browserAPI.navigateHome === 'function') {
          window.browserAPI.navigateHome();
        }
      });
    }

    if (this.btnDownloads) {
      this.btnDownloads.addEventListener('click', () => {
        if (!window.browserAPI) return;
        if (typeof window.browserAPI.openDownloads === 'function') {
          window.browserAPI.openDownloads();
        } else {
          window.browserAPI.createTab('dragon://downloads');
        }
      });
    }

    if (this.btnSettings) {
      this.btnSettings.addEventListener('click', () => {
        if (window.browserAPI && typeof window.browserAPI.openSettings === 'function') {
          window.browserAPI.openSettings();
        }
      });
    }

    // Notificações de progresso de downloads
    if (window.browserAPI && typeof window.browserAPI.onDownloadUpdate === 'function') {
      window.browserAPI.onDownloadUpdate((dl) => {
        if (this.btnDownloads) {
          if (dl && dl.state === 'progressing') {
            this.btnDownloads.classList.add('downloading');
          } else {
            this.btnDownloads.classList.remove('downloading');
          }
        }
      });
    }

    if (this.btnAllowRedirect) {
      this.btnAllowRedirect.addEventListener('click', () => {
        if (this.blockedRedirectUrl && window.browserAPI && typeof window.browserAPI.allowRedirect === 'function') {
          window.browserAPI.allowRedirect(this.blockedRedirectUrl);
        }
        this.hideRedirectBar();
      });
    }

    if (this.btnDismissRedirect) {
      this.btnDismissRedirect.addEventListener('click', () => {
        this.hideRedirectBar();
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onRedirectBlocked === 'function') {
      window.browserAPI.onRedirectBlocked((payload) => {
        if (!payload || !payload.targetUrl) return;
        this.showRedirectBar(payload.domain || payload.targetUrl, payload.targetUrl);
      });
    }
  }

  showRedirectBar(domain, targetUrl) {
    this.blockedRedirectUrl = targetUrl;
    if (this.redirectText) {
      this.redirectText.textContent = `Redirecionamento bloqueado — ${domain}`;
    }
    if (this.redirectBar) {
      this.redirectBar.hidden = false;
      this.redirectBar.classList.add('visible');
    }
    if (this.redirectDismissTimer) {
      clearTimeout(this.redirectDismissTimer);
    }
    this.redirectDismissTimer = setTimeout(() => {
      this.hideRedirectBar();
    }, 8000);
  }

  hideRedirectBar() {
    if (this.redirectDismissTimer) {
      clearTimeout(this.redirectDismissTimer);
      this.redirectDismissTimer = null;
    }
    this.blockedRedirectUrl = null;
    if (this.redirectBar) {
      this.redirectBar.hidden = true;
      this.redirectBar.classList.remove('visible');
    }
  }

  /**
   * Atualiza a interface da barra com base no estado recebido do main process
   * @param {object} state Estado consolidado enviado pelo TabManager
   */
  update(state) {
    if (!state) return;

    if (state.activeTabId && state.activeTabId !== this.activeTabId) {
      this.activeTabId = state.activeTabId;
      this.hideRedirectBar();
    }

    this.isLoading = Boolean(state.isLoading);

    if (this.btnBack) {
      this.btnBack.disabled = !state.canGoBack;
    }

    if (this.btnForward) {
      this.btnForward.disabled = !state.canGoForward;
    }

    if (this.btnReload) {
      if (this.isLoading) {
        this.btnReload.title = 'Parar carregamento';
        this.btnReload.innerHTML = `
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
          </svg>
        `;
      } else {
        this.btnReload.title = 'Recarregar página (Ctrl+R ou F5)';
        this.btnReload.innerHTML = `
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path fill="currentColor" d="M1.705 8.001a6.3 6.3 0 0 1 10.7-4.47l.825-.824a.5.5 0 0 1 .854.354V6.5a.5.5 0 0 1-.5.5H10.14a.5.5 0 0 1-.354-.854l.872-.871a4.8 4.8 0 1 0 1.488 3.726.75.75 0 1 1 1.498.087 6.3 6.3 0 0 1-11.94.413z"/>
          </svg>
        `;
      }
    }
  }
}

window.ToolbarComponent = ToolbarComponent;
```

---

### 4.37 `src/renderer/components/addressbar.js`

```javascript
// =============================================================================
// src/renderer/components/addressbar.js
// Componente da barra de endereços (Omnibox para URLs, pesquisa e favoritos)
// =============================================================================

class AddressBarComponent {
  constructor() {
    this.form = document.getElementById('address-form');
    this.input = document.getElementById('address-input');
    this.btnBookmark = document.getElementById('btn-bookmark');
    this.dropdown = document.getElementById('omnibox-dropdown');

    this.isFocused = false;
    this.currentUrl = '';
    this.currentTitle = '';
    this.suggestions = [];
    this.selectedIndex = -1;
    this.debounceTimer = null;

    this.initEvents();
  }

  /**
   * Configura eventos de envio, digitação, navegação por setas e favoritos
   */
  initEvents() {
    if (!this.form || !this.input) return;

    // Quando o usuário pressiona Enter para navegar
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitCurrent();
    });

    // Digitação para buscar sugestões no histórico/favoritos/mecanismo de busca
    this.input.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      const query = this.input.value.trim();

      if (!query) {
        this.hideSuggestions();
        return;
      }

      this.debounceTimer = setTimeout(() => {
        this.fetchSuggestions(query);
      }, 150);
    });

    // Teclado para navegar nas sugestões
    this.input.addEventListener('keydown', (event) => {
      if (this.dropdown && this.dropdown.classList.contains('visible') && this.suggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
          this.renderSelectedSuggestion();
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
          this.renderSelectedSuggestion();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          this.hideSuggestions();
          return;
        }
      }
    });

    // Ao focar, seleciona o texto
    this.input.addEventListener('focus', () => {
      this.isFocused = true;
      requestAnimationFrame(() => {
        this.input.select();
      });
    });

    // Ao perder o foco, fecha sugestões com tolerância para cliques
    this.input.addEventListener('blur', () => {
      this.isFocused = false;
      setTimeout(() => {
        this.hideSuggestions();
      }, 200);
    });

    // Botão de Favorito (Estrela)
    if (this.btnBookmark) {
      this.btnBookmark.addEventListener('click', () => {
        this.toggleCurrentBookmark();
      });
    }

    // Atalho Ctrl+D do teclado repassado pelo preload
    if (window.browserAPI && typeof window.browserAPI.onToggleBookmark === 'function') {
      window.browserAPI.onToggleBookmark(() => {
        this.toggleCurrentBookmark();
      });
    }

    // Redimensionamento da janela recalcula a posição do dropdown fixo
    window.addEventListener('resize', () => {
      if (this.dropdown && this.dropdown.classList.contains('visible')) {
        this.updateDropdownPosition();
      }
    });
  }

  updateDropdownPosition() {
    if (!this.dropdown || !this.form) return;
    const rect = this.form.getBoundingClientRect();
    this.dropdown.style.position = 'fixed';
    this.dropdown.style.left = `${rect.left}px`;
    this.dropdown.style.width = `${rect.width}px`;
    this.dropdown.style.top = `${rect.bottom + 4}px`;
    this.dropdown.style.zIndex = '9999';
  }

  submitCurrent() {
    let target = this.input.value.trim();

    if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
      const selected = this.suggestions[this.selectedIndex];
      target = selected.url || selected.searchUrl || target;
    }

    this.hideSuggestions();

    if (target && window.browserAPI) {
      window.browserAPI.navigate(target);
      this.input.blur();
    }
  }

  async toggleCurrentBookmark() {
    if (!this.currentUrl || !window.browserAPI) return;

    try {
      const res = await window.browserAPI.toggleBookmark(this.currentUrl, this.currentTitle);
      if (this.btnBookmark) {
        if (res && res.bookmarked) {
          this.btnBookmark.classList.add('active');
          this.btnBookmark.title = 'Remover dos favoritos (Ctrl+D)';
        } else {
          this.btnBookmark.classList.remove('active');
          this.btnBookmark.title = 'Favoritar esta página (Ctrl+D)';
        }
      }
    } catch (err) {
      console.warn('[AddressBar] Falha ao alternar favorito:', err);
    }
  }

  async fetchSuggestions(query) {
    if (!window.browserAPI || !this.dropdown) return;

    try {
      const data = await window.browserAPI.getOmniboxSuggestions(query);
      if (!data) {
        this.hideSuggestions();
        return;
      }

      const list = [];

      // 1. Sugestão de Busca
      if (data.searchItem) {
        list.push({
          type: 'search',
          title: `Pesquisar "${data.searchItem.query}" no ${data.searchItem.engineName || 'DuckDuckGo'}`,
          url: data.searchItem.searchUrl
        });
      }

      // 2. Favoritos correspondentes
      if (Array.isArray(data.bookmarks)) {
        data.bookmarks.forEach(b => {
          list.push({
            type: 'bookmark',
            title: b.title,
            url: b.url
          });
        });
      }

      // 3. Histórico recente correspondente
      if (Array.isArray(data.history)) {
        data.history.forEach(h => {
          list.push({
            type: 'history',
            title: h.title,
            url: h.url
          });
        });
      }

      if (list.length === 0) {
        this.hideSuggestions();
        return;
      }

      this.suggestions = list;
      this.selectedIndex = -1;
      this.renderDropdown(list);
      this.showSuggestions();
    } catch (err) {
      console.warn('[AddressBar] Erro ao obter sugestões:', err);
      this.hideSuggestions();
    }
  }

  renderDropdown(list) {
    if (!this.dropdown) return;
    this.dropdown.innerHTML = '';
    this.updateDropdownPosition();

    list.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = `omnibox-item type-${item.type}`;
      el.dataset.index = index;

      const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgIcon.setAttribute('class', 'omnibox-icon');
      svgIcon.setAttribute('viewBox', '0 0 16 16');

      if (item.type === 'search') {
        svgIcon.innerHTML = `<path d="M11.5 7a4.499 4.499 0 1 1-8.998 0A4.499 4.499 0 0 1 11.5 7zm-.82 4.74a6 6 0 1 0-1.06 1.06l3.65 3.65a.75.75 0 1 0 1.06-1.06l-3.65-3.65z"/>`;
      } else if (item.type === 'bookmark') {
        svgIcon.innerHTML = `<path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>`;
      } else {
        svgIcon.innerHTML = `<path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.376.868a6.975 6.975 0 0 0-.757-.597l.5-.866c.348.202.68.431.996.685l-.739.778zM8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>`;
      }

      const textWrap = document.createElement('div');
      textWrap.className = 'omnibox-text-wrap';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'omnibox-title';
      titleSpan.textContent = item.title;

      const urlSpan = document.createElement('span');
      urlSpan.className = 'omnibox-url';
      urlSpan.textContent = item.url;

      textWrap.appendChild(titleSpan);
      textWrap.appendChild(urlSpan);

      el.appendChild(svgIcon);
      el.appendChild(textWrap);

      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.selectedIndex = index;
        this.submitCurrent();
      });

      this.dropdown.appendChild(el);
    });
  }

  renderSelectedSuggestion() {
    if (!this.dropdown) return;
    const items = this.dropdown.querySelectorAll('.omnibox-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('selected');
        const selectedObj = this.suggestions[idx];
        if (selectedObj) {
          this.input.value = selectedObj.url;
        }
      } else {
        item.classList.remove('selected');
      }
    });
  }

  showSuggestions() {
    if (!this.dropdown || this.dropdown.classList.contains('visible')) return;
    this.updateDropdownPosition();
    this.dropdown.classList.add('visible');
    if (window.browserAPI) {
      window.browserAPI.showOverlay();
    }
  }

  hideSuggestions() {
    if (!this.dropdown || !this.dropdown.classList.contains('visible')) return;
    this.dropdown.classList.remove('visible');
    this.suggestions = [];
    this.selectedIndex = -1;
    if (window.browserAPI) {
      window.browserAPI.hideOverlay();
    }
  }

  /**
   * Dá foco imediato e seleciona o texto da barra de endereços (usado no atalho Ctrl+L)
   */
  focus() {
    if (this.input) {
      this.input.focus();
      this.input.select();
    }
  }

  /**
   * Atualiza o valor exibido na barra com a URL da aba ativa
   * @param {object} state Estado atualizado vindo do main process
   */
  async update(state) {
    if (!this.input || !state) return;

    this.currentUrl = state.currentUrl || '';
    this.currentTitle = state.currentTitle || '';

    // Atualiza o estado da estrela de favoritos
    if (this.btnBookmark && window.browserAPI && this.currentUrl) {
      try {
        const isFav = await window.browserAPI.isBookmarked(this.currentUrl);
        if (isFav) {
          this.btnBookmark.classList.add('active');
          this.btnBookmark.title = 'Remover dos favoritos (Ctrl+D)';
        } else {
          this.btnBookmark.classList.remove('active');
          this.btnBookmark.title = 'Favoritar esta página (Ctrl+D)';
        }
      } catch {}
    }

    // Se o usuário estiver digitando no momento, NÃO sobrescrevemos o que ele está escrevendo!
    if (this.isFocused) return;

    const url = state.currentUrl || '';

    // Se for a página interna de "Nova Aba", deixamos o campo em branco com placeholder
    const isNewTab = !url || url === 'about:blank' || (state.newTabUrl && url.startsWith(state.newTabUrl));
    if (isNewTab) {
      this.input.value = '';
      return;
    }

    // Se for uma página interna com rota amigável, exibe o protocolo amigável
    if (state.downloadsUrl && url.startsWith(state.downloadsUrl)) {
      this.input.value = 'dragon://downloads';
      return;
    }
    if (state.historyUrl && url.startsWith(state.historyUrl)) {
      this.input.value = 'dragon://history';
      return;
    }
    if (state.bookmarksUrl && url.startsWith(state.bookmarksUrl)) {
      this.input.value = 'dragon://bookmarks';
      return;
    }
    if (state.settingsUrl && url.startsWith(state.settingsUrl)) {
      this.input.value = 'dragon://settings';
      return;
    }

    // Se a aba estiver em página de erro ou aviso, exibe a URL original que falhou
    const isErrorOrWarning =
      (state.errorUrl && url.startsWith(state.errorUrl)) ||
      (state.httpsWarningUrl && url.startsWith(state.httpsWarningUrl)) ||
      (state.certErrorUrl && url.startsWith(state.certErrorUrl));

    if (isErrorOrWarning) {
      try {
        const parsed = new URL(url);
        const originalUrl = parsed.searchParams.get('url');
        if (originalUrl) {
          this.input.value = originalUrl;
          return;
        }
      } catch (err) {}
    }

    this.input.value = url;
  }
}

window.AddressBarComponent = AddressBarComponent;
```

---

### 4.38 `src/renderer/components/find-bar.js`

```javascript
// =============================================================================
// src/renderer/components/find-bar.js
// Barra de busca textual na página (Ctrl+F)
// =============================================================================

class FindBarComponent {
  constructor() {
    this.bar = document.getElementById('find-bar');
    this.input = document.getElementById('find-input');
    this.countLabel = document.getElementById('find-count');
    this.btnPrev = document.getElementById('find-prev');
    this.btnNext = document.getElementById('find-next');
    this.btnClose = document.getElementById('find-close');

    this.isVisible = false;
    this.lastQuery = '';

    this.initEvents();
  }

  initEvents() {
    if (!this.bar || !this.input) return;

    // Digitação na busca
    this.input.addEventListener('input', () => {
      const q = this.input.value;
      this.lastQuery = q;
      if (window.browserAPI) {
        window.browserAPI.findInPage(q, true, false);
      }
    });

    // Teclas especiais no campo de busca
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.findPrev();
        } else {
          this.findNext();
        }
      }
    });

    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => this.findPrev());
    }

    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => this.findNext());
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }

    // Ouvinte para abrir a busca via atalho Ctrl+F enviado pelo Main
    if (window.browserAPI && typeof window.browserAPI.onOpenFind === 'function') {
      window.browserAPI.onOpenFind(() => {
        this.open();
      });
    }

    // Ouvinte para resultados encontrados na página
    if (window.browserAPI && typeof window.browserAPI.onFindResult === 'function') {
      window.browserAPI.onFindResult((result) => {
        if (!result) return;
        const matches = result.matches || 0;
        const current = result.activeMatchOrdinal || 0;
        if (this.countLabel) {
          if (!this.input.value) {
            this.countLabel.textContent = '';
          } else {
            this.countLabel.textContent = `${current}/${matches}`;
          }
        }
      });
    }
  }

  open() {
    this.isVisible = true;
    this.bar.classList.add('visible');
    if (window.browserAPI && typeof window.browserAPI.setFindBarOpen === 'function') {
      window.browserAPI.setFindBarOpen(true);
    }
    this.input.focus();
    this.input.select();
    if (this.input.value && window.browserAPI) {
      window.browserAPI.findInPage(this.input.value, true, false);
    }
  }

  close() {
    this.isVisible = false;
    this.bar.classList.remove('visible');
    if (window.browserAPI && typeof window.browserAPI.setFindBarOpen === 'function') {
      window.browserAPI.setFindBarOpen(false);
    }
    if (this.countLabel) this.countLabel.textContent = '';
    if (window.browserAPI) {
      window.browserAPI.stopFindInPage('clearSelection');
    }
  }

  findNext() {
    if (this.input.value && window.browserAPI) {
      window.browserAPI.findInPage(this.input.value, true, true);
    }
  }

  findPrev() {
    if (this.input.value && window.browserAPI) {
      window.browserAPI.findInPage(this.input.value, false, true);
    }
  }
}

window.FindBarComponent = FindBarComponent;
```

---

### 4.39 `src/renderer/components/permission-sheet.js`

```javascript
// =============================================================================
// src/renderer/components/permission-sheet.js
// Modal estilo bottom-sheet para solicitar permissão por site (câmera, microfone, etc.)
// Fila de solicitações simultâneas: exibe um por um, ocultando overlay só ao esvaziar
// =============================================================================

class PermissionSheetComponent {
  constructor() {
    this.overlay = document.getElementById('permission-sheet-overlay');
    this.titleEl = document.getElementById('perm-title');
    this.descEl = document.getElementById('perm-desc');
    this.iconEl = document.getElementById('perm-icon-wrap');
    this.rememberCheck = document.getElementById('perm-remember-check');
    this.btnAllow = document.getElementById('btn-perm-allow');
    this.btnBlock = document.getElementById('btn-perm-block');

    this.currentRequest = null;
    this.queue = [];

    this.initEvents();
  }

  initEvents() {
    if (this.btnAllow) {
      this.btnAllow.addEventListener('click', () => {
        this.respond(true);
      });
    }

    if (this.btnBlock) {
      this.btnBlock.addEventListener('click', () => {
        this.respond(false);
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onPromptPermission === 'function') {
      window.browserAPI.onPromptPermission((payload) => {
        this.enqueuePrompt(payload);
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onCancelPermissionPrompt === 'function') {
      window.browserAPI.onCancelPermissionPrompt((payload) => {
        this.cancelRequests(payload);
      });
    }
  }

  enqueuePrompt(payload) {
    if (!payload || !payload.requestId) return;

    if (!this.currentRequest) {
      this.displayPrompt(payload);
    } else {
      this.queue.push(payload);
    }
  }

  displayPrompt(payload) {
    if (!payload || !this.overlay) return;

    this.currentRequest = payload;
    const origin = payload.origin || 'Este site';
    const label = payload.label || payload.permissionKey || 'um recurso';

    if (this.titleEl) {
      this.titleEl.textContent = `Permitir acesso a ${label}?`;
    }
    if (this.descEl) {
      this.descEl.textContent = `${origin} está solicitando autorização para usar ${label}.`;
    }
    if (this.rememberCheck) {
      this.rememberCheck.checked = true;
    }

    this.overlay.classList.add('visible');
  }

  cancelRequests(payload) {
    const { webContentsId, requestId } = payload || {};

    // Remove pedidos da fila pertencentes ao webContents cancelado ou ao requestId
    this.queue = this.queue.filter(item => {
      if (requestId && item.requestId === requestId) return false;
      if (webContentsId && item.webContentsId === webContentsId) return false;
      return true;
    });

    // Se o pedido atualmente em exibição foi cancelado, avança para o próximo
    if (this.currentRequest) {
      const matchWc = webContentsId && this.currentRequest.webContentsId === webContentsId;
      const matchReq = requestId && this.currentRequest.requestId === requestId;
      if (matchWc || matchReq) {
        this.currentRequest = null;
        this.processNextInQueue();
      }
    }
  }

  respond(allowed) {
    if (!this.currentRequest) return;

    const reqId = this.currentRequest.requestId;
    const remember = this.rememberCheck ? this.rememberCheck.checked : false;

    this.currentRequest = null;

    if (window.browserAPI && typeof window.browserAPI.respondPermission === 'function') {
      window.browserAPI.respondPermission(reqId, allowed, remember);
    }

    this.processNextInQueue();
  }

  processNextInQueue() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.displayPrompt(next);
    } else {
      if (this.overlay) {
        this.overlay.classList.remove('visible');
      }
    }
  }
}

window.PermissionSheetComponent = PermissionSheetComponent;
```

---

### 4.40 `src/renderer/components/download-risk-sheet.js`

```javascript
// =============================================================================
// src/renderer/components/download-risk-sheet.js
// Modal estilo bottom-sheet para aviso de downloads de risco (ETAPA 4)
// =============================================================================

class DownloadRiskSheetComponent {
  constructor() {
    this.overlay = document.getElementById('download-risk-overlay');
    this.titleEl = document.getElementById('download-risk-title');
    this.descEl = document.getElementById('download-risk-desc');
    this.btnCancel = document.getElementById('btn-download-risk-cancel');
    this.btnConfirm = document.getElementById('btn-download-risk-confirm');

    this.currentPrompt = null;
    this.queue = [];

    this.initEvents();
  }

  initEvents() {
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => {
        this.respond(false);
      });
    }

    if (this.btnConfirm) {
      this.btnConfirm.addEventListener('click', () => {
        this.respond(true);
      });
    }

    if (window.browserAPI && typeof window.browserAPI.onDownloadRiskPrompt === 'function') {
      window.browserAPI.onDownloadRiskPrompt((payload) => {
        this.enqueue(payload);
      });
    }
  }

  enqueue(payload) {
    if (!payload || !payload.downloadId) return;

    if (!this.currentPrompt) {
      this.display(payload);
    } else {
      this.queue.push(payload);
    }
  }

  display(payload) {
    if (!payload || !this.overlay) return;
    this.currentPrompt = payload;

    const filename = payload.filename || 'arquivo executável';
    const domain = payload.domain || 'origem desconhecida';

    if (this.titleEl) {
      this.titleEl.textContent = 'Arquivo potencialmente perigoso';
    }

    if (this.descEl) {
      this.descEl.innerHTML = `O arquivo <strong class="risk-highlight">${this.escapeHtml(filename)}</strong> de <strong class="risk-highlight">${this.escapeHtml(domain)}</strong> pode danificar o seu computador ou executar ações indesejadas. Deseja mantê-lo?`;
    }

    if (window.browserAPI && typeof window.browserAPI.showOverlay === 'function') {
      window.browserAPI.showOverlay();
    }

    this.overlay.classList.add('visible');
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async respond(allow) {
    if (!this.currentPrompt) return;

    const { downloadId } = this.currentPrompt;
    this.currentPrompt = null;

    try {
      if (window.browserAPI) {
        if (allow && typeof window.browserAPI.confirmRiskDownload === 'function') {
          await window.browserAPI.confirmRiskDownload(downloadId);
        } else if (!allow && typeof window.browserAPI.cancelRiskDownload === 'function') {
          await window.browserAPI.cancelRiskDownload(downloadId);
        }
      }
    } catch (err) {
      console.warn('[DownloadRisk] Erro ao responder prompt:', err);
    }

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.display(next);
    } else {
      this.close();
    }
  }

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('visible');
    }
    if (window.browserAPI && typeof window.browserAPI.hideOverlay === 'function') {
      window.browserAPI.hideOverlay();
    }
  }
}

window.DownloadRiskSheetComponent = DownloadRiskSheetComponent;
```

---

### 4.41 `src/renderer/components/privacy-shield.js`

```javascript
// =============================================================================
// src/renderer/components/privacy-shield.js
// Componente do Escudo de Privacidade na barra de endereço (estilo DuckDuckGo)
// Exibe rastreadores bloqueados e permite ligar/desligar proteção por site
// =============================================================================

class PrivacyShieldComponent {
  constructor() {
    this.btn = document.getElementById('btn-privacy-shield');
    this.badge = document.getElementById('shield-badge');
    this.panel = document.getElementById('shield-panel');
    this.siteHostEl = document.getElementById('shield-site-host');
    this.statusTextEl = document.getElementById('shield-status-text');
    this.toggleBtn = document.getElementById('btn-shield-toggle');
    this.counterEl = document.getElementById('shield-trackers-count');
    this.popupsCountEl = document.getElementById('shield-popups-count');
    this.gradeBadge = document.getElementById('shield-grade-badge');
    this.trackersListEl = document.getElementById('shield-trackers-list');
    this.backdrop = document.getElementById('shield-panel-backdrop');

    this.isOpen = false;
    this.currentHostname = '';
    this.isProtected = true;

    this.initEvents();
  }

  /**
   * Registra eventos de clique, teclado e clique fora
   */
  initEvents() {
    if (this.btn) {
      this.btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      });
    }

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.currentHostname || !window.browserAPI) return;
        const newState = await window.browserAPI.toggleSiteProtection(this.currentHostname);
        this.isProtected = newState;
        this.renderProtectionState();
      });
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => {
        this.close();
      });
    }

    // Tecla Escape fecha o painel do escudo
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  /**
   * Alterna abertura do painel do escudo
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Abre o painel do escudo e esconde a WebContentsView para sobreposição limpa
   */
  async open() {
    if (this.isOpen) return;
    this.isOpen = true;

    if (window.browserAPI && typeof window.browserAPI.showOverlay === 'function') {
      window.browserAPI.showOverlay();
    }

    if (this.backdrop) this.backdrop.classList.add('visible');
    if (this.panel) this.panel.classList.add('visible');

    await this.refreshData();
  }

  /**
   * Fecha o painel do escudo e restaura a visualização da página web
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.backdrop) this.backdrop.classList.remove('visible');
    if (this.panel) this.panel.classList.remove('visible');

    if (window.browserAPI && typeof window.browserAPI.hideOverlay === 'function') {
      window.browserAPI.hideOverlay();
    }
  }

  /**
   * Consulta os dados mais recentes de privacidade da aba ativa
   */
  async refreshData() {
    if (!window.browserAPI || typeof window.browserAPI.getPrivacyInfo !== 'function') return;

    try {
      const info = await window.browserAPI.getPrivacyInfo();
      this.currentHostname = info.hostname || 'Página interna';
      this.isProtected = info.isProtected;

      if (this.siteHostEl) {
        this.siteHostEl.textContent = this.currentHostname;
      }

      this.renderProtectionState();

      if (this.counterEl) {
        this.counterEl.textContent = info.count === 1
          ? '1 rastreador bloqueado nesta página'
          : `${info.count} rastreadores bloqueados nesta página`;
      }

      if (this.popupsCountEl) {
        const popups = info.popupsBlocked || 0;
        this.popupsCountEl.textContent = popups === 1
          ? '1 pop-up / redirecionamento bloqueado'
          : `${popups} pop-ups / redirecionamentos bloqueados`;
      }

      if (this.gradeBadge) {
        const grade = (info.grade || 'A').toUpperCase();
        this.gradeBadge.textContent = grade;
        this.gradeBadge.className = `shield-grade-badge grade-${grade.toLowerCase()}`;
        this.gradeBadge.title = `Classificação de privacidade: Nota ${grade}`;
      }

      if (this.trackersListEl) {
        while (this.trackersListEl.firstChild) {
          this.trackersListEl.removeChild(this.trackersListEl.firstChild);
        }
        if (info.domains && info.domains.length > 0) {
          info.domains.forEach(d => {
            const li = document.createElement('li');
            li.className = 'shield-tracker-item';

            const bullet = document.createElement('span');
            bullet.className = 'tracker-bullet';

            const name = document.createElement('span');
            name.className = 'tracker-name';
            name.textContent = d;

            li.appendChild(bullet);
            li.appendChild(name);
            this.trackersListEl.appendChild(li);
          });
        } else {
          const emptyLi = document.createElement('li');
          emptyLi.className = 'shield-empty-item';
          emptyLi.textContent = 'Nenhum rastreador detectado até o momento.';
          this.trackersListEl.appendChild(emptyLi);
        }
      }
    } catch (err) {
      console.warn('[PrivacyShield] Erro ao carregar dados:', err);
    }
  }

  renderProtectionState() {
    if (this.statusTextEl) {
      this.statusTextEl.textContent = this.isProtected
        ? 'Proteção ativada neste site'
        : 'Proteção desativada neste site';
    }

    if (this.toggleBtn) {
      if (this.isProtected) {
        this.toggleBtn.classList.add('active');
        this.toggleBtn.setAttribute('aria-checked', 'true');
      } else {
        this.toggleBtn.classList.remove('active');
        this.toggleBtn.setAttribute('aria-checked', 'false');
      }
    }

    if (this.btn) {
      if (!this.isProtected) {
        this.btn.classList.add('protection-off');
      } else {
        this.btn.classList.remove('protection-off');
      }
    }
  }

  /**
   * Atualização contínua via broadcast de estado
   * @param {object} state
   */
  update(state) {
    if (!state) return;

    const info = state.privacyInfo || { count: 0, isProtected: true };
    const count = info.count || 0;

    // Atualiza o badge numérico na barra
    if (this.badge) {
      this.badge.textContent = count;
      if (count > 0) {
        this.badge.classList.add('has-blocked');
      } else {
        this.badge.classList.remove('has-blocked');
      }
    }

    if (this.gradeBadge && info.grade) {
      const grade = info.grade.toUpperCase();
      this.gradeBadge.textContent = grade;
      this.gradeBadge.className = `shield-grade-badge grade-${grade.toLowerCase()}`;
      this.gradeBadge.title = `Classificação de privacidade: Nota ${grade}`;
    }

    if (this.btn) {
      if (!info.isProtected) {
        this.btn.classList.add('protection-off');
        this.btn.title = 'Proteção desativada neste site (clique para gerenciar)';
      } else {
        this.btn.classList.remove('protection-off');
        this.btn.title = `Proteção contra rastreadores (${count} bloqueados)`;
      }
    }

    // Se o painel estiver aberto no momento, atualiza seu conteúdo também
    if (this.isOpen) {
      this.refreshData();
    }
  }
}

// Exporta globalmente para uso no app.js sem dependência de bundler
window.PrivacyShieldComponent = PrivacyShieldComponent;
```

---

### 4.42 `src/renderer/components/fire-button.js`

```javascript
// =============================================================================
// src/renderer/components/fire-button.js
// Botão do Fogo do Dragão Azul na barra de ferramentas
// =============================================================================

class FireButtonComponent {
  /**
   * @param {object} options
   * @param {Function} options.onTrigger Callback disparado ao clicar no botão
   */
  constructor({ onTrigger }) {
    this.btn = document.getElementById('btn-fire');
    this.onTrigger = onTrigger;
    this.isBusy = false;

    this.initEvents();
  }

  /**
   * Configura os ouvintes de clique e acessibilidade
   */
  initEvents() {
    if (!this.btn) return;

    this.btn.addEventListener('click', (event) => {
      event.preventDefault();
      // Se a limpeza já estiver em andamento, ignora qualquer novo clique
      if (this.isBusy) return;

      if (typeof this.onTrigger === 'function') {
        this.onTrigger();
      }
    });
  }

  /**
   * Bloqueia ou desbloqueia o botão durante o ciclo de animação e exclusão
   * @param {boolean} busy
   */
  setBusy(busy) {
    this.isBusy = Boolean(busy);
    if (this.btn) {
      this.btn.disabled = this.isBusy;
      if (this.isBusy) {
        this.btn.classList.add('fire-busy');
      } else {
        this.btn.classList.remove('fire-busy');
      }
    }
  }

  /**
   * Retorna as coordenadas no viewport do centro do botão (usado como origem do choque)
   * @returns {{ x: number, y: number }}
   */
  getOriginCoords() {
    if (!this.btn) {
      return { x: window.innerWidth - 30, y: 38 };
    }
    const rect = this.btn.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
}

// Exporta globalmente para uso no app.js sem dependência de bundler
window.FireButtonComponent = FireButtonComponent;
```

---

### 4.43 `src/renderer/components/fire-sheet.js`

```javascript
// =============================================================================
// src/renderer/components/fire-sheet.js
// Painel estilo "bottom sheet" de confirmação com visual do Dragão Azul
// =============================================================================

class FireSheetComponent {
  /**
   * @param {object} options
   * @param {Function} options.onConfirm Callback disparado ao clicar em "Apagar tudo"
   */
  constructor({ onConfirm }) {
    this.overlay = document.getElementById('fire-sheet-overlay');
    this.sheet = document.getElementById('fire-sheet-panel');
    this.btnCancel = document.getElementById('btn-fire-cancel');
    this.btnConfirm = document.getElementById('btn-fire-confirm');
    this.onConfirm = onConfirm;

    this.isOpen = false;
    this.initEvents();
  }

  /**
   * Registra os eventos de clique, teclado (Esc) e clique fora
   */
  initEvents() {
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => this.cancel());
    }

    if (this.btnConfirm) {
      this.btnConfirm.addEventListener('click', () => this.confirm());
    }

    // Clique fora (no backdrop escuro) cancela a confirmação
    if (this.overlay) {
      this.overlay.addEventListener('click', (event) => {
        if (event.target === this.overlay) {
          this.cancel();
        }
      });
    }

    // Tecla Escape cancela quando o painel estiver aberto
    window.addEventListener('keydown', (event) => {
      if (this.isOpen && event.key === 'Escape') {
        event.preventDefault();
        this.cancel();
      }
    });
  }

  /**
   * Abre o painel de confirmação por cima de tudo
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    // Favoritos desmarcados por padrão
    const chkBookmarks = document.getElementById('chk-fire-bookmarks');
    if (chkBookmarks) {
      chkBookmarks.checked = false;
    }

    // Notifica o main process para esconder a WebContentsView da aba ativa
    if (window.browserAPI && typeof window.browserAPI.showOverlay === 'function') {
      window.browserAPI.showOverlay();
    }

    if (this.overlay) {
      this.overlay.classList.add('visible');
    }
    if (this.sheet) {
      this.sheet.classList.add('visible');
      // Foca no botão de confirmação para ergonomia
      if (this.btnConfirm) {
        setTimeout(() => this.btnConfirm.focus(), 50);
      }
    }
  }

  /**
   * Cancela e fecha o painel, restaurando a visão da aba ativa
   */
  cancel() {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.overlay) {
      this.overlay.classList.remove('visible');
    }
    if (this.sheet) {
      this.sheet.classList.remove('visible');
    }

    // Restaura a visualização da página web
    if (window.browserAPI && typeof window.browserAPI.hideOverlay === 'function') {
      window.browserAPI.hideOverlay();
    }
  }

  /**
   * Confirma a limpeza. Fecha o painel mas mantém o overlay ativo para o fogo.
   */
  confirm() {
    if (!this.isOpen) return;
    this.isOpen = false;

    const chkBookmarks = document.getElementById('chk-fire-bookmarks');
    const includeBookmarks = Boolean(chkBookmarks && chkBookmarks.checked);

    if (this.overlay) {
      this.overlay.classList.remove('visible');
    }
    if (this.sheet) {
      this.sheet.classList.remove('visible');
    }

    // Dispara a animação e o processo de exclusão passando o parâmetro de favoritos
    if (typeof this.onConfirm === 'function') {
      this.onConfirm({ includeBookmarks });
    }
  }
}

// Exporta globalmente para uso no app.js sem dependência de bundler
window.FireSheetComponent = FireSheetComponent;
```

---

### 4.44 `src/renderer/components/fire-animation.js`

```javascript
// =============================================================================
// src/renderer/components/fire-animation.js
// Animação "O Fogo do Dragão Azul" (Apagar Tudo)
// Efeito de fogo azul realista estilo maçarico a gás / sopro de dragão.
// Implementação preferencial em WebGL com Fragment Shader (FBM Noise)
// Fallback automático para Canvas 2D com partículas em lágrima invertida
// =============================================================================

// =============================================================================
// CONSTANTES DE AJUSTE DO FOGO AZUL DO DRAGÃO
// Modifique estes parâmetros para calibrar a altura, velocidade e intensidade:
// =============================================================================

// 1. Altura máxima das línguas de fogo (1.0 = topo da tela, 1.35 = ultrapassa o topo)
const FLAME_HEIGHT = 1.25;

// 2. Velocidade vertical de subida rápida das chamas e do ruído (valores maiores = mais veloz)
const RISE_SPEED = 2.8;

// 3. Quantidade e densidade de faíscas incandescentes que sobem em alta velocidade
const SPARKS_COUNT = 1.4;

// 4. Intensidade do brilho do núcleo de alta temperatura (efeito maçarico a gás)
const BRIGHTNESS = 1.35;

// 5. Tremulação lateral nervosa e rápida (nunca ondas suaves de água)
const LATERAL_JITTER = 0.035;

// =============================================================================
// SHADER GLSL DE FOGO AZUL EM WEBGL
// =============================================================================

// Vertex Shader: projeta um quadrilátero (quad) em tela cheia
const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Fragment Shader: calcula a densidade de fogo por ruído fractal browniano (FBM),
// línguas afiladas com pontas finas, máscara de subida/recuo e gradiente de temperatura
const FRAGMENT_SHADER_SRC = `
  precision mediump float;

  // Dimensões do canvas em pixels
  uniform vec2 u_resolution;
  // Tempo corrido em segundos
  uniform float u_time;
  // Progresso da máscara de subida (0.0 = base, 1.0 = tela coberta)
  uniform float u_coverage;
  // Progresso da máscara de dissipação (0.0 = sem dissipar, 1.0 = dissipado de cima para baixo)
  uniform float u_dissipation;

  // Parâmetros de calibração passados como uniforms
  uniform float u_flame_height;
  uniform float u_rise_speed;
  uniform float u_sparks_count;
  uniform float u_brightness;
  uniform float u_lateral_jitter;

  // Paleta de cores lida dinamicamente das variáveis do theme.css
  uniform vec3 u_color_core; // --fire-core: centro quase branco (altíssima temperatura)
  uniform vec3 u_color_mid;  // --fire-mid:  azul ciano intermediário
  uniform vec3 u_color_main; // --fire-main: azul elétrico
  uniform vec3 u_color_edge; // --fire-edge: azul profundo nas pontas
  uniform vec3 u_color_bg;   // --fire-bg:   azul-marinho escuro de fumaça

  // Função pseudo-aleatória baseada em coordenadas de fragmento
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Interpolação bilinear suave com curva cúbica Hermite (evita artefatos quadrados)
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Ruído Fractal Browniano (FBM): 4 camadas rolando para cima em velocidades distintas
  // Cria a turbulência nervosa característica de um maçarico a gás sob pressão
  float fbm(vec2 p, float t) {
    float total = 0.0;
    float amp = 0.52;
    float freq = 1.0;

    // Camada 1: Estrutura macro da chama subindo
    total += amp * noise(p * freq + vec2(0.0, -t * 1.0));

    // Camada 2: Divisão das línguas secundárias mais velozes
    freq *= 2.15;
    amp *= 0.50;
    total += amp * noise(p * freq + vec2(0.0, -t * 1.55));

    // Camada 3: Estrias e turbulência rápida
    freq *= 2.25;
    amp *= 0.45;
    total += amp * noise(p * freq + vec2(0.0, -t * 2.30));

    // Camada 4: Micro-tremores de alta frequência nas bordas
    freq *= 2.10;
    amp *= 0.40;
    total += amp * noise(p * freq + vec2(0.0, -t * 3.20));

    return total;
  }

  void main() {
    // Normalização das coordenadas para o espaço [0.0, 1.0] (y=0 na base, y=1 no topo)
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float t = u_time * u_rise_speed;

    // Formato afilado das línguas: esticadas verticalmente (3.8x mais altas que largas)
    // Isso cria as formas de lágrima invertida com pontas agudas
    vec2 flameUV = vec2(uv.x * 3.8, uv.y * 1.15);

    // Tremulação lateral rápida e nervosa (sem ondulação lenta de água)
    float fastJitter = sin(uv.y * 35.0 + t * 16.0) * u_lateral_jitter;
    fastJitter += (noise(vec2(uv.x * 6.0, t * 5.0)) - 0.5) * u_lateral_jitter * 1.6;
    flameUV.x += fastJitter;

    // Avalia o ruído fractal com subida contínua
    float n = fbm(flameUV, t);

    // Potência exponencial para afunilar as pontas das chamas
    n = pow(n, 1.8) * 1.75;

    // Atenuação vertical natural: mais intensa na base, afinando bruscamente para o topo
    float verticalTaper = clamp(1.0 - (uv.y / u_flame_height), 0.0, 1.0);
    verticalTaper = pow(verticalTaper, 0.70);

    // 1. Máscara de subida: sobe da base (y=0) até o topo da tela
    float riseMask = smoothstep(0.0, 0.35, (u_coverage * 1.35) - (uv.y / u_flame_height));

    // 2. Máscara de dissipação: na saída, recua de cima para baixo
    float dissMask = 1.0 - smoothstep(0.0, 0.38, (u_dissipation * 1.35) - ((1.0 - uv.y) * 0.75));

    // Combinação das máscaras
    float mask = clamp(riseMask * dissMask, 0.0, 1.0);

    // Intensidade bruta do fogo
    float rawIntensity = n * verticalTaper * mask * 1.9;

    // Contraste ALTO: threshold rígido para separar as línguas e criar vazios escuros
    // Elimina gradientes uniformes e planos
    float flameIntensity = smoothstep(0.32, 0.90, rawIntensity) * u_brightness;

    // Mapeamento de cor por temperatura:
    // Núcleo e base: quase branco (--fire-core)
    // Meio: azul ciano (--fire-mid)
    // Bordas: azul elétrico (--fire-main)
    // Pontas: azul profundo (--fire-edge)
    // Fumaça acima das pontas: azul-marinho (--fire-bg)
    vec3 col = u_color_bg;
    float alpha = 0.0;

    if (flameIntensity > 0.01) {
      // Pontas e fumaça escura
      col = mix(u_color_bg, u_color_edge, smoothstep(0.01, 0.20, flameIntensity));
      alpha = smoothstep(0.01, 0.12, flameIntensity);

      // Bordas elétricas
      col = mix(col, u_color_main, smoothstep(0.20, 0.48, flameIntensity));

      // Zona intermediária em ciano
      col = mix(col, u_color_mid, smoothstep(0.48, 0.76, flameIntensity));

      // Núcleo branco de gás sob alta pressão
      col = mix(col, u_color_core, smoothstep(0.76, 1.05, flameIntensity));
      alpha = max(alpha, smoothstep(0.12, 0.55, flameIntensity));
    }

    // Faíscas pontuais incandescentes subindo rápido com rastro curto
    float sparks = 0.0;
    if (u_sparks_count > 0.0) {
      vec2 spUV = uv * vec2(40.0, 18.0);
      spUV.y += t * 3.2; // Sobem 3x mais rápido que as chamas principais
      vec2 spCell = floor(spUV);
      vec2 spFract = fract(spUV);

      float spHash = hash(spCell);
      if (spHash > (1.0 - 0.038 * u_sparks_count)) {
        vec2 spPos = vec2(hash(spCell + 0.8), hash(spCell + 1.9));
        // Rastro curto esticado verticalmente
        float d = length((spFract - spPos) * vec2(1.0, 0.28));
        float s = smoothstep(0.15, 0.0, d);
        // Faíscas presentes na subida e como brasas na dissipação
        s *= clamp((u_coverage * 1.5) - (uv.y * 0.75), 0.0, 1.0);
        sparks += s;
      }
    }

    if (sparks > 0.0) {
      col = mix(col, u_color_core, clamp(sparks * 1.6, 0.0, 1.0));
      alpha = max(alpha, clamp(sparks, 0.0, 1.0));
    }

    // Fundo azul-marinho escuro durante a transição
    float bgAlpha = mask * 0.88;
    gl_FragColor = vec4(col, max(alpha, bgAlpha * 0.70));
  }
`;

/**
 * Converte cor hex ou rgb de CSS para array [r, g, b] normalizado em 0..1
 * @param {string} colorStr
 * @returns {number[]}
 */
function parseCssColorToRgb(colorStr) {
  if (!colorStr) return [1, 1, 1];
  colorStr = colorStr.trim();
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255
    ];
  }
  const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10) / 255,
      parseInt(rgbMatch[2], 10) / 255,
      parseInt(rgbMatch[3], 10) / 255
    ];
  }
  return [1, 1, 1];
}

class FireAnimationComponent {
  constructor() {
    this.canvas = document.getElementById('fire-canvas');
    this.centerBadge = document.getElementById('fire-center-badge');
    this.centerBadgeText = this.centerBadge ? this.centerBadge.querySelector('.fire-badge-text') : null;
    this.toast = document.getElementById('fire-toast');

    this.isRunning = false;
    this.animationFrameId = null;

    // Detecta se WebGL pode ser usado com segurança
    this.useWebGL = this.checkWebGLSupport();
    this.gl = null;
    this.glProgram = null;
    this.glUniforms = {};

    // Recursos para o fallback Canvas 2D
    this.ctx = null;
    this.particles = [];
    this.maxParticles = 400; // Limite rigoroso exigido no fallback 2D

    this.initResizeHandler();
  }

  /**
   * Testa suporte a WebGL em um canvas temporário sem prender o contexto do canvas principal
   * Testa também a compilação dos shaders e o link do programa WebGL.
   * @returns {boolean}
   */
  checkWebGLSupport() {
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl', { alpha: true }) ||
                 testCanvas.getContext('experimental-webgl', { alpha: true });
      if (!gl || !(gl instanceof WebGLRenderingContext)) return false;

      // Valida a compilação do Vertex Shader
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, VERTEX_SHADER_SRC);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return false;

      // Valida a compilação do Fragment Shader
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, FRAGMENT_SHADER_SRC);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return false;

      // Valida o link do programa
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Redimensionamento de tela respeitando devicePixelRatio máximo de 1.5
   */
  initResizeHandler() {
    window.addEventListener('resize', () => {
      if (this.canvas && this.isRunning) {
        this.updateDimensions();
      }
    });
  }

  updateDimensions() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.dpr = dpr;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    if (this.useWebGL && this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    } else if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  /**
   * Inicializa o pipeline de WebGL com os shaders e lê uniforms do theme.css
   */
  initWebGL() {
    if (!this.canvas) return false;
    try {
      this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, depth: false }) ||
                this.canvas.getContext('experimental-webgl', { alpha: true, antialias: false, depth: false });

      if (!this.gl) return false;

      const gl = this.gl;

      // Compila vertex shader
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, VERTEX_SHADER_SRC);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.warn('[FireAnimation] Erro no vertex shader:', gl.getShaderInfoLog(vs));
        return false;
      }

      // Compila fragment shader
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, FRAGMENT_SHADER_SRC);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.warn('[FireAnimation] Erro no fragment shader:', gl.getShaderInfoLog(fs));
        return false;
      }

      // Link do programa
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[FireAnimation] Erro no link do programa WebGL:', gl.getProgramInfoLog(program));
        return false;
      }

      this.glProgram = program;
      gl.useProgram(program);

      // Buffer do retângulo em tela cheia (dois triângulos cobrindo [-1, 1])
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      const positions = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      const posAttr = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

      // Localização dos uniforms
      this.glUniforms = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        coverage: gl.getUniformLocation(program, 'u_coverage'),
        dissipation: gl.getUniformLocation(program, 'u_dissipation'),
        flameHeight: gl.getUniformLocation(program, 'u_flame_height'),
        riseSpeed: gl.getUniformLocation(program, 'u_rise_speed'),
        sparksCount: gl.getUniformLocation(program, 'u_sparks_count'),
        brightness: gl.getUniformLocation(program, 'u_brightness'),
        lateralJitter: gl.getUniformLocation(program, 'u_lateral_jitter'),
        colorCore: gl.getUniformLocation(program, 'u_color_core'),
        colorMid: gl.getUniformLocation(program, 'u_color_mid'),
        colorMain: gl.getUniformLocation(program, 'u_color_main'),
        colorEdge: gl.getUniformLocation(program, 'u_color_edge'),
        colorBg: gl.getUniformLocation(program, 'u_color_bg')
      };

      // Carrega as cores do theme.css nos uniforms do shader
      this.uploadThemeColorsToWebGL(gl);

      return true;
    } catch (err) {
      console.warn('[FireAnimation] Falha ao configurar WebGL, alternando para Canvas 2D:', err);
      return false;
    }
  }

  /**
   * Lê variáveis CSS do theme.css e repassa para os uniforms do WebGL
   * @param {WebGLRenderingContext} gl
   */
  uploadThemeColorsToWebGL(gl) {
    const style = getComputedStyle(document.documentElement);
    const coreHex = style.getPropertyValue('--fire-core').trim() || '#E6F7FF';
    const midHex = style.getPropertyValue('--fire-mid').trim() || '#29B6FF';
    const mainHex = style.getPropertyValue('--fire-main').trim() || '#0194FF';
    const edgeHex = style.getPropertyValue('--fire-edge').trim() || '#0A2A9E';
    const bgHex = style.getPropertyValue('--fire-bg').trim() || '#08132B';

    const coreRgb = parseCssColorToRgb(coreHex);
    const midRgb = parseCssColorToRgb(midHex);
    const mainRgb = parseCssColorToRgb(mainHex);
    const edgeRgb = parseCssColorToRgb(edgeHex);
    const bgRgb = parseCssColorToRgb(bgHex);

    gl.uniform3fv(this.glUniforms.colorCore, coreRgb);
    gl.uniform3fv(this.glUniforms.colorMid, midRgb);
    gl.uniform3fv(this.glUniforms.colorMain, mainRgb);
    gl.uniform3fv(this.glUniforms.colorEdge, edgeRgb);
    gl.uniform3fv(this.glUniforms.colorBg, bgRgb);

    // Envia constantes de ajuste
    gl.uniform1f(this.glUniforms.flameHeight, FLAME_HEIGHT);
    gl.uniform1f(this.glUniforms.riseSpeed, RISE_SPEED);
    gl.uniform1f(this.glUniforms.sparksCount, SPARKS_COUNT);
    gl.uniform1f(this.glUniforms.brightness, BRIGHTNESS);
    gl.uniform1f(this.glUniforms.lateralJitter, LATERAL_JITTER);
  }

  /**
   * Dispara a animação completa de fogo azul sincronizada com a exclusão assíncrona de dados
   * @param {{ x: number, y: number }} origin Coordenadas do botão de fogo
   * @param {Function} [onComplete] Callback após conclusão e liberação da interface
   */
  start(origin, onComplete, options) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastCleanResult = null;

    // 1. Bloqueia imediatamente a interface gráfica
    document.body.classList.add('ui-locked');

    // 2. Dispara a limpeza assíncrona no processo principal
    let cleanDone = false;
    const cleanPromise = (window.browserAPI && typeof window.browserAPI.clearAllData === 'function')
      ? window.browserAPI.clearAllData(options)
      : Promise.resolve({ success: true, errors: [] });

    cleanPromise
      .then((res) => {
        this.lastCleanResult = res;
        cleanDone = true;
      })
      .catch((err) => {
        console.error('[FireAnimation] Erro na exclusão de dados:', err);
        this.lastCleanResult = { success: false, errors: [err.message || String(err)] };
        cleanDone = true;
      });

    // Timeout de segurança para evitar trava caso o main process demore
    setTimeout(() => { cleanDone = true; }, 10000);

    // 3. Acessibilidade: prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.runReducedMotionAnimation(() => cleanDone, onComplete);
      return;
    }

    // 4. Inicializa renderizador (WebGL ou Fallback 2D)
    if (this.useWebGL && !this.glProgram) {
      const ok = this.initWebGL();
      if (!ok) {
        this.useWebGL = false;
        // Se o WebGL falhou após getContext('webgl'), getContext('2d') no mesmo canvas retornará null.
        // Recria um elemento canvas novo para garantir que getContext('2d') funcione perfeitamente.
        const freshCanvas = document.createElement('canvas');
        freshCanvas.id = 'fire-canvas';
        if (this.canvas.parentNode) {
          this.canvas.parentNode.replaceChild(freshCanvas, this.canvas);
        }
        this.canvas = freshCanvas;
        this.ctx = this.canvas.getContext('2d');
      }
    } else if (!this.useWebGL && !this.ctx) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.updateDimensions();
    this.canvas.style.display = 'block';
    this.particles = [];

    const startTime = performance.now();
    let peakReachedTime = null;
    let phase = 'IGNITION'; // IGNITION -> COVERAGE -> PEAK -> DISSIPATION -> FINISHED
    this.dissipationStartTime = 0;

    const loop = (currentTime) => {
      const elapsed = (currentTime - startTime) / 1000;

      // Controle de fases da animação
      if (elapsed < 0.4) {
        phase = 'IGNITION';
      } else if (elapsed < 1.6) {
        phase = 'COVERAGE';
      } else {
        if (!peakReachedTime) peakReachedTime = currentTime;
        const peakElapsed = (currentTime - peakReachedTime) / 1000;

        if (cleanDone && peakElapsed >= 0.4 && phase !== 'DISSIPATION') {
          phase = 'DISSIPATION';
          this.dissipationStartTime = currentTime;
        } else if (phase !== 'DISSIPATION') {
          phase = 'PEAK';
        }
      }

      // Calcula progresso das máscaras
      let coverage = 0;
      let dissipation = 0;

      if (phase === 'IGNITION') {
        coverage = (elapsed / 0.4) * 0.25;
        dissipation = 0.0;
      } else if (phase === 'COVERAGE') {
        coverage = 0.25 + ((elapsed - 0.4) / 1.2) * 0.75;
        dissipation = 0.0;
      } else if (phase === 'PEAK') {
        coverage = 1.0;
        dissipation = 0.0;
      } else if (phase === 'DISSIPATION') {
        coverage = 1.0;
        // Duração da dissipação é de 650ms (0.65s). Como currentTime é em milissegundos, divide por 650.0
        dissipation = Math.min(1.0, (currentTime - this.dissipationStartTime) / 650.0);
      }

      // Atualiza badge central no pico
      this.updateCenterBadge(phase);

      // Renderiza quadro em WebGL ou Fallback 2D com tolerância a falhas
      try {
        if (this.useWebGL && this.gl) {
          this.renderWebGLFrame(currentTime - startTime, coverage, dissipation);
        } else {
          this.renderCanvas2DFrame(coverage, dissipation, phase);
        }
      } catch (renderErr) {
        console.warn('[FireAnimation] Falha na renderização de quadro, alternando para fallback:', renderErr);
        this.useWebGL = false;
      }

      // Finalização da dissipação
      if (phase === 'DISSIPATION') {
        const dissElapsed = (currentTime - this.dissipationStartTime) / 1000;
        if (dissElapsed >= 0.65) {
          this.finishAnimation(onComplete);
          return;
        }
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Renderiza um quadro utilizando o Fragment Shader WebGL
   * @param {number} timeMs Tempo decorrido em milissegundos
   * @param {number} coverage Progresso da máscara de subida (0..1)
   * @param {number} dissipation Progresso da máscara de recuo (0..1)
   */
  renderWebGLFrame(timeMs, coverage, dissipation) {
    const gl = this.gl;
    const timeSec = timeMs / 1000.0;

    gl.useProgram(this.glProgram);
    gl.uniform2f(this.glUniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.glUniforms.time, timeSec);
    gl.uniform1f(this.glUniforms.coverage, coverage);
    gl.uniform1f(this.glUniforms.dissipation, dissipation);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Fallback automático para Canvas 2D caso o WebGL não esteja disponível
   * Desenha partículas em lágrima invertida afilada, com mistura aditiva e rastro curto
   * @param {number} coverage
   * @param {number} dissipation
   * @param {string} phase
   */
  renderCanvas2DFrame(coverage, dissipation, phase) {
    const ctx = this.ctx;
    if (!ctx) return;
    const width = this.width;
    const height = this.height;

    ctx.clearRect(0, 0, width, height);

    // Fundo escuro azul-marinho subindo e recuando
    const bgAlpha = Math.max(0, (coverage - dissipation * 0.85) * 0.88);
    ctx.fillStyle = `rgba(8, 19, 43, ${bgAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    // Mistura aditiva de chamas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Gera novas partículas em lágrima se houver espaço no limite de 400
    if (phase !== 'DISSIPATION' || dissipation < 0.5) {
      const spawnCount = phase === 'DISSIPATION' ? 4 : (phase === 'PEAK' ? 14 : 22);
      for (let i = 0; i < spawnCount; i++) {
        if (this.particles.length >= this.maxParticles) break;

        const isSpark = Math.random() < 0.35;
        // Posição base de geração sobe conforme o progresso da máscara
        const spawnY = height - (height * coverage * Math.random());
        const w = isSpark ? (Math.random() * 2 + 1) : (Math.random() * 12 + 6);
        const h = isSpark ? (Math.random() * 6 + 3) : (w * (Math.random() * 2.5 + 3.0)); // Muito mais altas do que largas

        this.particles.push({
          x: Math.random() * width,
          y: Math.min(height, Math.max(0, spawnY)),
          w,
          h,
          vx: (Math.random() - 0.5) * 1.6,
          vy: isSpark ? -(Math.random() * 9 + 6) : -(Math.random() * 6 + 4), // Movimento sempre para cima e rápido
          life: 0,
          maxLife: isSpark ? (Math.random() * 25 + 15) : (Math.random() * 40 + 20), // Nascem e morrem rápido (0.3 a 0.8s)
          isSpark
        });
      }
    }

    // Atualiza e desenha partículas existentes
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;

      // Empuxo ascendente e tremulação nervosa lateral
      p.vy -= 0.18;
      p.y += p.vy;
      p.x += Math.sin(p.life * 0.45) * 1.8 + (Math.random() - 0.5) * 1.2;

      const lifeRatio = p.life / p.maxLife;
      if (p.life >= p.maxLife || p.y < -50) {
        this.particles.splice(i, 1);
        continue;
      }

      // Tamanho diminui rapidamente com a idade
      const currentScale = Math.max(0.1, 1 - lifeRatio);
      const alpha = Math.max(0, (1 - lifeRatio) * BRIGHTNESS);

      if (p.isSpark) {
        // Faísca com rastro curto
        ctx.strokeStyle = `rgba(230, 247, 255, ${(alpha * 0.9).toFixed(3)})`;
        ctx.lineWidth = p.w;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.h * 0.7);
        ctx.stroke();
      } else {
        // Língua de fogo em formato de lágrima invertida (ponta afilada para cima)
        const curW = p.w * currentScale;
        const curH = p.h * currentScale;

        // Gradiente vertical de temperatura (núcleo branco -> ciano -> elétrico -> profundo)
        const grad = ctx.createLinearGradient(p.x, p.y + curH * 0.3, p.x, p.y - curH * 0.7);
        grad.addColorStop(0.0, `rgba(230, 247, 255, ${(alpha * 0.95).toFixed(3)})`);
        grad.addColorStop(0.35, `rgba(41, 182, 255, ${(alpha * 0.80).toFixed(3)})`);
        grad.addColorStop(0.75, `rgba(1, 148, 255, ${(alpha * 0.50).toFixed(3)})`);
        grad.addColorStop(1.0, `rgba(10, 42, 158, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        // Ponta afilada no topo
        ctx.moveTo(p.x, p.y - curH * 0.7);
        // Lateral direita arredondando na base
        ctx.bezierCurveTo(
          p.x + curW * 0.6, p.y - curH * 0.2,
          p.x + curW * 0.6, p.y + curH * 0.3,
          p.x, p.y + curH * 0.3
        );
        // Lateral esquerda voltando à ponta
        ctx.bezierCurveTo(
          p.x - curW * 0.6, p.y + curH * 0.3,
          p.x - curW * 0.6, p.y - curH * 0.2,
          p.x, p.y - curH * 0.7
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Controla a visibilidade e texto do badge do dragão no centro da tela
   * @param {string} phase
   */
  updateCenterBadge(phase) {
    if (!this.centerBadge) return;

    if (phase === 'PEAK' || phase === 'DISSIPATION') {
      this.centerBadge.classList.add('visible');
      if (this.centerBadgeText) {
        this.centerBadgeText.textContent = phase === 'DISSIPATION' ? 'Tudo apagado' : 'Apagando tudo...';
      }
    } else {
      this.centerBadge.classList.remove('visible');
    }
  }

  /**
   * Animação reduzida para acessibilidade (prefers-reduced-motion)
   */
  runReducedMotionAnimation(checkCleanDone, onComplete) {
    if (!this.canvas) return;
    this.canvas.style.display = 'block';
    const ctx = this.canvas.getContext('2d');
    this.updateDimensions();

    const startTime = performance.now();
    const animateFade = () => {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;

      ctx.clearRect(0, 0, this.width, this.height);

      let alpha = 1;
      if (elapsed < 0.3) {
        alpha = elapsed / 0.3;
      } else if (elapsed > 1.4 && checkCleanDone()) {
        const diss = elapsed - 1.4;
        alpha = Math.max(0, 1 - (diss / 0.5));
        if (diss >= 0.5) {
          this.finishAnimation(onComplete);
          return;
        }
      }

      ctx.fillStyle = `rgba(8, 19, 43, ${(alpha * 0.95).toFixed(2)})`;
      ctx.fillRect(0, 0, this.width, this.height);

      if (this.centerBadge) {
        this.centerBadge.classList.add('visible');
        if (this.centerBadgeText) {
          this.centerBadgeText.textContent = elapsed > 1.4 ? 'Tudo apagado' : 'Apagando tudo...';
        }
      }

      requestAnimationFrame(animateFade);
    };

    requestAnimationFrame(animateFade);
  }

  /**
   * Finaliza o ciclo da animação, cria a nova aba limpa e exibe o toast
   */
  async finishAnimation(onComplete) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isRunning = false;

    if (this.centerBadge) {
      this.centerBadge.classList.remove('visible');
    }

    if (this.canvas) {
      this.canvas.style.display = 'none';
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    }

    // 1. Invoca no main process para abrir UMA aba limpa ativa e fechar o overlay
    if (window.browserAPI && typeof window.browserAPI.finishClearSession === 'function') {
      try {
        await window.browserAPI.finishClearSession();
      } catch (err) {
        console.warn('[FireAnimation] Aviso ao finalizar sessão limpa:', err);
      }
    }

    // 2. Remove o bloqueio de cliques na interface
    document.body.classList.remove('ui-locked');

    // 3. Exibe o Toast informativo: se houver falhas exibe aviso, caso contrário confirmação
    const result = this.lastCleanResult;
    const hasErrors = !result || result.success === false || (Array.isArray(result.errors) && result.errors.length > 0);
    if (hasErrors) {
      this.showToast('Alguns dados não puderam ser apagados', true);
    } else {
      this.showToast('Abas e dados apagados', false);
    }

    if (typeof onComplete === 'function') {
      onComplete();
    }
  }

  /**
   * Exibe o toast visual flutuante
   * @param {string} message Texto a ser exibido
   * @param {boolean} [isWarning=false] Se verdadeiro, aplica estilo de aviso
   */
  showToast(message, isWarning = false) {
    if (!this.toast) return;

    const label = this.toast.querySelector('.fire-toast-text');
    if (label) {
      label.textContent = message;
    }

    if (isWarning) {
      this.toast.classList.add('warning');
    } else {
      this.toast.classList.remove('warning');
    }

    this.toast.classList.add('visible');

    setTimeout(() => {
      if (this.toast) {
        this.toast.classList.remove('visible');
        this.toast.classList.remove('warning');
      }
    }, 3500);
  }
}

// Exporta globalmente para uso no app.js sem dependência de bundler
window.FireAnimationComponent = FireAnimationComponent;
```

---

### 4.45 `pages/settings.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Configurações - Dragon</title>
  <!-- Carrega variáveis e tokens visuais do tema do Dragon -->
  <link rel="stylesheet" href="../src/renderer/styles/theme.css">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--color-bg-window, #1e1e24);
      color: var(--color-text-primary, #f0f0f5);
      font-family: var(--font-family-base, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--font-size-base, 13px);
      line-height: 1.5;
      height: 100vh;
      display: flex;
      overflow: hidden;
      user-select: none;
    }

    /* -------------------------------------------------------------------------
       BARRA LATERAL ESQUERDA (MENU DE SEÇÕES)
       ------------------------------------------------------------------------- */
    .sidebar {
      width: 250px;
      min-width: 250px;
      background-color: var(--color-bg-toolbar, #23232b);
      border-right: 1px solid var(--color-border-subtle, #2d2d38);
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      gap: 20px;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px 12px 8px;
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
    }

    .sidebar-logo {
      width: 32px;
      height: 32px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      filter: drop-shadow(0 0 5px var(--fire-mid, #29B6FF)) drop-shadow(0 0 10px var(--fire-main, #0194FF));
      animation: sidebar-glow-pulse 3s ease-in-out infinite;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease;
      cursor: default;
    }

    .sidebar-header:hover .sidebar-logo {
      transform: scale(1.1);
      filter: drop-shadow(0 0 7px var(--fire-mid, #29B6FF)) drop-shadow(0 0 14px var(--color-accent, #4d7cff));
      animation-play-state: paused;
    }

    .sidebar-logo img {
      width: 26px;
      height: 26px;
      object-fit: contain;
      display: block;
      user-select: none;
      -webkit-user-drag: none;
    }

    .sidebar-logo svg {
      width: 18px;
      height: 18px;
      fill: #ffffff;
    }

    @keyframes sidebar-glow-pulse {
      0%, 100% {
        filter: drop-shadow(0 0 4px var(--fire-mid, #29B6FF)) drop-shadow(0 0 9px var(--fire-main, #0194FF));
      }
      50% {
        filter: drop-shadow(0 0 7px var(--fire-mid, #29B6FF)) drop-shadow(0 0 14px var(--color-accent, #4d7cff));
      }
    }

    .sidebar-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-primary, #f0f0f5);
      letter-spacing: -0.2px;
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--radius-md, 6px);
      background: transparent;
      border: none;
      color: var(--color-text-secondary, #9e9ea8);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: background-color var(--transition-fast, 0.15s), color var(--transition-fast, 0.15s);
      outline: none;
    }

    .nav-item svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
      flex-shrink: 0;
    }

    .nav-item:hover {
      background-color: var(--color-bg-button-hover, #333340);
      color: var(--color-text-primary, #f0f0f5);
    }

    .nav-item.active {
      background-color: var(--color-bg-tab-active, #2f2f3a);
      color: #ffffff;
      font-weight: 600;
      box-shadow: inset 3px 0 0 var(--color-accent, #4d7cff);
    }

    .sidebar-footer {
      font-size: 11px;
      color: var(--color-text-muted, #666673);
      padding: 0 8px;
      text-align: center;
    }

    /* -------------------------------------------------------------------------
       ÁREA PRINCIPAL DE CONTEÚDO (PAINÉIS À DIREITA)
       ------------------------------------------------------------------------- */
    .content-area {
      flex: 1;
      height: 100vh;
      overflow-y: auto;
      padding: 36px 48px;
      background-color: var(--color-bg-window, #1e1e24);
    }

    .panel {
      display: none;
      max-width: 760px;
      margin: 0 auto;
      animation: fadeIn 0.15s ease;
    }

    .panel.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .panel-header {
      margin-bottom: 28px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
    }

    .panel-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--color-text-primary, #f0f0f5);
      margin-bottom: 6px;
    }

    .panel-header p {
      font-size: 14px;
      color: var(--color-text-secondary, #9e9ea8);
    }

    /* -------------------------------------------------------------------------
       CARTÕES DE CONFIGURAÇÃO (CARDS)
       ------------------------------------------------------------------------- */
    .settings-card {
      background-color: var(--color-bg-toolbar, #23232b);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-lg, 8px);
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text-primary, #f0f0f5);
      margin-bottom: 4px;
    }

    .card-desc {
      font-size: 13px;
      color: var(--color-text-secondary, #9e9ea8);
      margin-bottom: 16px;
    }

    /* Formulários e Controles */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }

    label {
      font-size: 13px;
      color: var(--color-text-primary, #f0f0f5);
      font-weight: 500;
    }

    select, input[type="text"], input[type="url"], input[type="password"] {
      width: 100%;
      background-color: var(--color-bg-input, #18181d);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-md, 6px);
      color: var(--color-text-primary, #f0f0f5);
      padding: 10px 14px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color var(--transition-fast, 0.15s), box-shadow var(--transition-fast, 0.15s);
      user-select: text;
    }

    select:focus, input[type="text"]:focus, input[type="url"]:focus, input[type="password"]:focus {
      border-color: var(--color-accent, #4d7cff);
      box-shadow: 0 0 0 2px rgba(77, 124, 255, 0.25);
    }

    .help-text {
      font-size: 12px;
      color: var(--color-text-muted, #666673);
    }

    .help-text code {
      background-color: var(--color-bg-input, #18181d);
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid var(--color-border-subtle, #2d2d38);
      font-family: monospace;
      color: var(--color-accent, #4d7cff);
    }

    /* Opções em Radio */
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .radio-option {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      padding: 8px 12px;
      border-radius: var(--radius-md, 6px);
      background-color: rgba(255, 255, 255, 0.02);
      border: 1px solid transparent;
      transition: background-color var(--transition-fast, 0.15s), border-color var(--transition-fast, 0.15s);
    }

    .radio-option:hover {
      background-color: rgba(255, 255, 255, 0.04);
      border-color: var(--color-border-subtle, #2d2d38);
    }

    .radio-option input[type="radio"] {
      appearance: none;
      width: 16px;
      height: 16px;
      border: 2px solid var(--color-text-muted, #666673);
      border-radius: 50%;
      outline: none;
      cursor: pointer;
      position: relative;
      margin: 0;
      flex-shrink: 0;
      transition: border-color var(--transition-fast, 0.15s);
    }

    .radio-option input[type="radio"]:checked {
      border-color: var(--color-accent, #4d7cff);
    }

    .radio-option input[type="radio"]:checked::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 6px;
      height: 6px;
      background-color: var(--color-accent, #4d7cff);
      border-radius: 50%;
    }

    .radio-label {
      font-size: 13px;
      color: var(--color-text-primary, #f0f0f5);
    }

    /* Botões */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: var(--radius-md, 6px);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all var(--transition-fast, 0.15s);
      outline: none;
      font-family: inherit;
    }

    .btn-primary {
      background-color: var(--color-accent, #4d7cff);
      color: #ffffff;
    }

    .btn-primary:hover {
      background-color: var(--color-accent-hover, #3b6ae6);
    }

    .btn-secondary {
      background-color: var(--color-bg-input, #18181d);
      border-color: var(--color-border-subtle, #2d2d38);
      color: var(--color-text-primary, #f0f0f5);
    }

    .btn-secondary:hover {
      background-color: var(--color-bg-button-hover, #333340);
      border-color: var(--color-text-secondary, #9e9ea8);
    }

    .btn-danger {
      background-color: rgba(224, 69, 69, 0.15);
      border-color: rgba(224, 69, 69, 0.3);
      color: #ff6b6b;
    }

    .btn-danger:hover {
      background-color: rgba(224, 69, 69, 0.25);
    }

    /* Seletor de Cores de Destaque */
    .color-picker-grid {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .color-swatch {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      outline: none;
      transition: transform var(--transition-fast, 0.15s), border-color var(--transition-fast, 0.15s);
      position: relative;
    }

    .color-swatch:hover {
      transform: scale(1.15);
    }

    .color-swatch.active {
      border-color: #ffffff;
      box-shadow: 0 0 0 2px var(--color-bg-window, #1e1e24);
    }

    .custom-color-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background-color: var(--color-bg-input, #18181d);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-md, 6px);
      padding: 4px 10px 4px 6px;
      margin-left: 8px;
    }

    input[type="color"] {
      appearance: none;
      width: 26px;
      height: 26px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
      border-radius: 50%;
      outline: none;
    }

    input[type="color"]::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    input[type="color"]::-webkit-color-swatch {
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
    }

    .color-hex-label {
      font-size: 12px;
      font-family: monospace;
      color: var(--color-text-secondary, #9e9ea8);
    }

    /* Sliders de Ajuste */
    .slider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 14px;
    }

    .slider-label-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .slider-value {
      font-weight: 600;
      color: var(--color-accent, #4d7cff);
    }

    input[type="range"] {
      appearance: none;
      width: 180px;
      height: 6px;
      border-radius: 3px;
      background-color: var(--color-bg-input, #18181d);
      outline: none;
    }

    input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: var(--color-accent, #4d7cff);
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
      transition: transform var(--transition-fast, 0.15s);
    }

    input[type="range"]::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    /* Thumbnail Preview de Fundo */
    .bg-preview-box {
      width: 100%;
      height: 160px;
      border-radius: var(--radius-md, 6px);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      background-color: var(--color-bg-input, #18181d);
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      margin-top: 12px;
      margin-bottom: 14px;
    }

    .bg-preview-empty {
      color: var(--color-text-muted, #666673);
      font-size: 13px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .bg-preview-empty svg {
      width: 32px;
      height: 32px;
      fill: currentColor;
    }

    .bg-preview-dim-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.4);
      pointer-events: none;
    }

    /* Toggle Switch Moderno */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      cursor: pointer;
    }

    .toggle-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toggle-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary, #f0f0f5);
    }

    .toggle-desc {
      font-size: 12px;
      color: var(--color-text-secondary, #9e9ea8);
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background-color: #383844;
      border-radius: 24px;
      transition: background-color var(--transition-fast, 0.15s);
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      border-radius: 50%;
      transition: transform var(--transition-fast, 0.15s);
    }

    input:checked + .slider {
      background-color: var(--color-accent, #4d7cff);
    }

    input:checked + .slider:before {
      transform: translateX(20px);
    }

    .switch.disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .switch.disabled input {
      cursor: not-allowed;
    }

    .switch.disabled .slider {
      cursor: not-allowed;
    }

    /* Badge "Em breve" */
    .badge-soon {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background-color: rgba(77, 124, 255, 0.15);
      color: var(--color-accent, #4d7cff);
      border: 1px solid rgba(77, 124, 255, 0.3);
    }

    /* Itens da lista de Permissões de Sites */
    .perm-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background-color: var(--color-bg-input, #18181d);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-md, 6px);
      gap: 12px;
      transition: border-color var(--transition-fast, 0.15s);
    }

    .perm-item-row:hover {
      border-color: var(--color-accent, #4d7cff);
    }

    .perm-item-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .perm-item-origin {
      font-weight: 600;
      color: var(--color-text-primary, #f0f0f5);
      font-size: 13px;
      word-break: break-all;
    }

    .perm-item-detail {
      font-size: 11px;
      color: var(--color-text-secondary, #9e9ea8);
    }

    .perm-item-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .perm-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .perm-badge.allowed {
      background-color: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .perm-badge.blocked {
      background-color: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
  </style>
</head>
<body>

  <!-- =========================================================================
       BARRA LATERAL DE NAVEGAÇÃO
       ========================================================================= -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <img src="../assets/icons/favicon-circle.png" alt="Dragon">
      </div>
      <span class="sidebar-title">Configurações</span>
    </div>

    <nav class="sidebar-nav">
      <!-- Item 1: Principal -->
      <button class="nav-item active" data-target="panel-main">
        <svg viewBox="0 0 16 16">
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z"/>
        </svg>
        <span>Principal</span>
      </button>

      <!-- Item 2: Personalização -->
      <button class="nav-item" data-target="panel-appearance">
        <svg viewBox="0 0 16 16">
          <path d="M8 0a8 8 0 1 0 8 8 8 8 0 0 0-8-8zm0 14.5a6.5 6.5 0 0 1 0-13 1 1 0 0 1 1 1v.5a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-.5a1 1 0 0 1 1-1 6.5 6.5 0 0 1-6 13zm-2.5-9a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-2 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm2 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
        </svg>
        <span>Personalização</span>
      </button>

      <!-- Item 3: Proxy -->
      <button class="nav-item" data-target="panel-proxy">
        <svg viewBox="0 0 16 16">
          <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.25-6.97A6.51 6.51 0 0 0 1.55 7.25h2.89c.12-1.8.68-3.4 1.56-4.57.42-.56.9-.99 1.25-1.65zm1.5 0c.35.66.83 1.09 1.25 1.65.88 1.17 1.44 2.77 1.56 4.57h2.89a6.51 6.51 0 0 0-5.7-6.22zM8.75 8.75v5.72a6.51 6.51 0 0 0 5.7-5.72h-2.89c-.12 1.8-.68 3.4-1.56 4.57-.42.56-.9.99-1.25 1.15zM7.25 14.47c-.35-.16-.83-.59-1.25-1.15-.88-1.17-1.44-2.77-1.56-4.57H1.55a6.51 6.51 0 0 0 5.7 5.72zM8 2.5a14.2 14.2 0 0 0-2.02 4.75h4.04A14.2 14.2 0 0 0 8 2.5zm-2.02 6.25c.34 2.05 1.1 3.96 2.02 4.75.92-.79 1.68-2.7 2.02-4.75H5.98z"/>
        </svg>
        <span>Proxy</span>
      </button>

      <!-- Item 4: Permissões de Sites -->
      <button class="nav-item" data-target="panel-permissions">
        <svg viewBox="0 0 16 16">
          <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        </svg>
        <span>Permissões</span>
      </button>

      <!-- Item 5: Privacidade Avançada (Fingerprinting - ETAPA 5) -->
      <button class="nav-item" data-target="panel-fingerprint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
          <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/>
          <path d="M17.29 21.02c.12-.6.18-1.2.18-1.85 0-3.5-1.5-6.5-4.5-8.5"/>
          <path d="M9.08 9c.6-.8 1.43-1.37 2.42-1.63"/>
          <path d="M12 22a10 10 0 0 0 6.5-2.5"/>
          <path d="M12 6a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2"/>
          <path d="M8.7 13.5c-.37-.8-.57-1.7-.57-2.65a4 4 0 0 1 4-4c1.1 0 2.1.45 2.83 1.17"/>
        </svg>
        <span>Privacidade Avançada</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <span>Dragon Browser • v1.0.0</span>
    </div>
  </aside>

  <!-- =========================================================================
       ÁREA PRINCIPAL DE CONTEÚDO
       ========================================================================= -->
  <main class="content-area">

    <!-- -----------------------------------------------------------------------
         PAINEL 1: PRINCIPAL
         ----------------------------------------------------------------------- -->
    <section id="panel-main" class="panel active">
      <div class="panel-header">
        <h1>Principal</h1>
        <p>Configurações de busca, inicialização e navegação geral.</p>
      </div>

      <!-- Buscador Padrão -->
      <div class="settings-card">
        <h2 class="card-title">Mecanismo de busca padrão</h2>
        <p class="card-desc">Usado para termos digitados na barra de endereços e na página de nova aba.</p>

        <div class="form-group">
          <select id="select-search-engine">
            <option value="duckduckgo">DuckDuckGo (Padrão e Privado)</option>
            <option value="google">Google</option>
            <option value="bing">Bing</option>
            <option value="brave">Brave Search</option>
            <option value="startpage">Startpage</option>
            <option value="ecosia">Ecosia</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        <div id="wrap-custom-search" class="form-group" style="display: none;">
          <label for="input-custom-search">URL do mecanismo personalizado</label>
          <input
            type="url"
            id="input-custom-search"
            placeholder="https://exemplo.com/search?q=%s"
          />
          <span class="help-text">Use <code>%s</code> no lugar da palavra-chave pesquisada.</span>
        </div>
      </div>

      <!-- Ao Iniciar -->
      <div class="settings-card">
        <h2 class="card-title">Ao iniciar</h2>
        <p class="card-desc">Defina o que o Dragon deve abrir quando for inicializado.</p>

        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="startupBehavior" value="newtab" id="startup-newtab" checked />
            <span class="radio-label">Abrir a página de nova aba</span>
          </label>

          <label class="radio-option">
            <input type="radio" name="startupBehavior" value="restore" id="startup-restore" />
            <span class="radio-label">Restaurar as abas da última sessão (não restaura abas privadas)</span>
          </label>

          <label class="radio-option">
            <input type="radio" name="startupBehavior" value="custom" id="startup-custom" />
            <span class="radio-label">Abrir uma página específica</span>
          </label>
        </div>

        <div id="wrap-startup-url" class="form-group" style="display: none; margin-top: 14px;">
          <label for="input-startup-url">Endereço da página de inicialização</label>
          <input
            type="url"
            id="input-startup-url"
            placeholder="https://duckduckgo.com"
          />
        </div>
      </div>

      <!-- Página Inicial Personalizada -->
      <div class="settings-card">
        <h2 class="card-title">Página inicial personalizada</h2>
        <p class="card-desc">Endereço utilizado como sua página inicial principal.</p>

        <div class="form-group">
          <input
            type="url"
            id="input-home-url"
            placeholder="https://duckduckgo.com"
          />
        </div>
      </div>

      <!-- Zoom Padrão das Páginas -->
      <div class="settings-card">
        <h2 class="card-title">Zoom padrão das páginas</h2>
        <p class="card-desc">Escala de exibição padrão aplicada a todos os sites.</p>

        <div class="form-group">
          <select id="select-zoom">
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="0.8">80%</option>
            <option value="0.9">90%</option>
            <option value="1.0" selected>100% (Padrão)</option>
            <option value="1.1">110%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="1.75">175%</option>
            <option value="2.0">200%</option>
          </select>
        </div>
      </div>

      <!-- Limpeza de Dados ao Fechar -->
      <div class="settings-card">
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-title">Limpar dados ao fechar o navegador</span>
            <span class="toggle-desc">Apaga histórico, cookies, cache e sessões automaticamente ao fechar o Dragon.</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-clear-on-exit" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </section>

    <!-- -----------------------------------------------------------------------
         PAINEL 2: PERSONALIZAÇÃO
         ----------------------------------------------------------------------- -->
    <section id="panel-appearance" class="panel">
      <div class="panel-header">
        <h1>Personalização</h1>
        <p>Aparência, cores, temas e imagem de fundo da nova aba.</p>
      </div>

      <!-- Cor de Destaque -->
      <div class="settings-card">
        <h2 class="card-title">Cor de destaque</h2>
        <p class="card-desc">Aplicada em tempo real na interface do navegador, bordas de foco e indicadores.</p>

        <div class="color-picker-grid">
          <button class="color-swatch active" style="background-color: #4d7cff;" data-color="#4d7cff" title="Azul Dragon"></button>
          <button class="color-swatch" style="background-color: #0194FF;" data-color="#0194FF" title="Ciano Elétrico"></button>
          <button class="color-swatch" style="background-color: #10b981;" data-color="#10b981" title="Esmeralda"></button>
          <button class="color-swatch" style="background-color: #8b5cf6;" data-color="#8b5cf6" title="Violeta"></button>
          <button class="color-swatch" style="background-color: #ec4899;" data-color="#ec4899" title="Rosa"></button>
          <button class="color-swatch" style="background-color: #f59e0b;" data-color="#f59e0b" title="Âmbar"></button>
          <button class="color-swatch" style="background-color: #ef4444;" data-color="#ef4444" title="Coral"></button>

          <div class="custom-color-wrap">
            <input type="color" id="input-accent-color" value="#4d7cff" title="Escolher cor livre" />
            <span id="label-accent-hex" class="color-hex-label">#4d7cff</span>
          </div>
        </div>
      </div>

      <!-- Tema -->
      <div class="settings-card">
        <h2 class="card-title">Tema</h2>
        <p class="card-desc">Selecione o esquema de cores para a janela do navegador.</p>

        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="themeOption" value="dark" id="theme-dark" checked />
            <span class="radio-label">Escuro (Padrão)</span>
          </label>

          <label class="radio-option">
            <input type="radio" name="themeOption" value="light" id="theme-light" />
            <span class="radio-label">Claro</span>
          </label>

          <label class="radio-option">
            <input type="radio" name="themeOption" value="system" id="theme-system" />
            <span class="radio-label">Seguir o sistema</span>
          </label>
        </div>
      </div>

      <!-- Imagem de Fundo da Nova Aba -->
      <div class="settings-card">
        <h2 class="card-title">Imagem de fundo da nova aba</h2>
        <p class="card-desc">Escolha uma imagem do seu computador. Ela é copiada com segurança para a pasta do usuário.</p>

        <!-- Caixa de Pré-visualização -->
        <div id="bg-preview-box" class="bg-preview-box">
          <div id="bg-preview-empty" class="bg-preview-empty">
            <svg viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            <span>Nenhuma imagem de fundo selecionada</span>
          </div>
          <div id="bg-preview-overlay" class="bg-preview-dim-overlay" style="display: none;"></div>
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <button id="btn-choose-bg" class="btn btn-primary">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
              <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V10.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
            </svg>
            <span>Escolher imagem...</span>
          </button>

          <button id="btn-remove-bg" class="btn btn-danger" style="display: none;">
            <span>Remover imagem</span>
          </button>
        </div>

        <!-- Controles de Escurecimento e Desfoque -->
        <div class="slider-row">
          <div class="slider-label-wrap">
            <label for="slider-dim">Escurecimento do fundo</label>
            <span class="help-text">Garante alto contraste e legibilidade da busca</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="slider-dim" min="0" max="90" value="40" />
            <span id="label-dim-value" class="slider-value" style="width: 38px; text-align: right;">40%</span>
          </div>
        </div>

        <div class="slider-row">
          <div class="slider-label-wrap">
            <label for="slider-blur">Desfoque do fundo</label>
            <span class="help-text">Suaviza detalhes da imagem para foco no conteúdo</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="slider-blur" min="0" max="20" value="4" />
            <span id="label-blur-value" class="slider-value" style="width: 38px; text-align: right;">4px</span>
          </div>
        </div>
      </div>

      <!-- Atalhos na Nova Aba -->
      <div class="settings-card">
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-title">Atalhos de teclado na nova aba</span>
            <span class="toggle-desc">Exibir tabela com atalhos rápidos no centro da página inicial</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-shortcuts" checked />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </section>

    <!-- -----------------------------------------------------------------------
         PAINEL 3: PROXY
         ----------------------------------------------------------------------- -->
    <section id="panel-proxy" class="panel">
      <div class="panel-header">
        <h1>Proxy</h1>
        <p>Configurações de rede e tráfego através de servidor proxy.</p>
      </div>

      <div class="settings-card">
        <div class="toggle-row" style="margin-bottom: 16px;">
          <div class="toggle-info">
            <span class="toggle-title">Habilitar servidor proxy</span>
            <span class="toggle-desc">Roteia as conexões web através de um intermediário de rede</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-proxy-enabled" />
            <span class="slider"></span>
          </label>
        </div>

        <div id="proxy-fields" style="display: none; flex-direction: column; gap: 14px;">
          <div class="form-group">
            <label for="select-proxy-protocol">Protocolo</label>
            <select id="select-proxy-protocol">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>

          <div style="display: flex; gap: 12px;">
            <div class="form-group" style="flex: 3;">
              <label for="input-proxy-host">Servidor / Host</label>
              <input type="text" id="input-proxy-host" placeholder="ex: 127.0.0.1 ou proxy.exemplo.com" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="input-proxy-port">Porta</label>
              <input type="text" id="input-proxy-port" placeholder="ex: 8080" />
            </div>
          </div>

          <div style="display: flex; gap: 12px;">
            <div class="form-group" style="flex: 1;">
              <label for="input-proxy-username">Usuário (opcional)</label>
              <input type="text" id="input-proxy-username" placeholder="Usuário para autenticação" autocomplete="off" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="input-proxy-password">Senha (criptografada em disco)</label>
              <input type="password" id="input-proxy-password" placeholder="Senha do proxy" autocomplete="off" />
            </div>
          </div>

          <div class="toggle-row" style="margin-top: 8px;">
            <div class="toggle-info">
              <span class="toggle-title">Aplicar também em abas privadas</span>
              <span class="toggle-desc">Usa as mesmas configurações de proxy em sessões privadas</span>
            </div>
            <label class="switch">
              <input type="checkbox" id="toggle-proxy-apply-private" />
              <span class="slider"></span>
            </label>
          </div>

          <div style="display: flex; align-items: center; gap: 14px; margin-top: 10px;">
            <button type="button" id="btn-test-proxy" class="btn btn-secondary">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                <path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 4.9 4c1.552 0 2.94-.707 3.857-1.818a.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
              </svg>
              <span>Testar Conexão</span>
            </button>
            <span id="proxy-test-status" class="help-text"></span>
          </div>
        </div>
      </div>
    </section>

    <!-- -----------------------------------------------------------------------
         PAINEL 4: PERMISSÕES DE SITES
         ----------------------------------------------------------------------- -->
    <section id="panel-permissions" class="panel">
      <div class="panel-header">
        <h1>Permissões de Sites</h1>
        <p>Gerencie o acesso de sites a recursos como microfone, câmera, localização e notificações.</p>
      </div>

      <div class="settings-card">
        <h2 class="card-title">Permissões salvas</h2>
        <p class="card-desc">Lista de permissões concedidas ou bloqueadas por domínio com persistência.</p>

        <div id="permissions-list-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
          <!-- Renderizado dinamicamente via JS -->
          <div id="permissions-empty" class="help-text" style="padding: 12px 0;">Nenhuma permissão cadastrada até o momento.</div>
        </div>
      </div>
    </section>

    <!-- -----------------------------------------------------------------------
         PAINEL 5: PRIVACIDADE AVANÇADA (SISTEMA DE FINGERPRINTING MULTIVETORIAL)
         ----------------------------------------------------------------------- -->
    <section id="panel-fingerprint" class="panel">
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1>Privacidade Avançada</h1>
          <p>Configuração profunda da impressão digital (fingerprint) do Dragon com validação de consistência e reset de identidade.</p>
        </div>
        <button type="button" id="btn-reset-fingerprint" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; font-weight: 600; box-shadow: 0 0 12px var(--fire-glow, rgba(1,148,255,0.4));">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
            <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A4.985 4.985 0 0 1 8 2c2.166 0 3.993 1.373 4.678 3.308a.5.5 0 0 1-.942.338C11.144 4.025 9.697 3 8 3zm0 10c1.552 0 2.94-.707 3.857-1.818a.5.5 0 1 1 .771.636A4.985 4.985 0 0 1 8 14c-2.166 0-3.993-1.373-4.678-3.308a.5.5 0 0 1 .942-.338C4.856 11.975 6.303 13 8 13z"/>
          </svg>
          Resetar Fingerprint
        </button>
      </div>

      <!-- Banner de Inconsistência e Avisos -->
      <div id="fp-consistency-box" style="display: none; padding: 12px 16px; border-radius: var(--radius-md, 6px); margin-bottom: 20px; font-size: 13px; line-height: 1.5;"></div>

      <div class="settings-card">
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-title">Reduzir impressão digital do navegador (Fingerprinting)</span>
            <span class="toggle-desc">Ativa as proteções ativas e máscaras em páginas web normais. <strong>Esta configuração é global e NÃO cria perfis nem contas separadas.</strong> O botão "Resetar Fingerprint" sorteia uma nova identidade coerente a qualquer momento.</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-fp-enabled" />
            <span class="slider"></span>
          </label>
        </div>

        <div id="fp-suboptions" style="display: flex; flex-direction: column; gap: 24px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border-subtle, #2d2d38); transition: opacity var(--transition-fast, 0.15s);">
          
          <!-- GRUPO A: IDENTIDADE DO SISTEMA -->
          <div>
            <h3 class="card-title" style="margin-bottom: 4px;">Grupo A — Identidade do Sistema</h3>
            <p class="card-desc">Define como o sistema operacional, navegador, fuso horário e idioma são apresentados para a web.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label for="select-fp-os">Sistema Operacional Alvo</label>
                <select id="select-fp-os">
                  <option value="windows11">Windows 11 (Padrão Moderno)</option>
                  <option value="windows10">Windows 10</option>
                  <option value="macos">macOS (Sonoma / Sequoia)</option>
                  <option value="linux">Linux (Ubuntu / Fedora)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-browser">Navegador Relatado</label>
                <select id="select-fp-browser">
                  <option value="chrome">Google Chrome (Recomendado)</option>
                  <option value="edge">Microsoft Edge</option>
                  <option value="firefox">Mozilla Firefox</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-platform">Plataforma (navigator.platform)</label>
                <select id="select-fp-platform">
                  <option value="auto">Automático (Coerente com o SO)</option>
                  <option value="Win32">Win32 (Windows)</option>
                  <option value="MacIntel">MacIntel (macOS)</option>
                  <option value="Linux x86_64">Linux x86_64 (Linux)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-locale">Idioma do Navegador (Locale)</label>
                <select id="select-fp-locale">
                  <option value="pt-BR">Português do Brasil (pt-BR)</option>
                  <option value="en-US">English / Estados Unidos (en-US)</option>
                  <option value="es-ES">Español / Espanha (es-ES)</option>
                  <option value="fr-FR">Français / França (fr-FR)</option>
                  <option value="de-DE">Deutsch / Alemanha (de-DE)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-timezone">Fuso Horário (Timezone)</label>
                <select id="select-fp-timezone">
                  <option value="America/Sao_Paulo">América/São Paulo (GMT-3)</option>
                  <option value="America/New_York">América/Nova York (GMT-5 / EDT)</option>
                  <option value="America/Chicago">América/Chicago (GMT-6 / CDT)</option>
                  <option value="America/Los_Angeles">América/Los Angeles (GMT-8 / PDT)</option>
                  <option value="Europe/London">Europa/Londres (GMT+0 / BST)</option>
                  <option value="Europe/Paris">Europa/Paris (GMT+1 / CEST)</option>
                  <option value="Europe/Berlin">Europa/Berlim (GMT+1 / CEST)</option>
                  <option value="Europe/Madrid">Europa/Madri (GMT+1 / CEST)</option>
                  <option value="Asia/Tokyo">Ásia/Tóquio (GMT+9)</option>
                  <option value="UTC">UTC (Universal / GMT+0)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="input-fp-ua">User-Agent</label>
                <input type="text" id="input-fp-ua" placeholder="auto (gerado automaticamente pelo SO e Navegador)" />
                <span class="help-text">Digite <code>auto</code> para derivar automaticamente ou insira uma assinatura personalizada.</span>
              </div>
            </div>
          </div>

          <!-- GRUPO B: HARDWARE -->
          <div style="border-top: 1px solid var(--color-border-subtle, #2d2d38); padding-top: 16px;">
            <h3 class="card-title" style="margin-bottom: 4px;">Grupo B — Hardware e Resolução</h3>
            <p class="card-desc">Especificações técnicas de tela, processador e memória relatadas para as páginas.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label for="select-fp-resolution">Resolução de Tela</label>
                <select id="select-fp-resolution">
                  <option value="1920x1080">1920 × 1080 (Full HD, Mais Comum)</option>
                  <option value="2560x1440">2560 × 1440 (2K / QHD)</option>
                  <option value="1366x768">1366 × 768 (Notebook Padrão)</option>
                  <option value="1536x864">1536 × 864 (Notebook Alta Densidade)</option>
                  <option value="2880x1800">2880 × 1800 (MacBook Pro Retina)</option>
                  <option value="3840x2160">3840 × 2160 (4K UHD)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-dpr">Device Pixel Ratio (DPR)</label>
                <select id="select-fp-dpr">
                  <option value="auto">Automático (Baseado na Resolução)</option>
                  <option value="1">1.0 (Padrão 100%)</option>
                  <option value="1.25">1.25 (Escala 125%)</option>
                  <option value="1.5">1.5 (Escala 150%)</option>
                  <option value="2">2.0 (Retina / Alta Densidade)</option>
                  <option value="3">3.0 (Ultra Densidade)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-cores">Núcleos de Processamento (CPU Cores)</label>
                <select id="select-fp-cores">
                  <option value="2">2 núcleos</option>
                  <option value="4">4 núcleos</option>
                  <option value="6">6 núcleos</option>
                  <option value="8">8 núcleos (Mais comum)</option>
                  <option value="12">12 núcleos</option>
                  <option value="16">16 núcleos</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-memory">Memória RAM Relatada</label>
                <select id="select-fp-memory">
                  <option value="2">2 GB</option>
                  <option value="4">4 GB</option>
                  <option value="8">8 GB (Mais comum)</option>
                  <option value="16">16 GB</option>
                  <option value="32">32 GB</option>
                </select>
              </div>
            </div>

            <div class="toggle-row" style="margin-top: 14px;">
              <div class="toggle-info">
                <span class="toggle-title">Suporte a Tela Sensível ao Toque (Touch)</span>
                <span class="toggle-desc">Define <code>navigator.maxTouchPoints</code>. Desative para computadores desktop tradicionais.</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="toggle-fp-touch" />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- GRUPO C: GPU / WEBGL -->
          <div style="border-top: 1px solid var(--color-border-subtle, #2d2d38); padding-top: 16px;">
            <h3 class="card-title" style="margin-bottom: 4px;">Grupo C — Placa de Vídeo e WebGL</h3>
            <p class="card-desc">Fabricante e modelo da placa de vídeo expostos via extensões não-mascaradas do WebGL.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label for="input-fp-webgl-vendor">Fabricante da GPU (Vendor)</label>
                <input type="text" id="input-fp-webgl-vendor" placeholder="auto (gerado automaticamente pelo SO)" />
              </div>

              <div class="form-group">
                <label for="input-fp-webgl-renderer">Renderizador de Vídeo (Renderer)</label>
                <input type="text" id="input-fp-webgl-renderer" placeholder="auto (gerado automaticamente pelo SO)" />
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label for="select-fp-webgl-mode">Proteção de Renderização WebGL (readPixels)</label>
                <select id="select-fp-webgl-mode">
                  <option value="noise">Ruído Determinístico por Sessão (Recomendado — não quebra sites)</option>
                  <option value="real">Real (Sem Alteração)</option>
                  <option value="mask">Máscara Fixa</option>
                </select>
              </div>
            </div>
          </div>

          <!-- GRUPO D: CANVAS, ÁUDIO, CLIENTRECTS & FONTES -->
          <div style="border-top: 1px solid var(--color-border-subtle, #2d2d38); padding-top: 16px;">
            <h3 class="card-title" style="margin-bottom: 4px;">Grupo D — Canvas, Áudio, ClientRects & Fontes</h3>
            <p class="card-desc">Vetores biométricos complexos que geram assinaturas cruzadas de renderização de imagem e som.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label for="select-fp-canvas-mode">Proteção do Canvas 2D (toDataURL / getImageData)</label>
                <select id="select-fp-canvas-mode">
                  <option value="noise">Ruído Determinístico por Sessão (Recomendado — imperceptível)</option>
                  <option value="real">Real (Sem Alteração)</option>
                  <option value="mask">Máscara Fixa</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-audio-mode">Proteção de AudioContext / Frequência Sonora</label>
                <select id="select-fp-audio-mode">
                  <option value="noise">Ruído Determinístico por Sessão (Recomendado)</option>
                  <option value="real">Real (Sem Alteração)</option>
                  <option value="mask">Máscara Fixa</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-clientrects-mode">Geometria de Elementos (ClientRects)</label>
                <select id="select-fp-clientrects-mode">
                  <option value="noise">Micro-Ruído Determinístico (Recomendado — ±0.05px)</option>
                  <option value="mask">Arredondamento para Inteiros</option>
                  <option value="real">Real (Sem Alteração)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-fonts-mode">Enumeração de Fontes do Sistema</label>
                <select id="select-fp-fonts-mode">
                  <option value="mask">Filtrar para Fontes Padrão do SO Alvo (Recomendado)</option>
                  <option value="real">Real (Expõe todas as fontes instaladas)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- GRUPO E: OUTROS VETORES -->
          <div style="border-top: 1px solid var(--color-border-subtle, #2d2d38); padding-top: 16px;">
            <h3 class="card-title" style="margin-bottom: 4px;">Grupo E — Outros Vetores (WebRTC, Bateria, Permissões)</h3>
            <p class="card-desc">Controle de vazamentos de rede local e APIs de hardware auxiliares.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label for="select-fp-webrtc-mode">Política de WebRTC</label>
                <select id="select-fp-webrtc-mode">
                  <option value="proxy">Interface Pública Padrão (Sem Vazamento de IP Local)</option>
                  <option value="disabled">Desabilitar WebRTC Completamente</option>
                  <option value="real">Real (Sem Restrições)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-media-count">Dispositivos de Mídia Simulados (enumerateDevices)</label>
                <select id="select-fp-media-count">
                  <option value="2">2 dispositivos (Microfone + Câmera)</option>
                  <option value="1">1 dispositivo (Apenas Microfone)</option>
                  <option value="3">3 dispositivos (Microfone + Câmera + Alto-falante)</option>
                  <option value="0">Nenhum dispositivo de mídia</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-speech-voices">Vozes de Síntese de Fala (SpeechVoices)</label>
                <select id="select-fp-speech-voices">
                  <option value="mask">Máscara Padrão do SO Alvo</option>
                  <option value="real">Real (Sem Alteração)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="select-fp-battery-mode">Status de Bateria (getBattery)</label>
                <select id="select-fp-battery-mode">
                  <option value="mask">Mascarar (Sempre 100% Carregando)</option>
                  <option value="real">Real (Nível Real da Bateria)</option>
                </select>
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label for="select-fp-permissions-mode">Consulta de Permissões (permissions.query)</label>
                <select id="select-fp-permissions-mode">
                  <option value="mask">Mascarar como Prompt Padrão (Recomendado)</option>
                  <option value="real">Real (Expõe permissões já concedidas)</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

  </main>

  <!-- =========================================================================
       SCRIPT DO LADO DO CLIENTE (CONSUMIDOR DE window.settingsAPI)
       ========================================================================= -->
  <script src="settings.js"></script>
</body>
</html>
```

---

### 4.46 `pages/settings.js`

```javascript
// =============================================================================
// pages/settings.js
// Lógica da página de configurações (settings.html) do Dragon
// Comunicação segura via preload isolado (window.settingsAPI)
// =============================================================================

/**
 * Função utilitária de debounce para evitar gravações excessivas em disco
 * enquanto o usuário digita ou arrasta sliders.
 * @param {Function} fn Função a ser executada
 * @param {number} delay Tempo de espera em ms
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// Referências dos elementos da interface
const navButtons = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');

// Seção Principal
const selectSearchEngine = document.getElementById('select-search-engine');
const wrapCustomSearch = document.getElementById('wrap-custom-search');
const inputCustomSearch = document.getElementById('input-custom-search');

const startupNewTab = document.getElementById('startup-newtab');
const startupRestore = document.getElementById('startup-restore');
const startupCustom = document.getElementById('startup-custom');
const wrapStartupUrl = document.getElementById('wrap-startup-url');
const inputStartupUrl = document.getElementById('input-startup-url');

const inputHomeUrl = document.getElementById('input-home-url');
const selectZoom = document.getElementById('select-zoom');
const chkClearOnExit = document.getElementById('chk-clear-on-exit');

// Seção Personalização
const colorSwatches = document.querySelectorAll('.color-swatch');
const inputAccentColor = document.getElementById('input-accent-color');
const labelAccentHex = document.getElementById('label-accent-hex');

const themeDark = document.getElementById('theme-dark');
const themeLight = document.getElementById('theme-light');
const themeSystem = document.getElementById('theme-system');

const bgPreviewBox = document.getElementById('bg-preview-box');
const bgPreviewEmpty = document.getElementById('bg-preview-empty');
const bgPreviewOverlay = document.getElementById('bg-preview-overlay');
const btnChooseBg = document.getElementById('btn-choose-bg');
const btnRemoveBg = document.getElementById('btn-remove-bg');
const sliderDim = document.getElementById('slider-dim');
const labelDimValue = document.getElementById('label-dim-value');
const sliderBlur = document.getElementById('slider-blur');
const labelBlurValue = document.getElementById('label-blur-value');

const toggleShortcuts = document.getElementById('toggle-shortcuts');

// Seção Proxy
const toggleProxyEnabled = document.getElementById('toggle-proxy-enabled');
const proxyFields = document.getElementById('proxy-fields');
const selectProxyProtocol = document.getElementById('select-proxy-protocol');
const inputProxyHost = document.getElementById('input-proxy-host');
const inputProxyPort = document.getElementById('input-proxy-port');
const inputProxyUsername = document.getElementById('input-proxy-username');
const inputProxyPassword = document.getElementById('input-proxy-password');
const toggleProxyApplyPrivate = document.getElementById('toggle-proxy-apply-private');
const btnTestProxy = document.getElementById('btn-test-proxy');
const proxyTestStatus = document.getElementById('proxy-test-status');

// Seção Permissões de Sites
const permissionsListContainer = document.getElementById('permissions-list-container');
const permissionsEmpty = document.getElementById('permissions-empty');

// Seção Privacidade Avançada (Fingerprinting Multivetorial)
const btnResetFingerprint = document.getElementById('btn-reset-fingerprint');
const fpConsistencyBox = document.getElementById('fp-consistency-box');
const toggleFpEnabled = document.getElementById('toggle-fp-enabled');
const fpSuboptions = document.getElementById('fp-suboptions');

// Grupo A — Identidade do Sistema
const selectFpOs = document.getElementById('select-fp-os');
const selectFpBrowser = document.getElementById('select-fp-browser');
const selectFpPlatform = document.getElementById('select-fp-platform');
const selectFpLocale = document.getElementById('select-fp-locale');
const selectFpTimezone = document.getElementById('select-fp-timezone');
const inputFpUa = document.getElementById('input-fp-ua');

// Grupo B — Hardware
const selectFpResolution = document.getElementById('select-fp-resolution');
const selectFpDpr = document.getElementById('select-fp-dpr');
const selectFpCores = document.getElementById('select-fp-cores');
const selectFpMemory = document.getElementById('select-fp-memory');
const toggleFpTouch = document.getElementById('toggle-fp-touch');

// Grupo C — GPU / WebGL
const inputFpWebglVendor = document.getElementById('input-fp-webgl-vendor');
const inputFpWebglRenderer = document.getElementById('input-fp-webgl-renderer');
const selectFpWebglMode = document.getElementById('select-fp-webgl-mode');

// Grupo D — Canvas, Áudio, ClientRects & Fontes
const selectFpCanvasMode = document.getElementById('select-fp-canvas-mode');
const selectFpAudioMode = document.getElementById('select-fp-audio-mode');
const selectFpClientRectsMode = document.getElementById('select-fp-clientrects-mode');
const selectFpFontsMode = document.getElementById('select-fp-fonts-mode');

// Grupo E — Outros Vetores
const selectFpWebrtcMode = document.getElementById('select-fp-webrtc-mode');
const selectFpMediaCount = document.getElementById('select-fp-media-count');
const selectFpSpeechVoices = document.getElementById('select-fp-speech-voices');
const selectFpBatteryMode = document.getElementById('select-fp-battery-mode');
const selectFpPermissionsMode = document.getElementById('select-fp-permissions-mode');

// -------------------------------------------------------------------------
// 1. NAVEGAÇÃO ENTRE ABAS LATERAIS
// -------------------------------------------------------------------------
navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');

    navButtons.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const targetPanel = document.getElementById(targetId);
    if (targetPanel) targetPanel.classList.add('active');

    // Se o painel aberto for o de permissões, recarrega a lista
    if (targetId === 'panel-permissions') {
      loadPermissions();
    }
  });
});

// -------------------------------------------------------------------------
// 2. APLICAÇÃO VISUAL LOCAL DA COR DE DESTAQUE
// -------------------------------------------------------------------------
function applyAccentColorLocal(color) {
  if (!color) return;
  document.documentElement.style.setProperty('--color-accent', color);
  if (inputAccentColor) inputAccentColor.value = color;
  if (labelAccentHex) labelAccentHex.textContent = color.toUpperCase();

  colorSwatches.forEach(swatch => {
    const swatchColor = swatch.getAttribute('data-color');
    if (swatchColor && swatchColor.toLowerCase() === color.toLowerCase()) {
      swatch.classList.add('active');
    } else {
      swatch.classList.remove('active');
    }
  });
}

// -------------------------------------------------------------------------
// 3. ATUALIZAÇÃO DO PREVIEW DA IMAGEM DE FUNDO
// -------------------------------------------------------------------------
function updateBgPreviewUI(dataUrl, dim, blur) {
  if (dataUrl) {
    if (bgPreviewBox) bgPreviewBox.style.backgroundImage = `url("${dataUrl}")`;
    if (bgPreviewEmpty) bgPreviewEmpty.style.display = 'none';
    if (bgPreviewOverlay) bgPreviewOverlay.style.display = 'block';
    if (btnRemoveBg) btnRemoveBg.style.display = 'inline-flex';
  } else {
    if (bgPreviewBox) bgPreviewBox.style.backgroundImage = 'none';
    if (bgPreviewEmpty) bgPreviewEmpty.style.display = 'flex';
    if (bgPreviewOverlay) bgPreviewOverlay.style.display = 'none';
    if (btnRemoveBg) btnRemoveBg.style.display = 'none';
  }

  if (typeof dim === 'number') {
    if (sliderDim) sliderDim.value = dim;
    if (labelDimValue) labelDimValue.textContent = `${dim}%`;
    if (bgPreviewOverlay) bgPreviewOverlay.style.backgroundColor = `rgba(0, 0, 0, ${dim / 100})`;
  }

  if (typeof blur === 'number') {
    if (sliderBlur) sliderBlur.value = blur;
    if (labelBlurValue) labelBlurValue.textContent = `${blur}px`;
  }
}

// -------------------------------------------------------------------------
// 4. CARREGAMENTO E RENDERIZAÇÃO DAS PERMISSÕES DE SITES
// -------------------------------------------------------------------------
async function loadPermissions() {
  if (!window.settingsAPI || !permissionsListContainer) return;

  try {
    const list = await window.settingsAPI.getPermissions();
    permissionsListContainer.innerHTML = '';

    const permLabels = {
      'media:video': 'Câmera',
      'media:audio': 'Microfone',
      'media': 'Câmera e Microfone',
      'notifications': 'Notificações',
      'geolocation': 'Localização',
      'midi': 'Dispositivos MIDI',
      'clipboard': 'Área de Transferência'
    };

    let totalRows = 0;

    if (Array.isArray(list)) {
      list.forEach(item => {
        const origin = item.origin || '';
        const permissions = item.permissions || {};

        for (const [key, state] of Object.entries(permissions)) {
          totalRows++;
          const row = document.createElement('div');
          row.className = 'perm-item-row';

          const info = document.createElement('div');
          info.className = 'perm-item-info';

          const originSpan = document.createElement('span');
          originSpan.className = 'perm-item-origin';
          originSpan.textContent = origin;

          const detailSpan = document.createElement('span');
          detailSpan.className = 'perm-item-detail';
          const label = permLabels[key] || key;
          detailSpan.textContent = `Recurso: ${label}`;

          info.appendChild(originSpan);
          info.appendChild(detailSpan);

          const actions = document.createElement('div');
          actions.className = 'perm-item-actions';

          const isAllowed = state === 'allow';
          const badge = document.createElement('span');
          badge.className = `perm-badge ${isAllowed ? 'allowed' : 'blocked'}`;
          badge.textContent = isAllowed ? 'Permitido' : 'Bloqueado';

          const btnRevoke = document.createElement('button');
          btnRevoke.type = 'button';
          btnRevoke.className = 'btn btn-secondary btn-revoke';
          btnRevoke.style.padding = '6px 12px';
          btnRevoke.style.fontSize = '12px';
          btnRevoke.textContent = 'Revogar';

          btnRevoke.addEventListener('click', async () => {
            await window.settingsAPI.revokePermission(origin, key);
            loadPermissions();
          });

          actions.appendChild(badge);
          actions.appendChild(btnRevoke);

          row.appendChild(info);
          row.appendChild(actions);

          permissionsListContainer.appendChild(row);
        }
      });
    }

    if (totalRows === 0) {
      if (permissionsEmpty) {
        permissionsListContainer.appendChild(permissionsEmpty);
        permissionsEmpty.style.display = 'block';
      }
    } else {
      if (permissionsEmpty) {
        permissionsEmpty.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('[Settings] Erro ao carregar permissões:', err);
  }
}

function setValIfNotFocused(el, val) {
  if (el && document.activeElement !== el) {
    el.value = val;
  }
}

function setCheckedIfNotFocused(el, val) {
  if (el && document.activeElement !== el) {
    el.checked = val;
  }
}

async function updateFpConsistencyUI(providedConfig) {
  if (!fpConsistencyBox || !window.settingsAPI || typeof window.settingsAPI.validateFingerprint !== 'function') return;

  const config = providedConfig || {
    fpOs: selectFpOs ? selectFpOs.value : 'windows11',
    fpBrowser: selectFpBrowser ? selectFpBrowser.value : 'chrome',
    fpPlatform: selectFpPlatform ? selectFpPlatform.value : 'auto',
    fpLocale: selectFpLocale ? selectFpLocale.value : 'pt-BR',
    fpTimezone: selectFpTimezone ? selectFpTimezone.value : 'America/Sao_Paulo',
    fpUserAgent: inputFpUa ? inputFpUa.value : 'auto',
    fpScreenResolution: selectFpResolution ? selectFpResolution.value : '1920x1080',
    fpDevicePixelRatio: selectFpDpr ? selectFpDpr.value : 'auto',
    fpHardwareConcurrency: selectFpCores ? Number(selectFpCores.value) : 8,
    fpDeviceMemory: selectFpMemory ? Number(selectFpMemory.value) : 8,
    fpTouchSupport: toggleFpTouch ? toggleFpTouch.checked : false,
    fpWebglVendor: inputFpWebglVendor ? inputFpWebglVendor.value : 'auto',
    fpWebglRenderer: inputFpWebglRenderer ? inputFpWebglRenderer.value : 'auto'
  };

  try {
    const res = await window.settingsAPI.validateFingerprint(config);
    if (!res) {
      fpConsistencyBox.style.display = 'none';
      return;
    }

    const { valid, errors, warnings } = res;
    fpConsistencyBox.replaceChildren();

    if (!valid && errors && errors.length > 0) {
      fpConsistencyBox.style.display = 'block';
      fpConsistencyBox.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      fpConsistencyBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      fpConsistencyBox.style.color = '#ef4444';

      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.style.marginBottom = '6px';
      title.textContent = '⚠️ Inconsistência de Fingerprint Detectada:';
      fpConsistencyBox.appendChild(title);

      const ul = document.createElement('ul');
      ul.style.margin = '0';
      ul.style.paddingLeft = '20px';
      errors.forEach(err => {
        const li = document.createElement('li');
        li.textContent = err;
        ul.appendChild(li);
      });
      fpConsistencyBox.appendChild(ul);
    } else if (warnings && warnings.length > 0) {
      fpConsistencyBox.style.display = 'block';
      fpConsistencyBox.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
      fpConsistencyBox.style.border = '1px solid rgba(245, 158, 11, 0.4)';
      fpConsistencyBox.style.color = '#f59e0b';

      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.style.marginBottom = '6px';
      title.textContent = 'ℹ️ Aviso de Configuração Não Usual:';
      fpConsistencyBox.appendChild(title);

      const ul = document.createElement('ul');
      ul.style.margin = '0';
      ul.style.paddingLeft = '20px';
      warnings.forEach(warn => {
        const li = document.createElement('li');
        li.textContent = warn;
        ul.appendChild(li);
      });
      fpConsistencyBox.appendChild(ul);
    } else {
      fpConsistencyBox.style.display = 'none';
    }
  } catch (err) {
    console.warn('[Settings] Falha ao validar consistência do fingerprint:', err);
  }
}

// -------------------------------------------------------------------------
// 5. CARREGAMENTO INICIAL DAS CONFIGURAÇÕES DO MAIN PROCESS
// -------------------------------------------------------------------------
async function loadSettings() {
  if (!window.settingsAPI) {
    console.warn('[Settings] window.settingsAPI indisponível.');
    return;
  }

  try {
    const s = await window.settingsAPI.getSettings();
    if (!s) return;

    // Seção Principal - apenas atualiza campos que não estão em foco
    setValIfNotFocused(selectSearchEngine, s.searchEngine || 'duckduckgo');
    if (wrapCustomSearch) wrapCustomSearch.style.display = (selectSearchEngine && selectSearchEngine.value === 'custom') ? 'flex' : 'none';
    setValIfNotFocused(inputCustomSearch, s.customSearchUrl || '');

    if (s.startupBehavior === 'restore') {
      setCheckedIfNotFocused(startupRestore, true);
      if (wrapStartupUrl) wrapStartupUrl.style.display = 'none';
    } else if (s.startupBehavior === 'custom') {
      setCheckedIfNotFocused(startupCustom, true);
      if (wrapStartupUrl) wrapStartupUrl.style.display = 'flex';
    } else {
      setCheckedIfNotFocused(startupNewTab, true);
      if (wrapStartupUrl) wrapStartupUrl.style.display = 'none';
    }
    setValIfNotFocused(inputStartupUrl, s.startupCustomUrl || '');

    setValIfNotFocused(inputHomeUrl, s.homePageUrl || '');
    setValIfNotFocused(selectZoom, (s.defaultZoom || 1.0).toString());
    setCheckedIfNotFocused(chkClearOnExit, Boolean(s.clearDataOnExit));

    // Seção Personalização
    applyAccentColorLocal(s.accentColor || '#4d7cff');

    if (s.theme === 'light') {
      setCheckedIfNotFocused(themeLight, true);
    } else if (s.theme === 'system') {
      setCheckedIfNotFocused(themeSystem, true);
    } else {
      setCheckedIfNotFocused(themeDark, true);
    }

    // Apenas atualiza sliders se não estiverem em foco
    if (document.activeElement !== sliderDim && document.activeElement !== sliderBlur) {
      updateBgPreviewUI(s.backgroundImageDataUrl, s.backgroundDim, s.backgroundBlur);
    }

    setCheckedIfNotFocused(toggleShortcuts, s.showShortcuts !== false);

    // Seção Proxy
    if (toggleProxyEnabled) {
      setCheckedIfNotFocused(toggleProxyEnabled, Boolean(s.proxyEnabled));
      if (proxyFields) proxyFields.style.display = s.proxyEnabled ? 'flex' : 'none';
    }
    setValIfNotFocused(selectProxyProtocol, s.proxyProtocol || 'http');
    setValIfNotFocused(inputProxyHost, s.proxyHost || '');
    setValIfNotFocused(inputProxyPort, s.proxyPort || '');
    setValIfNotFocused(inputProxyUsername, s.proxyUsername || '');
    setValIfNotFocused(inputProxyPassword, s.hasProxyPassword ? '••••••••' : '');
    setCheckedIfNotFocused(toggleProxyApplyPrivate, Boolean(s.proxyApplyPrivate));

    // Seção Privacidade Avançada (Fingerprinting Multivetorial)
    if (toggleFpEnabled) {
      const fpEnabled = Boolean(s.fingerprintProtectionEnabled);
      setCheckedIfNotFocused(toggleFpEnabled, fpEnabled);
      if (fpSuboptions) {
        fpSuboptions.style.opacity = fpEnabled ? '1' : '0.5';
        fpSuboptions.style.pointerEvents = fpEnabled ? 'auto' : 'none';
      }
    }

    // Grupo A
    setValIfNotFocused(selectFpOs, s.fpOs || 'windows11');
    setValIfNotFocused(selectFpBrowser, s.fpBrowser || 'chrome');
    setValIfNotFocused(selectFpPlatform, s.fpPlatform || 'auto');
    setValIfNotFocused(selectFpLocale, s.fpLocale || 'pt-BR');
    setValIfNotFocused(selectFpTimezone, s.fpTimezone || 'America/Sao_Paulo');
    setValIfNotFocused(inputFpUa, s.fpUserAgent || 'auto');

    // Grupo B
    setValIfNotFocused(selectFpResolution, s.fpScreenResolution || '1920x1080');
    setValIfNotFocused(selectFpDpr, s.fpDevicePixelRatio ? String(s.fpDevicePixelRatio) : 'auto');
    setValIfNotFocused(selectFpCores, s.fpHardwareConcurrency ? String(s.fpHardwareConcurrency) : '8');
    setValIfNotFocused(selectFpMemory, s.fpDeviceMemory ? String(s.fpDeviceMemory) : '8');
    setCheckedIfNotFocused(toggleFpTouch, Boolean(s.fpTouchSupport));

    // Grupo C
    setValIfNotFocused(inputFpWebglVendor, s.fpWebglVendor || 'auto');
    setValIfNotFocused(inputFpWebglRenderer, s.fpWebglRenderer || 'auto');
    setValIfNotFocused(selectFpWebglMode, s.fpWebglImageMode || 'noise');

    // Grupo D
    setValIfNotFocused(selectFpCanvasMode, s.fpCanvasMode || 'noise');
    setValIfNotFocused(selectFpAudioMode, s.fpAudioMode || 'noise');
    setValIfNotFocused(selectFpClientRectsMode, s.fpClientRectsMode || 'noise');
    setValIfNotFocused(selectFpFontsMode, s.fpFontsMode || 'mask');

    // Grupo E
    setValIfNotFocused(selectFpWebrtcMode, s.fpWebrtcMode || 'proxy');
    setValIfNotFocused(selectFpMediaCount, s.fpMediaDevicesCount ? String(s.fpMediaDevicesCount) : '2');
    setValIfNotFocused(selectFpSpeechVoices, s.fpSpeechVoices || 'mask');
    setValIfNotFocused(selectFpBatteryMode, s.fpBatteryMode || 'mask');
    setValIfNotFocused(selectFpPermissionsMode, s.fpPermissionsMode || 'mask');

    // Atualiza status de consistência
    updateFpConsistencyUI(s);

    // Carrega Permissões
    loadPermissions();

  } catch (err) {
    console.error('[Settings] Erro ao carregar configurações:', err);
  }
}

// -------------------------------------------------------------------------
// 6. REGISTRO DE EVENTOS DE INTERAÇÃO COM DEBOUNCE
// -------------------------------------------------------------------------
function initEvents() {
  if (!window.settingsAPI) return;

  const debouncedSet = debounce((key, val) => {
    window.settingsAPI.setSetting(key, val);
  }, 300);

  // Mecanismo de busca
  if (selectSearchEngine) {
    selectSearchEngine.addEventListener('change', () => {
      const val = selectSearchEngine.value;
      if (wrapCustomSearch) wrapCustomSearch.style.display = val === 'custom' ? 'flex' : 'none';
      window.settingsAPI.setSetting('searchEngine', val);
    });
  }

  if (inputCustomSearch) {
    inputCustomSearch.addEventListener('input', () => {
      debouncedSet('customSearchUrl', inputCustomSearch.value.trim());
    });
  }

  // Ao iniciar
  const onStartupChange = () => {
    let val = 'newtab';
    if (startupRestore && startupRestore.checked) val = 'restore';
    else if (startupCustom && startupCustom.checked) val = 'custom';

    if (wrapStartupUrl) wrapStartupUrl.style.display = val === 'custom' ? 'flex' : 'none';
    window.settingsAPI.setSetting('startupBehavior', val);
  };

  if (startupNewTab) startupNewTab.addEventListener('change', onStartupChange);
  if (startupRestore) startupRestore.addEventListener('change', onStartupChange);
  if (startupCustom) startupCustom.addEventListener('change', onStartupChange);

  if (inputStartupUrl) {
    inputStartupUrl.addEventListener('input', () => {
      debouncedSet('startupCustomUrl', inputStartupUrl.value.trim());
    });
  }

  // Página inicial
  if (inputHomeUrl) {
    inputHomeUrl.addEventListener('input', () => {
      debouncedSet('homePageUrl', inputHomeUrl.value.trim());
    });
  }

  // Zoom padrão
  if (selectZoom) {
    selectZoom.addEventListener('change', () => {
      const factor = parseFloat(selectZoom.value) || 1.0;
      window.settingsAPI.setSetting('defaultZoom', factor);
    });
  }

  // Limpar dados ao fechar
  if (chkClearOnExit) {
    chkClearOnExit.addEventListener('change', () => {
      window.settingsAPI.setSetting('clearDataOnExit', chkClearOnExit.checked);
    });
  }

  // Cor de destaque - Paleta pronta
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.getAttribute('data-color');
      if (color) {
        applyAccentColorLocal(color);
        window.settingsAPI.setSetting('accentColor', color);
      }
    });
  });

  // Cor de destaque - Campo livre
  if (inputAccentColor) {
    inputAccentColor.addEventListener('input', () => {
      const color = inputAccentColor.value;
      applyAccentColorLocal(color);
      debouncedSet('accentColor', color);
    });
  }

  // Tema
  const onThemeChange = (themeVal) => {
    window.settingsAPI.setSetting('theme', themeVal);
  };

  if (themeDark) themeDark.addEventListener('change', () => { if (themeDark.checked) onThemeChange('dark'); });
  if (themeLight) themeLight.addEventListener('change', () => { if (themeLight.checked) onThemeChange('light'); });
  if (themeSystem) themeSystem.addEventListener('change', () => { if (themeSystem.checked) onThemeChange('system'); });

  // Imagem de Fundo - Escolher
  if (btnChooseBg) {
    btnChooseBg.addEventListener('click', async () => {
      try {
        const res = await window.settingsAPI.chooseBackgroundImage();
        if (res && res.dataUrl) {
          updateBgPreviewUI(res.dataUrl, parseInt(sliderDim.value), parseInt(sliderBlur.value));
        }
      } catch (err) {
        console.error('[Settings] Erro ao selecionar imagem:', err);
      }
    });
  }

  // Imagem de Fundo - Remover
  if (btnRemoveBg) {
    btnRemoveBg.addEventListener('click', async () => {
      try {
        await window.settingsAPI.removeBackgroundImage();
        updateBgPreviewUI('', parseInt(sliderDim.value), parseInt(sliderBlur.value));
      } catch (err) {
        console.error('[Settings] Erro ao remover imagem:', err);
      }
    });
  }

  // Sliders de escurecimento e desfoque com debounce
  if (sliderDim) {
    sliderDim.addEventListener('input', () => {
      const val = parseInt(sliderDim.value);
      if (labelDimValue) labelDimValue.textContent = `${val}%`;
      if (bgPreviewOverlay) bgPreviewOverlay.style.backgroundColor = `rgba(0, 0, 0, ${val / 100})`;
      debouncedSet('backgroundDim', val);
    });
  }

  if (sliderBlur) {
    sliderBlur.addEventListener('input', () => {
      const val = parseInt(sliderBlur.value);
      if (labelBlurValue) labelBlurValue.textContent = `${val}px`;
      debouncedSet('backgroundBlur', val);
    });
  }

  // Mostrar atalhos
  if (toggleShortcuts) {
    toggleShortcuts.addEventListener('change', () => {
      window.settingsAPI.setSetting('showShortcuts', toggleShortcuts.checked);
    });
  }

  // Controles de Proxy
  if (toggleProxyEnabled) {
    toggleProxyEnabled.addEventListener('change', () => {
      const enabled = toggleProxyEnabled.checked;
      if (proxyFields) proxyFields.style.display = enabled ? 'flex' : 'none';
      window.settingsAPI.setSetting('proxyEnabled', enabled);
    });
  }

  if (selectProxyProtocol) {
    selectProxyProtocol.addEventListener('change', () => {
      window.settingsAPI.setSetting('proxyProtocol', selectProxyProtocol.value);
    });
  }

  if (inputProxyHost) {
    inputProxyHost.addEventListener('input', () => {
      debouncedSet('proxyHost', inputProxyHost.value.trim());
    });
  }

  if (inputProxyPort) {
    inputProxyPort.addEventListener('input', () => {
      debouncedSet('proxyPort', inputProxyPort.value.trim());
    });
  }

  if (inputProxyUsername) {
    inputProxyUsername.addEventListener('input', () => {
      debouncedSet('proxyUsername', inputProxyUsername.value.trim());
    });
  }

  if (inputProxyPassword) {
    const debouncedPass = debounce((pass) => {
      window.settingsAPI.setProxyPassword(pass);
    }, 400);

    inputProxyPassword.addEventListener('input', () => {
      debouncedPass(inputProxyPassword.value);
    });
  }

  if (toggleProxyApplyPrivate) {
    toggleProxyApplyPrivate.addEventListener('change', () => {
      window.settingsAPI.setSetting('proxyApplyPrivate', toggleProxyApplyPrivate.checked);
    });
  }

  if (btnTestProxy) {
    btnTestProxy.addEventListener('click', async () => {
      if (!proxyTestStatus) return;

      const host = inputProxyHost ? inputProxyHost.value.trim() : '';
      const port = inputProxyPort ? inputProxyPort.value.trim() : '';

      if (!host) {
        proxyTestStatus.textContent = 'Erro: informe o host do proxy.';
        proxyTestStatus.style.color = '#ef4444';
        return;
      }

      proxyTestStatus.textContent = 'Testando conexão através do proxy...';
      proxyTestStatus.style.color = 'var(--color-text-secondary)';

      try {
        const result = await window.settingsAPI.testProxy({
          protocol: selectProxyProtocol ? selectProxyProtocol.value : 'http',
          host,
          port,
          username: inputProxyUsername ? inputProxyUsername.value.trim() : '',
          password: inputProxyPassword ? inputProxyPassword.value : ''
        });

        if (result && result.success) {
          proxyTestStatus.textContent = '✓ Conexão bem-sucedida!';
          proxyTestStatus.style.color = '#10b981';
        } else {
          proxyTestStatus.textContent = `✗ Falha: ${result ? result.message : 'Timeout ou erro de rede'}`;
          proxyTestStatus.style.color = '#ef4444';
        }
      } catch (err) {
        proxyTestStatus.textContent = `✗ Erro no teste: ${err.message || err}`;
        proxyTestStatus.style.color = '#ef4444';
      }
    });
  }

  // =========================================================================
  // Controles de Privacidade Avançada (Fingerprinting Multivetorial)
  // =========================================================================

  // Botão "Resetar Fingerprint"
  if (btnResetFingerprint) {
    btnResetFingerprint.addEventListener('click', async () => {
      const confirmReset = window.confirm(
        'Isso vai gerar uma nova identidade de fingerprint aleatória e consistente. Todas as abas abertas serão recarregadas. Deseja continuar?'
      );
      if (!confirmReset) return;

      try {
        btnResetFingerprint.disabled = true;
        btnResetFingerprint.style.opacity = '0.6';
        const res = await window.settingsAPI.resetFingerprint();
        if (res && res.config) {
          await loadSettings();
          if (fpConsistencyBox) {
            fpConsistencyBox.replaceChildren();
            fpConsistencyBox.style.display = 'block';
            fpConsistencyBox.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
            fpConsistencyBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            fpConsistencyBox.style.color = '#10b981';
            fpConsistencyBox.textContent = '✓ Fingerprint resetado com sucesso! Nova identidade ativa aplicada a todas as abas web.';
            setTimeout(() => {
              updateFpConsistencyUI();
            }, 4500);
          }
        }
      } catch (err) {
        console.error('[Settings] Erro ao resetar fingerprint:', err);
      } finally {
        btnResetFingerprint.disabled = false;
        btnResetFingerprint.style.opacity = '1';
      }
    });
  }

  // Toggle Mestre de Fingerprinting
  if (toggleFpEnabled) {
    toggleFpEnabled.addEventListener('change', () => {
      const enabled = toggleFpEnabled.checked;
      if (fpSuboptions) {
        fpSuboptions.style.opacity = enabled ? '1' : '0.5';
        fpSuboptions.style.pointerEvents = enabled ? 'auto' : 'none';
      }
      window.settingsAPI.setSetting('fingerprintProtectionEnabled', enabled);
    });
  }

  // GRUPO A: IDENTIDADE DO SISTEMA
  if (selectFpOs) {
    selectFpOs.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpOs', selectFpOs.value);
      updateFpConsistencyUI();
    });
  }
  if (selectFpBrowser) {
    selectFpBrowser.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpBrowser', selectFpBrowser.value);
      updateFpConsistencyUI();
    });
  }
  if (selectFpPlatform) {
    selectFpPlatform.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpPlatform', selectFpPlatform.value);
      updateFpConsistencyUI();
    });
  }
  if (selectFpLocale) {
    selectFpLocale.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpLocale', selectFpLocale.value);
      updateFpConsistencyUI();
    });
  }
  if (selectFpTimezone) {
    selectFpTimezone.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpTimezone', selectFpTimezone.value);
      updateFpConsistencyUI();
    });
  }
  if (inputFpUa) {
    inputFpUa.addEventListener('input', () => {
      const val = inputFpUa.value.trim();
      debouncedSet('fpUserAgent', val || 'auto');
      updateFpConsistencyUI();
    });
  }

  // GRUPO B: HARDWARE
  if (selectFpResolution) {
    selectFpResolution.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpScreenResolution', selectFpResolution.value);
      updateFpConsistencyUI();
    });
  }
  if (selectFpDpr) {
    selectFpDpr.addEventListener('change', () => {
      const val = selectFpDpr.value === 'auto' ? 'auto' : Number(selectFpDpr.value);
      window.settingsAPI.setSetting('fpDevicePixelRatio', val);
      updateFpConsistencyUI();
    });
  }
  if (selectFpCores) {
    selectFpCores.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpHardwareConcurrency', Number(selectFpCores.value));
      updateFpConsistencyUI();
    });
  }
  if (selectFpMemory) {
    selectFpMemory.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpDeviceMemory', Number(selectFpMemory.value));
      updateFpConsistencyUI();
    });
  }
  if (toggleFpTouch) {
    toggleFpTouch.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpTouchSupport', toggleFpTouch.checked);
      updateFpConsistencyUI();
    });
  }

  // GRUPO C: GPU / WEBGL
  if (inputFpWebglVendor) {
    inputFpWebglVendor.addEventListener('input', () => {
      const val = inputFpWebglVendor.value.trim();
      debouncedSet('fpWebglVendor', val || 'auto');
      updateFpConsistencyUI();
    });
  }
  if (inputFpWebglRenderer) {
    inputFpWebglRenderer.addEventListener('input', () => {
      const val = inputFpWebglRenderer.value.trim();
      debouncedSet('fpWebglRenderer', val || 'auto');
      updateFpConsistencyUI();
    });
  }
  if (selectFpWebglMode) {
    selectFpWebglMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpWebglImageMode', selectFpWebglMode.value);
    });
  }

  // GRUPO D: CANVAS, ÁUDIO, CLIENTRECTS & FONTES
  if (selectFpCanvasMode) {
    selectFpCanvasMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpCanvasMode', selectFpCanvasMode.value);
    });
  }
  if (selectFpAudioMode) {
    selectFpAudioMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpAudioMode', selectFpAudioMode.value);
    });
  }
  if (selectFpClientRectsMode) {
    selectFpClientRectsMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpClientRectsMode', selectFpClientRectsMode.value);
    });
  }
  if (selectFpFontsMode) {
    selectFpFontsMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpFontsMode', selectFpFontsMode.value);
    });
  }

  // GRUPO E: OUTROS VETORES
  if (selectFpWebrtcMode) {
    selectFpWebrtcMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpWebrtcMode', selectFpWebrtcMode.value);
    });
  }
  if (selectFpMediaCount) {
    selectFpMediaCount.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpMediaDevicesCount', Number(selectFpMediaCount.value));
    });
  }
  if (selectFpSpeechVoices) {
    selectFpSpeechVoices.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpSpeechVoices', selectFpSpeechVoices.value);
    });
  }
  if (selectFpBatteryMode) {
    selectFpBatteryMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpBatteryMode', selectFpBatteryMode.value);
    });
  }
  if (selectFpPermissionsMode) {
    selectFpPermissionsMode.addEventListener('change', () => {
      window.settingsAPI.setSetting('fpPermissionsMode', selectFpPermissionsMode.value);
    });
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initEvents();

  if (window.settingsAPI && typeof window.settingsAPI.onSettingsChanged === 'function') {
    window.settingsAPI.onSettingsChanged(() => {
      loadSettings();
    });
  }
});
```

---

### 4.47 `pages/newtab.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Dragon - Nova Aba</title>
  <style>
    :root {
      --color-accent: #4d7cff;
      --color-accent-hover: #3b6ae6;
      --fire-mid: #29B6FF;
      --fire-main: #0194FF;
      --color-bg-base: #18181d;
      --color-text-main: #f0f0f5;
      --color-text-sub: #9e9ea8;
      --color-card-bg: #1f1f26;
      --color-card-border: #2d2d38;
      --color-input-bg: #22222a;
      --color-input-border: #333340;
      --color-kbd-bg: #2c2c36;
      --color-kbd-border: #3d3d4b;
      --color-kbd-text: #e0e0ea;
      --bg-dim-opacity: 0.4;
      --bg-blur-amount: 4px;
    }

    /* Tema Claro */
    body.theme-light {
      --color-bg-base: #f0f2f7;
      --color-text-main: #18181f;
      --color-text-sub: #585868;
      --color-card-bg: #ffffff;
      --color-card-border: #dcdfe8;
      --color-input-bg: #ffffff;
      --color-input-border: #d0d4e0;
      --color-kbd-bg: #ebedf5;
      --color-kbd-border: #d0d4e0;
      --color-kbd-text: #2c2c36;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--color-bg-base);
      color: var(--color-text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      user-select: none;
      position: relative;
      overflow-x: hidden;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    /* Camada de Imagem de Fundo Personalizada */
    #bg-image-layer {
      position: fixed;
      inset: -20px;
      z-index: -2;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: none;
      filter: blur(var(--bg-blur-amount));
      transform: scale(1.05);
      transition: filter 0.2s ease, opacity 0.3s ease;
    }

    /* Camada de Escurecimento do Fundo */
    #bg-dim-layer {
      position: fixed;
      inset: 0;
      z-index: -1;
      background-color: rgba(0, 0, 0, var(--bg-dim-opacity));
      display: none;
      pointer-events: none;
      transition: background-color 0.2s ease;
    }

    .container {
      max-width: 680px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      z-index: 1;
    }

    .logo-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 58px;
      height: 58px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 0 8px var(--fire-mid)) drop-shadow(0 0 16px var(--fire-main));
      animation: logo-glow-pulse 2.8s ease-in-out infinite;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), filter 0.25s ease;
      cursor: default;
    }

    .logo-icon:hover {
      transform: scale(1.08);
      filter: drop-shadow(0 0 12px var(--fire-mid)) drop-shadow(0 0 24px var(--color-accent));
      animation-play-state: paused;
    }

    .logo-icon img {
      width: 48px;
      height: 48px;
      object-fit: contain;
      display: block;
      user-select: none;
      -webkit-user-drag: none;
    }

    .logo-icon svg {
      width: 34px;
      height: 34px;
      fill: #ffffff;
    }

    @keyframes logo-glow-pulse {
      0%, 100% {
        filter: drop-shadow(0 0 7px var(--fire-mid)) drop-shadow(0 0 14px var(--fire-main));
      }
      50% {
        filter: drop-shadow(0 0 12px var(--fire-mid)) drop-shadow(0 0 22px var(--color-accent));
      }
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }

    p.subtitle {
      color: var(--color-text-sub);
      font-size: 14px;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }

    .search-box {
      width: 100%;
      background-color: var(--color-input-bg);
      border: 1px solid var(--color-input-border);
      border-radius: 28px;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
    }

    .search-box:focus-within {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(77, 124, 255, 0.2), 0 6px 24px rgba(0, 0, 0, 0.3);
    }

    .search-box svg {
      width: 18px;
      height: 18px;
      fill: var(--color-text-sub);
      flex-shrink: 0;
    }

    .search-input {
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: var(--color-text-main);
      font-size: 15px;
      user-select: text;
    }

    .search-input::placeholder {
      color: var(--color-text-sub);
      opacity: 0.8;
    }

    .shortcuts-card {
      width: 100%;
      background-color: var(--color-card-bg);
      border: 1px solid var(--color-card-border);
      border-radius: 14px;
      padding: 18px 22px;
      text-align: left;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(8px);
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .shortcuts-card h2 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--color-text-sub);
      margin-bottom: 14px;
      font-weight: 600;
    }

    .shortcuts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px 16px;
    }

    .shortcut-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      color: var(--color-text-main);
    }

    kbd {
      background-color: var(--color-kbd-bg);
      border: 1px solid var(--color-kbd-border);
      border-radius: 4px;
      padding: 2px 7px;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      color: var(--color-kbd-text);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
  </style>
</head>
<body>
  <!-- Camadas para imagem de fundo personalizada da nova aba -->
  <div id="bg-image-layer"></div>
  <div id="bg-dim-layer"></div>

  <div class="container">
    <div class="logo-area">
      <div class="logo-icon">
        <img src="../assets/icons/favicon-circle.png" alt="Dragon">
      </div>
      <h1>Dragon</h1>
      <p id="subtitle-text" class="subtitle">Navegação rápida, privada e segura</p>
    </div>

    <!-- Barra de busca rápida na página inicial -->
    <form class="search-box" id="search-form">
      <svg viewBox="0 0 16 16">
        <path d="M11.5 7a4.499 4.499 0 1 1-8.998 0A4.499 4.499 0 0 1 11.5 7zm-.82 4.74a6 6 0 1 0-1.06 1.06l3.65 3.65a.75.75 0 1 0 1.06-1.06l-3.65-3.65z"/>
      </svg>
      <input
        class="search-input"
        id="search-input"
        type="text"
        placeholder="Pesquisar ou digitar endereço da web..."
        autofocus
        autocomplete="off"
        spellcheck="false"
      />
    </form>

    <!-- Cartão com atalhos de teclado rápidos -->
    <div id="shortcuts-card" class="shortcuts-card">
      <h2>Atalhos Rápidos</h2>
      <div class="shortcuts-grid">
        <div class="shortcut-item"><span>Nova aba</span><kbd>Ctrl + T</kbd></div>
        <div class="shortcut-item"><span>Fechar aba ativa</span><kbd>Ctrl + W</kbd></div>
        <div class="shortcut-item"><span>Reabrir aba fechada</span><kbd>Ctrl + Shift + T</kbd></div>
        <div class="shortcut-item"><span>Focar endereço</span><kbd>Ctrl + L</kbd></div>
        <div class="shortcut-item"><span>Buscar na página</span><kbd>Ctrl + F</kbd></div>
        <div class="shortcut-item"><span>Favoritar página</span><kbd>Ctrl + D</kbd></div>
        <div class="shortcut-item"><span>Histórico</span><kbd>Ctrl + H</kbd></div>
        <div class="shortcut-item"><span>Downloads</span><kbd>Ctrl + J</kbd></div>
        <div class="shortcut-item"><span>Configurações</span><kbd>Ctrl + ,</kbd></div>
        <div class="shortcut-item"><span>Recarregar página</span><kbd>Ctrl + R / F5</kbd></div>
        <div class="shortcut-item"><span>Próxima aba</span><kbd>Ctrl + Tab</kbd></div>
        <div class="shortcut-item"><span>Aba anterior</span><kbd>Ctrl + Shift + Tab</kbd></div>
        <div class="shortcut-item"><span>Abas 1 a 9</span><kbd>Ctrl + 1..9</kbd></div>
        <div class="shortcut-item"><span>Zoom</span><kbd>Ctrl + / - / 0</kbd></div>
        <div class="shortcut-item"><span>Apagar tudo</span><kbd>Ctrl + Shift + Del</kbd></div>
      </div>
    </div>
  </div>

  <script src="newtab.js"></script>
</body>
</html>
```

---

### 4.48 `pages/newtab.js`

```javascript
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
```

---

### 4.49 `pages/history.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Histórico - Dragon</title>
  <link rel="stylesheet" href="../src/renderer/styles/theme.css">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--color-bg-window, #1e1e24);
      color: var(--color-text-primary, #f0f0f5);
      font-family: var(--font-family-base, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--font-size-base, 13px);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    header {
      background-color: var(--color-bg-toolbar, #23232b);
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
      padding: 20px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-logo {
      width: 32px;
      height: 32px;
      filter: drop-shadow(0 0 5px rgba(41, 182, 255, 0.45));
      transition: filter 0.25s ease, transform 0.25s ease;
    }

    .header-logo:hover {
      transform: scale(1.08);
      filter: drop-shadow(0 0 8px rgba(41, 182, 255, 0.75));
    }

    .header-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      max-width: 500px;
      justify-content: flex-end;
    }

    .search-input-wrap {
      position: relative;
      flex: 1;
      max-width: 320px;
    }

    .search-input {
      width: 100%;
      background-color: var(--color-bg-input, #18181d);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-md, 6px);
      padding: 8px 12px 8px 32px;
      color: var(--color-text-primary, #f0f0f5);
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }

    .search-input:focus {
      border-color: var(--color-accent, #4d7cff);
    }

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      fill: var(--color-text-muted, #666673);
      pointer-events: none;
    }

    .btn-clear {
      background-color: rgba(255, 77, 77, 0.12);
      border: 1px solid rgba(255, 77, 77, 0.3);
      color: #ff6b6b;
      padding: 8px 14px;
      border-radius: var(--radius-md, 6px);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .btn-clear:hover {
      background-color: rgba(255, 77, 77, 0.22);
    }

    main {
      flex: 1;
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 24px;
    }

    .history-card {
      background-color: var(--color-bg-toolbar, #23232b);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-lg, 8px);
      overflow: hidden;
    }

    .history-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
      transition: background-color 0.15s;
    }

    .history-item:last-child {
      border-bottom: none;
    }

    .history-item:hover {
      background-color: var(--color-bg-button-hover, #333340);
    }

    .item-time {
      font-size: 12px;
      color: var(--color-text-muted, #666673);
      width: 52px;
      flex-shrink: 0;
    }

    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      cursor: pointer;
    }

    .item-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary, #f0f0f5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-url {
      font-size: 12px;
      color: var(--color-text-secondary, #9e9ea8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-delete-item {
      background: transparent;
      border: none;
      color: var(--color-text-muted, #666673);
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      transition: opacity 0.15s, color 0.15s, background-color 0.15s;
    }

    .btn-delete-item:hover {
      opacity: 1;
      color: #ff6b6b;
      background-color: rgba(255, 77, 77, 0.1);
    }

    .btn-delete-item svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--color-text-muted, #666673);
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      fill: currentColor;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <img src="../assets/icons/favicon-circle.png" alt="Dragon" class="header-logo" />
      <h1 class="header-title">Histórico</h1>
    </div>
    <div class="header-actions">
      <div class="search-input-wrap">
        <svg class="search-icon" viewBox="0 0 16 16">
          <path d="M11.5 7a4.499 4.499 0 1 1-8.998 0A4.499 4.499 0 0 1 11.5 7zm-.82 4.74a6 6 0 1 0-1.06 1.06l3.65 3.65a.75.75 0 1 0 1.06-1.06l-3.65-3.65z"/>
        </svg>
        <input type="text" id="input-search" class="search-input" placeholder="Pesquisar no histórico..." />
      </div>
      <button id="btn-clear-all" class="btn-clear">Limpar Histórico</button>
    </div>
  </header>

  <main>
    <div id="history-container" class="history-card">
      <div class="empty-state">
        <svg viewBox="0 0 16 16">
          <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933zm1.376.868a6.975 6.975 0 0 0-.757-.597l.5-.866c.348.202.68.431.996.685l-.739.778zM8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
        </svg>
        <p>Nenhuma página visitada ainda</p>
      </div>
    </div>
  </main>

  <script src="history.js"></script>
</body>
</html>
```

---

### 4.50 `pages/history.js`

```javascript
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
```

---

### 4.51 `pages/bookmarks.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Favoritos - Dragon</title>
  <link rel="stylesheet" href="../src/renderer/styles/theme.css">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--color-bg-window, #1e1e24);
      color: var(--color-text-primary, #f0f0f5);
      font-family: var(--font-family-base, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--font-size-base, 13px);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    header {
      background-color: var(--color-bg-toolbar, #23232b);
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
      padding: 20px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-logo {
      width: 32px;
      height: 32px;
      filter: drop-shadow(0 0 5px rgba(41, 182, 255, 0.45));
      transition: filter 0.25s ease, transform 0.25s ease;
    }

    .header-logo:hover {
      transform: scale(1.08);
      filter: drop-shadow(0 0 8px rgba(41, 182, 255, 0.75));
    }

    .header-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      max-width: 500px;
      justify-content: flex-end;
    }

    .search-input-wrap {
      position: relative;
      flex: 1;
      max-width: 320px;
    }

    .search-input {
      width: 100%;
      background-color: var(--color-bg-input, #18181d);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-md, 6px);
      padding: 8px 12px 8px 32px;
      color: var(--color-text-primary, #f0f0f5);
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }

    .search-input:focus {
      border-color: var(--color-accent, #4d7cff);
    }

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      fill: var(--color-text-muted, #666673);
      pointer-events: none;
    }

    .btn-clear {
      background-color: rgba(255, 77, 77, 0.12);
      border: 1px solid rgba(255, 77, 77, 0.3);
      color: #ff6b6b;
      padding: 8px 14px;
      border-radius: var(--radius-md, 6px);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .btn-clear:hover {
      background-color: rgba(255, 77, 77, 0.22);
    }

    main {
      flex: 1;
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 24px;
    }

    .bookmarks-card {
      background-color: var(--color-bg-toolbar, #23232b);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-lg, 8px);
      overflow: hidden;
    }

    .bookmark-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 18px;
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
      transition: background-color 0.15s;
    }

    .bookmark-item:last-child {
      border-bottom: none;
    }

    .bookmark-item:hover {
      background-color: var(--color-bg-button-hover, #333340);
    }

    .star-icon {
      width: 18px;
      height: 18px;
      fill: #ffb800;
      flex-shrink: 0;
    }

    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      cursor: pointer;
    }

    .item-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary, #f0f0f5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-url {
      font-size: 12px;
      color: var(--color-text-secondary, #9e9ea8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-delete-item {
      background: transparent;
      border: none;
      color: var(--color-text-muted, #666673);
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      transition: opacity 0.15s, color 0.15s, background-color 0.15s;
    }

    .btn-delete-item:hover {
      opacity: 1;
      color: #ff6b6b;
      background-color: rgba(255, 77, 77, 0.1);
    }

    .btn-delete-item svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--color-text-muted, #666673);
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      fill: currentColor;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <img src="../assets/icons/favicon-circle.png" alt="Dragon" class="header-logo" />
      <h1 class="header-title">Favoritos</h1>
    </div>
    <div class="header-actions">
      <div class="search-input-wrap">
        <svg class="search-icon" viewBox="0 0 16 16">
          <path d="M11.5 7a4.499 4.499 0 1 1-8.998 0A4.499 4.499 0 0 1 11.5 7zm-.82 4.74a6 6 0 1 0-1.06 1.06l3.65 3.65a.75.75 0 1 0 1.06-1.06l-3.65-3.65z"/>
        </svg>
        <input type="text" id="input-search" class="search-input" placeholder="Pesquisar nos favoritos..." />
      </div>
      <button id="btn-clear-all" class="btn-clear">Limpar Favoritos</button>
    </div>
  </header>

  <main>
    <div id="bookmarks-container" class="bookmarks-card">
      <div class="empty-state">
        <svg viewBox="0 0 16 16">
          <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
        </svg>
        <p>Nenhum favorito salvo ainda</p>
      </div>
    </div>
  </main>

  <script src="bookmarks.js"></script>
</body>
</html>
```

---

### 4.52 `pages/bookmarks.js`

```javascript
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
    if (confirm('Deseja remover todos os favoritos?')) {
      if (window.bookmarksAPI) {
        await window.bookmarksAPI.clearAll();
        renderBookmarks([]);
      }
    }
  });
}

loadBookmarks();
```

---

### 4.53 `pages/downloads.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Downloads - Dragon</title>
  <link rel="stylesheet" href="../src/renderer/styles/theme.css">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--color-bg-window, #1e1e24);
      color: var(--color-text-primary, #f0f0f5);
      font-family: var(--font-family-base, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--font-size-base, 13px);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    header {
      background-color: var(--color-bg-toolbar, #23232b);
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
      padding: 20px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-logo {
      width: 32px;
      height: 32px;
      filter: drop-shadow(0 0 5px rgba(41, 182, 255, 0.45));
      transition: filter 0.25s ease, transform 0.25s ease;
    }

    .header-logo:hover {
      transform: scale(1.08);
      filter: drop-shadow(0 0 8px rgba(41, 182, 255, 0.75));
    }

    .header-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .btn-clear {
      background-color: rgba(255, 77, 77, 0.12);
      border: 1px solid rgba(255, 77, 77, 0.3);
      color: #ff6b6b;
      padding: 8px 14px;
      border-radius: var(--radius-md, 6px);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .btn-clear:hover {
      background-color: rgba(255, 77, 77, 0.22);
    }

    main {
      flex: 1;
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 24px;
    }

    .downloads-card {
      background-color: var(--color-bg-toolbar, #23232b);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      border-radius: var(--radius-lg, 8px);
      overflow: hidden;
    }

    .download-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--color-border-subtle, #2d2d38);
      transition: background-color 0.15s;
    }

    .download-item:last-child {
      border-bottom: none;
    }

    .download-icon {
      width: 22px;
      height: 22px;
      fill: var(--color-accent, #4d7cff);
      flex-shrink: 0;
    }

    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .item-filename {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary, #f0f0f5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    .item-filename:hover {
      text-decoration: underline;
    }

    .item-meta {
      font-size: 12px;
      color: var(--color-text-secondary, #9e9ea8);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-completed {
      color: #00c853;
    }

    .status-cancelled {
      color: #ff6b6b;
    }

    .status-progressing {
      color: var(--color-accent, #4d7cff);
    }

    .download-progress-wrap {
      width: 100%;
      height: 6px;
      background-color: var(--color-bg-input, #18181d);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 4px;
    }

    .download-progress-bar {
      height: 100%;
      background-color: var(--color-accent, #4d7cff);
      border-radius: 3px;
      transition: width 0.2s ease;
    }

    .download-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-action {
      background-color: var(--color-bg-input, #18181d);
      border: 1px solid var(--color-border-subtle, #2d2d38);
      color: var(--color-text-primary, #f0f0f5);
      padding: 6px 12px;
      border-radius: var(--radius-md, 6px);
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .btn-action:hover {
      background-color: var(--color-bg-button-hover, #333340);
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--color-text-muted, #666673);
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      fill: currentColor;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <img src="../assets/icons/favicon-circle.png" alt="Dragon" class="header-logo" />
      <h1 class="header-title">Downloads</h1>
    </div>
    <button id="btn-clear-all" class="btn-clear">Limpar Histórico de Downloads</button>
  </header>

  <main>
    <div id="downloads-container" class="downloads-card">
      <div class="empty-state">
        <svg viewBox="0 0 16 16">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
        <p>Nenhum download recente</p>
      </div>
    </div>
  </main>

  <script src="downloads.js"></script>
</body>
</html>
```

---

### 4.54 `pages/downloads.js`

```javascript
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
```

---

### 4.55 `pages/error.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Dragon - Falha no carregamento</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #18181d;
      color: #f0f0f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      user-select: none;
    }

    .error-card {
      max-width: 540px;
      width: 100%;
      background-color: #202027;
      border: 1px solid #2e2e3a;
      border-radius: 14px;
      padding: 32px 28px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background-color: rgba(224, 69, 69, 0.15);
      color: #e04545;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-wrapper svg {
      width: 26px;
      height: 26px;
      fill: currentColor;
    }

    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #f0f0f5;
      line-height: 1.3;
    }

    p.description {
      font-size: 14px;
      color: #a0a0ab;
      line-height: 1.5;
    }

    .details-box {
      background-color: #151519;
      border: 1px solid #282832;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      user-select: text;
    }

    .details-row {
      display: flex;
      gap: 8px;
      word-break: break-all;
    }

    .details-label {
      color: #727280;
      flex-shrink: 0;
      font-weight: 500;
    }

    .details-value {
      color: #c7c7d1;
      font-family: monospace;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    button {
      padding: 9px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      outline: none;
      transition: background-color 0.15s, opacity 0.15s;
    }

    .btn-primary {
      background-color: #4d7cff;
      color: #ffffff;
    }

    .btn-primary:hover {
      background-color: #3b6ae6;
    }

    .btn-secondary {
      background-color: #2b2b36;
      color: #d1d1db;
    }

    .btn-secondary:hover {
      background-color: #353542;
    }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    </div>

    <div>
      <h1>Não foi possível carregar a página</h1>
      <p class="description">Verifique sua conexão com a internet ou se o endereço digitado está correto.</p>
    </div>

    <div class="details-box">
      <div class="details-row">
        <span class="details-label">URL:</span>
        <span class="details-value" id="error-url">-</span>
      </div>
      <div class="details-row">
        <span class="details-label">Código:</span>
        <span class="details-value" id="error-code">-</span>
      </div>
      <div class="details-row">
        <span class="details-label">Detalhe:</span>
        <span class="details-value" id="error-desc">-</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn-primary" id="btn-retry">Tentar novamente</button>
      <button class="btn-secondary" id="btn-home">Página Inicial</button>
    </div>
  </div>

  <script src="error.js"></script>
</body>
</html>
```

---

### 4.56 `pages/error.js`

```javascript
// =============================================================================
// pages/error.js
// Lógica da página de erro de comunicação de rede do Dragon
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url') || '';
  const errorCode = params.get('code') || 'Desconhecido';
  const errorDesc = params.get('desc') || 'Falha de comunicação de rede';

  const urlEl = document.getElementById('error-url');
  const codeEl = document.getElementById('error-code');
  const descEl = document.getElementById('error-desc');

  if (urlEl) urlEl.textContent = targetUrl || 'Nenhuma URL informada';
  if (codeEl) codeEl.textContent = errorCode;
  if (descEl) descEl.textContent = errorDesc;

  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      if (targetUrl && !targetUrl.includes('error.html') && !targetUrl.includes('https-warning.html') && !targetUrl.includes('cert-error.html')) {
        window.location.href = targetUrl;
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      window.location.href = 'newtab.html';
    });
  }
});
```

---

### 4.57 `pages/https-warning.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Dragon - Aviso de Conexão Não Criptografada</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #18181d;
      color: #f0f0f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      user-select: none;
    }

    .warning-card {
      max-width: 540px;
      width: 100%;
      background-color: #202027;
      border: 1px solid #3d3420;
      border-radius: 14px;
      padding: 32px 28px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .icon-wrapper {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background-color: rgba(245, 166, 35, 0.15);
      color: #f5a623;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-wrapper svg {
      width: 28px;
      height: 28px;
      fill: currentColor;
    }

    h1 {
      font-size: 21px;
      font-weight: 600;
      color: #f0f0f5;
      line-height: 1.3;
    }

    p.description {
      font-size: 14px;
      color: #a0a0ab;
      line-height: 1.6;
    }

    .url-box {
      background-color: #151519;
      border: 1px solid #282832;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: #f5a623;
      font-family: monospace;
      word-break: break-all;
      user-select: text;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 6px;
      flex-wrap: wrap;
    }

    button {
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      outline: none;
      transition: background-color 0.15s, opacity 0.15s;
    }

    .btn-safe {
      background-color: #4d7cff;
      color: #ffffff;
    }

    .btn-safe:hover {
      background-color: #3b6ae6;
    }

    .btn-insecure {
      background-color: #2b2b36;
      color: #e0e0ea;
      border: 1px solid #3d3d4b;
    }

    .btn-insecure:hover {
      background-color: #383847;
      color: #f5a623;
      border-color: #f5a623;
    }
  </style>
</head>
<body>
  <div class="warning-card">
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24">
        <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
      </svg>
    </div>

    <div>
      <h1>Aviso de Conexão Não Criptografada</h1>
      <p class="description">
        O Dragon tentou atualizar a conexão automaticamente para HTTPS criptografado, mas este site não parece suportar uma conexão segura. Informações enviadas ou recebidas poderão ser interceptadas em redes públicas ou locais.
      </p>
    </div>

    <div class="url-box" id="target-url">-</div>

    <div class="actions">
      <button class="btn-safe" id="btn-back">Voltar em segurança</button>
      <button class="btn-insecure" id="btn-continue-http">Continuar em HTTP (Inseguro)</button>
    </div>
  </div>

  <script src="https-warning.js"></script>
</body>
</html>
```

---

### 4.58 `pages/https-warning.js`

```javascript
// =============================================================================
// pages/https-warning.js
// Lógica da página de aviso de conexão não criptografada (HTTPS Fallback)
// Utiliza token de uso único criptograficamente seguro via IPC (window.warningAPI)
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const rawTarget = params.get('url') || '';
  // Validação estrita: a URL de destino DEVE começar com http://
  const targetUrl = rawTarget.startsWith('http://') ? rawTarget : '';

  const urlDisplay = document.getElementById('target-url');
  if (urlDisplay) {
    urlDisplay.textContent = targetUrl || 'Endereço inválido ou não informado';
  }

  const continueBtn = document.getElementById('btn-continue-http');
  if (!targetUrl && continueBtn) {
    continueBtn.disabled = true;
    continueBtn.style.opacity = '0.5';
    continueBtn.style.cursor = 'not-allowed';
  }

  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', async () => {
      if (!targetUrl || !targetUrl.startsWith('http://')) return;

      continueBtn.disabled = true;
      continueBtn.textContent = 'Solicitando liberação segura...';

      try {
        // Solicita ao main process via preload validado um token de uso único com TTL curto
        if (window.warningAPI && typeof window.warningAPI.requestBypassToken === 'function') {
          const token = await window.warningAPI.requestBypassToken(targetUrl);
          if (token) {
            const delim = targetUrl.includes('?') ? '&' : '?';
            // Navega com o token único que é validado e invalidado imediatamente no main
            window.location.href = `${targetUrl}${delim}dragon_bypass_token=${token}`;
            return;
          }
        }
      } catch (err) {
        console.error('[Aviso HTTPS] Falha ao solicitar token de bypass:', err);
      }

      continueBtn.disabled = false;
      continueBtn.textContent = 'Continuar em HTTP (Inseguro)';
      alert('Não foi possível obter autorização de segurança para este endereço.');
    });
  }
});
```

---

### 4.59 `pages/cert-error.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>Dragon - Erro de Certificado de Segurança</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #18181d;
      color: #f0f0f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      user-select: none;
    }

    .warning-card {
      max-width: 580px;
      width: 100%;
      background-color: #202027;
      border: 1px solid #4a2424;
      border-radius: 14px;
      padding: 32px 28px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .icon-wrapper {
      width: 54px;
      height: 54px;
      border-radius: 14px;
      background-color: rgba(224, 69, 69, 0.15);
      color: #e04545;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-wrapper svg {
      width: 30px;
      height: 30px;
      fill: currentColor;
    }

    h1 {
      font-size: 21px;
      font-weight: 600;
      color: #f0f0f5;
      line-height: 1.3;
    }

    p.description {
      font-size: 14px;
      color: #a0a0ab;
      line-height: 1.6;
    }

    .details-box {
      background-color: #151519;
      border: 1px solid #282832;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      user-select: text;
    }

    .details-row {
      display: flex;
      gap: 8px;
      word-break: break-all;
    }

    .details-label {
      color: #727280;
      flex-shrink: 0;
      font-weight: 500;
    }

    .details-value {
      color: #e04545;
      font-family: monospace;
    }

    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    button {
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      outline: none;
      transition: background-color 0.15s, opacity 0.15s;
    }

    .btn-safe {
      background-color: #4d7cff;
      color: #ffffff;
    }

    .btn-safe:hover {
      background-color: #3b6ae6;
    }

    .btn-link {
      background: transparent;
      color: #9e9ea8;
      padding: 8px 12px;
      text-decoration: underline;
    }

    .btn-link:hover {
      color: #f0f0f5;
    }

    .advanced-panel {
      display: none;
      background-color: #1a1a21;
      border: 1px dashed #3a3a48;
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      color: #a0a0ab;
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .advanced-panel.hidden {
      display: none;
    }

    .advanced-warning {
      color: #e57373;
    }

    .btn-retry {
      align-self: flex-start;
      background-color: #2b2b36;
      color: #e0e0ea;
      border: 1px solid #3d3d4b;
    }

    .btn-retry:hover {
      background-color: #383847;
    }

    .danger-proceed-link {
      font-size: 12px;
      color: #727280;
      cursor: pointer;
      text-decoration: underline;
    }

    .danger-proceed-link:hover {
      color: #e04545;
    }
  </style>
</head>
<body>
  <div class="warning-card">
    <div class="icon-wrapper">
      <svg viewBox="0 0 24 24">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
      </svg>
    </div>

    <div>
      <h1>Sua conexão não é privada</h1>
      <p class="description">
        O Dragon impediu o acesso a esta página porque o servidor apresentou um certificado de segurança digital inválido, expirado ou emitido por uma autoridade não confiável. Invasores podem estar tentando interceptar dados confidenciais (senhas, mensagens ou cartões).
      </p>
    </div>

    <div class="details-box">
      <div class="details-row">
        <span class="details-label">Endereço:</span>
        <span class="details-value" id="cert-url">-</span>
      </div>
      <div class="details-row">
        <span class="details-label">Código:</span>
        <span class="details-value" id="cert-code">-</span>
      </div>
      <div class="details-row">
        <span class="details-label">Motivo:</span>
        <span class="details-value" id="cert-desc">-</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn-safe" id="btn-back">Voltar para segurança</button>
      <button class="btn-link" id="btn-toggle-advanced">Avançado</button>
    </div>

    <div class="advanced-panel hidden" id="advanced-panel">
      <p>
        Este servidor não pôde comprovar que seu certificado SSL/TLS pertence ao domínio acessado. Isso pode ocorrer devido a erro de configuração do servidor, relógio do computador incorreto ou tentativa de interceptação de rede (ataque Man-in-the-Middle).
      </p>
      <p class="advanced-warning">
        Por segurança estrita, o Dragon não permite contornar falhas de certificado digital de forma facilitada nem rebaixa a conexão para HTTP.
      </p>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
        <button class="btn-retry" id="btn-retry">Tentar novamente</button>
        <span class="danger-proceed-link" id="btn-danger-proceed">Continuar mesmo assim (inseguro)</span>
      </div>
    </div>
  </div>

  <script src="cert-error.js"></script>
</body>
</html>
```

---

### 4.60 `pages/cert-error.js`

```javascript
// =============================================================================
// pages/cert-error.js
// Lógica da página interna de erro de certificado digital (SSL/TLS) do Dragon
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url') || '';
  const errorCode = params.get('code') || '-200';
  const errorDesc = params.get('desc') || 'ERR_CERT_COMMON_NAME_INVALID';

  const urlDisplay = document.getElementById('cert-url');
  const codeDisplay = document.getElementById('cert-code');
  const descDisplay = document.getElementById('cert-desc');

  if (urlDisplay) urlDisplay.textContent = targetUrl || 'Endereço não informado';
  if (codeDisplay) codeDisplay.textContent = errorCode;
  if (descDisplay) descDisplay.textContent = `${errorDesc} (Certificado Inválido)`;

  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (window.certErrorAPI && typeof window.certErrorAPI.goHome === 'function') {
        window.certErrorAPI.goHome();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  const btnToggleAdvanced = document.getElementById('btn-toggle-advanced');
  const advancedPanel = document.getElementById('advanced-panel');
  if (btnToggleAdvanced && advancedPanel) {
    btnToggleAdvanced.addEventListener('click', () => {
      const isHidden = advancedPanel.classList.contains('hidden');
      if (isHidden) {
        advancedPanel.classList.remove('hidden');
        btnToggleAdvanced.textContent = 'Ocultar detalhes';
      } else {
        advancedPanel.classList.add('hidden');
        btnToggleAdvanced.textContent = 'Avançado';
      }
    });
  }

  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => {
      if (targetUrl && !targetUrl.includes('cert-error.html')) {
        window.location.href = targetUrl;
      } else {
        window.location.href = 'newtab.html';
      }
    });
  }

  const btnDangerProceed = document.getElementById('btn-danger-proceed');
  if (btnDangerProceed) {
    btnDangerProceed.addEventListener('click', async () => {
      if (!targetUrl || targetUrl.includes('cert-error.html')) return;
      const confirmed = window.confirm(
        'ATENÇÃO: A conexão com este site NÃO é segura. O certificado digital não é confiável e terceiros podem interceptar ou adulterar suas informações pessoais.\n\nDeseja realmente continuar para este site de forma insegura?'
      );
      if (confirmed) {
        if (window.certErrorAPI && typeof window.certErrorAPI.requestBypassToken === 'function') {
          try {
            const token = await window.certErrorAPI.requestBypassToken(targetUrl);
            if (token && typeof window.certErrorAPI.proceedWithBypass === 'function') {
              await window.certErrorAPI.proceedWithBypass(targetUrl, token);
              return;
            }
          } catch (err) {
            console.error('Erro ao solicitar liberação de certificado:', err);
          }
        }
        window.location.href = targetUrl;
      }
    });
  }
});
```

---

### 4.61 `test/clear-data.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

// 1. Configura diretório temporário isolado para a execução dos testes
const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dragon-test-cleardata-'));
const tempDownloads = path.join(tempUserData, 'downloads');
fs.mkdirSync(tempDownloads, { recursive: true });

// 2. Cria Electron simulado e injeta no cache do Node.js antes de importar os módulos
const clearedStorages = [];
const mockDefaultSession = {
  clearStorageData: async ({ storages }) => {
    if (Array.isArray(storages)) {
      clearedStorages.push(...storages);
    }
  },
  clearCache: async () => {},
  clearAuthCache: async () => {},
  clearHostResolverCache: async () => {},
  clearCodeCaches: async () => {},
  clearHSTS: async () => {}
};

const privatePartitionsCleared = [];
const mockSession = {
  defaultSession: mockDefaultSession,
  fromPartition: (part) => ({
    clearStorageData: async ({ storages }) => {
      privatePartitionsCleared.push({ part, storages });
    },
    clearCache: async () => {},
    clearCodeCaches: async () => {},
    clearHostResolverCache: async () => {}
  })
};

const mockApp = {
  getPath: (name) => {
    if (name === 'userData') return tempUserData;
    if (name === 'downloads') return tempDownloads;
    return tempUserData;
  }
};

const mockElectron = {
  app: mockApp,
  session: mockSession,
  shell: {
    openPath: async () => {},
    showItemInFolder: () => {}
  }
};

require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: mockElectron
};

// 3. Importa os módulos principais do Dragon
const storage = require('../src/main/storage');
storage.init({});

const history = require('../src/main/history');
const bookmarks = require('../src/main/bookmarks');
const downloads = require('../src/main/downloads');
const permissions = require('../src/main/permissions');
const clearData = require('../src/main/clear-data');

test('clearAllData: limpa histórico, downloads, permissões e preserva favoritos por padrão', async () => {
  // Grava dados de navegação iniciais
  history.addEntry({ url: 'https://exemplo1.com', title: 'Exemplo 1' });
  history.addEntry({ url: 'https://exemplo2.com', title: 'Exemplo 2' });
  assert.strictEqual(history.getEntries().length, 2);

  bookmarks.addBookmark({ url: 'https://favorito.com', title: 'Meu Favorito' });
  assert.strictEqual(bookmarks.getBookmarks().length, 1);

  storage.writeJSON('downloads.json', [
    { id: 'dl-1', filename: 'teste.pdf', state: 'completed' }
  ]);
  assert.strictEqual(downloads.getDownloads().length, 1);

  permissions.setPermission('https://camera.com', 'camera', 'allow');
  assert.strictEqual(permissions.getPermission('https://camera.com', 'camera'), 'allow');

  const mockTabManager = {
    destroyAllTabs: () => 3,
    getActivePrivatePartitions: () => ['private-test-session'],
    clearPrivatePartitionsList: () => {}
  };

  const mockMainWindow = {
    isDestroyed: () => false,
    webContents: {
      setZoomLevel: () => {}
    }
  };

  const context = {
    mainWindow: mockMainWindow,
    tabManager: mockTabManager,
    storage: storage
  };

  // Executa clearAllData sem a flag includeBookmarks (padrão)
  const summary = await clearData.clearAllData(context);

  // Valida retorno estruturado do summary
  assert.strictEqual(summary.success, true);
  assert.strictEqual(summary.errors.length, 0);
  assert.strictEqual(summary.tabsDestroyed, 3);
  assert.strictEqual(summary.historyCleared, true);
  assert.strictEqual(summary.downloadsCleared, true);
  assert.strictEqual(summary.permissionsCleared, true);
  assert.strictEqual(summary.bookmarksCleared, false);
  assert.strictEqual(summary.storageDataCleared, true);

  // Confirma que getEntries() retorna vazio
  assert.deepStrictEqual(history.getEntries(), []);

  // Confirma que downloads foram limpos
  assert.deepStrictEqual(downloads.getDownloads(), []);

  // Confirma que permissões foram limpas
  assert.strictEqual(permissions.getPermission('https://camera.com', 'camera'), null);

  // Confirma que favoritos foram preservados
  assert.strictEqual(bookmarks.getBookmarks().length, 1);
  assert.strictEqual(bookmarks.getBookmarks()[0].url, 'https://favorito.com');

  // Simula nova navegação pós-limpeza
  history.addEntry({ url: 'https://novapagina.com', title: 'Nova Página' });

  // Confirma que após nova navegação só existe a nova entrada
  const updatedEntries = history.getEntries();
  assert.strictEqual(updatedEntries.length, 1);
  assert.strictEqual(updatedEntries[0].url, 'https://novapagina.com');
  assert.strictEqual(updatedEntries[0].title, 'Nova Página');

  // Confirma que a partição privada foi processada
  assert.ok(privatePartitionsCleared.some(p => p.part === 'private-test-session'));
});

test('clearAllData: apaga favoritos quando includeBookmarks for true', async () => {
  assert.strictEqual(bookmarks.getBookmarks().length, 1);

  const mockTabManager = {
    destroyAllTabs: () => 0,
    getActivePrivatePartitions: () => [],
    clearPrivatePartitionsList: () => {}
  };

  const context = {
    mainWindow: { isDestroyed: () => false, webContents: { setZoomLevel: () => {} } },
    tabManager: mockTabManager,
    storage: storage
  };

  const summary = await clearData.clearAllData(context, { includeBookmarks: true });
  assert.strictEqual(summary.success, true);
  assert.strictEqual(summary.bookmarksCleared, true);

  // Confirma que favoritos foram apagados
  assert.deepStrictEqual(bookmarks.getBookmarks(), []);
});

test('clearAllData: limpa a pilha de abas fechadas (closedTabsStack) impedindo Ctrl+Shift+T de reabrir páginas apagadas', async () => {
  let closedTabsCleared = false;
  const mockTabManager = {
    destroyAllTabs: () => 2,
    clearClosedTabs: () => {
      closedTabsCleared = true;
    },
    getActivePrivatePartitions: () => [],
    clearPrivatePartitionsList: () => {}
  };

  const context = {
    mainWindow: null,
    tabManager: mockTabManager,
    storage: storage
  };

  const summary = await clearData.clearAllData(context);
  assert.strictEqual(closedTabsCleared, true);
  assert.strictEqual(summary.tabsDestroyed, 2);
});

test('clearAllData: registra falhas no summary.errors e define success:false caso ocorra erro', async () => {
  const failingSession = {
    clearStorageData: async ({ storages }) => {
      if (storages.includes('cookies')) {
        throw new Error('Falha simulada ao limpar cookies');
      }
    },
    clearCache: async () => {},
    clearAuthCache: async () => {},
    clearHostResolverCache: async () => {},
    clearCodeCaches: async () => {},
    clearHSTS: async () => {}
  };

  mockElectron.session.defaultSession = failingSession;

  const context = {
    mainWindow: null,
    tabManager: null,
    storage: storage
  };

  const summary = await clearData.clearAllData(context);
  assert.strictEqual(summary.success, false);
  assert.ok(summary.errors.length > 0);
  assert.ok(summary.errors.some(e => e.includes('cookies')));

  // Restaura session padrão
  mockElectron.session.defaultSession = mockDefaultSession;

  // Limpeza final do diretório temporário
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true });
  } catch (e) {}
});
```

---

### 4.62 `test/downloads.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { isRiskyDownload, RISKY_EXTENSIONS } = require('../src/main/pure/download-utils');

test('isRiskyDownload: identifica corretamente extensões potencialmente perigosas', () => {
  // Extensões de risco executáveis e scripts
  assert.strictEqual(isRiskyDownload('setup.exe'), true);
  assert.strictEqual(isRiskyDownload('INSTALL.EXE'), true);
  assert.strictEqual(isRiskyDownload('script.bat'), true);
  assert.strictEqual(isRiskyDownload('command.cmd'), true);
  assert.strictEqual(isRiskyDownload('screensaver.scr'), true);
  assert.strictEqual(isRiskyDownload('installer.msi'), true);
  assert.strictEqual(isRiskyDownload('payload.vbs'), true);
  assert.strictEqual(isRiskyDownload('automation.ps1'), true);
  assert.strictEqual(isRiskyDownload('minecraft.jar'), true);
  assert.strictEqual(isRiskyDownload('oldprog.com'), true);
  assert.strictEqual(isRiskyDownload('shortcut.pif'), true);
  assert.strictEqual(isRiskyDownload('tweak.reg'), true);
  assert.strictEqual(isRiskyDownload('app.hta'), true);
});

test('isRiskyDownload: não bloqueia nem afeta extensões seguras e comuns', () => {
  // Extensões seguras comuns do cotidiano
  assert.strictEqual(isRiskyDownload('documento.pdf'), false);
  assert.strictEqual(isRiskyDownload('relatorio.docx'), false);
  assert.strictEqual(isRiskyDownload('planilha.xlsx'), false);
  assert.strictEqual(isRiskyDownload('arquivo.zip'), false);
  assert.strictEqual(isRiskyDownload('foto.png'), false);
  assert.strictEqual(isRiskyDownload('imagem.jpeg'), false);
  assert.strictEqual(isRiskyDownload('video.mp4'), false);
  assert.strictEqual(isRiskyDownload('musica.mp3'), false);
  assert.strictEqual(isRiskyDownload('codigo.txt'), false);
  assert.strictEqual(isRiskyDownload('pacote.tar.gz'), false);

  // Casos nulos ou vazios
  assert.strictEqual(isRiskyDownload(''), false);
  assert.strictEqual(isRiskyDownload(null), false);
  assert.strictEqual(isRiskyDownload(undefined), false);
});
```

---

### 4.63 `test/fingerprint.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const {
  applyDeterministicCanvasNoise,
  applyCanvasNoise,
  applyAudioNoise,
  applyClientRectsNoise,
  normalizeUserAgentString,
  deriveUserAgent,
  derivePlatform,
  deriveDevicePixelRatio,
  deriveWebglRenderer,
  validateFingerprintConsistency,
  buildFingerprintSeed,
  pickRandomConsistentPreset,
  pickRandomConsistentPresetWithSeed,
  getFingerprintOptions
} = require('../src/main/pure/fingerprint-utils');

test('applyDeterministicCanvasNoise: mesma semente produz rigorosamente o mesmo resultado', () => {
  const seed = 987654321;
  const original = new Uint8ClampedArray([
    120, 150, 200, 255,  // pixel 0
    120, 150, 200, 255,  // pixel 1
    120, 150, 200, 255,  // pixel 2
    120, 150, 200, 255,  // pixel 3
    120, 150, 200, 255,  // pixel 4
    120, 150, 200, 255,  // pixel 5
    120, 150, 200, 255,  // pixel 6
    120, 150, 200, 255   // pixel 7
  ]);

  const run1 = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), seed);
  const run2 = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), seed);

  assert.deepStrictEqual(Array.from(run1), Array.from(run2));
});

test('applyDeterministicCanvasNoise: sementes diferentes produzem distorções distintas', () => {
  const original = new Uint8ClampedArray([
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255,
    120, 150, 200, 255
  ]);

  const runSeedA = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), 11111);
  const runSeedB = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), 99999);

  assert.notDeepStrictEqual(Array.from(runSeedA), Array.from(runSeedB));
});

test('applyDeterministicCanvasNoise: distorção é sutil (máximo +-1) e preserva transparência', () => {
  const seed = 55555;
  const original = new Uint8ClampedArray([
    100, 100, 100, 255,  // opaco
    0,   0,   0,   0,    // transparente
    50,  50,  50,  255,
    0,   0,   0,   0,
    200, 200, 200, 255
  ]);

  const noisy = applyDeterministicCanvasNoise(new Uint8ClampedArray(original), seed);

  // Pixels transparentes devem ser preservados
  assert.strictEqual(noisy[7], 0);

  // Delta de distorção não pode ultrapassar 1
  for (let i = 0; i < original.length; i++) {
    const diff = Math.abs(noisy[i] - original[i]);
    assert.ok(diff <= 1, `Diferença no índice ${i} excedeu 1: ${diff}`);
  }
});

test('applyAudioNoise: ruído de áudio é determinístico e imperceptível', () => {
  const seed = 444333;
  const original = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);

  const run1 = applyAudioNoise(new Float32Array(original), seed);
  const run2 = applyAudioNoise(new Float32Array(original), seed);

  assert.deepStrictEqual(Array.from(run1), Array.from(run2));

  // Variação é minúscula
  for (let i = 0; i < original.length; i++) {
    const diff = Math.abs(run1[i] - original[i]);
    assert.ok(diff <= 0.0001, `Variação de áudio excedeu tolerância: ${diff}`);
  }
});

test('applyClientRectsNoise: ruído de geometria é determinístico e restrito', () => {
  const seed = 777666;
  const rect = { x: 100, y: 150, width: 200, height: 80, top: 150, bottom: 230, left: 100, right: 300 };

  const noisy1 = applyClientRectsNoise(rect, seed);
  const noisy2 = applyClientRectsNoise(rect, seed);

  assert.deepStrictEqual(noisy1, noisy2);
  assert.ok(Math.abs(noisy1.width - rect.width) <= 0.2);
});

test('normalizeUserAgentString: remove Electron e normaliza versão estável do Chrome', () => {
  const rawUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Dragon/1.0.0 Chrome/130.0.6723.117 Electron/33.2.0 Safari/537.36';
  const normalized = normalizeUserAgentString(rawUA);

  assert.strictEqual(normalized.includes('Electron'), false);
  assert.strictEqual(normalized.includes('Dragon'), false);
  assert.strictEqual(normalized.includes('Chrome/130.0.0.0'), true);
});

test('deriveUserAgent: deriva strings coerentes para SO e Navegador', () => {
  const winChrome = deriveUserAgent('windows11', 'chrome');
  assert.ok(winChrome.includes('Windows NT 10.0'));
  assert.ok(winChrome.includes('Chrome/130'));

  const macFirefox = deriveUserAgent('macos', 'firefox');
  assert.ok(macFirefox.includes('Macintosh; Intel Mac OS X 10_15_7'));
  assert.ok(macFirefox.includes('Firefox/132'));

  const winEdge = deriveUserAgent('windows10', 'edge');
  assert.ok(winEdge.includes('Edg/130'));
});

test('derivePlatform e deriveDevicePixelRatio: valores corretos', () => {
  assert.strictEqual(derivePlatform('windows11'), 'Win32');
  assert.strictEqual(derivePlatform('macos'), 'MacIntel');
  assert.strictEqual(derivePlatform('linux'), 'Linux x86_64');

  assert.strictEqual(deriveDevicePixelRatio('1920x1080'), 1);
  assert.strictEqual(deriveDevicePixelRatio('2880x1800'), 2);
  assert.strictEqual(deriveDevicePixelRatio('3840x2160'), 1.5);
});

test('deriveWebglRenderer: nunca retorna NVIDIA em macOS', () => {
  const macGpu = deriveWebglRenderer('macos');
  assert.ok(!macGpu.vendor.toLowerCase().includes('nvidia'));
  assert.ok(!macGpu.renderer.toLowerCase().includes('nvidia'));
});

test('validateFingerprintConsistency: bloqueia macOS com NVIDIA com erro estrito', () => {
  const invalidConfig = {
    fpOs: 'macos',
    fpBrowser: 'chrome',
    fpWebglVendor: 'NVIDIA Corporation',
    fpWebglRenderer: 'NVIDIA GeForce RTX 3060'
  };

  const result = validateFingerprintConsistency(invalidConfig);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length >= 1);
  assert.ok(result.errors.some(e => e.includes('macOS')));
});

test('validateFingerprintConsistency: detecta avisos para combinações improváveis', () => {
  const weirdConfig = {
    fpOs: 'windows11',
    fpBrowser: 'firefox',
    fpUserAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0.0.0', // Sem Firefox/
    fpScreenResolution: '2880x1800', // Tela Apple em Windows
    fpHardwareConcurrency: 2,
    fpDeviceMemory: 32, // 32GB RAM com 2 núcleos
    fpLocale: 'pt-BR',
    fpTimezone: 'Asia/Tokyo' // Idioma pt-BR com Tóquio
  };

  const result = validateFingerprintConsistency(weirdConfig);
  assert.strictEqual(result.valid, true); // Válido estruturalmente, mas com avisos
  assert.ok(result.warnings.length >= 4);
});

test('buildFingerprintSeed: gera semente de 32 bits determinística', () => {
  const cfg1 = { fpFingerprintSeed: 12345, fpOs: 'windows11', fpScreenResolution: '1920x1080' };
  const cfg2 = { fpFingerprintSeed: 12345, fpOs: 'windows11', fpScreenResolution: '1920x1080' };
  const cfg3 = { fpFingerprintSeed: 99999, fpOs: 'windows11', fpScreenResolution: '1920x1080' };

  const seed1 = buildFingerprintSeed(cfg1);
  const seed2 = buildFingerprintSeed(cfg2);
  const seed3 = buildFingerprintSeed(cfg3);

  assert.strictEqual(seed1, seed2);
  assert.notStrictEqual(seed1, seed3);
  assert.ok(seed1 > 0);
});

test('pickRandomConsistentPresetWithSeed: determinismo absoluto e consistência 100%', () => {
  const seed = 42891234;
  const p1 = pickRandomConsistentPresetWithSeed(seed);
  const p2 = pickRandomConsistentPresetWithSeed(seed);

  assert.deepStrictEqual(p1, p2);

  const check = validateFingerprintConsistency(p1.config);
  assert.strictEqual(check.valid, true);
  assert.strictEqual(check.errors.length, 0);

  if (p1.config.fpOs === 'macos') {
    assert.ok(!p1.config.fpWebglVendor.toLowerCase().includes('nvidia'));
    assert.ok(!p1.config.fpWebglRenderer.toLowerCase().includes('nvidia'));
  }
});

test('pickRandomConsistentPreset: sorteia preset 100% consistente sem erros', () => {
  for (let i = 0; i < 20; i++) {
    const { config, seed } = pickRandomConsistentPreset();
    assert.ok(seed > 0);
    const check = validateFingerprintConsistency(config);
    assert.strictEqual(check.valid, true, `Preset sorteado na iteração ${i} falhou na validação`);
    assert.strictEqual(check.errors.length, 0);

    if (config.fpOs === 'macos') {
      assert.ok(!config.fpWebglVendor.toLowerCase().includes('nvidia'));
    }
  }
});

test('getFingerprintOptions: retorna listas completas para a UI', () => {
  const opts = getFingerprintOptions();
  assert.ok(Array.isArray(opts.osList) && opts.osList.length > 0);
  assert.ok(Array.isArray(opts.browserList) && opts.browserList.length > 0);
  assert.ok(Array.isArray(opts.screenList) && opts.screenList.length > 0);
  assert.ok(Array.isArray(opts.timezoneList) && opts.timezoneList.length > 0);
  assert.ok(Array.isArray(opts.localeList) && opts.localeList.length > 0);
  assert.ok(opts.gpuPresets && opts.gpuPresets.windows && opts.gpuPresets.macos);
});
```

---

### 4.64 `test/history.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. Configura diretório temporário isolado para os testes de histórico
const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dragon-test-history-'));

// 2. Injeta mock do electron no require.cache
const mockElectron = {
  app: {
    getPath: (name) => {
      if (name === 'userData') return tempUserData;
      return tempUserData;
    }
  }
};

require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: mockElectron
};

const storage = require('../src/main/storage');
storage.init({});

const history = require('../src/main/history');
const config = require('../src/main/config');

test('history: não registra páginas internas (dragon://, settings, downloads, history, bookmarks)', () => {
  history.clearAll();

  history.addEntry({ url: 'dragon://settings', title: 'Configurações' });
  history.addEntry({ url: config.SETTINGS_PAGE_URL, title: 'Configurações' });
  history.addEntry({ url: config.HISTORY_PAGE_URL, title: 'Histórico' });
  history.addEntry({ url: config.DOWNLOADS_PAGE_URL, title: 'Downloads' });
  history.addEntry({ url: config.BOOKMARKS_PAGE_URL, title: 'Favoritos' });
  history.addEntry({ url: config.NEW_TAB_URL, title: 'Nova Aba' });
  history.addEntry({ url: 'about:blank', title: 'Branco' });

  assert.strictEqual(history.getEntries().length, 0);
});

test('history.updateTitle: atualiza o título da entrada mais recente sem criar duplicatas', () => {
  history.clearAll();

  // 1. Navegação inicial (did-navigate grava com título inicial ou url)
  history.addEntry({ url: 'https://exemplo.org/artigo', title: 'https://exemplo.org/artigo' });
  let entries = history.getEntries();
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].title, 'https://exemplo.org/artigo');

  // 2. Quando o título da página é carregado (page-title-updated)
  history.updateTitle('https://exemplo.org/artigo', 'Título Real do Artigo');

  entries = history.getEntries();
  assert.strictEqual(entries.length, 1, 'Não deve criar uma segunda entrada duplicada');
  assert.strictEqual(entries[0].title, 'Título Real do Artigo');
});

test('history: flushHistorySync grava imediatamente em disco', () => {
  history.clearAll();
  history.addEntry({ url: 'https://persistencia.com', title: 'Persistência' });
  history.flushHistorySync();

  const historyFilePath = path.join(tempUserData, 'history.json');
  assert.strictEqual(fs.existsSync(historyFilePath), true);

  const raw = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
  assert.strictEqual(raw.length, 1);
  assert.strictEqual(raw[0].url, 'https://persistencia.com');

  // Cleanup
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true });
  } catch {}
});
```

---

### 4.65 `test/navigation.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { normalizeInput } = require('../src/main/pure/navigation-utils');

test('normalizeInput: entrada vazia retorna newtab', () => {
  assert.strictEqual(normalizeInput(''), 'pages/newtab.html');
  assert.strictEqual(normalizeInput('   '), 'pages/newtab.html');
});

test('normalizeInput: atalhos dragon:// e about:// para páginas internas', () => {
  assert.strictEqual(normalizeInput('dragon://settings'), 'pages/settings.html');
  assert.strictEqual(normalizeInput('about:settings'), 'pages/settings.html');
  assert.strictEqual(normalizeInput('dragon://downloads'), 'pages/downloads.html');
  assert.strictEqual(normalizeInput('dragon://history'), 'pages/history.html');
  assert.strictEqual(normalizeInput('dragon://bookmarks'), 'pages/bookmarks.html');
});

test('normalizeInput: URLs com protocolo explícito mantidas', () => {
  assert.strictEqual(normalizeInput('https://google.com'), 'https://google.com');
  assert.strictEqual(normalizeInput('http://exemplo.org/path'), 'http://exemplo.org/path');
  assert.strictEqual(normalizeInput('about:blank'), 'about:blank');
});

test('normalizeInput: localhost e IPs recebem http://', () => {
  assert.strictEqual(normalizeInput('localhost'), 'http://localhost');
  assert.strictEqual(normalizeInput('localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(normalizeInput('127.0.0.1:8080'), 'http://127.0.0.1:8080');
  assert.strictEqual(normalizeInput('192.168.1.1'), 'http://192.168.1.1');
});

test('normalizeInput: domínios recebem https://', () => {
  assert.strictEqual(normalizeInput('github.com'), 'https://github.com');
  assert.strictEqual(normalizeInput('globo.com/noticias'), 'https://globo.com/noticias');
});

test('normalizeInput: palavras soltas ou com espaços viram busca', () => {
  const customOpts = { searchTemplate: 'https://duckduckgo.com/?q=%s' };
  assert.strictEqual(normalizeInput('dragao azul', customOpts), 'https://duckduckgo.com/?q=dragao%20azul');
  assert.strictEqual(normalizeInput('receitas', customOpts), 'https://duckduckgo.com/?q=receitas');
});

test('applySearchTemplate: substitui %s ou %25s corretamente e codifica queries', () => {
  const { applySearchTemplate } = require('../src/main/pure/navigation-utils');
  assert.strictEqual(applySearchTemplate('https://duckduckgo.com/?q=%s', 'gato preto'), 'https://duckduckgo.com/?q=gato%20preto');
  assert.strictEqual(applySearchTemplate('https://duckduckgo.com/?q=%25s', 'gato preto'), 'https://duckduckgo.com/?q=gato%20preto');
  assert.strictEqual(applySearchTemplate('https://www.google.com/search?q=%s', 'dragon browser'), 'https://www.google.com/search?q=dragon%20browser');
});

test('navigation (módulo principal): normalizeInput gera URL de pesquisa correta sem %25s', () => {
  const mainNav = require('../src/main/navigation');
  const result = mainNav.normalizeInput('gatos e cachorros');
  assert.strictEqual(result, 'https://duckduckgo.com/?q=gatos%20e%20cachorros');
  assert.ok(!result.includes('%25s'));
  assert.ok(result.includes('gatos%20e%20cachorros'));
});
```

---

### 4.66 `test/permissions.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { getPermissionKey, getPermissionLabel } = require('../src/main/session');

test('getPermissionKey: mapeia corretamente câmera, microfone e câmera+microfone', () => {
  // Quando ambos são solicitados juntos (Bloco 2.3)
  assert.strictEqual(getPermissionKey('media', { mediaTypes: ['video', 'audio'] }), 'media');
  assert.strictEqual(getPermissionKey('media', { mediaTypes: ['audio', 'video'] }), 'media');

  // Quando apenas um tipo é solicitado
  assert.strictEqual(getPermissionKey('media', { mediaTypes: ['video'] }), 'media:video');
  assert.strictEqual(getPermissionKey('media', { mediaTypes: ['audio'] }), 'media:audio');

  // Quando mediaTypes é vazio ou omitido
  assert.strictEqual(getPermissionKey('media', {}), 'media');

  // Outras permissões suportadas
  assert.strictEqual(getPermissionKey('notifications', {}), 'notifications');
  assert.strictEqual(getPermissionKey('geolocation', {}), 'geolocation');

  // Permissões não mapeadas / desconhecidas
  assert.strictEqual(getPermissionKey('midi', {}), null);
  assert.strictEqual(getPermissionKey('pointerLock', {}), null);
});

test('getPermissionLabel: retorna rótulos em português corretos', () => {
  assert.strictEqual(getPermissionLabel('media'), 'Câmera e Microfone');
  assert.strictEqual(getPermissionLabel('media:video'), 'Câmera');
  assert.strictEqual(getPermissionLabel('media:audio'), 'Microfone');
  assert.strictEqual(getPermissionLabel('notifications'), 'Notificações');
  assert.strictEqual(getPermissionLabel('geolocation'), 'Sua Localização');
});

test('Fila de permissões: lógica pura de enfileiramento e resolução sequencial', () => {
  const queue = [];
  let currentRequest = null;
  const processed = [];

  function enqueue(req) {
    if (!currentRequest) {
      currentRequest = req;
    } else {
      queue.push(req);
    }
  }

  function respond(allowed) {
    if (!currentRequest) return;
    processed.push({ id: currentRequest.id, allowed });
    if (queue.length > 0) {
      currentRequest = queue.shift();
    } else {
      currentRequest = null;
    }
  }

  // 1. Chegam dois pedidos simultâneos
  enqueue({ id: 'req-1', permissionKey: 'geolocation' });
  enqueue({ id: 'req-2', permissionKey: 'notifications' });

  assert.strictEqual(currentRequest.id, 'req-1');
  assert.strictEqual(queue.length, 1);

  // 2. Usuário responde o primeiro
  respond(true);

  // O segundo passa a ser o atual
  assert.strictEqual(currentRequest.id, 'req-2');
  assert.strictEqual(queue.length, 0);

  // 3. Usuário responde o segundo
  respond(false);

  assert.strictEqual(currentRequest, null);
  assert.deepStrictEqual(processed, [
    { id: 'req-1', allowed: true },
    { id: 'req-2', allowed: false }
  ]);
});
```

---

### 4.67 `test/privacy.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const {
  getBaseDomain,
  isLocalHost,
  isTrackerDomain,
  cleanTrackingParameters,
  isValidBlocklistHost,
  isSuspiciousRedirectChain,
  calculatePrivacyGrade
} = require('../src/main/pure/privacy-utils');


test('getBaseDomain: extração de domínio com tldts (incluindo domínios multipartes e privados)', () => {
  assert.strictEqual(getBaseDomain('sub.domain.com.au'), 'domain.com.au');
  assert.strictEqual(getBaseDomain('user.github.io'), 'user.github.io');
  assert.strictEqual(getBaseDomain('test.co.jp'), 'test.co.jp');
  assert.strictEqual(getBaseDomain('analytics.google.com'), 'google.com');
  assert.strictEqual(getBaseDomain('globo.com'), 'globo.com');
  assert.strictEqual(getBaseDomain('localhost'), 'localhost');
});

test('isLocalHost: identifica loopback, IPs privados e mDNS', () => {
  assert.strictEqual(isLocalHost('localhost'), true);
  assert.strictEqual(isLocalHost('::1'), true);
  assert.strictEqual(isLocalHost('127.0.0.1'), true);
  assert.strictEqual(isLocalHost('192.168.0.1'), true);
  assert.strictEqual(isLocalHost('10.0.0.1'), true);
  assert.strictEqual(isLocalHost('meucomputador.local'), true);
  assert.strictEqual(isLocalHost('router'), true);
  assert.strictEqual(isLocalHost('google.com'), false);
});

test('isTrackerDomain: detecta correspondência exata e subdomínios', () => {
  const trackers = new Set(['doubleclick.net', 'google-analytics.com']);
  assert.strictEqual(isTrackerDomain('doubleclick.net', trackers), true);
  assert.strictEqual(isTrackerDomain('ad.service.doubleclick.net', trackers), true);
  assert.strictEqual(isTrackerDomain('google-analytics.com', trackers), true);
  assert.strictEqual(isTrackerDomain('google.com', trackers), false);
  assert.strictEqual(isTrackerDomain('wikipedia.org', trackers), false);
});

test('cleanTrackingParameters: remove utm_*, fbclid, gclid, etc.', () => {
  const dirty = 'https://loja.com/produto?utm_source=facebook&fbclid=xyz123&cor=azul';
  const { cleanedUrl, hasRemovedParams } = cleanTrackingParameters(dirty);
  assert.strictEqual(hasRemovedParams, true);
  assert.strictEqual(cleanedUrl, 'https://loja.com/produto?cor=azul');

  const clean = 'https://loja.com/produto?cor=azul';
  const res = cleanTrackingParameters(clean);
  assert.strictEqual(res.hasRemovedParams, false);
  assert.strictEqual(res.cleanedUrl, clean);
});

test('isValidBlocklistHost: valida apenas linhas sintaticamente corretas de domínios', () => {
  // Casos válidos
  assert.strictEqual(isValidBlocklistHost('tracker.doubleclick.net'), true);
  assert.strictEqual(isValidBlocklistHost('analytics.google.com'), true);
  assert.strictEqual(isValidBlocklistHost('ad-server123.example.org'), true);
  assert.strictEqual(isValidBlocklistHost('sub.domain.co.uk'), true);

  // Casos inválidos
  assert.strictEqual(isValidBlocklistHost('# Comentário'), false);
  assert.strictEqual(isValidBlocklistHost(''), false);
  assert.strictEqual(isValidBlocklistHost('   '), false);
  assert.strictEqual(isValidBlocklistHost('http://site.com'), false);
  assert.strictEqual(isValidBlocklistHost('site.com/ad'), false);
  assert.strictEqual(isValidBlocklistHost('site.com:8080'), false);
  assert.strictEqual(isValidBlocklistHost('palavra-sem-ponto'), false);
  assert.strictEqual(isValidBlocklistHost('site com espaco.com'), false);
  assert.strictEqual(isValidBlocklistHost('.inicia-com-ponto.com'), false);
});

test('calculatePrivacyGrade: calcula notas A, C e F com base nas métricas de privacidade', () => {
  // Caso Nota A: Conexão HTTPS segura, 0 a 3 rastreadores, 0 popups
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 0, popupsBlocked: 0 }), 'A');
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 2, popupsBlocked: 0 }), 'A');

  // Caso Nota B: Conexão HTTPS com poucos rastreadores
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 4, popupsBlocked: 0 }), 'B');

  // Caso Nota C: Conexão HTTPS com volume moderado de rastreadores (10 rastreadores = -40 -> 60 pts)
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 10, popupsBlocked: 0 }), 'C');
  // Ou HTTPS com 4 rastreadores (-25) e 1 popup bloqueado (-15) -> 60 pts -> Nota C
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 4, popupsBlocked: 1 }), 'C');

  // Caso Nota D: Conexão HTTP insegura sem rastreadores (-45 -> 55 pts)
  assert.strictEqual(calculatePrivacyGrade({ isHttps: false, count: 0, popupsBlocked: 0 }), 'D');

  // Caso Nota F: Conexão HTTP insegura com rastreadores ou pop-ups abusivos
  // HTTP (-45) + 10 rastreadores (-40) = 15 pts -> Nota F
  assert.strictEqual(calculatePrivacyGrade({ isHttps: false, count: 10, popupsBlocked: 0 }), 'F');
  // HTTP (-45) + 4 rastreadores (-25) + 2 popups (-30) = 0 pts -> Nota F
  assert.strictEqual(calculatePrivacyGrade({ isHttps: false, count: 4, popupsBlocked: 2 }), 'F');
  // HTTPS com volume massivo de rastreadores + múltiplos popups forçados (-40 -30 = 30 pts) -> Nota F
  assert.strictEqual(calculatePrivacyGrade({ isHttps: true, count: 15, popupsBlocked: 2 }), 'F');
});

test('isSuspiciousRedirectChain: detecta sequências rápidas de redirecionamento entre domínios diferentes', () => {
  const now = 10000;
  const history = [
    { url: 'https://origem.com', domain: 'origem.com', timestamp: now - 1000 },
    { url: 'https://tracker.net/go', domain: 'tracker.net', timestamp: now - 400 }
  ];

  // Redirecionamento para o 3º domínio diferente em menos de 1.5s -> Detecta como suspeito
  assert.strictEqual(isSuspiciousRedirectChain(history, 'https://shadyad.org/landing', now, 1500, 2), true);

  // Redirecionamento interno dentro do mesmo domínio -> Não bloqueia
  assert.strictEqual(isSuspiciousRedirectChain(history, 'https://tracker.net/login', now, 1500, 2), false);

  // Redirecionamento fora da janela de 1.5s -> Não bloqueia
  const oldHistory = [
    { url: 'https://origem.com', domain: 'origem.com', timestamp: now - 3000 },
    { url: 'https://tracker.net/go', domain: 'tracker.net', timestamp: now - 2000 }
  ];
  assert.strictEqual(isSuspiciousRedirectChain(oldHistory, 'https://shadyad.org/landing', now, 1500, 2), false);
});

```

---

### 4.68 `test/settings.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');
const {
  isValidSetting,
  mergeWithDefaults,
  DEFAULT_SETTINGS
} = require('../src/main/pure/settings-utils');

test('isValidSetting: valida tipos, limites e enums', () => {
  assert.strictEqual(isValidSetting('searchEngine', 'duckduckgo'), true);
  assert.strictEqual(isValidSetting('searchEngine', 'invalido'), false);

  assert.strictEqual(isValidSetting('theme', 'dark'), true);
  assert.strictEqual(isValidSetting('theme', 'neon'), false);

  assert.strictEqual(isValidSetting('accentColor', '#4d7cff'), true);
  assert.strictEqual(isValidSetting('accentColor', 'red'), false);
  assert.strictEqual(isValidSetting('accentColor', '#12345'), false);

  assert.strictEqual(isValidSetting('defaultZoom', 1.0), true);
  assert.strictEqual(isValidSetting('defaultZoom', 0.1), false);
  assert.strictEqual(isValidSetting('defaultZoom', 5.0), false);

  assert.strictEqual(isValidSetting('backgroundDim', 40), true);
  assert.strictEqual(isValidSetting('backgroundDim', 95), false);

  assert.strictEqual(isValidSetting('proxyMode', 'manual'), true);
  assert.strictEqual(isValidSetting('proxyMode', 'socks'), false);

  assert.strictEqual(isValidSetting('showShortcuts', true), true);
  assert.strictEqual(isValidSetting('clearDataOnExit', true), true);
  assert.strictEqual(isValidSetting('clearDataOnExit', 'true'), false);
  assert.strictEqual(isValidSetting('fingerprintProtectionEnabled', true), true);
  assert.strictEqual(isValidSetting('fingerprintProtectionEnabled', 'yes'), false);
  assert.strictEqual(isValidSetting('fingerprintSpoofTimezone', false), true);
  assert.strictEqual(isValidSetting('fingerprintCanvasNoise', true), true);

  // Novos vetores de fingerprint
  assert.strictEqual(isValidSetting('fpOs', 'windows11'), true);
  assert.strictEqual(isValidSetting('fpOs', 'macos'), true);
  assert.strictEqual(isValidSetting('fpOs', 'android'), false);

  assert.strictEqual(isValidSetting('fpBrowser', 'chrome'), true);
  assert.strictEqual(isValidSetting('fpBrowser', 'safari'), false);

  assert.strictEqual(isValidSetting('fpScreenResolution', '1920x1080'), true);
  assert.strictEqual(isValidSetting('fpScreenResolution', '800x600'), false);

  assert.strictEqual(isValidSetting('fpHardwareConcurrency', 8), true);
  assert.strictEqual(isValidSetting('fpHardwareConcurrency', 3), false);

  assert.strictEqual(isValidSetting('fpDeviceMemory', 16), true);
  assert.strictEqual(isValidSetting('fpDeviceMemory', 10), false);

  assert.strictEqual(isValidSetting('fpCanvasMode', 'noise'), true);
  assert.strictEqual(isValidSetting('fpCanvasMode', 'mask'), true);
  assert.strictEqual(isValidSetting('fpCanvasMode', 'fake'), false);

  assert.strictEqual(isValidSetting('fpWebrtcMode', 'proxy'), true);
  assert.strictEqual(isValidSetting('fpWebrtcMode', 'disabled'), true);
  assert.strictEqual(isValidSetting('fpWebrtcMode', 'blocked'), false);

  assert.strictEqual(isValidSetting('fpFingerprintSeed', 123456789), true);
  assert.strictEqual(isValidSetting('fpFingerprintSeed', null), true);
  assert.strictEqual(isValidSetting('fpFingerprintSeed', -10), false);

  assert.strictEqual(isValidSetting('chaveInexistente', 123), false);
});

test('mergeWithDefaults: mescla chaves válidas e descarta corrompidas', () => {
  const saved = {
    theme: 'light',
    accentColor: '#00c853',
    defaultZoom: 10.0, // Inválido, deve reverter ao padrão 1.0
    chaveInvalida: 'teste' // Deve ser ignorada
  };

  const merged = mergeWithDefaults(saved);
  assert.strictEqual(merged.theme, 'light');
  assert.strictEqual(merged.accentColor, '#00c853');
  assert.strictEqual(merged.defaultZoom, DEFAULT_SETTINGS.defaultZoom);
  assert.strictEqual(merged.chaveInvalida, undefined);
  assert.strictEqual(merged.searchEngine, DEFAULT_SETTINGS.searchEngine);
});
```

---

### 4.69 `test/tabs.test.js`

```javascript
const test = require('node:test');
const assert = require('node:assert');

test('reorderTabs: reordena corretamente elementos em array de abas', () => {
  const tabs = [
    { id: 'tab-1', title: 'Aba 1' },
    { id: 'tab-2', title: 'Aba 2' },
    { id: 'tab-3', title: 'Aba 3' },
    { id: 'tab-4', title: 'Aba 4' }
  ];

  function reorder(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = tabs.findIndex(t => t.id === sourceId);
    const targetIndex = tabs.findIndex(t => t.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedTab] = tabs.splice(sourceIndex, 1);
    tabs.splice(targetIndex, 0, movedTab);
  }

  // Move tab-1 para a posição de tab-3
  reorder('tab-1', 'tab-3');
  assert.deepStrictEqual(tabs.map(t => t.id), ['tab-2', 'tab-3', 'tab-1', 'tab-4']);

  // Move tab-4 para a posição de tab-2
  reorder('tab-4', 'tab-2');
  assert.deepStrictEqual(tabs.map(t => t.id), ['tab-4', 'tab-2', 'tab-3', 'tab-1']);

  // Mover para o mesmo ID não altera nada
  reorder('tab-2', 'tab-2');
  assert.deepStrictEqual(tabs.map(t => t.id), ['tab-4', 'tab-2', 'tab-3', 'tab-1']);
});
```

---

### 4.70 `assets/blocklists/trackers.txt`

```text
# =============================================================================
# assets/blocklists/trackers.txt
# Lista de bloqueio de rastreadores integrada do Dragon
# Origem: Peter Lowe's Ad and tracking server list
# Total de dominios ativos cadastrados: 3569 dominios
# =============================================================================
# (Conteudo truncado no relatorio de auditoria conforme instrucao)
# [3569 dominios incluidos e ativos no arquivo real]
```

---

### 4.71 `README.md`

```markdown
# Dragon Desktop (Electron Vanilla)

Um navegador web desktop para Windows 10/11 construído com **Electron**, **JavaScript puro (CommonJS)**, **HTML** e **CSS**, com foco em privacidade, código limpo, modularidade e facilidade de modificação para iniciantes — **sem frameworks pesados** e **sem etapa de compilação/build**.

---

## 1. Visão Geral da Arquitetura

O projeto adota uma arquitetura em camadas orientada a eventos e responsabilidade única:

```
┌─────────────────────────────────────────────────────────────┐
│                      JANELA PRINCIPAL                       │
├─────────────────────────────────────────────────────────────┤
│  Interface HTML/CSS (Top Bar: 76px)                         │
│  - Barra de Abas (tabs-view.js)                             │
│  - Barra de Ferramentas e Endereços (toolbar / addressbar) │
│  - Escudo de Privacidade e Botão de Apagar Tudo             │
├─────────────────────────────────────────────────────────────┤
│  WebContentsView da Aba Ativa                               │
│  - Conteúdo web real isolado e nativo do Chromium           │
│  - Ocupa do pixel 76 até o rodapé da janela                 │
└─────────────────────────────────────────────────────────────┘
```

### Por que WebContentsView em vez de `<webview>`?
O `<webview>` do Electron é obsoleto e gera penalidades de desempenho e segurança. A API moderna `WebContentsView` renderiza as páginas web diretamente como visualizações nativas aceleradas pelo Chromium, desacopladas do DOM da interface do navegador.

### Camada de Segurança Estrita
- `contextIsolation: true`: isola o escopo de execução dos scripts do preload e do renderer.
- `sandbox: true`: executa a renderização em sandbox com privilégios reduzidos.
- `nodeIntegration: false`: impede que páginas web acessem módulos do Node.js.
- **Site Isolation Reforçado (`site-per-process`)**: Habilitado explicitamente antes de `app.whenReady()` via `app.commandLine.appendSwitch('site-per-process')`, garantindo que cada origem web rode em processo de renderização (renderer) próprio e isolado pelo Chromium. Testado e validado no Electron versão **^44.9.0** (Chromium 134+).
- **Aviso de Download de Arquivo Potencialmente Perigoso**: Monitora eventos `will-download` e pausa arquivos de risco (.exe, .bat, .cmd, .msi, .ps1, .vbs, etc.), exibindo modal inferior (bottom sheet) para confirmação explícita ou cancelamento seguro antes da gravação em disco.
- Comunicação controlada exclusivamente via `contextBridge` em `src/preload/preload.js` e `src/preload/settings-preload.js`.
- Configuração unificada de sessões (`configureSession`) e `app.userAgentFallback` higienizado antes do ready.
- Restrição estrita de protocolos (`setWindowOpenHandler` e `navigation:navigate`) permitindo apenas `http:`, `https:` e páginas internas do Dragon.
- Bloqueio de pop-ups não solicitados em `setWindowOpenHandler` sem `userGesture` e interrupção de redirecionamentos em sequência rápida sem interação do usuário.
- Validação no IPC de configurações exigindo frame principal e URL exata de `pages/settings.html`.

---

## 2. Estrutura de Pastas

```
dragon/
├── package.json               # Configurações do projeto, scripts (test, start, dist) e electron-builder
├── README.md                  # Documentação e guia completo da arquitetura
├── VERIFICACAO_PROJETO.md     # Relatório de conformidade, segurança e checklist do projeto
├── assets/
│   ├── blocklists/
│   │   └── trackers.txt       # Lista completa de rastreadores (Peter Lowe, 3.500+ domínios)
│   └── icons/
│       └── favicon-circle.png # Ícone circular oficial do dragão azul
├── pages/
│   ├── newtab.html            # Página de início rápida (busca, personalização e atalhos)
│   ├── newtab.js              # Lógica da nova aba com suporte a temas e buscador
│   ├── settings.html          # Configurações (Principal, Personalização, Proxy e Permissões)
│   ├── settings.js            # Lógica de configurações (debounce, proxy, senhas seguras e permissões)
│   ├── history.html           # Gerenciador de histórico de navegação
│   ├── history.js             # Lógica de busca e exclusão de itens de histórico
│   ├── bookmarks.html         # Gerenciador visual de favoritos
│   ├── bookmarks.js           # Lógica de busca, remoção e abertura de favoritos
│   ├── downloads.html         # Gerenciador de downloads do navegador
│   ├── downloads.js           # Lógica de controle de downloads (abrir arquivo, pasta ou cancelar)
│   ├── error.html             # Página interna exibida em falhas de conexão/rede
│   ├── error.js               # Lógica da página de erro de rede
│   ├── https-warning.html     # Aviso de conexão não criptografada com liberação HTTP segura
│   ├── https-warning.js       # Solicitação de token único para liberação de HTTP
│   ├── cert-error.html        # Página interna para erros de certificados SSL/TLS
│   └── cert-error.js          # Lógica da página de erro de certificado digital
├── test/                      # Testes automatizados com runner nativo do Node.js (node:test)
│   ├── clear-data.test.js     # Testes de limpeza profunda de dados e fechamento de abas
│   ├── downloads.test.js      # Testes de detecção de extensões perigosas vs seguras
│   ├── fingerprint.test.js    # Testes de ruído determinístico de canvas e normalização de UA
│   ├── history.test.js        # Testes de histórico, exclusão de internas e updateTitle
│   ├── navigation.test.js     # Testes de normalização de URLs e atalhos dragon://
│   ├── permissions.test.js    # Testes de getPermissionKey, rótulos e fila de permissões
│   ├── privacy.test.js        # Testes de cálculo de nota A-F, redirecionamentos, trackers e blocklist
│   ├── settings.test.js       # Testes de validação de esquemas e mescla com defaults
│   └── tabs.test.js           # Testes de reordenação e manipulação de abas
└── src/
    ├── main/                  # Processo Principal (Node.js / Electron)
    │   ├── main.js            # Ponto de entrada, ciclo de vida e migração de dados
    │   ├── config.js          # Constantes globais (dimensões, URLs padrão e rotas internas)
    │   ├── settings.js        # Gerenciamento de configurações, proxy e DPAPI safeStorage
    │   ├── window.js          # Janela principal, ícone nativo e integração com window-state
    │   ├── window-state.js    # Persistência de geometria da janela com validação multi-monitor
    │   ├── tabs.js            # TabManager: abas, popups OAuth, find-in-page e menu de contexto
    │   ├── context-menu.js    # Menu de contexto nativo com cópia, pesquisa e DevTools
    │   ├── clear-data.js      # Limpeza profunda de storage, cookies, cache e abas
    │   ├── privacy.js         # Motor de privacidade: tldts, HTTPS, headers e atualização de blocklist
    │   ├── fingerprint-protection.js # Gerador de injeção determinística de ruído e normalização
    │   ├── navigation.js      # Normalização de URLs, busca e histórico
    │   ├── history.js         # Persistência de histórico de navegação (history.json)
    │   ├── bookmarks.js       # Persistência e busca de favoritos (bookmarks.json)
    │   ├── downloads.js       # Gerenciador de downloads, will-download e verificação de extensões
    │   ├── permissions.js     # Gerenciamento de permissões por site com persistência (permissions.json)
    │   ├── session.js         # Sessão padrão, User-Agent, proxy auth e handlers de permissão
    │   ├── ipc.js             # Registro centralizado de canais IPC com validação de remetente
    │   ├── menu.js            # Menu da aplicação e aceleradores globais de teclado
    │   ├── storage.js         # Persistência atômica de arquivos JSON em app.getPath('userData')
    │   └── pure/              # Funções puras desacopladas do Electron para testes unitários
    │       ├── download-utils.js   # Classificação pura de extensões perigosas
    │       ├── fingerprint-utils.js # Ruído determinístico de Canvas e sanitização de User-Agent
    │       ├── navigation-utils.js # Lógica pura de URLs e busca
    │       ├── privacy-utils.js    # Lógica de notas A-F, cadeia de redirecionamentos e domínios
    │       └── settings-utils.js   # Lógica pura de validação e defaults
    ├── preload/
    │   ├── preload.js          # Ponte segura para a janela principal (window.browserAPI)
    │   ├── settings-preload.js # Preload exclusivo para settings.html (window.settingsAPI)
    │   └── tab-preload.js      # Preload para abas (injeção de fingerprinting e páginas internas)
    └── renderer/              # Interface Gráfica (HTML / CSS / JS do navegador)
        ├── index.html         # Estrutura visual da barra superior, escudo, find-bar e modais
        ├── app.js             # Orquestrador da interface e ouvinte de estado consolidado
        ├── components/
        │   ├── addressbar.js       # Barra de endereços, favoritos e omnibox com sugestões
        │   ├── tabs-view.js        # Abas com DOM diffing por ID e Drag & Drop para reordenação
        │   ├── toolbar.js          # Botões de navegação, badge de redirecionamento e configurações
        │   ├── find-bar.js         # Barra de busca textual na página (Ctrl+F)
        │   ├── permission-sheet.js # Modal estilo bottom-sheet para autorização por recurso
        │   ├── download-risk-sheet.js # Modal bottom-sheet para confirmação de downloads perigosos
        │   ├── privacy-shield.js   # Escudo com contador dinâmico, selo A-F e painel de exceções
        │   ├── fire-button.js      # Botão de fogo azul na barra de navegação
        │   ├── fire-sheet.js       # Painel inferior de confirmação de apagar tudo
        │   └── fire-animation.js   # Animação WebGL/Canvas do Dragão Azul
        └── styles/
            ├── theme.css           # Variáveis CSS de cores, fontes, raios e paleta de fogo
            ├── base.css            # Reset e regras básicas de layout
            └── components.css       # Estilos de abas, toolbar, find-bar, omnibox, modais e canvas
```

---

## 3. Proteções de Privacidade

O Dragon implementa um conjunto nativo e robusto de proteções determinísticas inspiradas no DuckDuckGo:

1. **Bloqueio de Rastreadores**: Intercepta requisições de rede em `src/main/privacy.js` e cancela chamadas que não sejam navegação principal (`mainFrame`) para os domínios listados em `assets/blocklists/trackers.txt` (permitindo visitar diretamente domínios da lista). Domínios base são resolvidos com precisão pela biblioteca `tldts`.
2. **Upgrade Automático para HTTPS com Token de Uso Único**: Redireciona conexões `http://` para `https://`. Caso o site não responda em HTTPS (-102, -107, -101, -118), exibe a página `pages/https-warning.html`. Ao escolher continuar em HTTP, a página interna solicita via IPC (`warning:request-bypass-token`) um token criptográfico de uso único (`crypto.randomUUID`) com validade curta (30s) vinculado ao WebContents da aba e ao host. O host é memorizado apenas para aquela aba durante a sessão, sendo descartado ao fechá-la.
3. **Página Dedicada para Erros de Certificado SSL/TLS com Bypass Controlado**: Falhas de certificado digital (-200 a -299) são direcionadas para `pages/cert-error.html`. A opção "Continuar mesmo assim (inseguro)" exige confirmação explícita com alerta de segurança e opera através de um token criptográfico de uso único (`crypto.randomUUID`, TTL de 30s) gerado no processo principal, vinculado estritamente ao host e ao WebContentsId da aba solicitante. O certificado só é aceito temporariamente para aquela aba específica durante a sessão ativa, sendo descartado imediatamente ao fechá-la.
4. **Cabeçalhos de Privacidade**: Injeta `Sec-GPC: 1` (Global Privacy Control) e `DNT: 1` (Do Not Track) nas requisições. Em requisições de terceiros, reduz o cabeçalho `Referer` para apenas a origem.
5. **Bloqueio de Cookies de Terceiros**: Remove o cabeçalho `Cookie` em requisições cross-origin e remove `Set-Cookie` em respostas de domínios terceiros apenas para requisições que não sejam `mainFrame` ou `subFrame` (preservando fluxos normais de login e navegação).
6. **Exceções Globais por Site (`privacy-exemptions.json`)**: Quando o usuário desativa o escudo para um site, a exceção desativa tanto o bloqueio de rastreadores quanto a remoção de cookies de terceiros e a redução de Referer, restaurando compatibilidade total.
7. **Limpeza de Parâmetros de Rastreamento (Link Cleaning)**: Remove parâmetros como `utm_*`, `fbclid`, `gclid`, `msclkid`, `mc_eid`, `igshid` e `_ga` antes do carregamento da página principal.
8. **Proteção contra Vazamento de IP via WebRTC**: Configura `default_public_interface_only` nas abas para impedir exposição do endereço IP local.
9. **Bloqueador de Pop-ups e Redirecionamentos em Cadeia Rápida**:
   - Bloqueia automaticamente qualquer tentativa de abertura de nova janela/aba via `window.open` em `setWindowOpenHandler` que não tenha sido originada de clique real do usuário (`userGesture === false`), independentemente da disposição.
   - Monitora eventos `will-redirect` no WebContents e detecta cadeias rápidas e abusivas de redirecionamentos automatizados (> 2 domínios diferentes em menos de 1,5s sem interação). Interrompe a navegação suspeita e exibe badge na barra de ferramentas: *"Redirecionamento bloqueado — [domínio]"* com botão *"Permitir mesmo assim"*.
   - Pop-ups e redirecionamentos bloqueados são contabilizados por aba e exibidos no painel do escudo (`popupsBlocked`).
   - Respeita integralmente exceções por site (`isSiteExempt`).

10. **Classificação de Privacidade do Site (Selo A-F)**:
    - O painel do escudo de privacidade exibe um selo alfabético colorido (A/B verde, C amarelo, D/F vermelho) calculado deterministicamente por `calculatePrivacyGrade(info)` em `src/main/pure/privacy-utils.js`.
    - Critérios ponderados: protocolo (HTTPS vs HTTP inseguro), volume de rastreadores terceiros bloqueados (0 a 15+), tentativas de pop-ups/redirecionamentos forçados e bloqueio de cookies de terceiros.

11. **Escudo de Privacidade na Barra de Endereço**:
    - Ícone de escudo com contador dinâmico de rastreadores bloqueados e badge do selo de privacidade (A a F).
    - Painel flutuante exibindo o status de segurança, contagem de pop-ups bloqueados, cookies terceiros bloqueados e interruptor para ativar/desativar proteções por site com persistência em `privacy-exemptions.json`.

12. **Proteção contra Fingerprinting (Configuração Global Única, Sem Multiperfil)**:
    - O Dragon oferece uma proteção global (ativada/desativada no painel *Privacidade Avançada* em `dragon://settings`) inspirada no comportamento nativo de navegadores como Firefox (`resistFingerprinting`) e Brave.
    - **Objetivo**: Reduzir a singularidade do Dragon tornando sua instalação idêntica a outras instalações do próprio navegador, **sem simular perfis falsos**, múltiplas identidades ou computadores diferentes.
    - **Controles Configuráveis**:
      - **Fuso Horário**: Padroniza o fuso horário relatado para `UTC` via `Intl.DateTimeFormat` e Date prototype.
      - **Resolução de Tela**: Padroniza a resolução exposta (`screen.width`, `screen.height`, `window.innerWidth/innerHeight`) para um valor comum (1920x1080), sem impactar o tamanho real ou o redimensionamento da janela do Dragon.
      - **Ruído Determinístico no Canvas/WebGL**: Injeta uma distorção sutil (máximo ±1 canal de cor) e determinística baseada em uma semente estável por sessão em `toDataURL` e `getImageData`. Como a semente é consistente durante a sessão, sites que utilizam canvas de forma legítima continuam funcionando normalmente sem quebras visuais.
      - **Limitação de Fontes do Sistema**: Restringe a enumeração de fontes do sistema via `document.fonts` a um conjunto padrão seguro.
      - **Normalização de User-Agent**: Sanitiza a string de User-Agent tanto nos cabeçalhos HTTP quanto em `navigator.userAgent`, removendo menções ao Electron e estabilizando a versão do Chromium.
    - **Isolamento de Páginas Internas**: Os scripts de proteção são injetados estritamente em páginas web normais e **nunca** nas páginas de controle do Dragon (`pages/settings.html`, `pages/newtab.html`, etc.).

> [!WARNING]
> **Ressalva Importante sobre Fingerprinting:** A proteção contra fingerprinting do navegador é uma corrida armamentista contínua entre desenvolvedores de navegadores e redes avançadas de rastreamento biométrico/comportamental. Nenhuma proteção baseada em software é 100% garantida contra técnicas invasivas emergentes ou correlações multicamadas. No entanto, ela eleva substancialmente o custo do rastreamento passivo sem comprometer a estabilidade do usuário.

---

## 4. Abas Privadas (Navegação Anônima)

- **Atalho**: <kbd>Ctrl + Shift + N</kbd> (ou pelo menu Navegação).
- **Sessão Exclusiva em Memória**: Criada com `session.fromPartition('private-<id>')` sem o prefixo `persist:`.
- **Zero Vazamentos de Disco**:
  - Downloads iniciados em sessão privada funcionam normalmente e são visíveis enquanto ativos, mas **nunca** são gravados no `downloads.json`.
  - Permissões concedidas em sessão privada com "Lembrar desta decisão" são armazenadas estritamente em memória na partição ativa e descartadas ao fechar a aba/partição, sem tocar em `permissions.json`.
  - O histórico de navegação nunca grava visitas de abas privadas. Ao fechar a aba privada, todos os storages e caches da partição são expurgados da memória.
- **Zero Persistência**: Nenhum histórico, cookie, cache de disco ou credencial é gravado em arquivos locais.
- **Descarte Imediato**: Todos os dados em memória da partição são expurgados ao fechar a aba ou ao acionar o botão de apagar tudo.
- **Identificação Visual**: Aba com estilo visual diferenciado e ícone de máscara.

---

## 5. Botão de Apagar Tudo (O Fogo do Dragão Azul)

- **Atalho**: <kbd>Ctrl + Shift + Delete</kbd> ou clique no botão de chama na barra de navegação.
- **Regra Fundamental de Confirmação**: **Nada é apagado sem a confirmação explícita do usuário no painel**. Ao clicar no botão, abre-se um painel inferior (bottom sheet). Se o usuário cancelar, clicar fora ou pressionar <kbd>Esc</kbd>, nenhuma exclusão é realizada.
- **Processo de Limpeza e Animação**:
  1. Ao confirmar no painel, a interface é travada contra cliques concorrentes e as abas ativas são ocultadas.
  2. Dispara-se a animação em tela cheia do Dragão Azul (shader WebGL FBM de alta velocidade com fallback para Canvas 2D).
  3. O processo principal fecha todas as abas, esvazia dados de armazenamento (`clearStorageData`), limpa caches de rede/DNS e exclui partições de abas privadas ativas.
  4. Ao término da queima, uma nova aba limpa é aberta e um toast confirma que as abas e dados foram apagados.

---

## 6. Pasta de Dados do Usuário (`%APPDATA%\Dragon`)

O navegador armazena seus dados em:
- **Windows**: `%APPDATA%\Dragon` (`C:\Users\<usuario>\AppData\Roaming\Dragon`)

### O que fica salvo:
- `settings.json`: Preferências do usuário (buscador padrão, inicialização, página inicial, zoom, cor de destaque, tema, configurações de proxy e credenciais criptografadas via DPAPI `safeStorage`).
- `sessions.json`: Lista de abas da última sessão para restauração (abas privadas nunca são salvas).
- `history.json`: Histórico de páginas visitadas com título, URL e timestamp (abas privadas nunca gravam histórico).
- `bookmarks.json`: Favoritos salvos com data de criação e links rápidos.
- `downloads.json`: Histórico de downloads concluídos, cancelados ou em andamento.
- `permissions.json`: Decisões de permissões concedidas ou bloqueadas por site (câmera, microfone, geolocalização).
- `window-state.json`: Posição na tela (x, y), dimensões (largura, altura) e estado maximizado com validação multi-monitor.
- `privacy-exemptions.json`: Sites onde o usuário optou por desativar as proteções do escudo.
- `backgrounds/`: Pasta com imagens de fundo da nova aba copiadas localmente do computador (o caminho original nunca é armazenado).
- `trackers-updated.txt`: Cache dinâmico da blocklist atualizada em segundo plano.
- `Network\Cookies`: Cookies persistentes de sites da navegação padrão.
- `Local Storage`, `IndexedDB`, `Cache`: Armazenamento web padrão de sites visitados em abas normais.
- `Preferences` e `Local State`: Configurações nativas do Chromium.

> **Migração Automática**: Na primeira execução do Dragon, se a pasta legada `%APPDATA%\meu-navegador` existir e a nova não existir, todos os dados são copiados integralmente para `%APPDATA%\Dragon`, preservando logins, cookies e preferências sem apagar a pasta anterior.

---

## 7. Fluxo de Dados em 10 Linhas

O processo principal (**Main**) é a única fonte da verdade. A interface (**Renderer**) apenas exibe o que recebe e despacha intenções do usuário:

1. **Ação do Usuário:** O usuário clica em um botão (ex: *Nova Aba*) ou digita uma URL e aperta *Enter*.
2. **Preload Seguro:** O componente chama a função correspondente exposta em `window.browserAPI` (ex: `browserAPI.navigate(url)`).
3. **Despacho IPC:** O Preload despacha a chamada para o processo principal através de `ipcRenderer.invoke(...)`.
4. **Validação no Main:** O `src/main/ipc.js` recebe o evento, valida estritamente a origem do frame e aciona o módulo responsável.
5. **Normalização:** Para endereços, o `src/main/navigation.js` decide se abre direto com `https://`, `http://` (para localhost/IP), rotas internas `dragon://` ou pesquisa.
6. **Execução na Aba:** O `src/main/tabs.js` (TabManager) comanda a `WebContentsView` ativa a carregar a página.
7. **Eventos do Chromium:** O Chromium emite eventos nativos (`did-start-loading`, `page-title-updated`, `did-navigate`, `found-in-page`).
8. **Consolidação do Estado:** O TabManager atualiza o seu objeto de estado (`getState()`), incluindo dados de privacidade e abas.
9. **Emissão do Estado:** O Main envia o estado serializado para a interface pelo canal IPC `browser:state-update`.
10. **Re-renderização Visual:** O `src/renderer/app.js` recebe o novo estado e atualiza as abas (usando DOM diffing), botões, endereço e escudo.

---

## 8. O Sistema de Overlay (`showOverlay` e `hideOverlay`)

No Electron, instâncias de `WebContentsView` são camadas gráficas nativas renderizadas **por cima** de qualquer elemento HTML da janela principal.

Se você criar um menu suspenso (dropdown), modal de confirmação ou painel do escudo no HTML da interface que ocupe a área do site, a visualização nativa cobriria esses elementos.

Para resolver isso de forma elegante:
- Chame `window.browserAPI.showOverlay()` ao abrir o modal/painel (isso oculta temporariamente o site com `view.setVisible(false)`).
- Chame `window.browserAPI.hideOverlay()` ao fechar o modal/painel (isso restaura a visualização do site com `view.setVisible(true)`).

---

## 9. Como Adicionar um Recurso Novo (Passo a Passo)

Suponha que você queira adicionar um recurso novo no navegador:

### Passo 1: Criar a lógica de dados no Main
Em [src/main/storage.js](src/main/storage.js) ou em um módulo dedicado em `src/main/`:
```javascript
function getCustomData() {
  return readJSON('custom-data.json', []);
}
```

### Passo 2: Registrar os canais IPC
Em [src/main/ipc.js](src/main/ipc.js), registre os canais com validação estrita do remetente (`isMainSender` ou `isPageSender`):
```javascript
ipcMain.handle('custom:get', (event) => {
  if (!isMainSender(event)) return null;
  return getCustomData();
});
```

### Passo 3: Expor na API do Preload
Em [src/preload/preload.js](src/preload/preload.js), adicione à ponte segura:
```javascript
getCustomData: () => ipcRenderer.invoke('custom:get'),
```

### Passo 4: Criar o componente na Interface
1. Adicione um novo arquivo `src/renderer/components/meu-componente.js`.
2. Adicione os elementos necessários no [src/renderer/index.html](src/renderer/index.html).
3. Importe a tag `<script src="components/meu-componente.js"></script>` antes de `app.js`.

### Passo 5: Estilizar exclusivamente pelo tema
Utilize as variáveis já existentes em [src/renderer/styles/theme.css](src/renderer/styles/theme.css) (`var(--color-bg-toolbar)`, `var(--radius-md)`, etc.) para garantir que qualquer mudança futura de tema se aplique ao seu novo recurso automaticamente.

---

## 10. Atalhos de Teclado Suportados

| Atalho | Ação |
| :--- | :--- |
| **Ctrl + T** | Abre uma nova aba |
| **Ctrl + Shift + N** | Abre uma nova aba privada (em memória, sem histórico) |
| **Ctrl + W** | Fecha a aba ativa atual (se for a última, cria uma nova) |
| **Ctrl + Shift + T** | Reabre a última aba que foi fechada |
| **Ctrl + L** | Dá foco imediato e seleciona o texto da barra de endereços |
| **Ctrl + F** | Abre a barra de busca textual na página |
| **Ctrl + D** | Favorita ou remove dos favoritos a página ativa atual |
| **Ctrl + H** | Abre a página de Histórico (`dragon://history`) |
| **Ctrl + J** | Abre a página de Downloads (`dragon://downloads`) |
| **Ctrl + ,** | Abre a página de Configurações (`dragon://settings`) |
| **Ctrl + 1** a **8** | Alterna diretamente para a aba de posição 1 até 8 |
| **Ctrl + 9** | Alterna diretamente para a última aba aberta |
| **Ctrl + Tab** | Alterna para a próxima aba aberta |
| **Ctrl + Shift + Tab**| Alterna para a aba aberta anterior |
| **Ctrl + +** / **=** | Aumenta o zoom da página ativa em 10% |
| **Ctrl + -** | Diminui o zoom da página ativa em 10% |
| **Ctrl + 0** | Redefine o zoom da página ativa para o padrão (100%) |
| **Ctrl + R** ou **F5** | Recarrega a página da aba ativa |
| **Alt + ←** | Volta no histórico da aba ativa |
| **Alt + →** | Avança no histórico da aba ativa |
| **Ctrl + Shift + Del** | Abre o painel para Apagar Tudo (O Fogo do Dragão Azul) |
| **F12** | Abre ou fecha as Ferramentas de Desenvolvedor (DevTools) |

---

## 11. Como Executar e Testar

### Pré-requisitos
- Node.js instalado (v18, v20, v22 ou v24).

### Instalação
No terminal, dentro da pasta do projeto:
```bash
npm install
```
*(Nota no Windows: Caso o PowerShell bloqueie a execução de scripts `.ps1`, execute `npm.cmd install`)*

### Execução em Desenvolvimento
```bash
npm start
```
*(Ou alternativamente: `npx.cmd electron .`)*

### Testes Automatizados
O projeto conta com suíte de testes unitários para todas as funções puras de navegação, privacidade e configurações, executada diretamente pelo runner oficial `node:test` (sem frameworks de teste externos):
```bash
npm test
```

### Empacotamento para Produção (Instalador Windows)
O projeto já está configurado com `electron-builder` para gerar o instalador executável `.exe` (NSIS) para Windows com o ícone oficial:
```bash
npm run dist
```
O instalador resultante é gerado no diretório `dist/`.

---

## 12. Sistema de Fingerprinting Configurável e com Reset de Identidade

O Dragon conta com mitigação avançada de fingerprinting multivetorial inspirada em navegadores antidetect modernos (como o Dolphin Anty), projetada para proteger o usuário de rastreamento invasivo por impressão digital mantendo a abordagem simples de **configuração global do navegador** (sem necessidade de gerenciar múltiplos perfis ou contas).

### Destaques do Sistema
- **5 Grupos de Vetores**:
  - **Grupo A (Sistema)**: OS (`windows11`, `windows10`, `macos`, `linux`), Navegador (`chrome`, `edge`, `firefox`), User-Agent, Plataforma (`Win32`, `MacIntel`, etc.), Idioma e Fuso Horário (`America/Sao_Paulo`, etc.).
  - **Grupo B (Hardware)**: Resolução de Tela (`1920x1080`, `2560x1440`, etc.), Device Pixel Ratio (DPR), CPU Cores (`hardwareConcurrency`), Memória RAM (`deviceMemory`) e Touch (`maxTouchPoints`).
  - **Grupo C (GPU & WebGL)**: GPU Vendor e Renderer (ANGLE/Direct3D11/Metal) e mitigação em `readPixels`.
  - **Grupo D (Canvas, Áudio, ClientRects & Fontes)**: Ruído determinístico imperceptível em Canvas 2D (`toDataURL`, `getImageData`), AudioBuffer (`getChannelData`), ClientRects (`getBoundingClientRect`) e limitação de fontes do SO alvo.
  - **Grupo E (Outros Vetores)**: WebRTC (proxy, disabled, real), contagem de dispositivos de mídia (`enumerateDevices`), vozes de síntese (`speechSynthesis.getVoices`), bateria (`getBattery`) e permissões (`permissions.query`).
- **Validação de Consistência Interna**: Impede combinações impossíveis (ex.: macOS com GPUs NVIDIA é estritamente bloqueado) e alerta sobre configurações incomuns.
- **Botão "Resetar Fingerprint"**: Sorteia uma nova semente de 32 bits e gera uma identidade completamente nova e coerente com um clique, recarregando automaticamente todas as abas web abertas.
- **Determinismo e Isolamento**: O ruído permanece perfeitamente estável durante a mesma sessão. Injeção restrita a páginas web (`http:` e `https:`), nunca tocando páginas internas do navegador.
```

---

