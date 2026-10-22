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
