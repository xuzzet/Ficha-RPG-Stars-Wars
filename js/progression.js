/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   progression.js — Aba "Progressão" (Pontos de Evolução)

   Responsabilidade:
   - Economia de Pontos de Evolução (PE): ganhar e gastar.
   - Compras que ALTERAM AUTOMATICAMENTE a ficha real:
       • Aumentar atributo (+5 por 4 PE) → soma em attributeBonuses.
       • Criar perícia (Grau D, 2 PE) → entra na lista real de perícias.
       • Melhorar perícia (D→C→B→A→S) → muda o grau real.
       • Criar Manobra (gasta Esforço ao usar) → listada e usável aqui.
       • Criar Técnica da Força (gasta Conexão ao usar) → listada e usável aqui.
       • Criar Habilidade Única → entra na lista da aba Ficha.
   - Modificadores globais ativos, histórico e re-sincronização da UI.

   Tudo é persistido em sheetState (LocalStorage + JSON via storage.js).
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { createEntity, ENTITY_TYPES } from './state.js';
import { byId, getVal, getNum, generateId, escapeHtml } from './dom.js';
import {
  ATTR_KEYS, getAttrName, getAttributeBonus,
  getBaseAttributes, getFinalAttributes,
  updateAttributeValidation,
} from './attributes.js';
import { updateEffort, updateConnection, syncResourcesWithAttributes, renderResources } from './resources.js';
import { renderSkills } from './skills.js';
import { renderAbilities } from './abilities.js';
import { renderInventory } from './inventory.js';
import { updateHpDisplay, showStatus } from './ui.js';
import { addToHistory } from './dice.js';
import { icon } from './icons.js';

/* ============================================================
   TABELAS DE CUSTO
   ============================================================ */

/** Aumento de atributo: 4 PE concede +5 ao valor final. */
const ATTR_INCREASE_COST  = 4;
const ATTR_INCREASE_BONUS = 5;

/** Aumento de recurso: 2 PE concede +1 ao MÁXIMO de Esforço ou Conexão. */
const RESOURCE_INCREASE_COST  = 2;
const RESOURCE_INCREASE_BONUS = 1;

/** Ordem de progressão dos graus de perícia (pior → melhor). */
const SKILL_GRADE_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];

/** Custo em PE para ATINGIR cada grau (criar D = 2; demais = melhorias). */
const SKILL_GRADE_COST = { D: 2, C: 2, B: 3, A: 4, S: 5 };

/** Manobras — custo de criação (PE) e gasto de Esforço por uso. */
const MANEUVER_TABLE = {
  simples: { pe: 4,  resource: 1, label: 'Simples'        },
  avancada:{ pe: 8,  resource: 2, label: 'Avançada'       },
  rara:    { pe: 12, resource: 3, label: 'Rara / Secreta'  },
};

/** Técnicas da Força — custo de criação (PE) e gasto de Conexão por uso. */
const TECHNIQUE_TABLE = {
  simples: { pe: 6,  resource: 1, label: 'Simples'                  },
  avancada:{ pe: 12, resource: 2, label: 'Avançada'                 },
  rara:    { pe: 18, resource: 3, label: 'Rara / Secreta / Proibida' },
};

/** Habilidades Únicas — custo de criação (PE) por intensidade. */
const ABILITY_TABLE = {
  simples:     { pe: 10, label: 'Simples'      },
  forte:       { pe: 15, label: 'Forte'        },
  'muito-forte': { pe: 20, label: 'Muito Forte' },
};

/* ============================================================
   ESTADO / NORMALIZAÇÃO
   ============================================================ */

/** Garante que a estrutura de progressão exista (fichas antigas). */
function ensureProgression() {
  if (!sheetState.attributeBonuses) {
    sheetState.attributeBonuses = { vida: 0, corpo: 0, mente: 0, presenca: 0, espirito: 0 };
  }
  ATTR_KEYS.forEach(k => {
    if (typeof sheetState.attributeBonuses[k] !== 'number') sheetState.attributeBonuses[k] = 0;
  });

  if (!sheetState.resourceBonuses) sheetState.resourceBonuses = { effort: 0, connection: 0 };
  if (typeof sheetState.resourceBonuses.effort     !== 'number') sheetState.resourceBonuses.effort = 0;
  if (typeof sheetState.resourceBonuses.connection !== 'number') sheetState.resourceBonuses.connection = 0;

  if (!sheetState.progression) sheetState.progression = {};
  const p = sheetState.progression;
  if (typeof p.totalEarned !== 'number') p.totalEarned = 0;
  if (typeof p.spent       !== 'number') p.spent = 0;
  if (!Array.isArray(p.history))                p.history = [];
  if (!Array.isArray(p.createdManeuvers))       p.createdManeuvers = [];
  if (!Array.isArray(p.createdForceTechniques)) p.createdForceTechniques = [];
  return p;
}

