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
