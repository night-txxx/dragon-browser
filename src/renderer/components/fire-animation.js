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