/** PE disponíveis = total ganho − total gasto. */
export function getEvolutionPointsAvailable() {
  const p = ensureProgression();
  return p.totalEarned - p.spent;
}

/* ============================================================
   PERSISTÊNCIA (usada por storage.js)
   ============================================================ */

/** Coleta os dados de progressão para salvar/exportar. */
export function getProgressionData() {
  ensureProgression();
  return {
    attributeBonuses: { ...sheetState.attributeBonuses },
    resourceBonuses:  { ...sheetState.resourceBonuses },
    progression: {
      totalEarned:            sheetState.progression.totalEarned,
      spent:                  sheetState.progression.spent,
      history:                [...sheetState.progression.history],
      createdManeuvers:       [...sheetState.progression.createdManeuvers],
      createdForceTechniques: [...sheetState.progression.createdForceTechniques],
    },
  };
}

/** Aplica dados de progressão vindos de uma ficha salva/importada. */
export function applyProgressionData(data) {
  const b = (data && data.attributeBonuses) || {};
  sheetState.attributeBonuses = { vida: 0, corpo: 0, mente: 0, presenca: 0, espirito: 0 };
  ATTR_KEYS.forEach(k => { sheetState.attributeBonuses[k] = Number(b[k]) || 0; });

  const rb = (data && data.resourceBonuses) || {};
  sheetState.resourceBonuses = {
    effort:     Number(rb.effort) || 0,
    connection: Number(rb.connection) || 0,
  };

  const p = (data && data.progression) || {};
  sheetState.progression = {
    totalEarned:            Number(p.totalEarned) || 0,
    spent:                  Number(p.spent) || 0,
    history:                Array.isArray(p.history) ? p.history : [],
    createdManeuvers:       Array.isArray(p.createdManeuvers) ? p.createdManeuvers : [],
    createdForceTechniques: Array.isArray(p.createdForceTechniques) ? p.createdForceTechniques : [],
  };
}

/* ============================================================
   PONTOS DE EVOLUÇÃO — GANHAR / GASTAR
   ============================================================ */

/**
 * Registra um ganho de PE (lido do formulário "Ganhar PE").
 */
export function addEvolutionPoints() {
  const p      = ensureProgression();
  const amount = Math.trunc(getNum('prog-earn-amount'));
  const reason = getVal('prog-earn-reason').trim();
  const date   = getVal('prog-earn-date').trim() || new Date().toLocaleDateString('pt-BR');

  if (!amount || amount <= 0) {
    showStatus('Informe uma quantidade de PE maior que zero.', 'error');
    return;
  }

  p.totalEarned += amount;
  addProgressionHistoryEntry({
    type: 'earn', name: 'Ganho de PE', deltaPE: amount,
    effect: `+${amount} PE`, reason, date,
  });

  byId('prog-earn-amount').value = '';
  byId('prog-earn-reason').value = '';
  byId('prog-earn-date').value   = '';

  renderProgressionPage();
  showStatus(`+${amount} PE registrados.`, 'saved', 2000);
}

/**
 * Tenta gastar uma quantidade de PE. Se o saldo for insuficiente,
 * pede confirmação para registrar mesmo assim (saldo negativo).
 * @param {number} amount
 * @returns {boolean} true se o gasto foi confirmado
 */
function spendEvolutionPoints(amount) {
  const p     = ensureProgression();
  const avail = p.totalEarned - p.spent;
  if (amount > avail) {
    const ok = window.confirm(
      `PE insuficiente (disponível: ${avail}, necessário: ${amount}).\n` +
      'Deseja registrar mesmo assim com saldo negativo? Use apenas se o Mestre autorizou.'
    );
    if (!ok) return false;
  }
  p.spent += amount;
  return true;
}

/* ============================================================
   SINCRONIZAÇÃO DA FICHA
   ============================================================ */

/**
 * Recalcula tudo que depende dos atributos finais e atualiza a UI:
 * pontos por atributo, validação, Esforço/Conexão/Movimento e HP.
 */
function syncSheetAfterChange() {
  // updateAttributeValidation já recalcula pontos (final), sincroniza
  // recursos derivados e os re-renderiza.
  updateAttributeValidation();
  updateHpDisplay();
  // Re-renderiza o inventário para atualizar as fórmulas de dano das armas
  // com os atributos finais atuais (ex.: Corpo 50 → 60 muda 5d12+5 → 6d12+6).
  renderInventory();
}

