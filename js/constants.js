/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   constants.js — Dados fixos e identificadores centrais

   Responsabilidade:
   - Concentrar TODOS os valores fixos do sistema em um único lugar:
     chave de armazenamento, versão do save, tabelas de dano, escalas
     de arma, rótulos legíveis e ícones de tipo de item.
   - Evitar dados fixos espalhados pelos módulos (fonte única da verdade).

   Este módulo não tem efeitos colaterais e não depende de nenhum outro.
   ============================================================ */

'use strict';

/* ============================================================
   ARMAZENAMENTO / VERSÃO
   ============================================================ */

/** Chave usada no LocalStorage para a ficha completa. */
export const STORAGE_KEY = 'swrpg-sheet';

/** Chave usada para lembrar a aba ativa entre sessões. */
export const ACTIVE_TAB_KEY = 'activeSheetTab';

/**
 * Versão atual do formato de salvamento.
 * Incrementar quando a estrutura mudar e exigir migração (ver migrations.js).
 */
export const CURRENT_SAVE_VERSION = '1.2';

/* ============================================================
   ATRIBUTOS
   ============================================================ */

/** Ordem canônica dos 5 atributos do sistema. */
export const ATTR_KEYS = ['vida', 'corpo', 'mente', 'presenca', 'espirito'];

/** Distribuição obrigatória dos atributos (cada valor usado uma vez). */
export const REQUIRED_ATTR_VALUES = [10, 20, 30, 40, 50];

/** Rótulos legíveis dos atributos. */
export const ATTR_LABEL = {
  vida:     'Vida',
  corpo:    'Corpo',
  mente:    'Mente',
  presenca: 'Presença',
  espirito: 'Espírito',
};

/* ============================================================
   SISTEMA DE DANO / ARMAS
   ============================================================ */

/** Categoria de dano → número de faces do dado. */
export const DAMAGE_DICE = {
  fraco:   4,
  normal:  6,
  forte:   8,
  grave:  10,
  extremo: 12,
};

/** Tipo de arma → atributos permitidos para escalonamento. */
export const WEAPON_SCALING = {
  melee:     ['corpo'],
  ranged:    ['corpo', 'mente'],
  vehicle:   ['mente'],
  special:   ['espirito'],
  explosive: ['corpo', 'mente', 'espirito'], // dano fixo: escala não é usada
};

/** Ordem dos passos de dado (para modificadores temporários de categoria). */
export const DIE_STEP_ORDER = [4, 6, 8, 10, 12];

/** Tipo de arma → rótulo legível. */
export const WEAPON_TYPE_LABEL = {
  melee:     'Arma Corpo a Corpo',
  ranged:    'Arma a Distância',
  vehicle:   'Arma de Veículo',
  special:   'Arma Especial',
  explosive: 'Explosivo',
};

/** Categoria de dano → rótulo legível. */
export const DAMAGE_CATEGORY_LABEL = {
  fraco:   'Dano Fraco',
  normal:  'Dano Normal',
  forte:   'Dano Forte',
  grave:   'Dano Grave',
  extremo: 'Dano Extremo',
};

/* ============================================================
   ITENS DE INVENTÁRIO
   ============================================================ */

/** Tipo de item → emoji exibido no card do inventário. */
export const ITEM_TYPE_ICONS = {
  arma:       '🔫',
  armadura:   '🛡',
  ferramenta: '🔧',
  droide:     '🤖',
  nave:       '🚀',
  implante:   '⚙',
  consumivel: '💊',
  reliquia:   '💎',
  outro:      '📦',
};

/** Ícone padrão para tipos de item desconhecidos. */
export const DEFAULT_ITEM_ICON = '📦';
