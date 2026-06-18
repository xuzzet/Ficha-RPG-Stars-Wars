/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   storage.js — Persistência (LocalStorage + JSON)

   Responsabilidade:
   - Coletar TODOS os dados da ficha em um único objeto.
   - Salvar/carregar no LocalStorage (chave 'swrpg-sheet').
   - Exportar e importar arquivo .json.
   - Apagar a ficha salva.
   - Tratamento de erros e re-render de todos os módulos.
   ============================================================ */

'use strict';

import { sheetState, setStateList, resetState } from './state.js';
import { getVal, setVal } from './dom.js';
import { updateAttributeValidation } from './attributes.js';
import { renderRollHistory } from './dice.js';
import { renderSkills } from './skills.js';
import { renderAbilities } from './abilities.js';
import { renderInventory, normalizeInventoryItem } from './inventory.js';
import { renderDefects } from './defects.js';
import { getResourcesData, applyResourcesData } from './resources.js';
import {
  renderSkillTreePage, getSkillTreeCategory,
  getSkillTreeState, applySkillTreeData,
} from './skillTree.js';
import { getProgressionData, applyProgressionData, renderProgressionPage } from './progression.js';
import { showStatus, updateHpDisplay, loadPortrait, switchSheetTab } from './ui.js';
import { STORAGE_KEY, ACTIVE_TAB_KEY, CURRENT_SAVE_VERSION } from './constants.js';
import { migrateSaveData } from './migrations.js';

/**
 * Gera um nome de arquivo seguro a partir de um texto livre.
 * Remove acentos, espaços e caracteres especiais.
 * @param {string} text
 * @returns {string}
 */
function slugifyFileName(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Validação mínima: o objeto parece uma ficha deste sistema?
 * Aceita formatos antigos (sem alguns campos) desde que tenha
 * pelo menos um indício reconhecível.
 * @param {*} data
 * @returns {boolean}
 */
export function isValidSaveData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return (
    'version'    in data ||
    'charName'   in data ||
    'attrVida'   in data ||
    'skills'     in data ||
    'progression' in data ||
    'attributeBonuses' in data
  );
}

/**
 * Normaliza e migra uma ficha antiga/incompleta para a versão atual.
 * Mantida por compatibilidade; delega ao pipeline de migração.
 * @param {object} data
 * @returns {object}
 */
export function normalizeSaveData(data) {
  return migrateSaveData(data);
}

/**
 * Retorna um objeto de ficha "em branco" com todos os campos vazios.
 * Usado para apagar/zerar a ficha reaproveitando applySheetData.
 * @returns {object}
 */
function getDefaultSheetData() {
  return {
    charName: '', playerName: '', species: '', archetype: '', rankLevel: '',
    concept: '', faction: '', origin: '', charDescription: '', portraitUrl: '',
    hpCurrent: '', hpMax: '', condition: '', credits: '', injuries: '',
    effortCurrent: 0, effortMax: 0, connectionCurrent: 0, connectionMax: 0,
    attrVida: '', attrCorpo: '', attrMente: '', attrPresenca: '', attrEspirito: '',
    eqWeaponMain: '', eqWeaponSec: '', eqArmor: '', eqShip: '', eqDroid: '', eqSpecial: '',
    loreHistory: '', lorePersonality: '', loreAppearance: '', loreMotivations: '',
    loreFears: '', loreRelations: '', loreDebts: '', loreSecrets: '', loreGoal: '',
    masterNotes: '', masterSecrets: '', masterHooks: '', masterConsequences: '',
    skills: [], abilities: [], inventory: [], rollHistory: [], defects: [],
    unlockedSkillTreeNodes: [],
    skillTree: {
      version: 2, customNodes: [], selectedNodeId: null,
      activeFilter: 'todos', migratedFromExamples: false,
    },
    sessionWeaponId: '',
    attributeBonuses: { vida: 0, corpo: 0, mente: 0, presenca: 0, espirito: 0 },
    progression: {
      totalEarned: 0, spent: 0, history: [],
      createdManeuvers: [], createdForceTechniques: [],
    },
    version: CURRENT_SAVE_VERSION,
  };
}