/* ============================================================
   COMPRAS QUE ALTERAM A FICHA
   ============================================================ */

/** Aumenta um atributo: +5 ao valor final por 4 PE. */
export function increaseAttributeWithEvolution() {
  const p    = ensureProgression();
  const attr = getVal('prog-attr-select');
  if (!ATTR_KEYS.includes(attr)) {
    showStatus('Selecione um atributo válido.', 'error');
    return;
  }
  if (!spendEvolutionPoints(ATTR_INCREASE_COST)) return;

  sheetState.attributeBonuses[attr] += ATTR_INCREASE_BONUS;

  // PV: se a ficha usa Vida × 2, aumentar Vida concede +10 PV (máx. e atual).
  if (attr === 'vida') {
    const hpMaxEl = byId('hp-max');
    const hpCurEl = byId('hp-current');
    if (hpMaxEl) hpMaxEl.value = (Number(hpMaxEl.value) || 0) + ATTR_INCREASE_BONUS * 2;
    if (hpCurEl) hpCurEl.value = (Number(hpCurEl.value) || 0) + ATTR_INCREASE_BONUS * 2;
  }

  addProgressionHistoryEntry({
    type: 'attribute', name: `Aumento de ${getAttrName(attr)}`, deltaPE: -ATTR_INCREASE_COST,
    effect: `${getAttrName(attr)} +${ATTR_INCREASE_BONUS} (total Prog: +${sheetState.attributeBonuses[attr]})`,
    reason: '', date: new Date().toLocaleDateString('pt-BR'),
  });

  syncSheetAfterChange();
  renderProgressionPage();
  showStatus(`${getAttrName(attr)} aumentado em +${ATTR_INCREASE_BONUS}.`, 'saved', 2200);
}

/**
 * Aumenta o MÁXIMO de Esforço ou Conexão em +1 por 2 PE.
 * O bônus é permanente e somado ao máximo derivado dos atributos.
 * @param {'effort'|'connection'} resource
 */
export function increaseResourceWithEvolution(resource) {
  ensureProgression();
  if (resource !== 'effort' && resource !== 'connection') {
    showStatus('Recurso inválido.', 'error');
    return;
  }
  if (!spendEvolutionPoints(RESOURCE_INCREASE_COST)) return;

  sheetState.resourceBonuses[resource] += RESOURCE_INCREASE_BONUS;

  const label = resource === 'effort' ? 'Esforço' : 'Conexão';
  addProgressionHistoryEntry({
    type: 'resource', name: `Aumento de ${label}`, deltaPE: -RESOURCE_INCREASE_COST,
    effect: `${label} Máx. +${RESOURCE_INCREASE_BONUS} (total Prog: +${sheetState.resourceBonuses[resource]})`,
    reason: '', date: new Date().toLocaleDateString('pt-BR'),
  });

  // Recalcula os máximos (inclui o novo bônus) e recupera 1 ponto do
  // recurso para que o aumento do máximo fique imediatamente utilizável.
  syncResourcesWithAttributes();
  if (resource === 'effort')      sheetState.effortCurrent     = Math.min(sheetState.effortMax, sheetState.effortCurrent + RESOURCE_INCREASE_BONUS);
  else                            sheetState.connectionCurrent = Math.min(sheetState.connectionMax, sheetState.connectionCurrent + RESOURCE_INCREASE_BONUS);
  renderResources();

  renderProgressionPage();
  showStatus(`${label} Máximo aumentado em +${RESOURCE_INCREASE_BONUS}.`, 'saved', 2200);
}

/** Cria uma nova perícia em Grau D (2 PE) e a adiciona à lista real. */
export function createSkillWithEvolution() {
  ensureProgression();
  const name = getVal('prog-skill-name').trim();
  const attr = getVal('prog-skill-attr');
  const desc = getVal('prog-skill-desc').trim();
  const reason = getVal('prog-skill-reason').trim();

  if (!name) { showStatus('Informe o nome da nova perícia.', 'error'); return; }
  if (!ATTR_KEYS.includes(attr)) { showStatus('Selecione o atributo da perícia.', 'error'); return; }
  if (!spendEvolutionPoints(SKILL_GRADE_COST.D)) return;

  sheetState.skills.push(createEntity(ENTITY_TYPES.SKILL, {
    name, attr, grade: 'D', cost: 0, desc, source: 'progression',
  }));

  addProgressionHistoryEntry({
    type: 'skill-create', name: `Perícia criada: ${name}`, deltaPE: -SKILL_GRADE_COST.D,
    effect: `Nova perícia (${getAttrName(attr)}) em Grau D`, reason,
    date: new Date().toLocaleDateString('pt-BR'),
  });

  byId('prog-skill-name').value   = '';
  byId('prog-skill-desc').value   = '';
  byId('prog-skill-reason').value = '';

  renderSkills();
  syncSheetAfterChange();
  renderProgressionPage();
  showStatus(`Perícia "${name}" criada (Grau D).`, 'saved', 2200);
}

