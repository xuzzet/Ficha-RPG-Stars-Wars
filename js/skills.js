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
import { byId, getVal, getNum, generateId, escapeHtml } from './dom.js';
import { getAttrName, updatePointsSummary, ATTR_KEYS } from './attributes.js';
import { showStatus } from './ui.js';
import { populateAttackSkillSelect } from './inventory.js';

/** Filtro atual da lista de perícias por atributo ('all' = todas). */
let currentSkillFilter = 'all';

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

  sheetState.skills.push({ id: generateId(), ...data });

  byId('skill-name').value  = '';
  byId('skill-desc').value  = '';
  byId('skill-cost').value  = '1';
  byId('skill-grade').value = 'C';
  if (byId('skill-is-attack')) byId('skill-is-attack').checked = false;

  renderSkills();
  updatePointsSummary();
  showStatus('Perícia adicionada.', 'saved', 2000);
}

/**
 * Remove uma perícia pelo ID e atualiza o resumo de pontos.
 * @param {string} id
 */
export function removeSkill(id) {
  sheetState.skills = sheetState.skills.filter(s => s.id !== id);
  renderSkills();
  updatePointsSummary();
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

      card.innerHTML = `
        <div class="skill-header">
          <span class="skill-name">${escapeHtml(skill.name)}</span>
          <span class="skill-grade-badge grade-${escapeHtml(skill.grade)}">${escapeHtml(skill.grade)}</span>
          <span class="skill-attr-badge">${escapeHtml(getAttrName(skill.attr))}</span>
          ${skill.isAttack ? '<span class="skill-attack-badge">⚔ Ataque</span>' : ''}
          <span class="skill-cost-badge">${escapeHtml(String(skill.cost))} pts</span>
        </div>
        ${skill.desc ? `<p class="skill-desc">${escapeHtml(skill.desc)}</p>` : ''}
        <div class="skill-actions">
          <label class="skill-mod-label" title="Bônus de acerto vindo de habilidades, equipamentos, etc.">Bônus acerto (%)
            <input type="number" class="skill-mini-input" data-role="hit-bonus" value="0" step="5">
          </label>
          <button type="button" class="btn btn--secondary btn--sm" data-action="roll-skill" data-id="${escapeHtml(skill.id)}">🎲 Rolar</button>
          <button type="button" class="btn btn--danger btn--sm" data-action="remove-skill" data-id="${escapeHtml(skill.id)}">✕ Remover</button>
        </div>
      `;
      container.appendChild(card);
    });
  });
}
