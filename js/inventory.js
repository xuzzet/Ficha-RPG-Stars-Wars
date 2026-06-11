/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   inventory.js — Inventário, equipamentos e armas

   Responsabilidade:
   - Ler o formulário de novo item (e os campos de arma).
   - Adicionar e remover itens do inventário.
   - Renderizar a lista do inventário (incluindo cards de arma).
   - Calcular e rolar o dano das armas.
   Os equipamentos principais são campos simples (slots) lidos
   diretamente no salvamento (ver storage.js).
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, getVal, getNum, generateId, escapeHtml } from './dom.js';
import { showStatus } from './ui.js';
import { getFinalAttribute } from './attributes.js';
import { displayDamageResult, addDamageRollToHistory } from './dice.js';

/* ============================================================
   TABELAS DO SISTEMA DE DANO
   ============================================================ */

/** Categoria de dano → número de faces do dado. */
export const DAMAGE_DICE = {
  fraco:   4,
  normal:  6,
  forte:   8,
  grave:  10,
  extremo: 12,
};

/** Tipo de arma → atributos permitidos para escalonamento. */
export const WEAPON_SCALING = {
  melee:     ['corpo'],
  ranged:    ['corpo', 'mente'],
  vehicle:   ['mente'],
  special:   ['espirito'],
  explosive: ['corpo', 'mente', 'espirito'], // dano fixo: escala não é usada
};

/** Ordem dos passos de dado (para modificadores temporários de categoria). */
const DIE_STEP_ORDER = [4, 6, 8, 10, 12];

/** Rótulos legíveis. */
const WEAPON_TYPE_LABEL = {
  melee:     'Arma Corpo a Corpo',
  ranged:    'Arma a Distância',
  vehicle:   'Arma de Veículo',
  special:   'Arma Especial',
  explosive: 'Explosivo',
};
const DAMAGE_CATEGORY_LABEL = {
  fraco:   'Dano Fraco',
  normal:  'Dano Normal',
  forte:   'Dano Forte',
  grave:   'Dano Grave',
  extremo: 'Dano Extremo',
};
const ATTR_LABEL = { corpo: 'Corpo', mente: 'Mente', espirito: 'Espírito' };

/* ============================================================
   FUNÇÕES DE DANO
   ============================================================ */

/**
 * Retorna o número de faces do dado de uma categoria de dano.
 * @param {string} category
 * @returns {number}
 */
export function getDamageDieByCategory(category) {
  return DAMAGE_DICE[category] || 6;
}

/**
 * Retorna o atributo de escalonamento VÁLIDO de uma arma.
 * Se o atributo salvo não for permitido para o tipo, corrige
 * automaticamente para o primeiro atributo permitido.
 * @param {object} weapon
 * @returns {string}
 */
export function getWeaponScalingAttribute(weapon) {
  const allowed = WEAPON_SCALING[weapon.weaponType] || ['corpo'];
  if (weapon.scalingAttribute && allowed.includes(weapon.scalingAttribute)) {
    return weapon.scalingAttribute;
  }
  return allowed[0];
}

/**
 * Rola um dado de N faces. Retorna inteiro entre 1 e N.
 * @param {number} sides
 * @returns {number}
 */
export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Aplica um modificador temporário de passos ao dado, respeitando os
 * limites d4 (mínimo) e d12 (máximo).
 * @param {number} die
 * @param {number} steps
 * @returns {number}
 */
function applyDieStep(die, steps) {
  const idx = DIE_STEP_ORDER.indexOf(die);
  if (idx === -1 || !steps) return die;
  const next = Math.max(0, Math.min(DIE_STEP_ORDER.length - 1, idx + steps));
  return DIE_STEP_ORDER[next];
}

/**
 * Calcula a fórmula de dano de uma arma COM escalonamento por atributo.
 *
 * FÓRMULA:
 *   atributoFinal = base + bônus de progressão
 *   escala        = Math.floor(atributoFinal / 10)
 *   quantidade    = max(1, escala)
 *   bônus fixo    = escala
 *
 * @param {object} weapon
 * @returns {{scalingAttr:string, attributeValue:number, diceCount:number, die:number, bonus:number, formula:string}}
 */