/** Próximo grau na progressão (ou null se já estiver no máximo). */
function getNextSkillGrade(grade) {
  const i = SKILL_GRADE_ORDER.indexOf(grade);
  if (i < 0) return 'D';
  if (i >= SKILL_GRADE_ORDER.length - 1) return null;
  return SKILL_GRADE_ORDER[i + 1];
}

/** Custo em PE para evoluir do grau atual para o próximo. */
function getSkillImprovementCost(currentGrade) {
  const next = getNextSkillGrade(currentGrade);
  return next ? (SKILL_GRADE_COST[next] || 0) : 0;
}

/** Melhora o grau da perícia selecionada (D→C→B→A→S). */
export function improveSkillWithEvolution() {
  ensureProgression();
  const id    = getVal('prog-skill-select');
  const skill = sheetState.skills.find(s => s.id === id);
  if (!skill) { showStatus('Selecione uma perícia para melhorar.', 'error'); return; }

  const next = getNextSkillGrade(skill.grade);
  if (!next) { showStatus(`"${skill.name}" já está no grau máximo (S).`, 'error'); return; }

  const cost = getSkillImprovementCost(skill.grade);
  if (!spendEvolutionPoints(cost)) return;

  const prev = skill.grade;
  skill.grade = next;

  addProgressionHistoryEntry({
    type: 'skill-improve', name: `Perícia melhorada: ${skill.name}`, deltaPE: -cost,
    effect: `Grau ${prev} → ${next}`, reason: '',
    date: new Date().toLocaleDateString('pt-BR'),
  });

  renderSkills();
  syncSheetAfterChange();
  renderProgressionPage();
  showStatus(`"${skill.name}" melhorada para Grau ${next}.`, 'saved', 2200);
}

/** Cria uma Manobra (listada e usável dentro desta aba). */
export function createManeuverWithEvolution() {
  const p        = ensureProgression();
  const name     = getVal('prog-maneuver-name').trim();
  const category = getVal('prog-maneuver-category');
  const action   = getVal('prog-maneuver-action');
  const desc     = getVal('prog-maneuver-desc').trim();
  const reason   = getVal('prog-maneuver-reason').trim();
  const def      = MANEUVER_TABLE[category];

  if (!name) { showStatus('Informe o nome da manobra.', 'error'); return; }
  if (!def)  { showStatus('Selecione a categoria da manobra.', 'error'); return; }
  if (!spendEvolutionPoints(def.pe)) return;

  sheetState.progression.createdManeuvers.push({
    id: generateId(), name, category, action, desc,
    cost: def.pe, resourceCost: def.resource,
  });

  addProgressionHistoryEntry({
    type: 'maneuver', name: `Manobra criada: ${name}`, deltaPE: -def.pe,
    effect: `${def.label} — gasta ${def.resource} Esforço por uso`, reason,
    date: new Date().toLocaleDateString('pt-BR'),
  });

  byId('prog-maneuver-name').value   = '';
  byId('prog-maneuver-desc').value   = '';
  byId('prog-maneuver-reason').value = '';

  renderProgressionPage();
  showStatus(`Manobra "${name}" criada.`, 'saved', 2200);
}

/** Cria uma Técnica da Força (listada e usável dentro desta aba). */
export function createForceTechniqueWithEvolution() {
  const p        = ensureProgression();
  const name     = getVal('prog-tech-name').trim();
  const category = getVal('prog-tech-category');
  const action   = getVal('prog-tech-action');
  const desc     = getVal('prog-tech-desc').trim();
  const reason   = getVal('prog-tech-reason').trim();
  const def      = TECHNIQUE_TABLE[category];

  if (!name) { showStatus('Informe o nome da técnica.', 'error'); return; }
  if (!def)  { showStatus('Selecione a categoria da técnica.', 'error'); return; }
  if (category === 'rara' && !reason) {
    showStatus('Técnicas Raras/Proibidas exigem justificativa do Mestre.', 'error');
    return;
  }
  if (!spendEvolutionPoints(def.pe)) return;

  sheetState.progression.createdForceTechniques.push({
    id: generateId(), name, category, action, desc,
    cost: def.pe, resourceCost: def.resource,
  });

  addProgressionHistoryEntry({
    type: 'technique', name: `Técnica criada: ${name}`, deltaPE: -def.pe,
    effect: `${def.label} — gasta ${def.resource} Conexão por uso`, reason,
    date: new Date().toLocaleDateString('pt-BR'),
  });

  byId('prog-tech-name').value   = '';
  byId('prog-tech-desc').value   = '';
  byId('prog-tech-reason').value = '';

  renderProgressionPage();
  showStatus(`Técnica "${name}" criada.`, 'saved', 2200);
}

