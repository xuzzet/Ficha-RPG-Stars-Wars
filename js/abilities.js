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
import { byId, getVal, getNum, generateId, escapeHtml } from './dom.js';
import { getAttrName, updatePointsSummary } from './attributes.js';
import { showStatus } from './ui.js';

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

  sheetState.abilities.push({ id: generateId(), ...data, used: false });

  byId('ability-name').value = '';
  byId('ability-desc').value = '';
  byId('ability-cost').value = '1';

  renderAbilities();
  updatePointsSummary();
  showStatus('Habilidade adicionada.', 'saved', 2000);
}

/**
 * Remove uma habilidade pelo ID.
 * @param {string} id
 */
export function removeUniqueAbility(id) {
  sheetState.abilities = sheetState.abilities.filter(a => a.id !== id);
  renderAbilities();
  updatePointsSummary();
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
    pv: '⚠ Custa PV',
    esforco: '⚠ Custa Esforço',
    conexao: '⚠ Custa Conexão',
    condicao: '⚠ Gera Condição',
    narrativo: '⚠ Recurso Narrativo',
    outro: '⚠ Outro Custo',
  };

  sheetState.abilities.forEach(ability => {
    const card = document.createElement('div');
    card.className  = `ability-card${ability.used ? ' ability--used' : ''}`;
    card.dataset.id = ability.id;

    const extraLabel = extraCostLabels[ability.extraCost];

    card.innerHTML = `
      <div class="ability-header">
        <span class="ability-name">${escapeHtml(ability.name)}</span>
        <span class="ability-freq-badge">${escapeHtml(getFreqName(ability.freq))}</span>
        <span class="skill-attr-badge">${escapeHtml(getAttrName(ability.attr))}</span>
        <span class="skill-cost-badge">${escapeHtml(String(ability.cost))} pts</span>
        ${extraLabel ? `<span class="ability-extra-badge">${escapeHtml(extraLabel)}</span>` : ''}
      </div>
      ${ability.desc ? `<p class="ability-desc">${escapeHtml(ability.desc)}</p>` : ''}
      <div class="ability-actions">
        <button class="btn btn--${ability.used ? 'dim' : 'warning'} btn--sm"
                data-action="toggle-ability" data-id="${escapeHtml(ability.id)}">
          ${ability.used ? '↺ Resetar' : '✓ Marcar como Usada'}
        </button>
        <button class="btn btn--danger btn--sm" data-action="remove-ability" data-id="${escapeHtml(ability.id)}">✕ Remover</button>
        ${ability.used ? '<span class="ability-used-label">— usada nesta cena/sessão</span>' : ''}
      </div>
    `;
    container.appendChild(card);
  });
}