/**
 * Coleta TODOS os dados da ficha em um único objeto.
 * Este objeto vai para o LocalStorage e para o arquivo JSON.
 * @returns {object}
 */
export function collectSheetData() {
  return {
    // --- Identidade ---
    charName:        getVal('char-name'),
    playerName:      getVal('player-name'),
    species:         getVal('species'),
    archetype:       getVal('archetype'),
    rankLevel:       getVal('rank-level'),
    concept:         getVal('concept'),
    faction:         getVal('faction'),
    origin:          getVal('origin'),
    charDescription: getVal('char-description'),
    portraitUrl:     getVal('portrait-url'),

    // --- Recursos ---
    hpCurrent: getVal('hp-current'),
    hpMax:     getVal('hp-max'),
    condition: getVal('condition'),
    credits:   getVal('credits'),
    injuries:  getVal('injuries'),

    // --- Esforço e Conexão ---
    ...getResourcesData(),

    // --- Atributos ---
    attrVida:     getVal('attr-vida'),
    attrCorpo:    getVal('attr-corpo'),
    attrMente:    getVal('attr-mente'),
    attrPresenca: getVal('attr-presenca'),
    attrEspirito: getVal('attr-espirito'),

    // --- Equipamentos principais ---
    eqWeaponMain: getVal('eq-weapon-main'),
    eqWeaponSec:  getVal('eq-weapon-sec'),
    eqArmor:      getVal('eq-armor'),
    eqShip:       getVal('eq-ship'),
    eqDroid:      getVal('eq-droid'),
    eqSpecial:    getVal('eq-special'),

    // --- Lore ---
    loreHistory:     getVal('lore-history'),
    lorePersonality: getVal('lore-personality'),
    loreAppearance:  getVal('lore-appearance'),
    loreMotivations: getVal('lore-motivations'),
    loreFears:       getVal('lore-fears'),
    loreRelations:   getVal('lore-relations'),
    loreDebts:       getVal('lore-debts'),
    loreSecrets:     getVal('lore-secrets'),
    loreGoal:        getVal('lore-goal'),

    // --- Notas do Mestre ---
    masterNotes:        getVal('master-notes'),
    masterSecrets:      getVal('master-secrets'),
    masterHooks:        getVal('master-hooks'),
    masterConsequences: getVal('master-consequences'),

    // --- Listas dinâmicas ---
    skills:      sheetState.skills,
    abilities:   sheetState.abilities,
    inventory:   sheetState.inventory,
    rollHistory: sheetState.rollHistory,
    defects:     sheetState.defects,

    // --- Árvore de Habilidades (dinâmica) ---
    unlockedSkillTreeNodes: sheetState.unlockedSkillTreeNodes,
    skillTree:              getSkillTreeState(),
    skillTreeCategory:      getSkillTreeCategory(),

    // --- Arma rápida do Painel de Sessão ---
    sessionWeaponId: sheetState.sessionWeaponId,

    // --- Progressão (bônus de atributo + economia de PE) ---
    ...getProgressionData(),

    // --- Metadados ---
    activeTab: localStorage.getItem(ACTIVE_TAB_KEY) || 'ficha',
    savedAt:   new Date().toISOString(),
    version:   CURRENT_SAVE_VERSION,
  };
}

/**
 * Aplica um objeto de dados (do LocalStorage ou de arquivo JSON) à ficha.
 * @param {object} data
 */
