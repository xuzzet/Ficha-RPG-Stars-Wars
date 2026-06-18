/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   dice.js — Sistema de rolagem 1d100

   Responsabilidade:
   - Rolar 1d100 e aplicar a lógica dos graus S/A/B/C/D/E.
   - Determinar sucesso/falha (resultado <= atributo → SUCESSO).
   - Exibir o resultado com feedback visual.
   - Manter e renderizar o histórico de rolagens.

   REGRA CENTRAL: no d100, MENOR é MELHOR.
     S → sucesso automático (sem rolar)
     A → 3d100, fica com o MENOR
     B → 2d100, fica com o MENOR
     C → 2d100, fica com o MENOR
     D → 1d100
     E → 2d100, fica com o MAIOR
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, escapeHtml, generateId } from './dom.js';
import { getFinalAttributes, getAttrName } from './attributes.js';
import { showStatus } from './ui.js';

/**
 * Rola um dado de 100 faces. Retorna inteiro entre 1 e 100.
 * @returns {number}
 */
export function rollD100() {
  return Math.floor(Math.random() * 100) + 1;
}

/**
 * Retorna o MENOR valor de um array (no d100, menor é melhor).
 * @param {number[]} rolls
 * @returns {number}
 */
export function getBestRoll(rolls) {
  return Math.min(...rolls);
}

/**
 * Retorna o MAIOR valor de um array (no d100, maior é pior).
 * @param {number[]} rolls
 * @returns {number}
 */
export function getWorstRoll(rolls) {
  return Math.max(...rolls);
}

/**
 * Determina sucesso ou falha.
 *   resultado <= atributo → SUCESSO
 *   resultado  > atributo → FALHA
 * @param {number} result
 * @param {number} attrValue
 * @returns {boolean} true = sucesso
 */
export function isSuccess(result, attrValue) {
  return result <= attrValue;
}

/**
 * Adiciona uma entrada ao histórico de rolagens (máx. 50) e re-renderiza.
 * @param {object} entry
 */
export function addToHistory(entry) {
  sheetState.rollHistory.unshift({
    ...entry,
    id: generateId(),
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  });
  if (sheetState.rollHistory.length > 50) {
    sheetState.rollHistory = sheetState.rollHistory.slice(0, 50);
  }
  renderRollHistory();
}

/**
 * Adiciona uma rolagem de DANO ao histórico de rolagens.
 * @param {{weaponName?:string, name?:string, formula:string, rolls:number[], bonus:number, total:number}} result
 */
export function addDamageRollToHistory(result) {
  addToHistory({
    type:    'damage',
    name:    result.weaponName || result.name || 'Arma',
    formula: result.formula,
    rolls:   Array.isArray(result.rolls) ? result.rolls : [],
    bonus:   Number(result.bonus) || 0,
    total:   Number(result.total) || 0,
  });
}

/**
 * Atualiza o mini-display de "Última Rolagem" no Painel de Sessão.
 * @param {string} value - Valor exibido (número ou 'S')
 * @param {string} text  - Texto descritivo curto
 * @param {'success'|'failure'|'auto'} state
 */
function updateSessionLastRoll(value, text, state) {
  const box = byId('session-lastroll');
  if (!box) return;
  const valEl  = byId('session-lastroll-value');
  const textEl = byId('session-lastroll-text');
  if (valEl)  valEl.textContent  = value;
  if (textEl) textEl.textContent = text;
  box.classList.remove('is-success', 'is-failure', 'is-auto', 'is-damage');
  box.classList.add(`is-${state}`);
}

/**
 * Exibe o resultado de uma rolagem na caixa central de dados.
 * @param {number|null} result      - Resultado final (null se sucesso automático)
 * @param {string}      label       - Nome do atributo ou perícia
 * @param {string|null} grade       - Grau (S/A/B/C/D/E) ou null
 * @param {number[]}    allRolls    - Todos os dados rolados
 * @param {boolean}     autoSuccess - true para Grau S
 * @param {number}      attrValue   - Valor do atributo para comparação
 */
