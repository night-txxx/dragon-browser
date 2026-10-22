const test = require('node:test');
const assert = require('node:assert');
const { normalizeDialogOptions } = require('../pages/dialog');

test('dialog: normalizeDialogOptions com string para confirm', () => {
  const opts = normalizeDialogOptions('Deseja continuar?', false);
  assert.strictEqual(opts.title, 'Confirmação');
  assert.strictEqual(opts.message, 'Deseja continuar?');
  assert.strictEqual(opts.confirmText, 'Confirmar');
  assert.strictEqual(opts.cancelText, 'Cancelar');
  assert.strictEqual(opts.danger, false);
});

test('dialog: normalizeDialogOptions com string para alert', () => {
  const opts = normalizeDialogOptions('Operação concluída com sucesso.', true);
  assert.strictEqual(opts.title, 'Aviso');
  assert.strictEqual(opts.message, 'Operação concluída com sucesso.');
  assert.strictEqual(opts.confirmText, 'OK');
  assert.strictEqual(opts.cancelText, 'Cancelar');
  assert.strictEqual(opts.danger, false);
});

test('dialog: normalizeDialogOptions com objeto customizado perigoso', () => {
  const opts = normalizeDialogOptions({
    title: 'Limpar Tudo',
    message: 'Esta ação não pode ser desfeita.',
    confirmText: 'Limpar',
    cancelText: 'Voltar',
    danger: true
  }, false);

  assert.strictEqual(opts.title, 'Limpar Tudo');
  assert.strictEqual(opts.message, 'Esta ação não pode ser desfeita.');
  assert.strictEqual(opts.confirmText, 'Limpar');
  assert.strictEqual(opts.cancelText, 'Voltar');
  assert.strictEqual(opts.danger, true);
});

test('dialog: normalizeDialogOptions trata valores nulos/indefinidos graciosamente', () => {
  const opts = normalizeDialogOptions(null, false);
  assert.strictEqual(opts.title, 'Confirmação');
  assert.strictEqual(opts.message, '');
  assert.strictEqual(opts.confirmText, 'Confirmar');
  assert.strictEqual(opts.cancelText, 'Cancelar');
  assert.strictEqual(opts.danger, false);
});