export function applySheetData(data) {
  // Identidade
  setVal('char-name',        data.charName);
  setVal('player-name',      data.playerName);
  setVal('species',          data.species);
  setVal('archetype',        data.archetype);
  setVal('rank-level',       data.rankLevel);
  setVal('concept',          data.concept);
  setVal('faction',          data.faction);
  setVal('origin',           data.origin);
  setVal('char-description', data.charDescription);
  setVal('portrait-url',     data.portraitUrl);

  // Recursos
  setVal('hp-current', data.hpCurrent);
  setVal('hp-max',     data.hpMax);
  setVal('condition',  data.condition);
  setVal('credits',    data.credits);
  setVal('injuries',   data.injuries);

  // Atributos
  setVal('attr-vida',     data.attrVida);
  setVal('attr-corpo',    data.attrCorpo);
  setVal('attr-mente',    data.attrMente);
  setVal('attr-presenca', data.attrPresenca);
  setVal('attr-espirito', data.attrEspirito);

  // Equipamentos
  setVal('eq-weapon-main', data.eqWeaponMain);
  setVal('eq-weapon-sec',  data.eqWeaponSec);
  setVal('eq-armor',       data.eqArmor);
  setVal('eq-ship',        data.eqShip);
  setVal('eq-droid',       data.eqDroid);
  setVal('eq-special',     data.eqSpecial);

  // Lore
  setVal('lore-history',     data.loreHistory);
  setVal('lore-personality', data.lorePersonality);
  setVal('lore-appearance',  data.loreAppearance);
  setVal('lore-motivations', data.loreMotivations);
  setVal('lore-fears',       data.loreFears);
  setVal('lore-relations',   data.loreRelations);
  setVal('lore-debts',       data.loreDebts);
  setVal('lore-secrets',     data.loreSecrets);
  setVal('lore-goal',        data.loreGoal);

  // Notas do Mestre
  setVal('master-notes',        data.masterNotes);
  setVal('master-secrets',      data.masterSecrets);
  setVal('master-hooks',        data.masterHooks);
  setVal('master-consequences', data.masterConsequences);

  // Listas dinâmicas — reset explícito quando ausentes no JSON
  setStateList('skills',      data.skills);
  setStateList('abilities',   data.abilities);
  setStateList('inventory',   Array.isArray(data.inventory)
    ? data.inventory.map(normalizeInventoryItem) : data.inventory);
  setStateList('rollHistory', data.rollHistory);
  setStateList('defects',     data.defects);
  setStateList('unlockedSkillTreeNodes', data.unlockedSkillTreeNodes);

  // Árvore de Habilidades (dinâmica) — normaliza/migra fichas antigas.
  applySkillTreeData(data);

  // Arma rápida do Painel de Sessão
  sheetState.sessionWeaponId = data.sessionWeaponId || '';

  // Progressão (antes de revalidar atributos para que os bônus entrem
  // no cálculo de pontos finais e recursos derivados).
  applyProgressionData(data);

  // Re-renderiza tudo
  renderSkills();
  renderAbilities();
  renderInventory();
  renderRollHistory();
  renderDefects();
  updateAttributeValidation();
  updateHpDisplay();
  loadPortrait();

  // Esforço/Conexão: restaura atuais salvos, recalcula máximos pelos
  // atributos atuais e corrige atuais acima do máximo.
  applyResourcesData(data);

  // Árvore de Habilidades — render após recursos (resumo usa Esforço/Conexão).
  renderSkillTreePage();

  // Progressão — render após recursos (manobras/técnicas dependem de Esforço/Conexão).
  renderProgressionPage();

  // Restaura a aba ativa salva (se houver) — não força mudança quando ausente.
  if (data.activeTab) {
    switchSheetTab(data.activeTab);
    if (data.activeTab === 'arvore')     renderSkillTreePage();
    if (data.activeTab === 'progressao') renderProgressionPage();
  }
}

/**
 * Salva a ficha completa no LocalStorage (chave 'swrpg-sheet').
 */
export function saveSheet() {
  try {
    const data = collectSheetData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    showStatus(`✓ Ficha salva às ${new Date().toLocaleTimeString('pt-BR')}`, 'success');
  } catch (err) {
    console.error('[SWRPG] Erro ao salvar:', err);
    showStatus('Erro ao salvar ficha. Verifique o console.', 'error');
  }
}

/**
 * Salva a ficha no LocalStorage SEM exibir aviso (auto-save silencioso).
 * Usado pela Árvore de Habilidades ao criar/editar/excluir/comprar/usar.
 */
export function persistSheetSilently() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectSheetData()));
  } catch (err) {
    console.warn('[SWRPG] Auto-save não foi possível:', err);
  }
}