export function displayRollResult(result, label, grade, allRolls, autoSuccess, attrValue) {
  const box       = byId('roll-result-box');
  const numEl     = byId('roll-number');
  const outcomeEl = byId('roll-outcome');
  const detailEl  = byId('roll-detail');
  const diceEl    = byId('roll-dice-anim');

  box.classList.remove('result--success', 'result--failure', 'result--auto');

  if (autoSuccess) {
    numEl.textContent     = 'S';
    outcomeEl.textContent = 'SUCESSO AUTOMÁTICO';
    detailEl.textContent  = `${label} — Grau S | Consulte o Mestre em situações extremas.`;
    box.classList.add('result--auto');
    updateSessionLastRoll('S', `${label} — Sucesso automático`, 'auto');
    return;
  }

  // Reinicia a animação CSS do dado
  diceEl.style.animation = 'none';
  void diceEl.offsetWidth; // reflow
  diceEl.style.animation = '';

  const success = isSuccess(result, attrValue);
  numEl.textContent     = result;
  outcomeEl.textContent = success ? '✓ SUCESSO' : '✗ FALHA';

  let detail = label;
  if (grade) detail += ` [Grau ${grade}]`;
  detail += ` — vs. ${attrValue}`;
  if (allRolls.length > 1) {
    detail += ` | Dados: [${allRolls.join(', ')}] → escolhido: ${result}`;
  }
  detailEl.textContent = detail;

  box.classList.add(success ? 'result--success' : 'result--failure');
  updateSessionLastRoll(
    String(result),
    `${label}${grade ? ` [${grade}]` : ''} — vs. ${attrValue} · ${success ? 'SUCESSO' : 'FALHA'}`,
    success ? 'success' : 'failure',
  );
}

/**
 * Exibe na caixa central de dados o resultado de uma rolagem de DANO.
 * Reusa a estrutura visual das rolagens, com um estado próprio (damage).
 * @param {string}   weaponName - Nome da arma
 * @param {string}   formula    - Fórmula final (ex.: "5d12 + 5")
 * @param {number[]} rolls      - Dados rolados
 * @param {number}   bonus      - Bônus fixo somado
 * @param {number}   total      - Total final de dano
 * @param {string}   [attackSummary] - Resumo da rolagem de ataque (acerto), se houver
 */
export function displayDamageResult(weaponName, formula, rolls, bonus, total, attackSummary) {
  const box       = byId('roll-result-box');
  const numEl     = byId('roll-number');
  const outcomeEl = byId('roll-outcome');
  const detailEl  = byId('roll-detail');
  const diceEl    = byId('roll-dice-anim');

  box.classList.remove('result--success', 'result--failure', 'result--auto', 'result--damage');

  // Reinicia a animação CSS do dado
  if (diceEl) {
    diceEl.style.animation = 'none';
    void diceEl.offsetWidth; // reflow
    diceEl.style.animation = '';
  }

  numEl.textContent     = String(total);
  outcomeEl.textContent = `${total} DE DANO`;
  const diceText = rolls && rolls.length ? `Dados: [${rolls.join(', ')}]` : '';
  const base     = `${weaponName} — ${formula}${diceText ? ` | ${diceText}` : ''}${bonus ? ` | Bônus fixo: +${bonus}` : ''}`;
  detailEl.textContent  = attackSummary ? `${attackSummary} | ${base}` : base;

  box.classList.add('result--damage');
  updateSessionLastRoll(
    String(total),
    `${attackSummary ? `${attackSummary} · ` : ''}${weaponName} — ${formula} · ${total} de dano`,
    'damage',
  );
}

/**
 * Restaura a caixa central de rolagem ao estado inicial.
 */
