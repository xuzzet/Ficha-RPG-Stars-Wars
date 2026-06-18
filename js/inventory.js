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
import {
  DAMAGE_DICE, WEAPON_SCALING, DIE_STEP_ORDER,
  WEAPON_TYPE_LABEL, DAMAGE_CATEGORY_LABEL, ATTR_LABEL,
  ITEM_TYPE_ICONS, DEFAULT_ITEM_ICON,
} from './constants.js';
import { clampInt } from './validators.js';
import {
  WEAPON_PROPERTY_CATEGORIES,
  getWeaponPropertyById, filterWeaponProperties,
  sanitizeWeaponProperties, normalizePropertyList, getCategoryClass,
} from './weaponProperties.js';

// Reexporta tabelas de dano para compatibilidade com imports existentes.
export { DAMAGE_DICE, WEAPON_SCALING } from './constants.js';

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

/* Estado do formulário de item (propriedades + edição). */
let formSelectedProperties = []; // ids na ordem de seleção
let editingItemId = null;        // id do item em edição (ou null)
let propsFilterQuery = '';       // texto do filtro de propriedades
let propsFilterCategory = '';    // categoria do filtro de propriedades

/**
 * Retorna o emoji correspondente ao tipo de item.
 * @param {string} type
 * @returns {string}
 */
export function getItemTypeIcon(type) {
  return ITEM_TYPE_ICONS[type] || DEFAULT_ITEM_ICON;
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

  // Quando os campos de arma ficam visíveis, garante a UI de propriedades.
  if (isWeapon) renderWeaponPropertySelector();
}

/* ============================================================
   SELETOR DE PROPRIEDADES DA ARMA (FORMULÁRIO)
   ============================================================ */

/**
 * Preenche o <select> de categorias do filtro (uma vez).
 */
function ensureWeaponPropertyCategoryOptions() {
  const sel = byId('weapon-props-category');
  if (!sel || sel.dataset.ready === '1') return;
  WEAPON_PROPERTY_CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
  sel.dataset.ready = '1';
}

/**
 * Define o texto de busca do filtro de propriedades e re-renderiza.
 * @param {string} query
 */
export function setWeaponPropertyFilterQuery(query) {
  propsFilterQuery = String(query || '');
  renderWeaponPropertySelector();
}

/**
 * Define a categoria do filtro de propriedades e re-renderiza.
 * @param {string} category
 */
export function setWeaponPropertyFilterCategory(category) {
  propsFilterCategory = String(category || '');
  renderWeaponPropertySelector();
}

/**
 * Limpa o filtro (busca + categoria) de propriedades.
 */
export function clearWeaponPropertyFilter() {
  propsFilterQuery = '';
  propsFilterCategory = '';
  const search = byId('weapon-props-search');
  const cat    = byId('weapon-props-category');
  if (search) search.value = '';
  if (cat)    cat.value = '';
  renderWeaponPropertySelector();
}

/**
 * Marca/desmarca uma propriedade no formulário, preservando a ordem.
 * @param {string} propertyId
 */
export function toggleWeaponProperty(propertyId) {
  if (!getWeaponPropertyById(propertyId)) return;
  const idx = formSelectedProperties.indexOf(propertyId);
  if (idx === -1) formSelectedProperties.push(propertyId);
  else            formSelectedProperties.splice(idx, 1);
  renderWeaponPropertySelector();
}

/**
 * Renderiza a lista de chips de propriedades (filtrada) e a área de
 * propriedades selecionadas, refletindo o estado atual do formulário.
 */
