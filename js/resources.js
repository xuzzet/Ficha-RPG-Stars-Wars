/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   resources.js — Esforço e Conexão

   Responsabilidade:
   - Calcular os máximos a partir dos atributos.
       Esforço Máximo  = floor(Corpo / 10)    + 3
       Conexão Máxima  = floor(Espírito / 10)  + 2
   - Gastar (-1), recuperar (+1) e restaurar cada recurso.
   - Sincronizar máximos quando os atributos mudam (com clamp).
   - Renderizar os medidores no DOM.

   Esforço  → gasto em Manobras (feitos físicos/táticos/técnicos).
   Conexão  → gasta em Técnicas da Força.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, getNum } from './dom.js';
import { showStatus } from './ui.js';

/**
 * Calcula o Esforço Máximo a partir do atributo Corpo.
 * FÓRMULA: Math.floor(corpo / 10) + 3
 * @param {number} corpo
 * @returns {number}
 */
export function calculateEffortMax(corpo) {
  return Math.floor(corpo / 10) + 3;
}

/**
 * Calcula a Conexão Máxima a partir do atributo Espírito.
 * FÓRMULA: Math.floor(espirito / 10) + 2
 * @param {number} espirito
 * @returns {number}
 */
export function calculateConnectionMax(espirito) {
  return Math.floor(espirito / 10) + 2;
}

/**
 * Calcula o Movimento (em metros) a partir do atributo Corpo.
 * FÓRMULA: Math.floor(corpo / 10) + 6
 * @param {number} corpo
 * @returns {number}
 */
export function calculateMovement(corpo) {
  return Math.floor(corpo / 10) + 6;
}

/**
 * Mantém um valor entre 0 e um máximo.
 * @param {number} value
 * @param {number} max
 * @returns {number}
 */
function clamp(value, max) {
  return Math.max(0, Math.min(max, value));
}

/**
 * Aplica um breve pulso visual ao card de um recurso.
 * @param {string} variant - 'effort' | 'connection'
 */
function pulseMeter(variant) {
  const card = document.querySelector(`.resource-meter--${variant}`);
  if (!card) return;
  card.classList.remove('resource-meter--pulse');
  void card.offsetWidth; // reinicia a transição
  card.classList.add('resource-meter--pulse');
  setTimeout(() => card.classList.remove('resource-meter--pulse'), 220);
}

/**
 * Altera o Esforço Atual por um delta (+1 / -1), respeitando 0..máximo.
 * @param {number} delta
 */
export function updateEffort(delta) {
  sheetState.effortCurrent = clamp(sheetState.effortCurrent + delta, sheetState.effortMax);
  renderResources();
  pulseMeter('effort');
}

/**
 * Altera a Conexão Atual por um delta (+1 / -1), respeitando 0..máxima.
 * @param {number} delta
 */
export function updateConnection(delta) {
  sheetState.connectionCurrent = clamp(sheetState.connectionCurrent + delta, sheetState.connectionMax);
  renderResources();
  pulseMeter('connection');
}

/** Restaura o Esforço Atual ao Esforço Máximo. */
export function restoreEffort() {
  sheetState.effortCurrent = sheetState.effortMax;
  renderResources();
  pulseMeter('effort');
  showStatus('Esforço restaurado ao máximo.', 'info', 2000);
}

/** Restaura a Conexão Atual à Conexão Máxima. */
export function restoreConnection() {
  sheetState.connectionCurrent = sheetState.connectionMax;
  renderResources();
  pulseMeter('connection');
  showStatus('Conexão restaurada ao máximo.', 'info', 2000);
}

/**
 * Valor FINAL de um atributo = base (campo do DOM) + bônus de progressão.
 * @param {string} domId - ex.: 'attr-corpo'
 * @param {string} key   - ex.: 'corpo'
 * @returns {number}
 */
function finalAttr(domId, key) {
  const bonus = (sheetState.attributeBonuses && sheetState.attributeBonuses[key]) || 0;
  return getNum(domId) + bonus;
}

/**
 * Recalcula os máximos a partir dos atributos FINAIS (Corpo e Espírito)
 * e ajusta os valores atuais para não ultrapassarem os novos máximos.
 * Não renderiza (chame renderResources() depois).
 */
export function syncResourcesWithAttributes() {
  const effortBonus     = (sheetState.resourceBonuses && sheetState.resourceBonuses.effort)     || 0;
  const connectionBonus = (sheetState.resourceBonuses && sheetState.resourceBonuses.connection) || 0;

  sheetState.effortMax     = calculateEffortMax(finalAttr('attr-corpo', 'corpo')) + effortBonus;
  sheetState.connectionMax = calculateConnectionMax(finalAttr('attr-espirito', 'espirito')) + connectionBonus;

  sheetState.effortCurrent     = clamp(sheetState.effortCurrent, sheetState.effortMax);
  sheetState.connectionCurrent = clamp(sheetState.connectionCurrent, sheetState.connectionMax);
}

/**
 * Atualiza um medidor (Esforço ou Conexão) no DOM.
 * @param {string} prefix - 'effort' | 'connection'
 * @param {number} current
 * @param {number} max
 */
function renderMeter(prefix, current, max) {
  const currentEl = byId(`${prefix}-current-display`);
  const maxEl     = byId(`${prefix}-max-display`);
  const bar       = byId(`${prefix}-bar`);
  if (currentEl) currentEl.textContent = current;
  if (maxEl)     maxEl.textContent     = max;
  if (bar) {
    const pct = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
    bar.style.width = `${pct}%`;
  }
}

/**
 * Renderiza os medidores de Esforço e Conexão a partir do estado.
 * Também atualiza o display de Movimento (derivado de Corpo).
 */
export function renderResources() {
  renderMeter('effort', sheetState.effortCurrent, sheetState.effortMax);
  renderMeter('connection', sheetState.connectionCurrent, sheetState.connectionMax);

  const movementEl = byId('movement-display');
  if (movementEl) movementEl.textContent = calculateMovement(finalAttr('attr-corpo', 'corpo'));
}

/**
 * Coleta os dados de recursos para salvar.
 * @returns {{effortCurrent,effortMax,connectionCurrent,connectionMax}}
 */
export function getResourcesData() {
  return {
    effortCurrent:     sheetState.effortCurrent,
    effortMax:         sheetState.effortMax,
    connectionCurrent: sheetState.connectionCurrent,
    connectionMax:     sheetState.connectionMax,
  };
}

/**
 * Aplica dados de recursos vindos de uma ficha salva/importada.
 * Restaura os valores atuais salvos, recalcula os máximos com base
 * nos atributos atuais e corrige valores atuais acima do máximo.
 * @param {object} data
 */
export function applyResourcesData(data) {
  sheetState.effortCurrent     = Number(data.effortCurrent)     || 0;
  sheetState.connectionCurrent = Number(data.connectionCurrent) || 0;

  // Recalcula máximos a partir dos atributos e faz o clamp dos atuais.
  syncResourcesWithAttributes();
  renderResources();
}
