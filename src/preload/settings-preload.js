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
