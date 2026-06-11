/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   inventory.js — Inventário e equipamentos

   Responsabilidade:
   - Ler o formulário de novo item.
   - Adicionar e remover itens do inventário.
   - Renderizar a lista do inventário.
   Os equipamentos principais são campos simples (slots) lidos
   diretamente no salvamento (ver storage.js).
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, getVal, getNum, generateId, escapeHtml } from './dom.js';
import { showStatus } from './ui.js';

/**
 * Retorna o emoji correspondente ao tipo de item.
 * @param {string} type
 * @returns {string}
 */
export function getItemTypeIcon(type) {
  const map = {
    arma: '🔫', armadura: '🛡', ferramenta: '🔧', droide: '🤖',
    nave: '🚀', implante: '⚙', consumivel: '💊', reliquia: '💎', outro: '📦',
  };
  return map[type] || '📦';
}

/**
 * Lê e valida os campos do formulário de novo item.
 * @returns {{name,type,qty,desc}|null}
 */
function readItemForm() {
  const name = getVal('item-name').trim();
  const type = getVal('item-type');
  const qty  = getNum('item-qty', 1);
  const desc = getVal('item-desc').trim();

  if (!name) {
    showStatus('Preencha o nome do item.', 'error');
    return null;
  }
  return { name, type, qty, desc };
}

/**
 * Adiciona um novo item ao inventário e re-renderiza.
 */
export function addInventoryItem() {
  const data = readItemForm();
  if (!data) return;

  sheetState.inventory.push({ id: generateId(), ...data });

  byId('item-name').value = '';
  byId('item-desc').value = '';
  byId('item-qty').value  = '1';

  renderInventory();
  showStatus('Item adicionado.', 'saved', 2000);
}

/**
 * Remove um item do inventário pelo ID.
 * @param {string} id
 */
export function removeInventoryItem(id) {
  sheetState.inventory = sheetState.inventory.filter(i => i.id !== id);
  renderInventory();
}

/**
 * Renderiza a lista de itens do inventário no DOM.
 */
export function renderInventory() {
  const container = byId('inventory-list');
  container.innerHTML = '';

  if (sheetState.inventory.length === 0) {
    container.innerHTML = '<p class="empty-message">Inventário vazio. Adicione itens acima.</p>';
    return;
  }

  sheetState.inventory.forEach(item => {
    const card = document.createElement('div');
    card.className  = 'item-card';
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="item-type-icon">${getItemTypeIcon(item.type)}</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-meta">${escapeHtml(item.type.charAt(0).toUpperCase() + item.type.slice(1))}</div>
        ${item.desc ? `<div class="item-desc">${escapeHtml(item.desc)}</div>` : ''}
      </div>
      <span class="item-qty-badge">×${escapeHtml(String(item.qty))}</span>
      <button class="btn btn--danger btn--sm" data-action="remove-item" data-id="${escapeHtml(item.id)}">✕</button>
    `;
    container.appendChild(card);
  });
}
