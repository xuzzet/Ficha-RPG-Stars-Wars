/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   state.js — Estado central da ficha

   Responsabilidade:
   - Manter o objeto central com todas as listas dinâmicas.
   - Oferecer funções simples para ler e atualizar o estado.

   As listas dinâmicas (perícias, habilidades, inventário,
   histórico de rolagens e defeitos) vivem aqui. Os campos de
   texto/numéricos da ficha continuam sendo lidos diretamente
   do DOM no momento de salvar (ver storage.js).
   ============================================================ */

'use strict';

/**
 * Estado central da ficha.
 * Cada lista é mutável e compartilhada entre os módulos via import.
 */
export const sheetState = {
  skills:      [],   // [{id, name, attr, grade, cost, desc}]
  abilities:   [],   // [{id, name, attr, cost, freq, extraCost, desc, used}]
  inventory:   [],   // [{id, name, type, qty, desc}]
  rollHistory: [],   // [{id, name, grade, rolls, result, attrValue, success, isAutoSuccess, type, timestamp}]
  defects:     [],   // [{id, name, points, type, description, source}]

  // Recursos rastreáveis (números). Máximos derivam dos atributos.
  effortCurrent:     0,   // Esforço atual (gasto em Manobras)
  effortMax:         0,   // Esforço máximo = floor(Corpo / 10) + 3
  connectionCurrent: 0,   // Conexão atual (gasta em Técnicas da Força)
  connectionMax:     0,   // Conexão máxima = floor(Espírito / 10) + 2
};

/**
 * Substitui o conteúdo de uma lista do estado de forma segura.
 * Usado ao carregar/importar uma ficha (ver storage.js).
 * @param {keyof sheetState} key - Nome da lista
 * @param {Array} value - Novo array (caso não seja array, vira [])
 */
export function setStateList(key, value) {
  sheetState[key] = Array.isArray(value) ? value : [];
}

/**
 * Esvazia uma lista do estado.
 * @param {keyof sheetState} key
 */
export function clearStateList(key) {
  sheetState[key] = [];
}