export function calculateWeaponDamageFormula(weapon) {
  const scalingAttr    = getWeaponScalingAttribute(weapon);
  const attributeValue = getFinalAttribute(scalingAttr);
  const scale          = Math.floor(attributeValue / 10);
  const diceCount      = Math.max(1, scale);
  const bonus          = scale;
  const die            = weapon.damageDie || getDamageDieByCategory(weapon.damageCategory);

  return {
    scalingAttr,
    attributeValue,
    diceCount,
    die,
    bonus,
    formula: `${diceCount}d${die}${bonus > 0 ? ` + ${bonus}` : ''}`,
  };
}

/**
 * Calcula a fórmula de dano FIXO (explosivos): quantidade e dado fixos,
 * com bônus fixo opcional. Não escala com atributos.
 * @param {object} weapon
 * @returns {{diceCount:number, die:number, bonus:number, formula:string}}
 */
export function calculateFixedDamage(weapon) {
  const diceCount = Math.max(1, Number(weapon.fixedDiceCount) || 1);
  const die       = Number(weapon.fixedDamageDie) || getDamageDieByCategory(weapon.damageCategory);
  const bonus     = Number(weapon.fixedDamageBonus) || 0;

  return {
    diceCount,
    die,
    bonus,
    formula: `${diceCount}d${die}${bonus > 0 ? ` + ${bonus}` : ''}`,
  };
}

/**
 * Retorna a fórmula de dano (string) de uma arma, recalculada a partir
 * dos atributos finais atuais. Nunca é salva como verdade permanente.
 * @param {object} weapon
 * @returns {string}
 */
export function renderWeaponDamageFormula(weapon) {
  const dmg = weapon.isFixedDamage ? calculateFixedDamage(weapon) : calculateWeaponDamageFormula(weapon);
  return dmg.formula;
}

/**
 * Localiza uma arma do inventário pelo ID.
 * @param {string} id
 * @returns {object|undefined}
 */
export function findWeaponById(id) {
  return sheetState.inventory.find(i => i.id === id && i.isWeapon);
}

/**
 * Rola o dano de uma arma com escalonamento e registra no histórico.
 * @param {string} weaponId
 * @param {{stepMod?:number, tempBonus?:number}} [options]
 */
export function rollWeaponDamage(weaponId, options = {}) {
  const weapon = findWeaponById(weaponId);
  if (!weapon) {
    showStatus('Arma não encontrada.', 'error');
    return;
  }

  // Explosivos usam dano fixo.
  if (weapon.isFixedDamage) {
    rollFixedDamage(weaponId, options);
    return;
  }

  const damage    = calculateWeaponDamageFormula(weapon);
  const stepMod   = Number(options.stepMod) || 0;
  const tempBonus = Number(options.tempBonus) || 0;
  const die       = applyDieStep(damage.die, stepMod);

  const rolls = [];
  for (let i = 0; i < damage.diceCount; i++) rolls.push(rollDie(die));

  const totalBonus = damage.bonus + tempBonus;
  const total      = rolls.reduce((sum, v) => sum + v, 0) + totalBonus;
  const formula    = `${damage.diceCount}d${die}${totalBonus > 0 ? ` + ${totalBonus}` : ''}`;

  displayDamageResult(weapon.name, formula, rolls, totalBonus, total);
  addDamageRollToHistory({ weaponName: weapon.name, formula, rolls, bonus: totalBonus, total });
  showStatus(`${weapon.name}: ${formula} = ${total} de dano`, 'saved', 3000);
}

/**
 * Rola o dano FIXO de um explosivo e registra no histórico.
 * @param {string} weaponId
 * @param {{stepMod?:number, tempBonus?:number}} [options]
 */
