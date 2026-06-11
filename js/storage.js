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

import { sheetState, setStateList } from './state.js';
import { getVal, setVal } from './dom.js';
import { updateAttributeValidation } from './attributes.js';
import { renderRollHistory } from './dice.js';
import { renderSkills } from './skills.js';
import { renderAbilities } from './abilities.js';
import { renderInventory } from './inventory.js';
import { renderDefects } from './defects.js';
import { getResourcesData, applyResourcesData } from './resources.js';
import { showStatus, updateHpDisplay, loadPortrait } from './ui.js';

/** Chave usada no LocalStorage. */
const STORAGE_KEY = 'swrpg-sheet';

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

    // --- Metadados ---
    savedAt: new Date().toISOString(),
    version: '1.0',
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
  setStateList('inventory',   data.inventory);
  setStateList('rollHistory', data.rollHistory);
  setStateList('defects',     data.defects);

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
}

/**
 * Salva a ficha completa no LocalStorage (chave 'swrpg-sheet').
 */
export function saveSheet() {
  try {
    const data = collectSheetData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    showStatus(`✓ Ficha salva às ${new Date().toLocaleTimeString('pt-BR')}`, 'saved');
  } catch (err) {
    console.error('[SWRPG] Erro ao salvar:', err);
    showStatus('Erro ao salvar. Verifique o espaço disponível.', 'error');
  }
}

/**
 * Carrega a ficha salva do LocalStorage.
 */
export function loadSheet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      showStatus('Nenhuma ficha salva encontrada.', 'error');
      return;
    }
    const data = JSON.parse(raw);
    applySheetData(data);
    const when = data.savedAt ? new Date(data.savedAt).toLocaleString('pt-BR') : '?';
    showStatus(`✓ Ficha carregada! (Salva em: ${when})`, 'saved');
  } catch (err) {
    console.error('[SWRPG] Erro ao carregar:', err);
    showStatus('Erro ao carregar. O arquivo pode estar corrompido.', 'error');
  }
}

/**
 * Exporta a ficha como arquivo .json para download.
 */
export function exportSheetJSON() {
  try {
    const data     = collectSheetData();
    const charName = data.charName || 'personagem';
    const filename = `swrpg-${charName.replace(/[^a-zA-Z0-9À-ú]/g, '_').toLowerCase()}.json`;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showStatus(`✓ Exportado como ${filename}`, 'saved');
  } catch (err) {
    console.error('[SWRPG] Erro ao exportar:', err);
    showStatus('Erro ao exportar a ficha.', 'error');
  }
}

/**
 * Importa uma ficha de um arquivo .json selecionado pelo usuário.
 * @param {File} file
 */
export function importSheetJSON(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      applySheetData(data);
      showStatus(`✓ Ficha de "${data.charName || 'personagem'}" importada!`, 'saved');
    } catch (err) {
      console.error('[SWRPG] Erro ao importar:', err);
      showStatus('Arquivo inválido. Selecione um JSON exportado por este sistema.', 'error');
    }
  };

  reader.onerror = () => showStatus('Erro ao ler o arquivo.', 'error');
  reader.readAsText(file, 'UTF-8');
}

/**
 * Apaga a ficha salva no LocalStorage após confirmação.
 */
export function deleteSheet() {
  if (!confirm('Apagar a ficha salva?\n\nEsta ação remove os dados do armazenamento do navegador. Os dados na tela não serão alterados.')) return;
  localStorage.removeItem(STORAGE_KEY);
  showStatus('Ficha apagada do armazenamento local.', 'info');
}
