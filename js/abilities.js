/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   abilities.js — Habilidades únicas

   Responsabilidade:
   - Ler o formulário de nova habilidade.
   - Adicionar, remover e marcar como usada/resetar.
   - Renderizar a lista de habilidades únicas.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, getVal, getNum, escapeHtml } from './dom.js';
import { getAttrName, updatePointsSummary, ATTR_KEYS } from './attributes.js';
import { showStatus } from './ui.js';
import { createEntity, ENTITY_TYPES } from './state.js';
import { commit } from './store.js';
import { icon } from './icons.js';

/** ID da habilidade atualmente em modo de edição (null = nenhuma). */
let editingAbilityId = null;

/** Opções de frequência (valor -> rótulo). */
const FREQ_OPTIONS = [
  ['livre', 'Livre'],
  ['cena', 'Uma vez por cena'],
  ['sessao', 'Uma vez por sessão'],
  ['descanso', 'Por descanso'],
  ['passiva', 'Passiva'],
  ['personalizada', 'Personalizada'],
];

/** Opções de custo adicional (valor -> rótulo). */
const EXTRA_COST_OPTIONS = [
  ['nenhum', 'Nenhum'],
  ['pv', 'Paga PV'],
  ['esforco', 'Esforço'],
  ['conexao', 'Conexão'],
  ['condicao', 'Gera Condição'],
  ['narrativo', 'Recurso Narrativo'],
  ['outro', 'Outro'],
];

/**
 * Retorna o nome legível da frequência de uma habilidade.
 * @param {string} freq
 * @returns {string}
 */
export function getFreqName(freq) {
  const map = {
    livre: 'Livre', cena: 'Por Cena', sessao: 'Por Sessão',
    descanso: 'Por Descanso', passiva: 'Passiva', personalizada: 'Personalizada',
  };
  return map[freq] || freq;
}

/**
 * Lê e valida os campos do formulário de nova habilidade.
 * @returns {{name,attr,cost,freq,extraCost,desc}|null}
 */
function readAbilityForm() {
  const name      = getVal('ability-name').trim();
  const attr      = getVal('ability-attr');
  const cost      = getNum('ability-cost');
  const freq      = getVal('ability-freq');
  const extraCost = getVal('ability-extra-cost');
  const desc      = getVal('ability-desc').trim();

  if (!name) {
    showStatus('Preencha o nome da habilidade.', 'error');
    return null;
  }
  return { name, attr, cost, freq, extraCost, desc };
}

/**
 * Adiciona uma nova habilidade única ao estado.
 * O campo "used" começa como false (ainda não usada na sessão).
 */
export function addUniqueAbility() {
  const data = readAbilityForm();
  if (!data) return;

  sheetState.abilities.push(createEntity(ENTITY_TYPES.ABILITY, { ...data, used: false }));

  byId('ability-name').value = '';
  byId('ability-desc').value = '';
  byId('ability-cost').value = '1';

  renderAbilities();
  updatePointsSummary();
  commit({ reason: 'ability:add' });
  showStatus('Habilidade adicionada.', 'saved', 2000);
}

/**
 * Remove uma habilidade pelo ID.
 * @param {string} id
 */
export function removeUniqueAbility(id) {
  sheetState.abilities = sheetState.abilities.filter(a => a.id !== id);
  if (editingAbilityId === id) editingAbilityId = null;
  renderAbilities();
  updatePointsSummary();
  commit({ reason: 'ability:remove' });
}

/**
 * Coloca uma habilidade em modo de edição e re-renderiza a lista.
 * @param {string} id
 */
export function editUniqueAbility(id) {
  editingAbilityId = id;
  renderAbilities();
}

/**
 * Cancela a edição em andamento e re-renderiza a lista.
 */
export function cancelEditAbility() {
  editingAbilityId = null;
  renderAbilities();
}

/**
 * Salva as alterações feitas no formulário inline de edição de uma habilidade.
 * @param {string} id
 * @param {HTMLElement} card - Elemento da habilidade contendo os campos de edição.
 */
export function saveUniqueAbility(id, card) {
  const ability = sheetState.abilities.find(a => a.id === id);
  if (!ability || !card) return;

  const nameInput  = card.querySelector('[data-role="edit-name"]');
  const attrInput  = card.querySelector('[data-role="edit-attr"]');
  const costInput  = card.querySelector('[data-role="edit-cost"]');
  const freqInput  = card.querySelector('[data-role="edit-freq"]');
  const extraInput = card.querySelector('[data-role="edit-extra"]');
  const descInput  = card.querySelector('[data-role="edit-desc"]');

  const name = nameInput ? nameInput.value.trim() : ability.name;
  if (!name) {
    showStatus('Preencha o nome da habilidade.', 'error');
    return;
  }

  ability.name = name;
  if (attrInput)  ability.attr      = attrInput.value;
  if (costInput)  ability.cost      = Number(costInput.value) || 0;
  if (freqInput)  ability.freq      = freqInput.value;
  if (extraInput) ability.extraCost = extraInput.value;
  if (descInput)  ability.desc      = descInput.value.trim();

  editingAbilityId = null;
  renderAbilities();
  updatePointsSummary();
  commit({ reason: 'ability:edit' });
  showStatus('Habilidade atualizada.', 'saved', 2000);
}

