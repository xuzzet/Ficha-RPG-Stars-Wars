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
import {
  addInventoryItem, removeInventoryItem, renderInventory,
  rollWeaponDamage, updateWeaponFormConstraints,
  setSessionWeapon, rollSessionWeaponDamage,
  editInventoryItem, cancelItemEdit, toggleWeaponProperty,
  setWeaponPropertyFilterQuery, setWeaponPropertyFilterCategory,
  clearWeaponPropertyFilter,
} from './inventory.js';
import { getWeaponPropertyById } from './weaponProperties.js';
import {
  addDefect, addPresetDefect, removeDefect,
  setPresetFilter, renderPresetDefects, renderDefects,
} from './defects.js';
import {
  renderSkillTreePage, selectSkillTreeCategory, selectSkillNode,
  buySkillNode, useSkillNode, refundSkillNode, setSkillTreeCategory,
  openSkillForm, closeSkillForm, saveSkillForm, requestDeleteSkillNode,
  centerSkillTreeView,
} from './skillTree.js';
import {
  renderProgressionPage, addEvolutionPoints, increaseAttributeWithEvolution,
  increaseResourceWithEvolution,
  createSkillWithEvolution, improveSkillWithEvolution,
  createManeuverWithEvolution, createForceTechniqueWithEvolution,
  createUniqueAbilityWithEvolution,
  useProgressionManeuver, useProgressionTechnique,
  removeProgressionManeuver, removeProgressionTechnique,
  updateAttrPreview, updateSkillPreview, updateManeuverCost,
  updateTechniqueCost, updateAbilityCost,
} from './progression.js';
import { saveSheet, loadSheet, exportSheetJSON, importSheetJSON, deleteSheet, persistSheetSilently } from './storage.js';
import {
  updateEffort, updateConnection, restoreEffort, restoreConnection, renderResources,
} from './resources.js';
import {
  showStatus, switchSheetTab, initAccordions, loadPortrait, initPortraitDropzone,
  updateHpDisplay, increaseHp, decreaseHp, restoreHp, suggestHp,
} from './ui.js';
import { ACTIVE_TAB_KEY } from './constants.js';

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

  // --- Arma rápida (Painel de Sessão) ---
  bindEvent('session-weapon-select', 'change', e => setSessionWeapon(e.target.value));
  bindEvent('btn-session-roll-damage', 'click', rollSessionWeaponDamage);

  // --- Atributos: qualquer alteração recalcula pontos e valida distribuição ---
  ['vida', 'corpo', 'mente', 'presenca', 'espirito'].forEach(attr => {
    bindEvent(`attr-${attr}`, 'input', () => {
      updateAttributeValidation();
      renderInventory(); // recalcula as fórmulas de dano das armas
    });
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
      if (action === 'roll-skill') {
        const card      = btn.closest('.skill-card');
        const bonusInput = card && card.querySelector('[data-role="hit-bonus"]');
        rollSkill(id, { hitBonus: bonusInput ? Number(bonusInput.value) : 0 });
      }
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
  bindEvent('btn-cancel-edit-item', 'click', cancelItemEdit);

  // Formulário de arma: mostrar/ocultar campos e restringir escalonamento.
  bindEvent('item-is-weapon', 'change', updateWeaponFormConstraints);
  bindEvent('item-weapon-type', 'change', updateWeaponFormConstraints);

  // Tipo do item: ao escolher "Arma", liga automaticamente os campos de arma.
  bindEvent('item-type', 'change', e => {
    const box = document.getElementById('item-is-weapon');
    if (box) box.checked = (e.target.value === 'arma');
    updateWeaponFormConstraints();
  });

  // Seletor de Propriedades da Arma (busca, categoria e limpar filtro).
  bindEvent('weapon-props-search', 'input', e => setWeaponPropertyFilterQuery(e.target.value));
  bindEvent('weapon-props-category', 'change', e => setWeaponPropertyFilterCategory(e.target.value));
  bindEvent('btn-weapon-props-clear', 'click', clearWeaponPropertyFilter);

  // Clique nos chips de propriedade (lista) e na área de selecionadas.
  const propsList = document.getElementById('weapon-props-list');
  if (propsList) {
    propsList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="toggle-weapon-prop"]');
      if (btn) toggleWeaponProperty(btn.dataset.propId);
    });
  }
  const propsSelected = document.getElementById('weapon-props-selected');
  if (propsSelected) {
    propsSelected.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="remove-weapon-prop"]');
      if (btn) toggleWeaponProperty(btn.dataset.propId);
    });
  }

  const inventoryList = document.getElementById('inventory-list');
  if (inventoryList) {
    inventoryList.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'remove-item') removeInventoryItem(btn.dataset.id);
      if (btn.dataset.action === 'edit-item')   editInventoryItem(btn.dataset.id);
      if (btn.dataset.action === 'show-weapon-prop') {
        const card   = btn.closest('.item-card');
        const detail = card && card.querySelector('[data-role="prop-detail"]');
        const prop   = getWeaponPropertyById(btn.dataset.propId);
        if (detail && prop) {
          const isSame = detail.dataset.propId === prop.id && !detail.hidden;
          if (isSame) {
            detail.hidden = true;
            detail.dataset.propId = '';
          } else {
            detail.innerHTML = `<strong>${prop.nome}</strong> <span class="prop-detail-cat">${prop.categoria}</span><br>${prop.efeito}`;
            detail.dataset.propId = prop.id;
            detail.hidden = false;
          }
        }
      }
      if (btn.dataset.action === 'roll-damage') {
        const card      = btn.closest('.item-card');
        const stepSel   = card && card.querySelector('[data-role="step-mod"]');
        const bonusInput = card && card.querySelector('[data-role="temp-bonus"]');
        rollWeaponDamage(btn.dataset.id, {
          stepMod:   stepSel ? Number(stepSel.value) : 0,
          tempBonus: bonusInput ? Number(bonusInput.value) : 0,
        });
      }
    });
  }

  // --- Abas (Ficha / Defeitos / Árvore / Progressão) ---
  const sheetTabs = Array.from(document.querySelectorAll('.sheet-tab'));

  /** Ativa uma aba e dispara as renderizações sob demanda. */
  function activateSheetTab(tabName) {
    switchSheetTab(tabName);
    if (tabName === 'arvore')     renderSkillTreePage();
    if (tabName === 'progressao') renderProgressionPage();
  }

  sheetTabs.forEach((button, index) => {
    button.addEventListener('click', () => activateSheetTab(button.dataset.tab));

    // Navegação por teclado conforme o padrão WAI-ARIA de tablist.
    button.addEventListener('keydown', e => {
      let target = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          target = sheetTabs[(index + 1) % sheetTabs.length];
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          target = sheetTabs[(index - 1 + sheetTabs.length) % sheetTabs.length];
          break;
        case 'Home':
          target = sheetTabs[0];
          break;
        case 'End':
          target = sheetTabs[sheetTabs.length - 1];
          break;
        default:
          return;
      }
      e.preventDefault();
      activateSheetTab(target.dataset.tab);
      target.focus();
    });
  });

  // --- Progressão: todos os botões de ação (delegado) ---
  const progPanel = document.getElementById('tab-progressao');
  if (progPanel) {
    progPanel.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      switch (action) {
        case 'earn-pe':          addEvolutionPoints(); break;
        case 'buy-attribute':    increaseAttributeWithEvolution(); break;
        case 'buy-effort':       increaseResourceWithEvolution('effort'); break;
        case 'buy-connection':   increaseResourceWithEvolution('connection'); break;
        case 'create-skill':     createSkillWithEvolution(); break;
        case 'improve-skill':    improveSkillWithEvolution(); break;
        case 'create-maneuver':  createManeuverWithEvolution(); break;
        case 'create-technique': createForceTechniqueWithEvolution(); break;
        case 'create-ability':   createUniqueAbilityWithEvolution(); break;
        case 'use-maneuver':     useProgressionManeuver(id); break;
        case 'use-technique':    useProgressionTechnique(id); break;
        case 'remove-maneuver':  removeProgressionManeuver(id); break;
        case 'remove-technique': removeProgressionTechnique(id); break;
      }
    });

    // Prévias dinâmicas: atualizam ao trocar seleções (não alteram regras).
    progPanel.addEventListener('change', e => {
      const id = e.target && e.target.id;
      if (id === 'prog-attr-select')          updateAttrPreview();
      else if (id === 'prog-skill-select')    updateSkillPreview();
      else if (id === 'prog-maneuver-category') updateManeuverCost();
      else if (id === 'prog-tech-category')   updateTechniqueCost();
      else if (id === 'prog-ability-intensity') updateAbilityCost();
    });
  }

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

  // --- Árvore de Habilidades: trocar filtro de destaque ---
  const skillFilters = document.getElementById('skilltree-filters');
  if (skillFilters) {
    skillFilters.addEventListener('click', e => {
      const btn = e.target.closest('.skill-tree-filter-btn[data-filter]');
      if (btn) selectSkillTreeCategory(btn.dataset.filter);
    });
  }

  // --- Árvore de Habilidades: botão criar habilidade (toolbar) ---
  bindEvent('skilltree-create-btn', 'click', () => openSkillForm());

  // --- Árvore de Habilidades: centralizar a visão do mapa ---
  bindEvent('skilltree-center-btn', 'click', () => centerSkillTreeView());

  // --- Árvore de Habilidades: selecionar nó / criar pelo empty state ---
  const skillCanvas = document.getElementById('skilltree-map');
  if (skillCanvas) {
    skillCanvas.addEventListener('click', e => {
      const create = e.target.closest('[data-action="open-create"]');
      if (create) { openSkillForm(); return; }
      const node = e.target.closest('.skill-node[data-node-id]');
      if (node) selectSkillNode(node.dataset.nodeId);
    });
  }

  // --- Árvore de Habilidades: ações do painel de detalhes ---
  const skillDetails = document.getElementById('skilltree-details');
  if (skillDetails) {
    skillDetails.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      switch (action) {
        case 'open-create':   openSkillForm();           break;
        case 'buy-node':      buySkillNode(id);          break;
        case 'force-buy-node': buySkillNode(id, true);   break;
        case 'use-node':      useSkillNode(id);          break;
        case 'refund-node':   refundSkillNode(id);       break;
        case 'edit-node':     openSkillForm(id);         break;
        case 'delete-node':   requestDeleteSkillNode(id); break;
      }
    });
  }

  // --- Árvore de Habilidades: modal do formulário ---
  const skillModal = document.getElementById('skilltree-modal');
  if (skillModal) {
    skillModal.addEventListener('click', e => {
      if (e.target.closest('[data-action="close-form"]')) closeSkillForm();
    });
    skillModal.addEventListener('submit', e => {
      if (e.target && e.target.id === 'skill-form') {
        e.preventDefault();
        saveSkillForm();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !skillModal.hidden) closeSkillForm();
    });
  }

  // --- Auto-save silencioso disparado pela Árvore de Habilidades ---
  document.addEventListener('swrpg:autosave', persistSheetSilently);

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

  // --- Autosave opcional ---
  initAutosave();
}