/** Cria uma Habilidade Única e a adiciona à lista da aba Ficha. */
export function createUniqueAbilityWithEvolution() {
  ensureProgression();
  const name      = getVal('prog-ability-name').trim();
  const attr      = getVal('prog-ability-attr');
  const intensity = getVal('prog-ability-intensity');
  const freq      = getVal('prog-ability-freq');
  const effect    = getVal('prog-ability-desc').trim();
  const reason    = getVal('prog-ability-reason').trim();
  const def       = ABILITY_TABLE[intensity];

  if (!name) { showStatus('Informe o nome da habilidade única.', 'error'); return; }
  if (!ATTR_KEYS.includes(attr)) { showStatus('Selecione o atributo associado.', 'error'); return; }
  if (!def) { showStatus('Selecione a intensidade da habilidade.', 'error'); return; }
  if (!spendEvolutionPoints(def.pe)) return;

  const descParts = [`[${def.label}]`];
  if (effect) descParts.push(effect);
  if (reason) descParts.push(`Justificativa: ${reason}`);

  sheetState.abilities.push(createEntity(ENTITY_TYPES.ABILITY, {
    name, attr, cost: 0, freq, extraCost: 'nenhum',
    desc: descParts.join(' — '), used: false, source: 'progression',
  }));

  addProgressionHistoryEntry({
    type: 'ability', name: `Habilidade Única criada: ${name}`, deltaPE: -def.pe,
    effect: `${def.label} (${getAttrName(attr)})`, reason,
    date: new Date().toLocaleDateString('pt-BR'),
  });

  byId('prog-ability-name').value   = '';
  byId('prog-ability-desc').value   = '';
  byId('prog-ability-reason').value = '';

  renderAbilities();
  renderProgressionPage();
  showStatus(`Habilidade Única "${name}" criada e adicionada à Ficha.`, 'saved', 2400);
}

/* ============================================================
   USAR MANOBRAS / TÉCNICAS (gastam recurso)
   ============================================================ */

/** Usa uma manobra: gasta Esforço, se houver o suficiente. */
export function useProgressionManeuver(id) {
  const m = sheetState.progression.createdManeuvers.find(x => x.id === id);
  if (!m) return;
  if (sheetState.effortCurrent < m.resourceCost) {
    showStatus(`Esforço insuficiente para "${m.name}" (precisa de ${m.resourceCost}).`, 'error');
    return;
  }
  updateEffort(-m.resourceCost);
  addToHistory({
    name: `Manobra: ${m.name}`, grade: null, rolls: [], result: null,
    attrValue: sheetState.effortCurrent, success: true, isAutoSuccess: true, type: 'maneuver',
  });
  showStatus(`Manobra "${m.name}" usada (−${m.resourceCost} Esforço).`, 'info', 2200);
}

/** Usa uma técnica: gasta Conexão, se houver o suficiente. */
export function useProgressionTechnique(id) {
  const t = sheetState.progression.createdForceTechniques.find(x => x.id === id);
  if (!t) return;
  if (sheetState.connectionCurrent < t.resourceCost) {
    showStatus(`Conexão insuficiente para "${t.name}" (precisa de ${t.resourceCost}).`, 'error');
    return;
  }
  updateConnection(-t.resourceCost);
  addToHistory({
    name: `Técnica: ${t.name}`, grade: null, rolls: [], result: null,
    attrValue: sheetState.connectionCurrent, success: true, isAutoSuccess: true, type: 'technique',
  });
  showStatus(`Técnica "${t.name}" usada (−${t.resourceCost} Conexão).`, 'info', 2200);
}

/** Remove uma manobra criada (não devolve PE). */
export function removeProgressionManeuver(id) {
  const m = sheetState.progression.createdManeuvers.find(x => x.id === id);
  if (!m) return;
  if (!window.confirm(`Remover a manobra "${m.name}"? Os PE gastos não são devolvidos.`)) return;
  sheetState.progression.createdManeuvers =
    sheetState.progression.createdManeuvers.filter(x => x.id !== id);
  renderProgressionPage();
}

