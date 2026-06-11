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

  // Árvore de Habilidades — ids dos nós já desbloqueados (comprados).
  unlockedSkillTreeNodes: [],

  // Painel de Sessão — id da arma escolhida como "arma rápida".
  sessionWeaponId: '',

  // Recursos rastreáveis (números). Máximos derivam dos atributos.
  effortCurrent:     0,   // Esforço atual (gasto em Manobras)
  effortMax:         0,   // Esforço máximo = floor(Corpo / 10) + 3
  connectionCurrent: 0,   // Conexão atual (gasta em Técnicas da Força)
  connectionMax:     0,   // Conexão máxima = floor(Espírito / 10) + 2

  // Progressão — bônus permanentes somados ao valor BASE dos atributos.
  // O valor FINAL usado em pontos, rolagens e recursos derivados é
  // base (campo do DOM) + bônus de progressão.
  attributeBonuses: { vida: 0, corpo: 0, mente: 0, presenca: 0, espirito: 0 },

  // Progressão — bônus permanentes somados aos MÁXIMOS de Esforço e
  // Conexão (além do que vem dos atributos Corpo e Espírito).
  resourceBonuses: { effort: 0, connection: 0 },

  // Progressão — economia de Pontos de Evolução (PE) e o que foi comprado.
  progression: {
    totalEarned: 0,            // total de PE ganhos
    spent:       0,            // total de PE gastos
    history:     [],           // [{id, type, name, deltaPE, effect, reason, date}]
    createdManeuvers:       [],// [{id, name, category, action, cost, resourceCost, desc, effect, reason}]
    createdForceTechniques: [],// [{id, name, category, action, cost, resourceCost, sensitive, desc, effect, reason}]
  },
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

/**
 * Restaura TODO o estado central para os valores iniciais.
 * Usado ao apagar a ficha (ver storage.js → resetSheetToDefault).
 * Não toca no DOM — apenas no objeto de estado.
 */
export function resetState() {
  sheetState.skills      = [];
  sheetState.abilities   = [];
  sheetState.inventory   = [];
  sheetState.rollHistory = [];
  sheetState.defects     = [];
  sheetState.unlockedSkillTreeNodes = [];
  sheetState.sessionWeaponId = '';

  sheetState.effortCurrent     = 0;
  sheetState.effortMax         = 0;
  sheetState.connectionCurrent = 0;
  sheetState.connectionMax     = 0;

  sheetState.attributeBonuses = { vida: 0, corpo: 0, mente: 0, presenca: 0, espirito: 0 };
  sheetState.resourceBonuses  = { effort: 0, connection: 0 };

  sheetState.progression = {
    totalEarned: 0,
    spent:       0,
    history:     [],
    createdManeuvers:       [],
    createdForceTechniques: [],
  };
}