/* ============================================================
   AUTOSAVE OPCIONAL (com debounce)
   ============================================================ */

const AUTOSAVE_PREF_KEY = 'swrpg-autosave';
let autosaveTimeout = null;

/** Lê se o autosave está ativo a partir do checkbox. */
function isAutosaveEnabled() {
  const chk = document.getElementById('chk-autosave');
  return !!(chk && chk.checked);
}

/**
 * Agenda um salvamento automático com debounce de 800ms.
 * Não interfere no salvamento manual.
 */
function scheduleAutosave() {
  if (!isAutosaveEnabled()) return;
  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(() => {
    saveSheet();
  }, 800);
}

/**
 * Configura o checkbox de autosave e os gatilhos de alteração.
 * Restaura a preferência salva e observa edições da ficha.
 */
function initAutosave() {
  const chk = document.getElementById('chk-autosave');
  if (chk) {
    chk.checked = localStorage.getItem(AUTOSAVE_PREF_KEY) === '1';
    chk.addEventListener('change', () => {
      localStorage.setItem(AUTOSAVE_PREF_KEY, chk.checked ? '1' : '0');
      if (chk.checked) {
        showStatus('Autosave ativado.', 'info', 2000);
        scheduleAutosave();
      } else {
        clearTimeout(autosaveTimeout);
        showStatus('Autosave desativado.', 'info', 2000);
      }
    });
  }

  // Alterações em campos de formulário disparam autosave com debounce.
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'chk-autosave') return;
    scheduleAutosave();
  });
  // Cliques de ação (adicionar/remover/comprar) que alteram listas e estado.
  document.addEventListener('click', e => {
    if (!e.target) return;
    const trigger = e.target.closest('button[data-action], .btn');
    if (trigger && trigger.id !== 'btn-load' && trigger.id !== 'btn-delete') {
      scheduleAutosave();
    }
  });
}