export function resetRollDisplay() {
  const box = byId('roll-result-box');
  box.classList.remove('result--success', 'result--failure', 'result--auto', 'result--damage');
  byId('roll-number').textContent  = '—';
  byId('roll-outcome').textContent = 'Aguardando rolagem...';
  byId('roll-detail').textContent  = '';

  const lastRoll = byId('session-lastroll');
  if (lastRoll) {
    lastRoll.classList.remove('is-success', 'is-failure', 'is-auto', 'is-damage');
    const valEl  = byId('session-lastroll-value');
    const textEl = byId('session-lastroll-text');
    if (valEl)  valEl.textContent  = '—';
    if (textEl) textEl.textContent = 'Nenhuma rolagem ainda.';
  }
}

/**
 * Rola 1d100 para um atributo básico e compara com seu valor.
 * @param {string} attributeName - 'vida'|'corpo'|'mente'|'presenca'|'espirito'
 */
export function rollAttribute(attributeName) {
  const attrs     = getFinalAttributes();
  const attrValue = attrs[attributeName];
  const label     = getAttrName(attributeName);

  if (attrValue === 0) {
    showStatus(`${label} está em 0 — preencha os atributos primeiro.`, 'error');
    return;
  }

  const result  = rollD100();
  const success = isSuccess(result, attrValue);

  displayRollResult(result, label, null, [result], false, attrValue);
  addToHistory({ name: label, grade: null, rolls: [result], result, attrValue, success, isAutoSuccess: false, type: 'attribute' });
}

/**
 * Calcula o resultado de uma rolagem de perícia SEM exibir nem registrar.
 * Reutilizado pela rolagem direta de perícia e pela rolagem de ataque
 * integrada ao dano da arma.
 * @param {object} skill - Perícia ({attr, grade, ...})
 * @param {number} [hitBonus] - Bônus de acerto (%) somado ao atributo
 * @returns {{autoSuccess?:boolean, error?:string, result:number|null, rolls:number[], attrValue:number, baseAttr:number, hitBonus:number, success:boolean}}
 */
export function computeSkillRoll(skill, hitBonus = 0) {
  const attrs     = getFinalAttributes();
  const baseAttr  = attrs[skill.attr];
  const bonus     = Number(hitBonus) || 0;
  const attrValue = Math.max(0, baseAttr + bonus);

  // Grau S: sucesso automático, sem dado.
  if (skill.grade === 'S') {
    return { autoSuccess: true, result: null, rolls: [], attrValue, baseAttr, hitBonus: bonus, success: true };
  }

  if (baseAttr === 0) {
    return { error: `Atributo ${getAttrName(skill.attr)} está em 0.`, result: null, rolls: [], attrValue, baseAttr, hitBonus: bonus, success: false };
  }

  let rolls = [];
  let result;

  switch (skill.grade) {
    case 'A': // 3 dados → menor
      rolls  = [rollD100(), rollD100(), rollD100()];
      result = getBestRoll(rolls);
      break;
    case 'B': // 2 dados → menor
      rolls  = [rollD100(), rollD100()];
      result = getBestRoll(rolls);
      break;
    case 'C': // 2 dados → menor
      rolls  = [rollD100(), rollD100()];
      result = getBestRoll(rolls);
      break;
    case 'D': // 1 dado
      rolls  = [rollD100()];
      result = rolls[0];
      break;
    case 'E': // 2 dados → maior
      rolls  = [rollD100(), rollD100()];
      result = getWorstRoll(rolls);
      break;
    default:
      rolls  = [rollD100()];
      result = rolls[0];
  }

  return { autoSuccess: false, result, rolls, attrValue, baseAttr, hitBonus: bonus, success: isSuccess(result, attrValue) };
}

/**
 * Rola o dado para uma perícia, aplicando a lógica do grau.
 * @param {string} skillId - ID da perícia
 * @param {{hitBonus?:number}} [options] - Bônus de acerto (%) somado ao atributo
 */
