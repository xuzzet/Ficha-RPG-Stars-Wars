/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   main.js — Ponto de entrada (ES Modules)

   Responsabilidade:
   - Importar todos os módulos.
   - Registrar os event listeners principais.
   - Inicializar a aplicação e fazer o render inicial.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { updateAttributeValidation, clearAttributes } from './attributes.js';
import { rollAttribute, rollSkill, renderRollHistory, clearRollHistory } from './dice.js';
import { addSkill, removeSkill, renderSkills, setSkillFilter } from './skills.js';
import { addUniqueAbility, removeUniqueAbility, toggleAbilityUsed, renderAbilities } from './abilities.js';
import { addInventoryItem, removeInventoryItem, renderInventory } from './inventory.js';
import {
  addDefect, addPresetDefect, removeDefect,
  setPresetFilter, renderPresetDefects, renderDefects,
} from './defects.js';
import { saveSheet, loadSheet, exportSheetJSON, importSheetJSON, deleteSheet } from './storage.js';
import {
  updateEffort, updateConnection, restoreEffort, restoreConnection, renderResources,
} from './resources.js';
import {
  showStatus, switchSheetTab, initAccordions, loadPortrait,
  updateHpDisplay, increaseHp, decreaseHp, restoreHp, suggestHp,
} from './ui.js';

/**
 * Liga um handler a um evento de um elemento pelo ID, com aviso se ausente.
 * @param {string} id
 * @param {string} event
 * @param {Function} handler
 * @returns {boolean}
 */
function bindEvent(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[SWRPG] Elemento não encontrado: #${id}`);
    return false;
  }
  el.addEventListener(event, handler);
  return true;
}

/**
 * Configura todos os event listeners da aplicação.
 */
