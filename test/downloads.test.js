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
