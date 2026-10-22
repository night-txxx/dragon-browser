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