/**
 * Gera as <option> de atributo com o valor atual selecionado.
 * @param {string} selected
 * @returns {string}
 */
function attrOptions(selected) {
  return ATTR_KEYS.map(attr =>
    `<option value="${attr}"${attr === selected ? ' selected' : ''}>${escapeHtml(getAttrName(attr))}</option>`
  ).join('');
}

/**
 * Gera as <option> a partir de uma lista [valor, rótulo].
 * @param {Array<[string,string]>} options
 * @param {string} selected
 * @returns {string}
 */
function buildOptions(options, selected) {
  return options.map(([value, label]) =>
    `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`
  ).join('');
}

/**
 * Alterna o estado "usada" de uma habilidade.
 * @param {string} id
 */
export function toggleAbilityUsed(id) {
  const ability = sheetState.abilities.find(a => a.id === id);
  if (ability) {
    ability.used = !ability.used;
    renderAbilities();
    commit({ reason: 'ability:toggle-used' });
  }
}

/**
 * Renderiza a lista de habilidades únicas no DOM.
 */
export function renderAbilities() {
  const container = byId('abilities-list');
  container.innerHTML = '';

  if (sheetState.abilities.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhuma habilidade criada ainda. Use o formulário acima.</p>';
    return;
  }

  const extraCostLabels = {
    nenhum: null,
    pv: 'Custa PV',
    esforco: 'Custa Esforço',
    conexao: 'Custa Conexão',
    condicao: 'Gera Condição',
    narrativo: 'Recurso Narrativo',
    outro: 'Outro Custo',
  };

  sheetState.abilities.forEach(ability => {
    const card = document.createElement('div');
    card.className  = `ability-card${ability.used ? ' ability--used' : ''}`;
    card.dataset.id = ability.id;

    if (editingAbilityId === ability.id) {
      card.classList.add('ability-card--editing');
      card.innerHTML = `
        <div class="ability-edit-form">
          <div class="form-row">
            <div class="form-group form-group--wide">
              <label class="field-label">Nome</label>
              <input type="text" class="field-input" data-role="edit-name" value="${escapeHtml(ability.name)}">
            </div>
            <div class="form-group">
              <label class="field-label">Atributo</label>
              <select class="field-input field-select" data-role="edit-attr">${attrOptions(ability.attr)}</select>
            </div>
            <div class="form-group form-group--tiny">
              <label class="field-label">Custo</label>
              <input type="number" class="field-input" data-role="edit-cost" value="${escapeHtml(String(ability.cost))}" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="field-label">Frequência</label>
              <select class="field-input field-select" data-role="edit-freq">${buildOptions(FREQ_OPTIONS, ability.freq)}</select>
            </div>
            <div class="form-group">
              <label class="field-label">Custo Adicional</label>
              <select class="field-input field-select" data-role="edit-extra">${buildOptions(EXTRA_COST_OPTIONS, ability.extraCost)}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="field-label">Descrição / Efeito</label>
            <textarea class="field-input field-textarea" rows="3" data-role="edit-desc">${escapeHtml(ability.desc || '')}</textarea>
          </div>
          <div class="ability-actions">
            <button type="button" class="btn btn--primary btn--sm icon-button" data-action="save-ability" data-id="${escapeHtml(ability.id)}">${icon('salvar')} Salvar</button>
            <button type="button" class="btn btn--secondary btn--sm" data-action="cancel-edit-ability" data-id="${escapeHtml(ability.id)}">Cancelar</button>
          </div>
        </div>
      `;
      container.appendChild(card);
      return;
    }

    const extraLabel = extraCostLabels[ability.extraCost];

    card.innerHTML = `
      <div class="ability-header">
        <span class="ability-name">${escapeHtml(ability.name)}</span>
        <span class="ability-freq-badge">${escapeHtml(getFreqName(ability.freq))}</span>
        <span class="skill-attr-badge">${escapeHtml(getAttrName(ability.attr))}</span>
        <span class="skill-cost-badge">${escapeHtml(String(ability.cost))} pts</span>
        ${extraLabel ? `<span class="ability-extra-badge icon-label">${icon('aviso')} ${escapeHtml(extraLabel)}</span>` : ''}
      </div>
      ${ability.desc ? `<p class="ability-desc">${escapeHtml(ability.desc)}</p>` : ''}
      <div class="ability-actions">
        <button type="button" class="btn btn--${ability.used ? 'dim' : 'warning'} btn--sm icon-button"
                data-action="toggle-ability" data-id="${escapeHtml(ability.id)}">
          ${ability.used ? `${icon('resetar')} Resetar` : `${icon('sucesso')} Marcar como Usada`}
        </button>
        <button type="button" class="btn btn--secondary btn--sm icon-button" data-action="edit-ability" data-id="${escapeHtml(ability.id)}">${icon('editar')} Editar</button>
        <button type="button" class="btn btn--danger btn--sm icon-button" data-action="remove-ability" data-id="${escapeHtml(ability.id)}">${icon('remover')} Remover</button>
        ${ability.used ? '<span class="ability-used-label">— usada nesta cena/sessão</span>' : ''}
      </div>
    `;
    container.appendChild(card);
  });
}