export function renderWeaponPropertySelector() {
  ensureWeaponPropertyCategoryOptions();

  const list = byId('weapon-props-list');
  if (list) {
    const filtered = filterWeaponProperties(propsFilterQuery, propsFilterCategory);
    if (filtered.length === 0) {
      list.innerHTML = '<p class="weapon-props-empty">Nenhuma propriedade encontrada.</p>';
    } else {
      list.innerHTML = filtered.map(prop => {
        const selected = formSelectedProperties.includes(prop.id);
        const catClass = getCategoryClass(prop.categoria);
        return `
          <button type="button"
                  class="weapon-property-chip ${catClass}${selected ? ' is-selected' : ''}"
                  data-action="toggle-weapon-prop"
                  data-prop-id="${escapeHtml(prop.id)}"
                  title="${escapeHtml(prop.efeito)}"
                  aria-pressed="${selected ? 'true' : 'false'}">
            <span class="chip-check">${selected ? '✓' : '+'}</span>
            <span class="chip-name">${escapeHtml(prop.nome)}</span>
          </button>`;
      }).join('');
    }
  }

  const selectedWrap = byId('weapon-props-selected');
  if (selectedWrap) {
    if (formSelectedProperties.length === 0) {
      selectedWrap.innerHTML = '<span class="weapon-props-none">Nenhuma propriedade selecionada.</span>';
    } else {
      selectedWrap.innerHTML = formSelectedProperties.map(id => {
        const prop = getWeaponPropertyById(id);
        if (!prop) return '';
        const catClass = getCategoryClass(prop.categoria);
        return `
          <span class="weapon-property-chip is-selected is-removable ${catClass}"
                title="${escapeHtml(prop.efeito)}">
            <span class="chip-name">${escapeHtml(prop.nome)}</span>
            <button type="button" class="chip-remove" data-action="remove-weapon-prop"
                    data-prop-id="${escapeHtml(prop.id)}" aria-label="Remover ${escapeHtml(prop.nome)}">✕</button>
          </span>`;
      }).join('');
    }
  }
}

/**
 * Lê e valida os campos do formulário de novo item (e de arma).
 * @returns {object|null}
 */
