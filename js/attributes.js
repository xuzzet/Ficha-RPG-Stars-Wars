/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   attributes.js — Atributos, pontos e validação

   Responsabilidade:
   - Leitura dos 5 atributos (Vida, Corpo, Mente, Presença, Espírito).
   - Validação da distribuição obrigatória 50, 40, 30, 20 e 10.
   - Cálculo de pontos por atributo: Math.floor(atributo / 10) * 2.
   - Resumo de pontos (total / gasto / restante) e alertas.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, getNum } from './dom.js';
import { syncResourcesWithAttributes, renderResources } from './resources.js';

/** Ordem canônica dos atributos do sistema. */
export const ATTR_KEYS = ['vida', 'corpo', 'mente', 'presenca', 'espirito'];

/** Conjunto obrigatório de valores para a distribuição. */
export const REQUIRED_ATTR_VALUES = [10, 20, 30, 40, 50];

/**
 * Retorna o nome legível de um atributo.
 * @param {string} attr - 'vida'|'corpo'|'mente'|'presenca'|'espirito'
 * @returns {string}
 */
export function getAttrName(attr) {
  const map = { vida: 'Vida', corpo: 'Corpo', mente: 'Mente', presenca: 'Presença', espirito: 'Espírito' };
  return map[attr] || attr;
}

/**
 * Lê os valores BASE dos 5 atributos diretamente do DOM.
 * Estes são os valores da distribuição obrigatória (50/40/30/20/10).
 * @returns {{vida:number, corpo:number, mente:number, presenca:number, espirito:number}}
 */
export function getAttributes() {
  return {
    vida:     getNum('attr-vida'),
    corpo:    getNum('attr-corpo'),
    mente:    getNum('attr-mente'),
    presenca: getNum('attr-presenca'),
    espirito: getNum('attr-espirito'),
  };
}

/** Alias explícito para os valores BASE (sem bônus de progressão). */
export function getBaseAttributes() {
  return getAttributes();
}

/** Bônus permanente de progressão de um atributo (0 se não houver). */
export function getAttributeBonus(attr) {
  return (sheetState.attributeBonuses && sheetState.attributeBonuses[attr]) || 0;
}

/**
 * Valores FINAIS dos atributos = base (DOM) + bônus de progressão.
 * Usados em pontos por atributo, rolagens e recursos derivados.
 * @returns {{vida:number, corpo:number, mente:number, presenca:number, espirito:number}}
 */
export function getFinalAttributes() {
  const base = getAttributes();
  const out  = {};
  ATTR_KEYS.forEach(k => { out[k] = base[k] + getAttributeBonus(k); });
  return out;
}

/**
 * Valor FINAL de UM atributo (base + bônus de progressão).
 * Usado, por exemplo, pelo sistema de dano das armas.
 * @param {string} attr - 'vida'|'corpo'|'mente'|'presenca'|'espirito'
 * @returns {number}
 */
export function getFinalAttribute(attr) {
  return getFinalAttributes()[attr] || 0;
}

/**
 * Calcula os pontos de perícia/habilidade gerados por um atributo.
 *
 * FÓRMULA: pontos = Math.floor(atributo / 10) * 2
 * Ex.: Vida 30 → 6 pontos | Corpo 50 → 10 pontos | Mente 40 → 8 pontos
 *
 * @param {number} value - Valor do atributo (0–100)
 * @returns {number} Pontos disponíveis
 */
export function calculateAttributePoints(value) {
  return Math.floor(value / 10) * 2;
}

/**
 * Verifica se a distribuição dos 5 atributos é válida.
 * Os atributos devem usar EXATAMENTE 10, 20, 30, 40 e 50 (cada um uma vez).
 * @param {object} attrs
 * @returns {boolean}
 */
export function validateAttributeDistribution(attrs) {
  const actual = Object.values(attrs).map(Number).sort((a, b) => a - b);
  return JSON.stringify(actual) === JSON.stringify(REQUIRED_ATTR_VALUES);
}

/**
 * Indica se um valor de atributo individual é inválido (fora do conjunto ou duplicado).
 * @param {number} value
 * @param {number[]} allValues
 * @returns {boolean}
 */