export function rollFixedDamage(weaponId, options = {}) {
  const weapon = findWeaponById(weaponId);
  if (!weapon) {
    showStatus('Item não encontrado.', 'error');
    return;
  }

  const damage    = calculateFixedDamage(weapon);
  const stepMod   = Number(options.stepMod) || 0;
  const tempBonus = Number(options.tempBonus) || 0;
  const die       = applyDieStep(damage.die, stepMod);

  const rolls = [];
  for (let i = 0; i < damage.diceCount; i++) rolls.push(rollDie(die));

  const totalBonus = damage.bonus + tempBonus;
  const total      = rolls.reduce((sum, v) => sum + v, 0) + totalBonus;
  const formula    = `${damage.diceCount}d${die}${totalBonus > 0 ? ` + ${totalBonus}` : ''}`;

  displayDamageResult(weapon.name, formula, rolls, totalBonus, total);
  addDamageRollToHistory({ weaponName: weapon.name, formula, rolls, bonus: totalBonus, total });
  showStatus(`${weapon.name}: ${formula} = ${total} de dano`, 'saved', 3000);
}

/* ============================================================
   FORMULÁRIO
   ============================================================ */

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
 * Aplica as restrições do formulário de arma:
 * - Mostra/oculta os campos de arma conforme o checkbox.
 * - Mostra/oculta os campos de dano fixo (explosivos).
 * - Restringe o atributo de escalonamento ao tipo selecionado.
 * Chamada por main.js ao alterar o checkbox/tipo e na inicialização.
 */
export function updateWeaponFormConstraints() {
  const isWeapon = !!(byId('item-is-weapon') && byId('item-is-weapon').checked);
  const fields   = byId('weapon-fields');
  if (fields) fields.hidden = !isWeapon;

  const type     = getVal('item-weapon-type');
  const fixedBox = byId('weapon-fixed-fields');
  if (fixedBox) fixedBox.hidden = type !== 'explosive';

  const allowed = WEAPON_SCALING[type] || ['corpo', 'mente', 'espirito'];
  const sel     = byId('item-scaling-attr');
  if (sel) {
    Array.from(sel.options).forEach(opt => {
      const ok = allowed.includes(opt.value);
      opt.disabled = !ok;
      opt.hidden   = !ok;
    });
    if (!allowed.includes(sel.value)) sel.value = allowed[0];
  }
}

/**
 * Lê e valida os campos do formulário de novo item (e de arma).
 * @returns {object|null}
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

  const base     = { name, type, qty, desc };
  const isWeapon = !!(byId('item-is-weapon') && byId('item-is-weapon').checked);
  if (!isWeapon) return { ...base, isWeapon: false };

  const weaponType     = getVal('item-weapon-type');
  const damageCategory = getVal('item-damage-category');
  const damageDie      = getDamageDieByCategory(damageCategory);
  const properties     = getVal('item-weapon-props')
    .split(',').map(s => s.trim()).filter(Boolean);
  const rarity = getVal('item-rarity');
  const price  = getNum('item-price', 0);

  // Auto-correção do atributo de escalonamento conforme o tipo.
  const allowed = WEAPON_SCALING[weaponType] || ['corpo'];
  let scalingAttribute = getVal('item-scaling-attr');
  if (!allowed.includes(scalingAttribute)) {
    scalingAttribute = allowed[0];
    showStatus(`Escalonamento ajustado para ${ATTR_LABEL[scalingAttribute]} (regra do tipo de arma).`, 'warning', 3000);
  }

  const isFixedDamage = weaponType === 'explosive';

  const weapon = {
    ...base,
    isWeapon: true,
    weaponType,
    damageCategory,
    damageDie,
    scalingAttribute,
    properties,
    rarity,
    price,
    isFixedDamage,
  };

  if (isFixedDamage) {
    weapon.fixedDiceCount   = getNum('item-fixed-dice', 1);
    weapon.fixedDamageDie   = getNum('item-fixed-die', damageDie);
    weapon.fixedDamageBonus = getNum('item-fixed-bonus', 0);
    weapon.area             = getVal('item-area').trim();
  }

  return weapon;
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

  // Limpa campos de arma (mantém o checkbox para adições em sequência).
  const props = byId('item-weapon-props');
  const price = byId('item-price');
  const area  = byId('item-area');
  if (props) props.value = '';
  if (price) price.value = '';
  if (area)  area.value  = '';

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

/* ============================================================
   RENDERIZAÇÃO
   ============================================================ */