function readItemForm() {
  const name = getVal('item-name').trim();
  const type = getVal('item-type');
  const qty  = clampInt(getNum('item-qty', 1), 1, 9999, 1);
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
  const properties     = sanitizeWeaponProperties(formSelectedProperties);
  const rarity = getVal('item-rarity');
  const price  = clampInt(getNum('item-price', 0), 0, 9999999, 0);

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
 * Adiciona um novo item ao inventário (ou salva a edição em andamento)
 * e re-renderiza.
 */
export function addInventoryItem() {
  const data = readItemForm();
  if (!data) return;

  if (editingItemId) {
    const idx = sheetState.inventory.findIndex(i => i.id === editingItemId);
    if (idx !== -1) {
      sheetState.inventory[idx] = { id: editingItemId, ...data };
      resetItemForm();
      renderInventory();
      showStatus('Item atualizado.', 'saved', 2000);
      return;
    }
    // Item sumiu enquanto editava: cai para adição normal.
    editingItemId = null;
  }

  sheetState.inventory.push({ id: generateId(), ...data });
  resetItemForm({ keepWeaponToggle: true });
  renderInventory();
  showStatus('Item adicionado.', 'saved', 2000);
}

/**
 * Limpa o formulário de item e sai do modo de edição.
 * @param {{keepWeaponToggle?:boolean}} [opts]
 */
export function resetItemForm(opts = {}) {
  editingItemId = null;
  formSelectedProperties = [];

  const name = byId('item-name');
  const desc = byId('item-desc');
  const qty  = byId('item-qty');
  if (name) name.value = '';
  if (desc) desc.value = '';
  if (qty)  qty.value  = '1';

  const price = byId('item-price');
  const area  = byId('item-area');
  if (price) price.value = '';
  if (area)  area.value  = '';

  if (!opts.keepWeaponToggle) {
    const isWeapon = byId('item-is-weapon');
    if (isWeapon) isWeapon.checked = false;
  }

  // Botões / rótulo do modo de edição.
  const addBtn    = byId('btn-add-item');
  const cancelBtn = byId('btn-cancel-edit-item');
  if (addBtn)    addBtn.textContent = '+ Adicionar Item';
  if (cancelBtn) cancelBtn.hidden = true;

  updateWeaponFormConstraints();
}

/**
 * Cancela a edição em andamento e limpa o formulário.
 */
export function cancelItemEdit() {
  resetItemForm();
  showStatus('Edição cancelada.', 'info', 1500);
}

/**
 * Carrega um item do inventário no formulário para edição.
 * @param {string} id
 */
export function editInventoryItem(id) {
  const item = sheetState.inventory.find(i => i.id === id);
  if (!item) {
    showStatus('Item não encontrado.', 'error');
    return;
  }

  editingItemId = id;

  const setIf = (elId, value) => { const el = byId(elId); if (el) el.value = value; };
  setIf('item-name', item.name || '');
  setIf('item-type', item.type || 'outro');
  setIf('item-qty', item.qty != null ? item.qty : 1);
  setIf('item-desc', item.desc || '');

  const isWeaponBox = byId('item-is-weapon');
  if (isWeaponBox) isWeaponBox.checked = !!item.isWeapon;

  if (item.isWeapon) {
    setIf('item-weapon-type', item.weaponType || 'melee');
    setIf('item-damage-category', item.damageCategory || 'normal');
    setIf('item-scaling-attr', item.scalingAttribute || 'corpo');
    setIf('item-rarity', item.rarity || 'Comum');
    setIf('item-price', item.price || '');
    formSelectedProperties = normalizePropertyList(item.properties);

    if (item.isFixedDamage) {
      setIf('item-fixed-dice', item.fixedDiceCount || 1);
      setIf('item-fixed-die', item.fixedDamageDie || 6);
      setIf('item-fixed-bonus', item.fixedDamageBonus || 0);
      setIf('item-area', item.area || '');
    }
  } else {
    formSelectedProperties = [];
  }

  const addBtn    = byId('btn-add-item');
  const cancelBtn = byId('btn-cancel-edit-item');
  if (addBtn)    addBtn.textContent = '✓ Salvar Alterações';
  if (cancelBtn) cancelBtn.hidden = false;

  updateWeaponFormConstraints();

  const form = byId('item-name');
  if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Normaliza um item do inventário ao carregar/importar:
 * garante `properties` como array de ids válidos (compatível com
 * fichas antigas e com importação no campo `propriedades`).
 * @param {object} item
 * @returns {object}
 */
export function normalizeInventoryItem(item) {
  if (!item || typeof item !== 'object') return item;
  const raw = Array.isArray(item.properties)
    ? item.properties
    : (Array.isArray(item.propriedades) ? item.propriedades : []);
  const result = { ...item, properties: normalizePropertyList(raw) };
  delete result.propriedades;
  return result;
}

/**
 * Remove um item do inventário pelo ID.
 * @param {string} id
 */
export function removeInventoryItem(id) {
  sheetState.inventory = sheetState.inventory.filter(i => i.id !== id);
  if (editingItemId === id) resetItemForm();
  renderInventory();
}

/* ============================================================
   RENDERIZAÇÃO
   ============================================================ */

/**
 * Monta os badges (chips) das propriedades de uma arma para o card.
 * @param {Array<string>} propertyIds
 * @returns {string} HTML
 */
export function renderWeaponPropertyBadges(propertyIds) {
  const ids = sanitizeWeaponProperties(propertyIds);
  if (!ids.length) return '';
  const chips = ids.map(id => {
    const prop = getWeaponPropertyById(id);
    if (!prop) return '';
    const catClass = getCategoryClass(prop.categoria);
    return `
      <button type="button"
              class="weapon-property-badge ${catClass}"
              data-action="show-weapon-prop"
              data-prop-id="${escapeHtml(prop.id)}"
              title="${escapeHtml(prop.nome)} — ${escapeHtml(prop.efeito)}">
        ${escapeHtml(prop.nome)}
      </button>`;
  }).join('');
  return `
    <div class="weapon-properties">
      <span class="weapon-props-caption">Propriedades:</span>
      <div class="weapon-property-badges">${chips}</div>
    </div>
    <div class="weapon-property-detail" data-role="prop-detail" hidden></div>`;
}

/**
 * Monta a lista de "Efeitos rápidos" (resumos) das propriedades da arma.
 * @param {Array<string>} propertyIds
 * @returns {string} HTML
 */
export function renderWeaponPropertyQuickEffects(propertyIds) {
  const ids = sanitizeWeaponProperties(propertyIds);
  const lines = ids
    .map(id => getWeaponPropertyById(id))
    .filter(p => p && p.resumo)
    .map(p => `<li><b>${escapeHtml(p.nome)}:</b> ${escapeHtml(p.resumo)}</li>`);
  if (!lines.length) return '';
  return `
    <div class="weapon-quick-effects">
      <span class="weapon-quick-effects-title">Efeitos rápidos:</span>
      <ul>${lines.join('')}</ul>
    </div>`;
}

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
    <button type="button" class="btn btn--dim btn--sm" data-action="edit-item" data-id="${escapeHtml(item.id)}" aria-label="Editar ${escapeHtml(item.name)}" title="Editar item">✎</button>
    <button type="button" class="btn btn--danger btn--sm" data-action="remove-item" data-id="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.name)}" title="Remover item">✕</button>
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
  const propsHtml   = renderWeaponPropertyBadges(item.properties);
  const quickHtml   = renderWeaponPropertyQuickEffects(item.properties);
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
      ${propsHtml}
      ${quickHtml}
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
    <button type="button" class="btn btn--dim btn--sm" data-action="edit-item" data-id="${escapeHtml(item.id)}" aria-label="Editar ${escapeHtml(item.name)}" title="Editar item">✎</button>
    <button type="button" class="btn btn--danger btn--sm" data-action="remove-item" data-id="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.name)}" title="Remover item">✕</button>
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
    renderSessionWeapon();
    return;
  }

  sheetState.inventory.forEach(item => {
    const card = item.isWeapon ? buildWeaponCard(item) : buildItemCard(item);
    container.appendChild(card);
  });

  renderSessionWeapon();
}