/**
 * Carrega a ficha salva do LocalStorage.
 */
export function loadSheet() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.error('[SWRPG] Erro ao acessar o armazenamento:', err);
    showStatus('Erro ao carregar ficha. Verifique o console.', 'error');
    return;
  }

  if (!raw) {
    showStatus('Nenhuma ficha salva encontrada.', 'warning');
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('[SWRPG] Erro ao interpretar a ficha salva:', err);
    showStatus('Erro ao carregar ficha. O dado salvo está corrompido.', 'error');
    return;
  }

  if (!isValidSaveData(data)) {
    showStatus('Erro ao carregar ficha. Formato não reconhecido.', 'error');
    return;
  }

  try {
    applySheetData(normalizeSaveData(data));
    showStatus('Ficha carregada com sucesso.', 'success');
  } catch (err) {
    console.error('[SWRPG] Erro ao aplicar a ficha:', err);
    showStatus('Erro ao carregar ficha. Verifique o console.', 'error');
  }
}

/**
 * Exporta a ficha como arquivo .json para download.
 */
export function exportSheetJSON() {
  try {
    const data = collectSheetData();
    data.exportedAt = new Date().toISOString();

    const slug     = slugifyFileName(data.charName);
    const filename = slug ? `${slug}-ficha-star-wars.json` : 'ficha-star-wars-rpg.json';

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showStatus('Ficha exportada com sucesso.', 'success');
  } catch (err) {
    console.error('[SWRPG] Erro ao exportar:', err);
    showStatus('Erro ao exportar a ficha.', 'error');
  }
}

/**
 * Importa uma ficha de um arquivo .json selecionado pelo usuário.
 * Pede confirmação antes de substituir os dados atuais e nunca apaga
 * a ficha atual se o arquivo for inválido.
 * @param {File} file
 */
export function importSheetJSON(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch (err) {
      console.error('[SWRPG] Erro ao interpretar o arquivo importado:', err);
      showStatus('Arquivo inválido. A ficha atual não foi alterada.', 'error');
      return;
    }

    if (!isValidSaveData(data)) {
      console.error('[SWRPG] Arquivo importado não parece uma ficha válida.');
      showStatus('Arquivo inválido. A ficha atual não foi alterada.', 'error');
      return;
    }

    if (!confirm('Importar esta ficha substituirá os dados atuais. Deseja continuar?')) {
      showStatus('Importação cancelada.', 'info');
      return;
    }

    try {
      applySheetData(normalizeSaveData(data));
      // Persiste automaticamente a ficha importada no armazenamento local.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collectSheetData()));
      } catch (saveErr) {
        console.warn('[SWRPG] Ficha importada, mas não foi possível salvar automaticamente:', saveErr);
      }
      showStatus('Ficha importada com sucesso.', 'success');
    } catch (err) {
      console.error('[SWRPG] Erro ao aplicar a ficha importada:', err);
      showStatus('Erro ao importar ficha. A ficha atual pode estar inconsistente.', 'error');
    }
  };

  reader.onerror = () => {
    console.error('[SWRPG] Erro ao ler o arquivo.');
    showStatus('Erro ao importar ficha. Não foi possível ler o arquivo.', 'error');
  };
  reader.readAsText(file, 'UTF-8');
}

/**
 * Restaura TODA a ficha para o estado inicial em branco (estado + DOM),
 * re-renderizando todas as telas. Não mexe no LocalStorage.
 */
export function resetSheetToDefault() {
  resetState();
  applySheetData(getDefaultSheetData());
}

/**
 * Apaga a ficha salva no LocalStorage após confirmação e limpa a tela.
 */
export function deleteSheet() {
  if (!confirm('Tem certeza que deseja apagar a ficha salva? Essa ação não pode ser desfeita.')) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    resetSheetToDefault();
    showStatus('Ficha apagada com sucesso.', 'success');
  } catch (err) {
    console.error('[SWRPG] Erro ao apagar:', err);
    showStatus('Erro ao apagar a ficha. Verifique o console.', 'error');
  }
}