/**
 * Monta o card de um item comum (não-arma).
 * @param {object} item
 * @returns {HTMLElement}
 */
function buildItemCard(item) {
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
    <button type="button" class="btn btn--danger btn--sm" data-action="remove-item" data-id="${escapeHtml(item.id)}">✕</button>
  `;
  return card;
}

/**
 * Monta o card de uma arma, com badges e botão "Rolar Dano".
 * A fórmula de dano é SEMPRE recalculada a partir dos atributos atuais.
 * @param {object} item
 * @returns {HTMLElement}
 */
function buildWeaponCard(item) {
  const card = document.createElement('div');
  card.className  = 'item-card item-card--weapon';
  card.dataset.id = item.id;

  const dmg        = item.isFixedDamage ? calculateFixedDamage(item) : calculateWeaponDamageFormula(item);
  const typeLabel  = WEAPON_TYPE_LABEL[item.weaponType] || 'Arma';
  const catLabel   = DAMAGE_CATEGORY_LABEL[item.damageCategory] || '';
  const scaleLabel = item.isFixedDamage
    ? 'Dano Fixo'
    : `Escala: ${ATTR_LABEL[dmg.scalingAttr] || ''}`;
  const propsText  = (item.properties && item.properties.length) ? item.properties.join(', ') : '';
  const icon       = item.isFixedDamage ? '💥' : '🔫';

  card.innerHTML = `
    <div class="item-type-icon">${icon}</div>
    <div class="item-info">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="weapon-badges">
        <span class="badge badge--type">${escapeHtml(typeLabel)}</span>
        ${catLabel ? `<span class="badge badge--dmg">${escapeHtml(catLabel)}</span>` : ''}
        <span class="badge badge--die">d${escapeHtml(String(dmg.die))}</span>
        <span class="badge badge--scale">${escapeHtml(scaleLabel)}</span>
        ${item.rarity ? `<span class="badge badge--rarity">${escapeHtml(item.rarity)}</span>` : ''}
        ${item.price ? `<span class="badge badge--price">${escapeHtml(String(item.price))} cr</span>` : ''}
        ${item.isFixedDamage && item.area ? `<span class="badge badge--area">Área: ${escapeHtml(item.area)}</span>` : ''}
      </div>
      <div class="weapon-formula">Dano: <b data-role="formula">${escapeHtml(dmg.formula)}</b></div>
      ${propsText ? `<div class="weapon-props">Propriedades: ${escapeHtml(propsText)}</div>` : ''}
      ${item.desc ? `<div class="item-desc">${escapeHtml(item.desc)}</div>` : ''}
      <div class="weapon-roll-controls">
        <label class="weapon-mod-label">Passo
          <select class="weapon-mini-select" data-role="step-mod">
            <option value="0">Nenhum</option>
            <option value="1">+1</option>
            <option value="2">+2</option>
            <option value="-1">-1</option>
          </select>
        </label>
        <label class="weapon-mod-label">Bônus tmp.
          <input type="number" class="weapon-mini-input" data-role="temp-bonus" value="0">
        </label>
        <button type="button" class="btn btn--primary btn--sm" data-action="roll-damage" data-id="${escapeHtml(item.id)}">🎲 Rolar Dano</button>
      </div>
    </div>
    <span class="item-qty-badge">×${escapeHtml(String(item.qty))}</span>
    <button type="button" class="btn btn--danger btn--sm" data-action="remove-item" data-id="${escapeHtml(item.id)}">✕</button>
  `;
  return card;
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
    const card = item.isWeapon ? buildWeaponCard(item) : buildItemCard(item);
    container.appendChild(card);
  });
}