export function isAttributeValueInvalid(value, allValues) {
  if (value === 0) return false;
  if (!REQUIRED_ATTR_VALUES.includes(value)) return true;
  return allValues.filter(v => v === value).length > 1;
}

/**
 * Soma os pontos gastos em perícias e habilidades, agrupados por atributo.
 * @returns {{vida:number, corpo:number, mente:number, presenca:number, espirito:number}}
 */
export function calculateSpentPoints() {
  const spent = { vida: 0, corpo: 0, mente: 0, presenca: 0, espirito: 0 };

  sheetState.skills.forEach(skill => {
    if (skill.attr in spent) spent[skill.attr] += Number(skill.cost) || 0;
  });
  sheetState.abilities.forEach(ability => {
    if (ability.attr in spent) spent[ability.attr] += Number(ability.cost) || 0;
  });

  return spent;
}

/**
 * Atualiza os badges de Pontos / Gasto / Restante para todos os atributos.
 * Marca visualmente quando o jogador ultrapassou o limite do atributo.
 */
export function updatePointsSummary() {
  // Pontos por atributo usam o valor FINAL (base + progressão).
  const finalAttrs = getFinalAttributes();
  const spent      = calculateSpentPoints();

  ATTR_KEYS.forEach(attr => {
    const total     = calculateAttributePoints(finalAttrs[attr]);
    const spentVal  = spent[attr];
    const remaining = total - spentVal;

    byId(`pts-${attr}`).textContent   = total;
    byId(`spent-${attr}`).textContent = spentVal;
    byId(`rem-${attr}`).textContent   = remaining;

    byId(`rem-badge-${attr}`).classList.toggle('over-budget', remaining < 0);
  });

  updateAttributeBonusDisplay();
}

/**
 * Mostra/oculta a linha "Base · Prog · Final" de cada atributo conforme
 * exista (ou não) bônus de progressão acumulado.
 */
export function updateAttributeBonusDisplay() {
  ATTR_KEYS.forEach(attr => {
    const el = byId(`attr-final-${attr}`);
    if (!el) return;
    const base  = getNum(`attr-${attr}`);
    const bonus = getAttributeBonus(attr);
    if (bonus > 0) {
      el.hidden = false;
      el.innerHTML = `Base ${base} · <b>Prog +${bonus}</b> · Final ${base + bonus}`;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  });
}

/**
 * Valida a distribuição de atributos e atualiza o indicador no DOM.
 * Chama updatePointsSummary() em seguida.
 */
export function updateAttributeValidation() {
  const attrs     = getAttributes();
  const allValues = Object.values(attrs).map(Number);
  const total     = allValues.reduce((sum, v) => sum + v, 0);
  const el        = byId('attr-validation');
  const textEl    = byId('attr-validation-text');

  if (total === 0) {
    el.className = 'attr-validation attr-validation--empty';
    textEl.textContent = 'Preencha os atributos com os valores: 50, 40, 30, 20 e 10';
  } else if (validateAttributeDistribution(attrs)) {
    el.className = 'attr-validation attr-validation--valid';
    textEl.textContent = '✓ Distribuição válida — 50, 40, 30, 20, 10';
  } else {
    const sorted = allValues.sort((a, b) => b - a).join(', ');
    el.className = 'attr-validation attr-validation--invalid';
    textEl.textContent = `✗ Inválida — Atual: [${sorted}] | Necessário: 50, 40, 30, 20, 10`;
  }

  ATTR_KEYS.forEach(attr => {
    const panel = byId(`panel-${attr}`);
    if (!panel) return;
    const invalid = total > 0 && isAttributeValueInvalid(attrs[attr], allValues);
    panel.classList.toggle('attr-panel--invalid', invalid);
  });

  // Recalcula Esforço (Corpo) e Conexão (Espírito) e ajusta os atuais.
  syncResourcesWithAttributes();
  renderResources();

  updatePointsSummary();
}

/**
 * Zera todos os atributos e revalida.
 */
export function clearAttributes() {
  ATTR_KEYS.forEach(attr => { byId(`attr-${attr}`).value = 0; });
  updateAttributeValidation();
}