/** Remove uma técnica criada (não devolve PE). */
export function removeProgressionTechnique(id) {
  const t = sheetState.progression.createdForceTechniques.find(x => x.id === id);
  if (!t) return;
  if (!window.confirm(`Remover a técnica "${t.name}"? Os PE gastos não são devolvidos.`)) return;
  sheetState.progression.createdForceTechniques =
    sheetState.progression.createdForceTechniques.filter(x => x.id !== id);
  renderProgressionPage();
}

/* ============================================================
   HISTÓRICO
   ============================================================ */

/** Adiciona uma entrada ao histórico de progressão (mais recente primeiro). */
export function addProgressionHistoryEntry(entry) {
  const p = ensureProgression();
  p.history.unshift({ id: generateId(), ...entry });
}

/* ============================================================
   RENDERIZAÇÃO
   ============================================================ */

/** Resumo de PE (ganhos / gastos / disponíveis / melhorias aplicadas). */
function renderProgressionSummary() {
  const p     = ensureProgression();
  const avail = p.totalEarned - p.spent;
  const set = (id, v) => { const el = byId(id); if (el) el.textContent = v; };
  set('prog-total-earned', p.totalEarned);
  set('prog-spent', p.spent);
  set('prog-available', avail);

  // "Melhorias aplicadas" = toda entrada de histórico que não é ganho de PE.
  const improvements = p.history.filter(h => h.type && h.type !== 'earn').length;
  set('prog-improvements', improvements);

  const card = byId('prog-available-card');
  if (card) card.classList.toggle('prog-negative', avail < 0);
}

/** Painel de "Modificadores Globais Ativos" (diagnóstico da ficha). */
function renderGlobalModifiers() {
  const container = byId('prog-modifiers');
  if (!container) return;
  const p = ensureProgression();

  const createdSkills    = sheetState.skills.filter(s => s.source === 'progression').length;
  const improvedSkills   = p.history.filter(h => h.type === 'skill-improve').length;
  const createdAbilities = sheetState.abilities.filter(a => a.source === 'progression').length;
  const createdManeuvers = p.createdManeuvers.length;
  const createdTechs     = p.createdForceTechniques.length;

  const totalAttrBonus = ATTR_KEYS.reduce((sum, k) => sum + getAttributeBonus(k), 0);
  const hasAny = totalAttrBonus > 0 || createdSkills || improvedSkills ||
    createdManeuvers || createdTechs || createdAbilities;

  if (!hasAny) {
    container.innerHTML = '<p class="empty-message">Nenhum modificador de progressão aplicado ainda.</p>';
    return;
  }

  const attrRows = ATTR_KEYS.map(k => {
    const bonus = getAttributeBonus(k);
    const zero  = bonus > 0 ? '' : ' is-zero';
    return `<li class="${zero.trim()}"><span>${getAttrName(k)}</span><b>+${bonus}</b></li>`;
  }).join('');

  const counters = [
    ['Perícias criadas',    createdSkills],
    ['Perícias melhoradas', improvedSkills],
    ['Manobras criadas',    createdManeuvers],
    ['Técnicas criadas',    createdTechs],
    ['Habilidades Únicas',  createdAbilities],
  ].map(([label, n]) => {
    const zero = n > 0 ? '' : 'is-zero';
    return `<li class="${zero}"><span>${label}</span><b>${n}</b></li>`;
  }).join('');

  container.innerHTML = `
    <h4 class="prog-mod-subtitle">Bônus de Atributo</h4>
    <ul class="prog-mod-list">${attrRows}</ul>
    <h4 class="prog-mod-subtitle">Aquisições</h4>
    <ul class="prog-mod-list">${counters}</ul>
  `;
}

/* ============================================================
   PRÉVIAS DINÂMICAS (apenas leitura — não alteram regras)
   ============================================================ */

/** Atualiza a prévia "Aumentar Atributo" (base · prog · final → final+5). */
export function updateAttrPreview() {
  const el = byId('prog-attr-preview');
  if (!el) return;
  const key = getVal('prog-attr-select');
  if (!key) { el.textContent = ''; return; }

  const base  = getBaseAttributes()[key] || 0;
  const bonus = getAttributeBonus(key);
  const final = base + bonus;
  const next  = final + ATTR_INCREASE_BONUS;

  el.classList.remove('prog-preview--warn');
  el.innerHTML =
    `Base <b>${base}</b> · Prog <b>+${bonus}</b> · Final <b>${final}</b> ` +
    `→ após compra: <span class="prog-preview-future">${next}</span>`;
}

