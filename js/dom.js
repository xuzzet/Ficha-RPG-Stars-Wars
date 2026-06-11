/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   dom.js — Seletores e auxiliares de DOM

   Responsabilidade:
   - Funções curtas para pegar elementos e ler/escrever valores.
   - Geração de IDs únicos.
   - Escape de HTML para prevenir XSS.
   ============================================================ */

'use strict';

/**
 * Atalho para document.getElementById.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function byId(id) {
  return document.getElementById(id);
}

/**
 * Lê o valor (string) de um input/textarea/select pelo ID.
 * Retorna string vazia se o elemento não existir.
 * @param {string} id
 * @returns {string}
 */
export function getVal(id) {
  const el = byId(id);
  return el ? el.value : '';
}

/**
 * Define o valor de um campo pelo ID, com verificação defensiva.
 * Ignora valores undefined/null para não apagar campos sem necessidade.
 * @param {string} id
 * @param {*} value
 */
export function setVal(id, value) {
  const el = byId(id);
  if (el && value !== undefined && value !== null) el.value = value;
}

/**
 * Lê um campo numérico pelo ID, com valor padrão.
 * @param {string} id
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function getNum(id, fallback = 0) {
  const n = parseInt(getVal(id), 10);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Gera um ID único combinando timestamp e número aleatório.
 * Usado para identificar perícias, habilidades, itens e defeitos.
 * @returns {string}
 */
export function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 99999)}`;
}

/**
 * Escapa caracteres HTML especiais para prevenir XSS.
 * SEMPRE use esta função ao inserir texto do usuário via innerHTML.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