export function rollSkill(skillId, options = {}) {
  const skill = sheetState.skills.find(s => s.id === skillId);
  if (!skill) return;

  const roll  = computeSkillRoll(skill, options.hitBonus);
  const label = `${skill.name} (${getAttrName(skill.attr)})${roll.hitBonus ? ` ${roll.hitBonus > 0 ? '+' : ''}${roll.hitBonus}% acerto` : ''}`;

  if (roll.error) {
    showStatus(roll.error, 'error');
    return;
  }

  // Grau S: sucesso automático, sem dado
  if (roll.autoSuccess) {
    displayRollResult(null, label, 'S', [], true, roll.attrValue);
    addToHistory({ name: skill.name, grade: 'S', rolls: [], result: null, attrValue: roll.attrValue, success: true, isAutoSuccess: true, type: 'skill' });
    return;
  }

  displayRollResult(roll.result, label, skill.grade, roll.rolls, false, roll.attrValue);
  addToHistory({ name: skill.name, grade: skill.grade, rolls: roll.rolls, result: roll.result, attrValue: roll.attrValue, success: roll.success, isAutoSuccess: false, type: 'skill' });
}

/**
 * Limpa o histórico de rolagens e reseta a caixa de resultado.
 */
export function clearRollHistory() {
  sheetState.rollHistory = [];
  renderRollHistory();
  resetRollDisplay();
}

/**
 * Renderiza o histórico de rolagens no DOM.
 * Entradas mais recentes aparecem no topo.
 */
export function renderRollHistory() {
  const container = byId('roll-history');
  container.innerHTML = '';

  if (sheetState.rollHistory.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhuma rolagem ainda. Role um atributo ou perícia.</p>';
    return;
  }

  sheetState.rollHistory.forEach(entry => {
    // Entradas de DANO têm layout próprio.
    if (entry.type === 'damage') {
      const div = document.createElement('div');
      div.className = 'history-entry entry--damage';
      const diceText  = entry.rolls && entry.rolls.length ? `Dados: [${entry.rolls.join(', ')}]` : '';
      const bonusText = entry.bonus ? ` · bônus +${entry.bonus}` : '';
      const metaText  = `${diceText}${bonusText} ${entry.timestamp}`;
      div.innerHTML = `
        <span class="history-roll">${escapeHtml(String(entry.total))}</span>
        <div class="history-info">
          <div class="history-name">[Dano] ${escapeHtml(entry.name)} — ${escapeHtml(entry.formula)}</div>
          <div class="history-meta">${escapeHtml(metaText)}</div>
        </div>
        <span class="history-outcome">DANO</span>
      `;
      container.appendChild(div);
      return;
    }

    const div = document.createElement('div');

    let cssClass    = 'entry--failure';
    let outcomeText = 'FALHA';
    if (entry.isAutoSuccess) { cssClass = 'entry--auto';    outcomeText = 'AUTO';    }
    else if (entry.success)  { cssClass = 'entry--success'; outcomeText = 'SUCESSO'; }

    div.className = `history-entry ${cssClass}`;

    const rollDisplay = entry.isAutoSuccess ? 'S' : escapeHtml(String(entry.result));
    const gradeText   = entry.grade ? ` [${entry.grade}]` : '';
    const diceText    = entry.rolls && entry.rolls.length > 1 ? ` [${entry.rolls.join(',')}]` : '';
    const metaText    = `vs.${entry.attrValue}${gradeText}${diceText} ${entry.timestamp}`;

    div.innerHTML = `
      <span class="history-roll">${rollDisplay}</span>
      <div class="history-info">
        <div class="history-name">${escapeHtml(entry.name)}</div>
        <div class="history-meta">${escapeHtml(metaText)}</div>
      </div>
      <span class="history-outcome">${outcomeText}</span>
    `;
    container.appendChild(div);
  });
}