/* ============================================================
   ARMA RÁPIDA (PAINEL DE SESSÃO)
   ============================================================ */

/**
 * Define a arma rápida escolhida no Painel de Sessão e re-renderiza.
 * @param {string} id
 */
export function setSessionWeapon(id) {
  sheetState.sessionWeaponId = id || '';
  renderSessionWeapon();
}

/**
 * Preenche o seletor de arma rápida com as armas do inventário e
 * atualiza a fórmula de dano exibida no Painel de Sessão.
 * A fórmula é SEMPRE recalculada a partir dos atributos atuais.
 */
export function renderSessionWeapon() {
  const select  = byId('session-weapon-select');
  const formula = byId('session-weapon-formula');
  const btn     = byId('btn-session-roll-damage');
  if (!select) return;

  const weapons = sheetState.inventory.filter(i => i.isWeapon);

  // Se a arma escolhida não existe mais, limpa a seleção.
  if (sheetState.sessionWeaponId && !weapons.some(w => w.id === sheetState.sessionWeaponId)) {
    sheetState.sessionWeaponId = '';
  }

  // (Re)monta as opções do seletor.
  select.innerHTML = '<option value="">— Nenhuma arma —</option>';
  weapons.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.name;
    if (w.id === sheetState.sessionWeaponId) opt.selected = true;
    select.appendChild(opt);
  });

  const weapon = weapons.find(w => w.id === sheetState.sessionWeaponId);

  if (!weapon) {
    if (formula) {
      formula.textContent = weapons.length
        ? 'Selecione uma arma para acesso rápido.'
        : 'Nenhuma arma no inventário.';
    }
    if (btn) btn.disabled = true;
    return;
  }

  const dmg       = weapon.isFixedDamage ? calculateFixedDamage(weapon) : calculateWeaponDamageFormula(weapon);
  const typeLabel = WEAPON_TYPE_LABEL[weapon.weaponType] || 'Arma';
  if (formula) formula.textContent = `${typeLabel} · Dano: ${dmg.formula}`;
  if (btn) btn.disabled = false;
}

/**
 * Rola o dano da arma rápida atualmente selecionada no Painel de Sessão.
 */
export function rollSessionWeaponDamage() {
  if (!sheetState.sessionWeaponId) {
    showStatus('Escolha uma arma no Painel de Sessão.', 'warning', 2500);
    return;
  }
  rollWeaponDamage(sheetState.sessionWeaponId);
}