/** Atualiza a prévia "Melhorar Perícia" (grau atual → próximo + custo). */
export function updateSkillPreview() {
  const el = byId('prog-skill-preview');
  if (!el) return;
  const id    = getVal('prog-skill-select');
  const skill = sheetState.skills.find(s => s.id === id);

  el.classList.remove('prog-preview--warn');
  if (!skill) { el.textContent = ''; return; }

  const next = getNextSkillGrade(skill.grade);
  if (!next) {
    el.classList.add('prog-preview--warn');
    el.innerHTML = `<b>${escapeHtml(skill.name)}</b> já está no grau máximo (S).`;
    return;
  }
  const cost = getSkillImprovementCost(skill.grade);
  el.innerHTML =
    `<b>${escapeHtml(skill.name)}</b>: Grau ${skill.grade} ` +
    `→ <span class="prog-preview-future">${next}</span> · custo <b>${cost} PE</b>`;
}

/** Atualiza a prévia de custo de Manobra conforme a categoria. */
export function updateManeuverCost() {
  const el = byId('prog-maneuver-cost');
  if (!el) return;
  const def = MANEUVER_TABLE[getVal('prog-maneuver-category')];
  if (!def) { el.textContent = ''; return; }
  el.innerHTML = `Custo: <b>${def.pe} PE</b> · usa <b>${def.resource} Esforço</b> por ativação`;
}

/** Atualiza a prévia de custo de Técnica conforme a categoria. */
export function updateTechniqueCost() {
  const el = byId('prog-tech-cost');
  if (!el) return;
  const def = TECHNIQUE_TABLE[getVal('prog-tech-category')];
  if (!def) { el.textContent = ''; return; }
  el.innerHTML = `Custo: <b>${def.pe} PE</b> · usa <b>${def.resource} Conexão</b> por ativação`;
}

/** Atualiza a prévia de custo de Habilidade Única conforme a intensidade. */
export function updateAbilityCost() {
  const el = byId('prog-ability-cost');
  if (!el) return;
  const def = ABILITY_TABLE[getVal('prog-ability-intensity')];
  if (!def) { el.textContent = ''; return; }
  el.innerHTML = `Custo: <b>${def.pe} PE</b> · intensidade ${escapeHtml(def.label)}`;
}

/** Atualiza todas as prévias dinâmicas de uma vez. */
export function updateProgressionPreviews() {
  updateAttrPreview();
  updateSkillPreview();
  updateManeuverCost();
  updateTechniqueCost();
  updateAbilityCost();
}

/** Popula o seletor de perícias a melhorar e a prévia de custo. */
function renderImproveSkillSelect() {
  const select = byId('prog-skill-select');
  if (!select) return;
  const prev = select.value;

  const options = sheetState.skills.map(s => {
    const next = getNextSkillGrade(s.grade);
    const label = next
      ? `${s.name} — Grau ${s.grade} → ${next} (${getSkillImprovementCost(s.grade)} PE)`
      : `${s.name} — Grau ${s.grade} (máximo)`;
    return `<option value="${s.id}">${escapeHtml(label)}</option>`;
  }).join('');

  select.innerHTML = sheetState.skills.length
    ? options
    : '<option value="">Nenhuma perícia disponível</option>';

  if (prev && sheetState.skills.some(s => s.id === prev)) select.value = prev;
}

/** Lista de manobras criadas (com botões Usar / Remover). */
function renderProgressionManeuvers() {
  const container = byId('prog-maneuvers-list');
  if (!container) return;
  const list = sheetState.progression.createdManeuvers;

  if (!list.length) {
    container.innerHTML = '<p class="empty-message">Nenhuma manobra criada ainda.</p>';
    return;
  }

  container.innerHTML = list.map(m => {
    const def = MANEUVER_TABLE[m.category] || { label: m.category };
    const disabled = sheetState.effortCurrent < m.resourceCost ? 'disabled' : '';
    return `
      <article class="prog-power-card">
        <div class="prog-power-head">
          <h5 class="prog-power-name">${escapeHtml(m.name)}</h5>
          <span class="prog-power-tag">${escapeHtml(def.label)}</span>
        </div>
        <p class="prog-power-meta icon-label">${icon('esforco')} Gasta <b>${m.resourceCost}</b> Esforço · ${escapeHtml(m.action || 'Ação')}</p>
        ${m.desc ? `<p class="prog-power-desc">${escapeHtml(m.desc)}</p>` : ''}
        <div class="prog-power-actions">
          <button type="button" class="btn btn--roll btn--sm icon-button" data-action="use-maneuver" data-id="${m.id}" ${disabled}>${icon('usar')} Usar (−${m.resourceCost} Esforço)</button>
          <button type="button" class="btn btn--dim btn--sm" data-action="remove-maneuver" data-id="${m.id}">${icon('remover')}</button>
        </div>
      </article>`;
  }).join('');
}

