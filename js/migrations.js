/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   migrations.js — Versão e migração de saves

   Responsabilidade:
   - Normalizar fichas antigas/incompletas (compatibilidade retroativa).
   - Executar migrações por versão de save, de forma encadeada.
   - Carimbar a versão atual no resultado.

   A migração nunca remove dados desconhecidos: apenas garante a
   presença e o formato dos campos essenciais.
   ============================================================ */

'use strict';

import { CURRENT_SAVE_VERSION } from './constants.js';
import { ensureArray, ensureObject } from './validators.js';
import { normalizeInventoryItem } from './inventory.js';
import { createEntity, ENTITY_TYPES } from './state.js';

/**
 * Padroniza uma lista de entidades garantindo `id` e `kind`.
 * Preserva todos os demais campos (inclusive `type` de categoria).
 * @param {Array} list
 * @param {string} kind - Valor de {@link ENTITY_TYPES}.
 * @returns {Array}
 */
function standardizeEntities(list, kind) {
  return ensureArray(list).map(item =>
    (item && typeof item === 'object') ? createEntity(kind, item) : item
  );
}

/**
 * Garante a presença e o formato dos campos essenciais da ficha.
 * (Base comum a qualquer versão.)
 * @param {object} data
 * @returns {object}
 */
function normalizeBaseShape(data) {
  const safe = ensureObject(data);
  return {
    ...safe,
    skills:      ensureArray(safe.skills),
    abilities:   ensureArray(safe.abilities),
    inventory:   ensureArray(safe.inventory),
    rollHistory: ensureArray(safe.rollHistory),
    defects:     ensureArray(safe.defects),
    unlockedSkillTreeNodes: ensureArray(safe.unlockedSkillTreeNodes),
    skillTree:        safe.skillTree && typeof safe.skillTree === 'object' ? safe.skillTree : null,
    attributeBonuses: ensureObject(safe.attributeBonuses),
    resourceBonuses:  ensureObject(safe.resourceBonuses),
    progression:      ensureObject(safe.progression),
  };
}

/**
 * Migração para o formato 1.2:
 * - Normaliza os itens do inventário (propriedades de arma como ids válidos,
 *   aceitando o campo legado `propriedades`).
 * - Garante os bônus de recurso (Esforço/Conexão) da progressão.
 * @param {object} data
 * @returns {object}
 */
function migrateTo_1_2(data) {
  const next = { ...data };

  next.inventory = ensureArray(next.inventory).map(normalizeInventoryItem);

  next.resourceBonuses = {
    effort:     Number(next.resourceBonuses.effort)     || 0,
    connection: Number(next.resourceBonuses.connection) || 0,
  };

  return next;
}

/**
 * Migração para o formato 1.3:
 * - Padroniza as entidades dinâmicas (perícias, habilidades, itens,
 *   defeitos) garantindo `id` e `kind`, sem alterar campos existentes.
 * @param {object} data
 * @returns {object}
 */
function migrateTo_1_3(data) {
  const next = { ...data };

  next.skills    = standardizeEntities(next.skills,    ENTITY_TYPES.SKILL);
  next.abilities = standardizeEntities(next.abilities, ENTITY_TYPES.ABILITY);
  next.inventory = standardizeEntities(next.inventory, ENTITY_TYPES.ITEM);
  next.defects   = standardizeEntities(next.defects,   ENTITY_TYPES.DEFECT);

  return next;
}

/**
 * Normaliza e migra uma ficha para a versão atual.
 * Idempotente: aplicar duas vezes produz o mesmo resultado.
 * @param {object} rawData - Dados crus (LocalStorage ou JSON importado).
 * @returns {object} Ficha normalizada e carimbada com a versão atual.
 */
export function migrateSaveData(rawData) {
  let data = normalizeBaseShape(rawData);

  // Migrações encadeadas. Como são idempotentes, podem rodar sempre.
  data = migrateTo_1_2(data);
  data = migrateTo_1_3(data);

  data.version = CURRENT_SAVE_VERSION;
  return data;
}
