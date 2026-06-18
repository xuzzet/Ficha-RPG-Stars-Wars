/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   validators.js — Validação e saneamento de dados

   Responsabilidade:
   - Funções pequenas e reutilizáveis para validar e sanear valores
     vindos de formulários ou de fichas importadas.
   - Sem efeitos colaterais e sem acesso ao DOM: recebem valores,
     devolvem valores tratados.
   ============================================================ */

'use strict';

/**
 * Indica se um texto possui conteúdo (não é vazio após aparar espaços).
 * @param {*} value
 * @returns {boolean}
 */
export function isNonEmpty(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null && value !== '';
}

/**
 * Aparar espaços de uma string de forma segura (não-string vira '').
 * @param {*} value
 * @returns {string}
 */
export function cleanText(value) {
  return value == null ? '' : String(value).trim();
}

/**
 * Converte um valor para inteiro, com valor padrão se inválido.
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Converte para inteiro e limita ao intervalo [min, max].
 * @param {*} value
 * @param {number} min
 * @param {number} max
 * @param {number} [fallback=min]
 * @returns {number}
 */
export function clampInt(value, min, max, fallback = min) {
  let n = toInt(value, fallback);
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

/**
 * Remove duplicatas de um array de strings preservando a ordem.
 * @param {Array<string>} list
 * @returns {Array<string>}
 */
export function dedupeStrings(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(v => typeof v === 'string'))];
}

/**
 * Garante que o valor seja um array (caso contrário, devolve []).
 * @param {*} value
 * @returns {Array}
 */
export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Garante que o valor seja um objeto simples (caso contrário, devolve {}).
 * @param {*} value
 * @returns {object}
 */
export function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
