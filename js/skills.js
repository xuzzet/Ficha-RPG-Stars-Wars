/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   skills.js — Perícias personalizadas

   Responsabilidade:
   - Ler o formulário de nova perícia.
   - Adicionar e remover perícias do estado.
   - Renderizar a lista de perícias (agrupada por atributo).
   A rolagem de perícia vive em dice.js (rollSkill); aqui só
   geramos os botões com data-action, ligados em main.js.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, getVal, getNum, escapeHtml } from './dom.js';
import { getAttrName, updatePointsSummary, ATTR_KEYS } from './attributes.js';
import { showStatus } from './ui.js';
import { populateAttackSkillSelect } from './inventory.js';
import { createEntity, ENTITY_TYPES } from './state.js';
import { commit } from './store.js';
import { icon } from './icons.js';

/** Filtro atual da lista de perícias por atributo ('all' = todas). */
let currentSkillFilter = 'all';

/** ID da perícia atualmente em modo de edição (null = nenhuma). */
let editingSkillId = null;

/** Graus disponíveis para uma perícia (do melhor ao pior). */
const SKILL_GRADES = ['S', 'A', 'B', 'C', 'D', 'E'];

/**
 * Define o filtro de atributo das perícias e re-renderiza a lista.
 * @param {string} filter - 'all'|'vida'|'corpo'|'mente'|'presenca'|'espirito'
 */
export function setSkillFilter(filter) {
  currentSkillFilter = filter || 'all';
  renderSkills();
}

/**
 * Lê e valida os campos do formulário de nova perícia.
 * @returns {{name,attr,grade,cost,desc}|null} null se inválido
 */
function readSkillForm() {
  const name  = getVal('skill-name').trim();
  const attr  = getVal('skill-attr');
  const grade = getVal('skill-grade');
  const cost  = getNum('skill-cost');
  const desc  = getVal('skill-desc').trim();
  const isAttack = !!(byId('skill-is-attack') && byId('skill-is-attack').checked);

  if (!name) {
    showStatus('Preencha o nome da perícia.', 'error');
    return null;
  }
  return { name, attr, grade, cost, desc, isAttack };
}

/**
 * Adiciona uma nova perícia ao estado e re-renderiza a lista.
 */
export function addSkill() {
  const data = readSkillForm();
  if (!data) return;

  sheetState.skills.push(createEntity(ENTITY_TYPES.SKILL, data));

  byId('skill-name').value  = '';
  byId('skill-desc').value  = '';
  byId('skill-cost').value  = '1';
  byId('skill-grade').value = 'C';
  if (byId('skill-is-attack')) byId('skill-is-attack').checked = false;

  renderSkills();
  updatePointsSummary();
  commit({ reason: 'skill:add' });
  showStatus('Perícia adicionada.', 'saved', 2000);
}

/**
 * Remove uma perícia pelo ID e atualiza o resumo de pontos.
 * @param {string} id
 */
export function removeSkill(id) {
  sheetState.skills = sheetState.skills.filter(s => s.id !== id);
  if (editingSkillId === id) editingSkillId = null;
  renderSkills();
  updatePointsSummary();
  commit({ reason: 'skill:remove' });
}

/**
 * Coloca uma perícia em modo de edição e re-renderiza a lista.
 * @param {string} id
 */
export function editSkill(id) {
  editingSkillId = id;
  renderSkills();
}

/**
 * Cancela a edição em andamento e re-renderiza a lista.
 */
export function cancelEditSkill() {
  editingSkillId = null;
  renderSkills();
}

/**
 * Salva as alterações feitas no formulário inline de edição de uma perícia.
 * @param {string} id
 * @param {HTMLElement} card - Elemento da perícia contendo os campos de edição.
 */