/** Lista de técnicas criadas (com botões Usar / Remover). */
function renderProgressionTechniques() {
  const container = byId('prog-techniques-list');
  if (!container) return;
  const list = sheetState.progression.createdForceTechniques;

  if (!list.length) {
    container.innerHTML = '<p class="empty-message">Nenhuma técnica criada ainda.</p>';
    return;
  }

  container.innerHTML = list.map(t => {
    const def = TECHNIQUE_TABLE[t.category] || { label: t.category };
    const disabled = sheetState.connectionCurrent < t.resourceCost ? 'disabled' : '';
    return `
      <article class="prog-power-card prog-power-card--force">
        <div class="prog-power-head">
          <h5 class="prog-power-name">${escapeHtml(t.name)}</h5>
          <span class="prog-power-tag">${escapeHtml(def.label)}</span>
        </div>
        <p class="prog-power-meta icon-label">${icon('conexao')} Gasta <b>${t.resourceCost}</b> Conexão · ${escapeHtml(t.action || 'Ação')}</p>
        ${t.desc ? `<p class="prog-power-desc">${escapeHtml(t.desc)}</p>` : ''}
        <div class="prog-power-actions">
          <button type="button" class="btn btn--roll btn--sm icon-button" data-action="use-technique" data-id="${t.id}" ${disabled}>${icon('usar')} Usar (−${t.resourceCost} Conexão)</button>
          <button type="button" class="btn btn--dim btn--sm" data-action="remove-technique" data-id="${t.id}">${icon('remover')}</button>
        </div>
      </article>`;
  }).join('');
}

/** Mapa tipo → rótulo/ícone (Lucide) para o histórico. */
const HISTORY_META = {
  earn:          { icon: 'star',          cls: 'is-earn',    label: 'Ganho' },
  attribute:     { icon: 'diamond',       cls: 'is-spend',   label: 'Atributo' },
  'skill-create':{ icon: 'plus',          cls: 'is-spend',   label: 'Perícia' },
  'skill-improve':{ icon: 'chevron-up',   cls: 'is-spend',   label: 'Perícia' },
  maneuver:      { icon: 'zap',           cls: 'is-spend',   label: 'Manobra' },
  technique:     { icon: 'sparkles',      cls: 'is-spend',   label: 'Técnica' },
  ability:       { icon: 'hexagon',       cls: 'is-spend',   label: 'Habilidade' },
};

/** Histórico cronológico de toda a progressão. */
function renderProgressionHistory() {
  const container = byId('prog-history');
  if (!container) return;
  const p = ensureProgression();

  if (!p.history.length) {
    container.innerHTML = '<p class="empty-message">Nenhuma evolução registrada ainda.</p>';
    return;
  }

  container.innerHTML = p.history.map(h => {
    const meta  = HISTORY_META[h.type] || { icon: 'circle', cls: '', label: '' };
    const delta = Number(h.deltaPE) || 0;
    const deltaStr = delta > 0 ? `+${delta} PE` : `${delta} PE`;
    const deltaCls = delta >= 0 ? 'prog-delta-pos' : 'prog-delta-neg';
    return `
      <div class="prog-history-row ${meta.cls}">
        <span class="prog-history-icon" aria-hidden="true">${icon(meta.icon)}</span>
        <div class="prog-history-body">
          <div class="prog-history-top">
            <span class="prog-history-name">${escapeHtml(h.name || '')}</span>
            <span class="prog-history-delta ${deltaCls}">${deltaStr}</span>
          </div>
          ${h.effect ? `<p class="prog-history-effect">${escapeHtml(h.effect)}</p>` : ''}
          ${h.reason ? `<p class="prog-history-reason">“${escapeHtml(h.reason)}”</p>` : ''}
          <p class="prog-history-date">${escapeHtml(h.date || '')}</p>
        </div>
      </div>`;
  }).join('');
}

/** Render mestre de toda a aba Progressão. */
export function renderProgressionPage() {
  ensureProgression();
  renderProgressionSummary();
  renderGlobalModifiers();
  renderImproveSkillSelect();
  renderProgressionManeuvers();
  renderProgressionTechniques();
  renderProgressionHistory();
  updateProgressionPreviews();
}