/**
 * Inicialização principal. Chamada uma única vez no DOMContentLoaded.
 */
function init() {
  initEventListeners();
  initAccordions();
  initPortraitDropzone();
  updateAttributeValidation(); // inicia com "Preencha os atributos"
  updateHpDisplay();           // inicia barra de HP em 0/0
  renderResources();           // inicia medidores de Esforço/Conexão
  renderSkills();
  renderAbilities();
  renderInventory();
  updateWeaponFormConstraints();
  renderRollHistory();
  renderPresetDefects();
  renderDefects();

  // Restaura o filtro salvo da Árvore de Habilidades e renderiza.
  setSkillTreeCategory(localStorage.getItem('skillTreeCategory') || 'todos');
  renderSkillTreePage();

  // Aba Progressão — render inicial.
  renderProgressionPage();

  // Restaura a aba ativa salva (padrão: "ficha")
  const savedSheetTab = localStorage.getItem(ACTIVE_TAB_KEY) || 'ficha';
  switchSheetTab(savedSheetTab);

  if (localStorage.getItem('swrpg-sheet')) {
    showStatus('💾 Ficha salva encontrada. Clique em "Carregar" para restaurar.', 'info', 7000);
  }

  console.log('%cSTAR WARS RPG — Ficha carregada com sucesso.', 'color: #f0c040; font-weight: bold;');
}

document.addEventListener('DOMContentLoaded', init);