export function saveSkill(id, card) {
  const skill = sheetState.skills.find(s => s.id === id);
  if (!skill || !card) return;

  const nameInput  = card.querySelector('[data-role="edit-name"]');
  const attrInput  = card.querySelector('[data-role="edit-attr"]');
  const gradeInput = card.querySelector('[data-role="edit-grade"]');
  const costInput  = card.querySelector('[data-role="edit-cost"]');
  const descInput  = card.querySelector('[data-role="edit-desc"]');

  const name = nameInput ? nameInput.value.trim() : skill.name;
  if (!name) {
    showStatus('Preencha o nome da perícia.', 'error');
    return;
  }

  skill.name  = name;
  if (attrInput)  skill.attr  = attrInput.value;
  if (gradeInput) skill.grade = gradeInput.value;
  if (costInput)  skill.cost  = Number(costInput.value) || 0;
  if (descInput)  skill.desc  = descInput.value.trim();

  editingSkillId = null;
  renderSkills();
  updatePointsSummary();
  commit({ reason: 'skill:edit' });
  showStatus('Perícia atualizada.', 'saved', 2000);
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
 * Gera as <option> de grau com o valor atual selecionado.
 * @param {string} selected
 * @returns {string}
 */
function gradeOptions(selected) {
  return SKILL_GRADES.map(grade =>
    `<option value="${grade}"${grade === selected ? ' selected' : ''}>${grade}</option>`
  ).join('');
}

/**
 * Renderiza a lista de perícias no DOM, agrupada por atributo.
 */
export function renderSkills() {
  const container = byId('skills-list');
  container.innerHTML = '';

  // Mantém o seletor de "Perícia de Ataque" do formulário de arma em sincronia.
  populateAttackSkillSelect();

  if (sheetState.skills.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhuma perícia criada ainda. Use o formulário acima.</p>';
    return;
  }

  const visibleSkills = currentSkillFilter === 'all'
    ? sheetState.skills
    : sheetState.skills.filter(s => s.attr === currentSkillFilter);

  if (visibleSkills.length === 0) {
    container.innerHTML = `<p class="empty-message">Nenhuma perícia de ${getAttrName(currentSkillFilter)}. Ajuste o filtro acima.</p>`;
    return;
  }

  const grouped = {};
  visibleSkills.forEach(skill => {
    if (!grouped[skill.attr]) grouped[skill.attr] = [];
    grouped[skill.attr].push(skill);
  });

  ATTR_KEYS.forEach(attr => {
    if (!grouped[attr]) return;

    const header = document.createElement('div');
    header.className   = 'skill-group-header';
    header.textContent = `— ${getAttrName(attr)} —`;
    container.appendChild(header);

    grouped[attr].forEach(skill => {
      const card = document.createElement('div');
      card.className  = 'skill-card';
      card.dataset.id = skill.id;

      if (editingSkillId === skill.id) {
        card.classList.add('skill-card--editing');
        card.innerHTML = `
          <div class="skill-edit-form">
            <div class="form-row">
              <div class="form-group form-group--wide">
                <label class="field-label">Nome</label>
                <input type="text" class="field-input" data-role="edit-name" value="${escapeHtml(skill.name)}">
              </div>
              <div class="form-group">
                <label class="field-label">Atributo</label>
                <select class="field-input field-select" data-role="edit-attr">${attrOptions(skill.attr)}</select>
              </div>
              <div class="form-group">
                <label class="field-label">Grau</label>
                <select class="field-input field-select" data-role="edit-grade">${gradeOptions(skill.grade)}</select>
              </div>
              <div class="form-group form-group--tiny">
                <label class="field-label">Custo</label>
                <input type="number" class="field-input" data-role="edit-cost" value="${escapeHtml(String(skill.cost))}" min="0">
              </div>
            </div>
            <div class="form-group">
              <label class="field-label">Descrição</label>
              <textarea class="field-input field-textarea" rows="2" data-role="edit-desc">${escapeHtml(skill.desc || '')}</textarea>
            </div>
            <div class="skill-actions">
              <button type="button" class="btn btn--primary btn--sm icon-button" data-action="save-skill" data-id="${escapeHtml(skill.id)}">${icon('salvar')} Salvar</button>
              <button type="button" class="btn btn--secondary btn--sm" data-action="cancel-edit-skill" data-id="${escapeHtml(skill.id)}">Cancelar</button>
            </div>
          </div>
        `;
        container.appendChild(card);
        return;
      }

      card.innerHTML = `
        <div class="skill-header">
          <span class="skill-name">${escapeHtml(skill.name)}</span>
          <span class="skill-grade-badge grade-${escapeHtml(skill.grade)}">${escapeHtml(skill.grade)}</span>
          <span class="skill-attr-badge">${escapeHtml(getAttrName(skill.attr))}</span>
          ${skill.isAttack ? `<span class="skill-attack-badge icon-label">${icon('arma')} Ataque</span>` : ''}
          <span class="skill-cost-badge">${escapeHtml(String(skill.cost))} pts</span>
        </div>
        ${skill.desc ? `<p class="skill-desc">${escapeHtml(skill.desc)}</p>` : ''}
        <div class="skill-actions">
          <label class="skill-mod-label" title="Bônus de acerto vindo de habilidades, equipamentos, etc.">Bônus acerto (%)
            <input type="number" class="skill-mini-input" data-role="hit-bonus" value="0" step="5">
          </label>
          <button type="button" class="btn btn--secondary btn--sm icon-button" data-action="roll-skill" data-id="${escapeHtml(skill.id)}">${icon('rolar')} Rolar</button>
          <button type="button" class="btn btn--secondary btn--sm icon-button" data-action="edit-skill" data-id="${escapeHtml(skill.id)}">${icon('editar')} Editar</button>
          <button type="button" class="btn btn--danger btn--sm icon-button" data-action="remove-skill" data-id="${escapeHtml(skill.id)}">${icon('remover')} Remover</button>
        </div>
      `;
      container.appendChild(card);
    });
  });
}
