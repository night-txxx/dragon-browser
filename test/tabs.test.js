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