function initEventListeners() {

  // --- Retrato ---
  bindEvent('btn-load-portrait', 'click', loadPortrait);
  bindEvent('portrait-url', 'keydown', e => {
    if (e.key === 'Enter') loadPortrait();
  });

  // --- HP ---
  bindEvent('btn-hp-increase', 'click', increaseHp);
  bindEvent('btn-hp-decrease', 'click', decreaseHp);
  bindEvent('btn-hp-restore', 'click', restoreHp);
  bindEvent('btn-hp-suggest', 'click', suggestHp);
  bindEvent('hp-current', 'input', updateHpDisplay);
  bindEvent('hp-max', 'input', updateHpDisplay);

  // --- Esforço e Conexão ---
  bindEvent('btn-effort-decrease', 'click', () => updateEffort(-1));
  bindEvent('btn-effort-increase', 'click', () => updateEffort(1));
  bindEvent('btn-effort-restore', 'click', restoreEffort);
  bindEvent('btn-connection-decrease', 'click', () => updateConnection(-1));
  bindEvent('btn-connection-increase', 'click', () => updateConnection(1));
  bindEvent('btn-connection-restore', 'click', restoreConnection);

  // --- Atributos: qualquer alteração recalcula pontos e valida distribuição ---
  ['vida', 'corpo', 'mente', 'presenca', 'espirito'].forEach(attr => {
    bindEvent(`attr-${attr}`, 'input', updateAttributeValidation);
  });

  // --- Botões de rolar por atributo (delegação de eventos na grade) ---
  const attrGrid = document.querySelector('.attributes-grid');
  if (attrGrid) {
    attrGrid.addEventListener('click', e => {
      const btn = e.target.closest('.btn--roll[data-attr]');
      if (btn) rollAttribute(btn.dataset.attr);
    });
  } else {
    console.warn('[SWRPG] Grade de atributos não encontrada.');
  }

  // --- Botão limpar atributos ---
  bindEvent('btn-clear-attrs', 'click', () => {
    if (!confirm('Limpar todos os atributos?')) return;
    clearAttributes();
  });

  // --- Histórico de rolagens ---
  bindEvent('btn-clear-history', 'click', clearRollHistory);

  // --- Perícias ---
  bindEvent('btn-add-skill', 'click', addSkill);

  // --- Perícias: filtro por atributo ---
  const skillFilter = document.getElementById('skill-filter');
  if (skillFilter) {
    skillFilter.addEventListener('click', e => {
      const chip = e.target.closest('.filter-chip[data-filter]');
      if (!chip) return;
      skillFilter.querySelectorAll('.filter-chip').forEach(c =>
        c.classList.toggle('filter-chip--active', c === chip));
      setSkillFilter(chip.dataset.filter);
    });
  }

  const skillsList = document.getElementById('skills-list');
  if (skillsList) {
    skillsList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'roll-skill')   rollSkill(id);
      if (action === 'remove-skill') removeSkill(id);
    });
  }

  // --- Habilidades ---
  bindEvent('btn-add-ability', 'click', addUniqueAbility);

  const abilitiesList = document.getElementById('abilities-list');
  if (abilitiesList) {
    abilitiesList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'toggle-ability') toggleAbilityUsed(id);
      if (action === 'remove-ability') removeUniqueAbility(id);
    });
  }

  // --- Inventário ---
  bindEvent('btn-add-item', 'click', addInventoryItem);

  const inventoryList = document.getElementById('inventory-list');
  if (inventoryList) {
    inventoryList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'remove-item') removeInventoryItem(btn.dataset.id);
    });
  }

  // --- Abas (Ficha / Defeitos) ---
  document.querySelectorAll('.sheet-tab').forEach(button => {
    button.addEventListener('click', () => switchSheetTab(button.dataset.tab));
  });

  // --- Defeitos: adicionar personalizado ---
  bindEvent('btn-add-defect', 'click', addDefect);

  // --- Defeitos: filtro de gravidade da lista de prontos ---
  const presetFilter = document.getElementById('defect-preset-filter');
  if (presetFilter) {
    presetFilter.addEventListener('click', e => {
      const chip = e.target.closest('.filter-chip[data-filter]');
      if (!chip) return;
      presetFilter.querySelectorAll('.filter-chip').forEach(c =>
        c.classList.toggle('filter-chip--active', c === chip));
      setPresetFilter(chip.dataset.filter);
    });
  }

  // --- Defeitos: adicionar a partir da lista de prontos ---
  const presetsList = document.getElementById('defect-presets-list');
  if (presetsList) {
    presetsList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="add-preset"]');
      if (btn) addPresetDefect(Number(btn.dataset.index));
    });
  }

  // --- Defeitos: remover escolhidos ---
  const defectsList = document.getElementById('defects-list');
  if (defectsList) {
    defectsList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="remove-defect"]');
      if (btn) removeDefect(btn.dataset.id);
    });
  }

  // --- Salvar / Carregar / Exportar / Importar / Apagar ---
  bindEvent('btn-save', 'click', saveSheet);
  bindEvent('btn-load', 'click', loadSheet);
  bindEvent('btn-export', 'click', exportSheetJSON);
  bindEvent('btn-delete', 'click', deleteSheet);

  bindEvent('input-import', 'change', e => {
    const file = e.target.files[0];
    if (file) importSheetJSON(file);
    e.target.value = ''; // permite reimportar o mesmo arquivo
  });
}

/**
 * Inicialização principal. Chamada uma única vez no DOMContentLoaded.
 */
function init() {
  initEventListeners();
  initAccordions();
  updateAttributeValidation(); // inicia com "Preencha os atributos"
  updateHpDisplay();           // inicia barra de HP em 0/0
  renderResources();           // inicia medidores de Esforço/Conexão
  renderSkills();
  renderAbilities();
  renderInventory();
  renderRollHistory();
  renderPresetDefects();
  renderDefects();

  // Restaura a aba ativa salva (padrão: "ficha")
  const savedSheetTab = localStorage.getItem('activeSheetTab') || 'ficha';
  switchSheetTab(savedSheetTab);

  if (localStorage.getItem('swrpg-sheet')) {
    showStatus('💾 Ficha salva encontrada. Clique em "Carregar" para restaurar.', 'info', 7000);
  }

  console.log('%cSTAR WARS RPG — Ficha carregada com sucesso.', 'color: #f0c040; font-weight: bold;');
}

document.addEventListener('DOMContentLoaded', init);
