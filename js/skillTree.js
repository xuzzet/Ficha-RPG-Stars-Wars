/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   skillTree.js — Árvore de Habilidades (dinâmica)

   Responsabilidade:
   - Manter uma árvore RADIAL onde o jogador CRIA as próprias
     habilidades, manobras e técnicas (com aprovação do Mestre).
   - A árvore começa vazia: apenas o Núcleo central e os hubs de
     categoria (Sobrevivência, Combate, Força, Social, Técnica) são
     âncoras visuais fixas — NÃO são habilidades compráveis.
   - Cada habilidade criada vira um nó dinâmico, posicionado
     automaticamente em torno do hub da sua categoria.
   - Comprar nós usando Pontos de Defeito (sem pré-requisitos).
   - Usar habilidades ativas gastando Esforço / Conexão (ou registrar
     o uso quando o recurso não é rastreado).
   - Salvar/carregar/exportar/importar via sheetState.skillTree.

   As trilhas entre os nós são apenas organização visual/temática —
   nunca bloqueiam a compra de nenhuma habilidade.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, escapeHtml, generateId, getVal, getNum } from './dom.js';
import { showStatus } from './ui.js';
import { calculateDefectPoints } from './defects.js';
import { updateEffort, updateConnection } from './resources.js';
import { addToHistory } from './dice.js';

/* ------------------------------------------------------------
   CONSTANTES DE DOMÍNIO
------------------------------------------------------------ */
export const SKILL_TREE_VERSION = 2;

/* Centro do canvas (coordenadas em % de 0 a 100). */
const CENTER = 50;

/* Núcleo central — âncora visual (não é comprado). */
export const CORE_NODE = {
  id: '__core__',
  label: 'Núcleo do Personagem',
  icon: '◈',
};

/* Hubs de categoria — âncoras visuais (não são compráveis).
   O ângulo (graus) define o setor da árvore para aquela categoria. */
export const SKILL_TREE_HUBS = [
  { id: 'hub-survival', label: 'Sobrevivência', category: 'Sobrevivência', icon: '🛡', angle: 180 }, // esquerda
  { id: 'hub-combat',   label: 'Combate',       category: 'Combate',       icon: '⚔', angle: 0   }, // direita
  { id: 'hub-force',    label: 'Força',          category: 'Força',         icon: '✦', angle: 90  }, // inferior
  { id: 'hub-social',   label: 'Social',         category: 'Social',        icon: '☷', angle: 225 }, // superior esquerdo
  { id: 'hub-tech',     label: 'Técnica',        category: 'Técnica',       icon: '⚙', angle: 315 }, // superior direito
];

/* Posiciona os hubs (x/y em %) num raio fixo a partir do centro. */
const HUB_RADIUS = 14;
SKILL_TREE_HUBS.forEach(h => {
  const rad = h.angle * Math.PI / 180;
  h.x = +(CENTER + HUB_RADIUS * Math.cos(rad)).toFixed(2);
  h.y = +(CENTER + HUB_RADIUS * Math.sin(rad)).toFixed(2);
});

/* Categorias e subcategorias sugeridas (organização da árvore). */
export const SKILL_CATEGORIES = [
  { id: 'Sobrevivência', subs: ['Defesa', 'Mobilidade', 'Resistência', 'Recuperação'] },
  { id: 'Combate',       subs: ['Corpo a corpo', 'Armas leves', 'Armas pesadas', 'Precisão', 'Controle de área', 'Reação'] },
  { id: 'Força',         subs: ['Instinto', 'Controle', 'Telecinese', 'Defesa', 'Lado Sombrio', 'Meditação'] },
  { id: 'Social',        subs: ['Enganação', 'Intimidação', 'Negociação', 'Liderança', 'Manipulação'] },
  { id: 'Técnica',       subs: ['Pilotagem', 'Mecânica', 'Hacking', 'Medicina', 'Sensores', 'Exploração'] },
];

/* Opções do formulário de criação. */
export const SKILL_TYPES     = ['Manobra', 'Técnica da Força', 'Habilidade Única', 'Passiva', 'Reação', 'Outro'];
export const SKILL_MODES     = ['Ativa', 'Passiva', 'Reação'];
export const SKILL_RESOURCES = ['Nenhum', 'Esforço', 'Conexão', 'Créditos', 'Carga', 'Outro'];
export const SKILL_ACTIONS   = ['Livre', 'Movimento', 'Padrão', 'Reação', 'Passiva', 'Especial'];

/* Filtros da aba (organização visual — nenhum filtro bloqueia compra). */
export const SKILL_FILTERS = [
  { id: 'todos',         label: 'Todos'         },
  { id: 'Sobrevivência', label: 'Sobrevivência' },
  { id: 'Combate',       label: 'Combate'       },
  { id: 'Força',         label: 'Força'         },
  { id: 'Social',        label: 'Social'        },
  { id: 'Técnica',       label: 'Técnica'       },
  { id: 'compradas',     label: 'Compradas'     },
  { id: 'disponiveis',   label: 'Disponíveis'   },
  { id: 'avisos',        label: 'Avisos'        },
];
const FILTER_IDS = SKILL_FILTERS.map(f => f.id);

/* ------------------------------------------------------------
   ESTADO
------------------------------------------------------------ */
/** Estado-padrão da árvore (vazia, só com núcleo + hubs). */
function defaultSkillTreeState() {
  return {
    version:              SKILL_TREE_VERSION,
    customNodes:          [],
    selectedNodeId:       null,
    activeFilter:         'todos',
    migratedFromExamples: false,
  };
}

/** Retorna (criando se necessário) o estado da árvore no sheetState. */
function getState() {
  if (!sheetState.skillTree || typeof sheetState.skillTree !== 'object') {
    sheetState.skillTree = defaultSkillTreeState();
  }
  if (!Array.isArray(sheetState.skillTree.customNodes)) {
    sheetState.skillTree.customNodes = [];
  }
  return sheetState.skillTree;
}

/** Acesso externo ao estado completo (persistência). */
export function getSkillTreeState() {
  return getState();
}

/* ------------------------------------------------------------
   FILTRO ATIVO (usado pela persistência e pelos botões)
------------------------------------------------------------ */
export function getSkillTreeCategory() {
  return getState().activeFilter || 'todos';
}
export function setSkillTreeCategory(filterId) {
  getState().activeFilter = (filterId && FILTER_IDS.includes(filterId)) ? filterId : 'todos';
}

/* ------------------------------------------------------------
   CONSULTAS BÁSICAS
------------------------------------------------------------ */
function getNodeById(id) {
  return getState().customNodes.find(n => n.id === id) || null;
}
function getHubByCategory(category) {
  return SKILL_TREE_HUBS.find(h => h.category === category) || null;
}
function subcategoriasFor(category) {
  const c = SKILL_CATEGORIES.find(x => x.id === category);
  return c ? c.subs : [];
}
function isDarkSide(node) {
  return node.subcategoria === 'Lado Sombrio';
}
function nodeHasWarning(node) {
  return !!(node.aviso && String(node.aviso).trim()) || isDarkSide(node);
}
function nodeMatchesFilter(node, filter) {
  switch (filter) {
    case 'compradas':   return !!node.comprada;
    case 'disponiveis': return !node.comprada;
    case 'avisos':      return nodeHasWarning(node);
    case 'todos':       return true;
    default:            return node.categoria === filter; // filtros por categoria
  }
}

/** Converte um custo de compra na camada concêntrica (1, 2 ou 3). */
function costToLayer(cost) {
  const c = Number(cost) || 0;
  if (c >= 5) return 3;
  if (c >= 3) return 2;
  return 1;
}

/** Ícone padrão do nó conforme tipo/modo (visual técnico). */
function iconForNode(node) {
  if (node.cor && String(node.cor).trim()) return node.cor;
  if (node.modo === 'Passiva') return '◇';
  switch (node.tipo) {
    case 'Técnica da Força': return '✦';
    case 'Habilidade Única': return '★';
    case 'Manobra':          return '⚔';
    case 'Reação':           return '↩';
    default:                 return '◆';
  }
}

/** Slug de categoria → classe de cor das trilhas SVG. */
function catSlug(category) {
  return ({
    'Sobrevivência': 'sobrevivencia',
    'Combate':       'combate',
    'Força':         'forca',
    'Social':        'social',
    'Técnica':       'tecnica',
  })[category] || 'core';
}

/* ------------------------------------------------------------
   NORMALIZAÇÃO DE NÓ
   Garante todos os campos e aplica as regras de passiva.
------------------------------------------------------------ */
function normalizeNode(raw) {
  const r = (raw && typeof raw === 'object') ? raw : {};

  const tipo = SKILL_TYPES.includes(r.tipo) ? r.tipo : 'Manobra';
  let modo   = SKILL_MODES.includes(r.modo) ? r.modo : (tipo === 'Passiva' ? 'Passiva' : 'Ativa');

  let recursoUso = SKILL_RESOURCES.includes(r.recursoUso) ? r.recursoUso : 'Nenhum';
  let custoUso    = Math.max(0, Number(r.custoUso) || 0);
  const custoCompra = Math.max(0, Number(r.custoCompra) || 0);

  // Regra: passiva não gasta recurso de uso.
  if (modo === 'Passiva') { custoUso = 0; recursoUso = 'Nenhum'; }

  const categoria = SKILL_CATEGORIES.some(c => c.id === r.categoria) ? r.categoria : 'Combate';
  const subs = subcategoriasFor(categoria);
  const subcategoria = (typeof r.subcategoria === 'string' && subs.includes(r.subcategoria)) ? r.subcategoria : '';

  return {
    id:           r.id || `skill-${generateId()}`,
    nome:         (String(r.nome || '').trim()) || 'Habilidade sem nome',
    categoria,
    subcategoria,
    tipo,
    modo,
    custoCompra,
    custoUso,
    recursoUso,
    acao:         SKILL_ACTIONS.includes(r.acao) ? r.acao : (modo === 'Passiva' ? 'Passiva' : 'Padrão'),
    descricao:    String(r.descricao || ''),
    efeito:       String(r.efeito || ''),
    aviso:        String(r.aviso || ''),
    comprada:     !!r.comprada,
    criadaEm:     Number(r.criadaEm) || Date.now(),
    atualizadaEm: Number(r.atualizadaEm) || Date.now(),
    x:            (typeof r.x === 'number') ? r.x : null,
    y:            (typeof r.y === 'number') ? r.y : null,
    layer:        (typeof r.layer === 'number') ? r.layer : null,
    cor:          String(r.cor || ''),
  };
}

/* ------------------------------------------------------------
   LAYOUT RADIAL (posicionamento automático)
   - Cada categoria ocupa um setor angular em torno do seu hub.
   - O custo de compra define a camada (distância do centro).
   - Passivas sobem levemente no eixo; reações descem levemente.
------------------------------------------------------------ */
const SECTOR_HALF      = 42;  // meia-abertura (graus) do leque de cada categoria
const NODE_BASE_RADIUS = 24;  // raio (%) da camada 1
const NODE_LAYER_STEP  = 9;   // distância (%) entre camadas

/**
 * Calcula x/y (em %) de cada nó conforme categoria, quantidade e custo.
 * @param {Array} [customNodes]
 */
export function calculateRadialLayout(customNodes = getState().customNodes) {
  SKILL_CATEGORIES.forEach(cat => {
    const hub = getHubByCategory(cat.id);
    if (!hub) return;

    const baseAngle = Math.atan2(hub.y - CENTER, hub.x - CENTER);
    const list = customNodes
      .filter(n => n.categoria === cat.id)
      .sort((a, b) =>
        (a.subcategoria || '').localeCompare(b.subcategoria || '', 'pt') ||
        costToLayer(a.custoCompra) - costToLayer(b.custoCompra) ||
        (a.nome || '').localeCompare(b.nome || '', 'pt'));

    const n = list.length;

    list.forEach((node, i) => {
      const layer = costToLayer(node.custoCompra);
      const t = (n <= 1) ? 0.5 : (i + 0.5) / n;
      let angle = baseAngle + (SECTOR_HALF * Math.PI / 180) * (2 * t - 1);

      // Passiva levemente "acima" do eixo; reação levemente "abaixo".
      if (node.modo === 'Passiva')                              angle -= 6 * Math.PI / 180;
      else if (node.modo === 'Reação' || node.acao === 'Reação') angle += 6 * Math.PI / 180;

      const radius = NODE_BASE_RADIUS + (layer - 1) * NODE_LAYER_STEP;
      node.x = +(CENTER + radius * Math.cos(angle)).toFixed(2);
      node.y = +(CENTER + radius * Math.sin(angle)).toFixed(2);
      node.layer = layer;
    });
  });
}

/* ------------------------------------------------------------
   PONTOS (Pontos de Defeito — NÃO confundir com Pontos de Evolução)
------------------------------------------------------------ */
/** Soma o custo de compra de todos os nós já comprados. */
export function calculateSkillTreeSpentPoints() {
  return getState().customNodes.reduce(
    (sum, n) => sum + (n.comprada ? (Number(n.custoCompra) || 0) : 0), 0);
}
/** Pontos disponíveis = Pontos de Defeito totais − pontos gastos na árvore. */
export function calculateSkillTreeAvailablePoints() {
  return calculateDefectPoints() - calculateSkillTreeSpentPoints();
}
/* Alias compatível. */
export const calculateSkillTreeRemainingPoints = calculateSkillTreeAvailablePoints;

/* ------------------------------------------------------------
   STATUS
------------------------------------------------------------ */
export function getSkillNodeStatus(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return 'available';
  return node.comprada ? 'unlocked' : 'available';
}

/* ------------------------------------------------------------
   PERSISTÊNCIA AUTOMÁTICA
   Emite um evento que o main.js liga ao salvamento silencioso, para
   evitar dependência circular com storage.js.
------------------------------------------------------------ */
function persist() {
  try {
    document.dispatchEvent(new CustomEvent('swrpg:autosave'));
  } catch (_) { /* ambiente sem CustomEvent — ignora */ }
}

/* ------------------------------------------------------------
   CRUD DE HABILIDADES
------------------------------------------------------------ */
/**
 * Cria um novo nó dinâmico a partir dos dados do formulário.
 * @param {object} data
 * @returns {object} o nó criado
 */
export function createSkillNode(data) {
  const node = normalizeNode({
    ...data,
    id:       data && data.id ? data.id : `skill-${generateId()}`,
    criadaEm: Date.now(),
    atualizadaEm: Date.now(),
  });
  getState().customNodes.push(node);
  getState().selectedNodeId = node.id;
  persist();
  renderSkillTreePage();
  return node;
}

/**
 * Atualiza um nó existente.
 * @param {string} nodeId
 * @param {object} data
 * @returns {object|null}
 */
export function updateSkillNode(nodeId, data) {
  const node = getNodeById(nodeId);
  if (!node) return null;
  const updated = normalizeNode({
    ...node,
    ...data,
    id:       node.id,
    criadaEm: node.criadaEm,
    atualizadaEm: Date.now(),
  });
  Object.assign(node, updated);
  getState().selectedNodeId = node.id;
  persist();
  renderSkillTreePage();
  return node;
}

/**
 * Remove um nó da árvore (sem confirmação — ver requestDeleteSkillNode).
 * Como os pontos gastos derivam dos nós comprados, a remoção devolve
 * automaticamente os pontos.
 * @param {string} nodeId
 */
export function deleteSkillNode(nodeId) {
  const list = getState().customNodes;
  const idx = list.findIndex(n => n.id === nodeId);
  if (idx === -1) return;
  list.splice(idx, 1);
  if (getState().selectedNodeId === nodeId) getState().selectedNodeId = null;
  persist();
  renderSkillTreePage();
}

/**
 * Pede confirmação e exclui o nó, devolvendo os pontos se estava comprado.
 * @param {string} nodeId
 */
export function requestDeleteSkillNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return;
  const msg = node.comprada
    ? `Excluir "${node.nome}"? Ela está comprada — os ${node.custoCompra} ponto(s) gastos serão devolvidos.`
    : `Excluir "${node.nome}"? Esta ação não pode ser desfeita.`;
  if (!confirm(msg)) return;
  const name = node.nome;
  deleteSkillNode(nodeId);
  showStatus(`Habilidade "${name}" excluída.`, 'saved', 2500);
}

/* ------------------------------------------------------------
   COMPRAR / DESFAZER / USAR
------------------------------------------------------------ */
/**
 * Compra um nó com Pontos de Defeito.
 * @param {string} nodeId
 * @param {boolean} [force] - compra mesmo sem pontos (aprovação do Mestre)
 */
export function buySkillNode(nodeId, force = false) {
  const node = getNodeById(nodeId);
  if (!node) return;

  if (node.comprada) {
    showStatus('Esta habilidade já está comprada.', 'info', 2000);
    return;
  }

  const available = calculateSkillTreeAvailablePoints();
  const insufficient = node.custoCompra > available;

  if (insufficient && !force) {
    showStatus(
      `Pontos de Defeito insuficientes para "${node.nome}" (faltam ${node.custoCompra - available}). ` +
      `Use "Comprar com aprovação do Mestre" se o Mestre permitir.`,
      'error', 4500);
    renderSkillNodeDetails(nodeId);
    return;
  }

  node.comprada = true;
  node.atualizadaEm = Date.now();
  getState().selectedNodeId = nodeId;

  if (insufficient && force) {
    showStatus(`Comprado com aprovação do Mestre: ${node.nome}.`, 'saved', 3000);
  } else {
    showStatus(`Comprado: ${node.nome} (−${node.custoCompra} ponto${node.custoCompra !== 1 ? 's' : ''}).`, 'saved', 2500);
  }

  persist();
  renderSkillTreePage();
}

/**
 * Desfaz a compra de um nó, devolvendo os Pontos de Defeito.
 * @param {string} nodeId
 */
export function refundSkillNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return;
  if (!node.comprada) {
    showStatus('Esta habilidade não está comprada.', 'info', 2000);
    return;
  }
  node.comprada = false;
  node.atualizadaEm = Date.now();
  getState().selectedNodeId = nodeId;
  showStatus(`Compra desfeita: ${node.nome} (+${node.custoCompra} ponto${node.custoCompra !== 1 ? 's' : ''} devolvido${node.custoCompra !== 1 ? 's' : ''}).`, 'saved', 2500);
  persist();
  renderSkillTreePage();
}

/**
 * Usa uma habilidade ativa já comprada, gastando o recurso correspondente.
 * @param {string} nodeId
 */
export function useSkillNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return;

  if (!node.comprada) {
    showStatus('Compre esta habilidade antes de usá-la.', 'error', 2500);
    return;
  }

  if (node.modo === 'Passiva') {
    showStatus(`${node.nome} é passiva — sempre ativa.`, 'info', 2500);
    registerSkillUse(node, 0);
    return;
  }

  const recurso = node.recursoUso;

  if (recurso === 'Esforço') {
    if (sheetState.effortCurrent < node.custoUso) {
      showStatus(`Esforço insuficiente para usar ${node.nome} (precisa de ${node.custoUso}).`, 'error', 3000);
      return;
    }
    if (node.custoUso > 0) updateEffort(-node.custoUso);
    registerSkillUse(node, node.custoUso);
    showStatus(`${node.nome} usada (−${node.custoUso} Esforço).`, 'saved', 2500);
  } else if (recurso === 'Conexão') {
    if (sheetState.connectionCurrent < node.custoUso) {
      showStatus(`Conexão insuficiente para usar ${node.nome} (precisa de ${node.custoUso}).`, 'error', 3000);
      return;
    }
    if (node.custoUso > 0) updateConnection(-node.custoUso);
    registerSkillUse(node, node.custoUso);
    showStatus(`${node.nome} usada (−${node.custoUso} Conexão).`, 'saved', 2500);
  } else if (recurso === 'Nenhum') {
    registerSkillUse(node, 0);
    showStatus(`${node.nome} usada.`, 'saved', 2000);
  } else {
    // Créditos / Carga / Outro — recurso não rastreado automaticamente.
    registerSkillUse(node, node.custoUso);
    showStatus(`${node.nome} usada (−${node.custoUso} ${recurso}). Ajuste o recurso manualmente.`, 'info', 3500);
  }

  renderSkillTreeSummary();
}

/** Registra o uso de uma habilidade no histórico de rolagens/ações. */
function registerSkillUse(node, spent) {
  let remaining = '—';
  if (node.recursoUso === 'Esforço')  remaining = sheetState.effortCurrent;
  if (node.recursoUso === 'Conexão')  remaining = sheetState.connectionCurrent;

  addToHistory({
    name:          `${node.tipo}: ${node.nome}`,
    result:        'S',
    isAutoSuccess: true,
    success:       true,
    attrValue:     remaining,
    grade:         spent > 0 ? `−${spent} ${node.recursoUso}` : (node.modo === 'Passiva' ? 'Passiva' : 'Uso'),
    rolls:         [],
    type:          'skill-use',
  });
}

/* ------------------------------------------------------------
   SELEÇÃO E FILTRO
------------------------------------------------------------ */
export function filterSkillTree(filterId) {
  setSkillTreeCategory(filterId);
  try { localStorage.setItem('skillTreeCategory', getSkillTreeCategory()); } catch (_) {}
  renderSkillTreeFilters();
  applySkillTreeFilterHighlight();
}
/* Alias compatível com o restante da ficha. */
export const selectSkillTreeCategory = filterSkillTree;

export function selectSkillNode(nodeId) {
  getState().selectedNodeId = nodeId;
  const map = byId('skilltree-map');
  if (map) {
    map.querySelectorAll('.skill-node').forEach(el =>
      el.classList.toggle('focused', el.dataset.nodeId === nodeId));
  }
  highlightLinesForNode(nodeId);
  renderSkillNodeDetails(nodeId);
}

/* ------------------------------------------------------------
   RENDER: FILTROS
------------------------------------------------------------ */
export function renderSkillTreeFilters() {
  const container = byId('skilltree-filters');
  if (!container) return;
  container.innerHTML = '';

  const active = getSkillTreeCategory();
  const nodes = getState().customNodes;

  SKILL_FILTERS.forEach(filter => {
    const count = nodes.filter(n => nodeMatchesFilter(n, filter.id)).length;
    const isActive = filter.id === active;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-tree-filter-btn';
    btn.classList.toggle('active', isActive);
    btn.dataset.filter = filter.id;
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.innerHTML =
      `<span class="skill-tree-filter-label">${escapeHtml(filter.label)}</span>` +
      `<span class="skill-tree-filter-count">${count}</span>`;
    container.appendChild(btn);
  });
}

/** Reduz a opacidade dos nós fora do filtro atual. */
function applySkillTreeFilterHighlight() {
  const map = byId('skilltree-map');
  if (!map) return;
  const active = getSkillTreeCategory();
  const all = active === 'todos';

  map.querySelectorAll('.skill-node[data-node-id]').forEach(el => {
    if (el.classList.contains('skill-node-core')) return;
    const node = getNodeById(el.dataset.nodeId);
    const match = all || (node && nodeMatchesFilter(node, active));
    el.classList.toggle('is-dimmed', !match);
  });

  const svg = byId('skilltree-lines');
  if (svg) svg.classList.toggle('is-filtered', !all);
}

/* ------------------------------------------------------------
   RENDER: NÓS (núcleo + hubs + habilidades + empty state)
------------------------------------------------------------ */
export function renderSkillTreeNodes() {
  const map = byId('skilltree-map');
  if (!map) return;

  // Limpa nós, hubs e empty state (mantém a SVG de linhas).
  map.querySelectorAll('.skill-node, .skill-tree-hub, .skill-tree-empty').forEach(el => el.remove());

  const state = getState();
  const selectedId = state.selectedNodeId;

  // Núcleo central (âncora — selecionável para abrir o painel de criação).
  const core = document.createElement('button');
  core.type = 'button';
  core.className = 'skill-node skill-node-core';
  if (selectedId === CORE_NODE.id) core.classList.add('focused');
  core.dataset.nodeId = CORE_NODE.id;
  core.style.setProperty('--x', CENTER);
  core.style.setProperty('--y', CENTER);
  core.title = `${CORE_NODE.label} — centro da árvore`;
  core.setAttribute('aria-label', `${CORE_NODE.label} — centro da árvore`);
  core.innerHTML =
    `<span class="skill-node-shape"><span class="skill-node-icon" aria-hidden="true">${escapeHtml(CORE_NODE.icon)}</span></span>` +
    `<span class="skill-node-label">Núcleo</span>`;
  map.appendChild(core);

  // Hubs de categoria (âncoras visuais — não compráveis).
  SKILL_TREE_HUBS.forEach(hub => {
    const count = state.customNodes.filter(n => n.categoria === hub.category).length;
    const el = document.createElement('div');
    el.className = 'skill-tree-hub';
    el.dataset.hub = hub.id;
    el.style.setProperty('--x', hub.x);
    el.style.setProperty('--y', hub.y);
    el.innerHTML =
      `<span class="skill-tree-hub-shape" aria-hidden="true">${escapeHtml(hub.icon)}</span>` +
      `<span class="skill-tree-hub-label">${escapeHtml(hub.label)}` +
      `${count ? ` <span class="skill-tree-hub-count">${count}</span>` : ''}</span>`;
    map.appendChild(el);
  });

  // Habilidades criadas.
  state.customNodes.forEach(node => {
    const status = node.comprada ? 'unlocked' : 'available';
    const warning = nodeHasWarning(node);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `skill-node custom ${status}`;
    btn.classList.add(node.modo === 'Passiva' ? 'passive' : 'active-skill');
    if (isDarkSide(node)) btn.classList.add('is-forbidden');
    if (warning) btn.classList.add('warning');
    if (node.id === selectedId) btn.classList.add('focused');
    btn.dataset.nodeId = node.id;
    btn.style.setProperty('--x', node.x == null ? CENTER : node.x);
    btn.style.setProperty('--y', node.y == null ? CENTER : node.y);

    btn.title = `${node.nome} · ${node.tipo} · ${node.custoCompra} PD`;
    btn.setAttribute('aria-label',
      `${node.nome}. ${node.tipo}. ${node.categoria}${node.subcategoria ? ` — ${node.subcategoria}` : ''}. ` +
      `${node.comprada ? 'Comprada.' : 'Disponível.'}${warning ? ' Atenção.' : ''}`);

    btn.innerHTML = `
      <span class="skill-node-shape">
        <span class="skill-node-icon" aria-hidden="true">${escapeHtml(iconForNode(node))}</span>
        <span class="skill-node-cost" title="Custo de compra">${node.custoCompra}</span>
        ${node.comprada ? '<span class="skill-node-check" aria-hidden="true">✓</span>' : ''}
        ${warning ? '<span class="skill-node-flag" aria-hidden="true">!</span>' : ''}
      </span>
      <span class="skill-node-label">${escapeHtml(node.nome)}</span>
    `;

    btn.addEventListener('mouseenter', () => highlightLinesForNode(node.id));
    btn.addEventListener('mouseleave', () => highlightLinesForNode(getState().selectedNodeId));
    btn.addEventListener('focus', () => highlightLinesForNode(node.id));
    btn.addEventListener('blur', () => highlightLinesForNode(getState().selectedNodeId));

    map.appendChild(btn);
  });

  // Empty state — quando não há habilidades, a árvore continua bonita.
  if (!state.customNodes.length) {
    const empty = document.createElement('div');
    empty.className = 'skill-tree-empty';
    empty.innerHTML = `
      <span class="skill-tree-empty-icon" aria-hidden="true">✧</span>
      <p class="skill-tree-empty-text">
        Sua árvore ainda não possui habilidades. No sistema, as habilidades são criadas
        pelo jogador e aprovadas pelo Mestre. Adicione uma habilidade para começar a
        formar sua árvore personalizada.
      </p>
      <button type="button" class="btn btn--primary skill-tree-create-btn" data-action="open-create">
        + Criar primeira habilidade
      </button>
    `;
    map.appendChild(empty);
  }
}

/* ------------------------------------------------------------
   RENDER: TRILHAS (SVG)
   Núcleo → hubs; hub → nós; conexões locais por subcategoria.
   Decorativas — NÃO representam pré-requisito.
------------------------------------------------------------ */
export function renderSkillTreeLines() {
  const svg = byId('skilltree-lines');
  if (!svg) return;
  svg.innerHTML = '';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const state = getState();

  const addLine = (ax, ay, bx, by, opts = {}) => {
    const line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', ax);
    line.setAttribute('y1', ay);
    line.setAttribute('x2', bx);
    line.setAttribute('y2', by);
    let cls = `skill-tree-line line-${opts.cat || 'core'}`;
    if (opts.dark)   cls += ' line-dark';
    if (opts.active) cls += ' active';
    line.setAttribute('class', cls);
    if (opts.kind)  line.dataset.kind = opts.kind;
    if (opts.cat)   line.dataset.cat = opts.cat;
    if (opts.nodes) line.dataset.nodes = opts.nodes;
    svg.appendChild(line);
  };

  // 1) Núcleo → hub de cada categoria.
  SKILL_TREE_HUBS.forEach(hub => {
    addLine(CENTER, CENTER, hub.x, hub.y, { kind: 'core', cat: catSlug(hub.category) });
  });

  // 2) Hub → cada habilidade da categoria.
  state.customNodes.forEach(node => {
    const hub = getHubByCategory(node.categoria);
    if (!hub) return;
    addLine(hub.x, hub.y, node.x == null ? CENTER : node.x, node.y == null ? CENTER : node.y, {
      kind:   'hub',
      cat:    catSlug(node.categoria),
      dark:   isDarkSide(node),
      nodes:  node.id,
      active: node.comprada,
    });
  });

  // 3) Conexões locais entre nós da mesma subcategoria.
  const groups = {};
  state.customNodes.forEach(n => {
    if (!n.subcategoria) return;
    const key = `${n.categoria}::${n.subcategoria}`;
    (groups[key] = groups[key] || []).push(n);
  });
  Object.values(groups).forEach(list => {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      addLine(a.x == null ? CENTER : a.x, a.y == null ? CENTER : a.y,
              b.x == null ? CENTER : b.x, b.y == null ? CENTER : b.y, {
        kind:   'sub',
        cat:    catSlug(a.categoria),
        dark:   isDarkSide(a) && isDarkSide(b),
        nodes:  `${a.id} ${b.id}`,
        active: a.comprada && b.comprada,
      });
    }
  });

  highlightLinesForNode(state.selectedNodeId);
}

/** Realça as trilhas ligadas ao nó (hub da categoria + ramo local). */
export function highlightLinesForNode(nodeId) {
  const svg = byId('skilltree-lines');
  if (!svg) return;
  const lines = svg.querySelectorAll('.skill-tree-line');
  const node = getNodeById(nodeId);

  if (!node) {
    lines.forEach(l => l.classList.remove('is-linked', 'is-muted'));
    return;
  }

  const cat = catSlug(node.categoria);
  lines.forEach(l => {
    const touches  = (l.dataset.nodes || '').split(' ').includes(nodeId);
    const corePath = l.dataset.kind === 'core' && l.dataset.cat === cat;
    const linked = touches || corePath;
    l.classList.toggle('is-linked', linked);
    l.classList.toggle('is-muted', !linked);
  });
}

/** Renderiza o mapa radial completo (nós + linhas) e aplica o filtro. */
export function renderRadialSkillTree() {
  renderSkillTreeNodes();
  renderSkillTreeLines();
  applySkillTreeFilterHighlight();
}

/* ------------------------------------------------------------
   RENDER: PAINEL DE DETALHES
------------------------------------------------------------ */
function renderEmptyDetails(panel) {
  panel.innerHTML = `
    <div class="skill-node-details-empty">
      <span class="skill-node-details-empty-icon" aria-hidden="true">✧</span>
      <p>Selecione uma habilidade para ver detalhes ou crie uma nova habilidade.</p>
      <button type="button" class="btn btn--primary skill-tree-create-btn" data-action="open-create">+ Criar Habilidade</button>
    </div>
  `;
}

function renderCoreDetails(panel) {
  const count = getState().customNodes.length;
  panel.innerHTML = `
    <div class="skill-node-details-head">
      <span class="skill-node-details-icon" aria-hidden="true">${escapeHtml(CORE_NODE.icon)}</span>
      <div>
        <h3 class="skill-node-details-name">${escapeHtml(CORE_NODE.label)}</h3>
        <span class="skill-node-status-badge">Núcleo</span>
      </div>
    </div>
    <div class="skill-detail-block">
      <span class="skill-detail-label">Sobre</span>
      <p class="skill-detail-text">Centro da árvore. As habilidades criadas organizam-se ao redor dos ramos: Sobrevivência, Combate, Força, Social e Técnica.</p>
    </div>
    ${count === 0
      ? `<p class="skill-detail-text">Nenhuma habilidade criada ainda. Crie sua primeira habilidade para começar a formar a árvore.</p>
         <div class="skill-node-details-actions">
           <button type="button" class="btn btn--primary skill-action-btn" data-action="open-create">+ Criar primeira habilidade</button>
         </div>`
      : `<div class="skill-node-details-actions">
           <button type="button" class="btn btn--primary skill-action-btn" data-action="open-create">+ Criar Habilidade</button>
         </div>`}
  `;
}

function renderNodeDetails(panel, node) {
  const status = node.comprada ? 'unlocked' : 'available';
  const statusLabel = node.comprada ? 'Comprada' : 'Disponível';
  const warning = nodeHasWarning(node);
  const badgeClass = warning ? `${status} is-warning` : status;

  const useCostText = (node.modo === 'Passiva' || node.recursoUso === 'Nenhum')
    ? 'Nenhum'
    : `${node.custoUso} ${node.recursoUso}`;

  // Ações de compra / uso.
  let actions = '';
  if (!node.comprada) {
    const available = calculateSkillTreeAvailablePoints();
    const insufficient = node.custoCompra > available;
    if (insufficient) {
      actions += `
        <div class="skill-tree-warning">⚠ Pontos de Defeito insuficientes (faltam ${node.custoCompra - available}).</div>
        <button type="button" class="btn btn--primary skill-action-btn" data-action="buy-node" data-id="${escapeHtml(node.id)}">⊕ Comprar (−${node.custoCompra})</button>
        <button type="button" class="btn btn--secondary skill-action-btn" data-action="force-buy-node" data-id="${escapeHtml(node.id)}">✓ Comprar com aprovação do Mestre</button>
      `;
    } else {
      actions += `<button type="button" class="btn btn--primary skill-action-btn" data-action="buy-node" data-id="${escapeHtml(node.id)}">⊕ Comprar (−${node.custoCompra})</button>`;
    }
  } else {
    if (node.modo === 'Passiva') {
      actions += `<div class="skill-action-passive">✓ Passiva — sempre ativa</div>`;
    } else {
      actions += `<button type="button" class="btn btn--secondary skill-action-btn" data-action="use-node" data-id="${escapeHtml(node.id)}">▶ Usar (−${escapeHtml(useCostText)})</button>`;
    }
    actions += `<button type="button" class="btn btn--secondary skill-action-btn skill-action-refund" data-action="refund-node" data-id="${escapeHtml(node.id)}">↺ Desfazer compra (+${node.custoCompra})</button>`;
  }

  const avisoBlock = node.aviso
    ? `<div class="skill-tree-warning${isDarkSide(node) ? ' skill-tree-warning--dark' : ''}">⚠ ${escapeHtml(node.aviso)}</div>`
    : (isDarkSide(node)
        ? `<div class="skill-tree-warning skill-tree-warning--dark">☠ Caminho do Lado Sombrio — use com cautela narrativa.</div>`
        : '');

  panel.innerHTML = `
    <div class="skill-node-details-head">
      <span class="skill-node-details-icon ${status}" aria-hidden="true">${escapeHtml(iconForNode(node))}</span>
      <div>
        <h3 class="skill-node-details-name">${escapeHtml(node.nome)}</h3>
        <span class="skill-node-status-badge ${badgeClass}">${statusLabel}${warning ? ' · Atenção' : ''}</span>
      </div>
    </div>

    <div class="skill-node-details-grid">
      <div class="skill-detail"><span class="skill-detail-label">Categoria</span><span class="skill-detail-value">${escapeHtml(node.categoria)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Subcategoria</span><span class="skill-detail-value">${escapeHtml(node.subcategoria || '—')}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Tipo</span><span class="skill-detail-value">${escapeHtml(node.tipo)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Modo</span><span class="skill-detail-value">${escapeHtml(node.modo)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Ação</span><span class="skill-detail-value">${escapeHtml(node.acao)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Custo de Compra</span><span class="skill-detail-value">${node.custoCompra} Ponto${node.custoCompra !== 1 ? 's' : ''} de Defeito</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Custo de Uso</span><span class="skill-detail-value">${escapeHtml(useCostText)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Recurso</span><span class="skill-detail-value">${escapeHtml(node.recursoUso)}</span></div>
    </div>

    ${node.descricao ? `<div class="skill-detail-block"><span class="skill-detail-label">Descrição</span><p class="skill-detail-text">${escapeHtml(node.descricao)}</p></div>` : ''}
    ${node.efeito ? `<div class="skill-detail-block"><span class="skill-detail-label">Efeito</span><p class="skill-detail-text">${escapeHtml(node.efeito)}</p></div>` : ''}

    ${avisoBlock}

    <div class="skill-node-details-actions">
      ${actions}
      <div class="skill-tree-node-actions">
        <button type="button" class="btn btn--secondary skill-tree-edit-btn" data-action="edit-node" data-id="${escapeHtml(node.id)}">✎ Editar</button>
        <button type="button" class="btn btn--secondary skill-tree-delete-btn" data-action="delete-node" data-id="${escapeHtml(node.id)}">🗑 Excluir</button>
      </div>
    </div>
  `;
}

export function renderSkillNodeDetails(nodeId = getState().selectedNodeId) {
  const panel = byId('skilltree-details');
  if (!panel) return;

  if (nodeId === CORE_NODE.id) { renderCoreDetails(panel); return; }

  const node = getNodeById(nodeId);
  if (!node) { renderEmptyDetails(panel); return; }

  renderNodeDetails(panel, node);
}

/* ------------------------------------------------------------
   RENDER: RESUMO
------------------------------------------------------------ */
export function renderSkillTreeSummary() {
  const state = getState();
  const nodes = state.customNodes;

  const total     = calculateDefectPoints();
  const spent     = calculateSkillTreeSpentPoints();
  const remaining = total - spent;

  const created    = nodes.length;
  const bought     = nodes.filter(n => n.comprada).length;
  const maneuvers  = nodes.filter(n => n.tipo === 'Manobra').length;
  const techniques = nodes.filter(n => n.tipo === 'Técnica da Força').length;
  const passives   = nodes.filter(n => n.modo === 'Passiva').length;
  const warnings   = nodes.filter(nodeHasWarning).length;

  const set = (id, val) => { const el = byId(id); if (el) el.textContent = val; };

  set('skilltree-total-points', total);
  set('skilltree-spent-points', spent);
  set('skilltree-remaining-points', remaining);
  set('skilltree-created-count', created);
  set('skilltree-unlocked-count', bought);
  set('skilltree-maneuvers-count', maneuvers);
  set('skilltree-techniques-count', techniques);
  set('skilltree-passives-count', passives);
  set('skilltree-warnings-count', warnings);
  set('skilltree-effort', `${sheetState.effortCurrent}/${sheetState.effortMax}`);
  set('skilltree-connection', `${sheetState.connectionCurrent}/${sheetState.connectionMax}`);

  const remCard = byId('skilltree-remaining-card');
  if (remCard) remCard.classList.toggle('is-over', remaining < 0);

  const warning = byId('skilltree-warning');
  if (warning) {
    const parts = [];
    if (state.migratedFromExamples) {
      parts.push('A árvore agora usa habilidades personalizadas. Habilidades antigas de exemplo não foram recriadas automaticamente.');
    }
    if (remaining < 0) {
      parts.push(`⚠ Você gastou ${Math.abs(remaining)} ponto(s) além dos Pontos de Defeito disponíveis. O Mestre deve aprovar.`);
    }
    if (parts.length) {
      warning.hidden = false;
      warning.innerHTML = parts.map(p => escapeHtml(p)).join('<br>');
    } else {
      warning.hidden = true;
    }
  }
}

/* ------------------------------------------------------------
   RENDER MESTRE DA ABA
------------------------------------------------------------ */
export function renderSkillTreePage() {
  calculateRadialLayout();
  renderSkillTreeSummary();
  renderSkillTreeFilters();
  renderRadialSkillTree();
  renderSkillNodeDetails(getState().selectedNodeId);
}

/* ------------------------------------------------------------
   FORMULÁRIO DE CRIAÇÃO / EDIÇÃO (modal)
------------------------------------------------------------ */
let editingNodeId = null;

function optionList(values, selected) {
  return values.map(v =>
    `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('');
}

function buildSkillFormHtml(node) {
  const n = node || {};
  const cat = SKILL_CATEGORIES.some(c => c.id === n.categoria) ? n.categoria : 'Combate';
  const subs = subcategoriasFor(cat);
  const isEdit = !!node;

  return `
    <div class="skilltree-modal-backdrop" data-action="close-form"></div>
    <div class="skilltree-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-form-title">
      <form id="skill-form" class="skill-tree-form" novalidate>
        <div class="skill-tree-form-head">
          <h3 id="skill-form-title">${isEdit ? 'Editar Habilidade' : 'Criar Habilidade'}</h3>
          <button type="button" class="skill-tree-form-close" data-action="close-form" aria-label="Fechar">✕</button>
        </div>

        <div class="skill-tree-form-grid">
          <label class="skill-tree-form-field skill-tree-form-field--wide">
            <span>Nome *</span>
            <input type="text" id="skill-form-nome" value="${escapeHtml(n.nome || '')}" maxlength="80" required>
          </label>

          <label class="skill-tree-form-field">
            <span>Categoria *</span>
            <select id="skill-form-categoria">${optionList(SKILL_CATEGORIES.map(c => c.id), cat)}</select>
          </label>

          <label class="skill-tree-form-field">
            <span>Subcategoria</span>
            <select id="skill-form-subcategoria"><option value="">—</option>${optionList(subs, n.subcategoria || '')}</select>
          </label>

          <label class="skill-tree-form-field">
            <span>Tipo</span>
            <select id="skill-form-tipo">${optionList(SKILL_TYPES, n.tipo || 'Manobra')}</select>
          </label>

          <label class="skill-tree-form-field">
            <span>Modo</span>
            <select id="skill-form-modo">${optionList(SKILL_MODES, n.modo || 'Ativa')}</select>
          </label>

          <label class="skill-tree-form-field">
            <span>Ação</span>
            <select id="skill-form-acao">${optionList(SKILL_ACTIONS, n.acao || 'Padrão')}</select>
          </label>

          <label class="skill-tree-form-field">
            <span>Custo de compra (PD)</span>
            <input type="number" id="skill-form-custocompra" min="0" step="1" value="${Number(n.custoCompra) || 0}">
          </label>

          <label class="skill-tree-form-field">
            <span>Custo de uso</span>
            <input type="number" id="skill-form-custouso" min="0" step="1" value="${Number(n.custoUso) || 0}">
          </label>

          <label class="skill-tree-form-field">
            <span>Recurso usado</span>
            <select id="skill-form-recurso">${optionList(SKILL_RESOURCES, n.recursoUso || 'Nenhum')}</select>
          </label>

          <label class="skill-tree-form-field skill-tree-form-field--wide">
            <span>Descrição</span>
            <textarea id="skill-form-descricao" rows="2">${escapeHtml(n.descricao || '')}</textarea>
          </label>

          <label class="skill-tree-form-field skill-tree-form-field--wide">
            <span>Efeito</span>
            <textarea id="skill-form-efeito" rows="2">${escapeHtml(n.efeito || '')}</textarea>
          </label>

          <label class="skill-tree-form-field skill-tree-form-field--wide">
            <span>Aviso narrativo</span>
            <input type="text" id="skill-form-aviso" value="${escapeHtml(n.aviso || '')}" maxlength="160" placeholder="Ex.: Requer aprovação do Mestre.">
          </label>

          <label class="skill-tree-form-check">
            <input type="checkbox" id="skill-form-comprada" ${n.comprada ? 'checked' : ''}>
            <span>Já está comprada</span>
          </label>

          <label class="skill-tree-form-check">
            <input type="checkbox" id="skill-form-aprovacao">
            <span>Requer aprovação do Mestre</span>
          </label>
        </div>

        <div class="skill-tree-form-actions">
          <button type="button" class="btn btn--secondary" data-action="close-form">Cancelar</button>
          <button type="submit" class="btn btn--primary" data-action="save-form">Salvar</button>
        </div>
      </form>
    </div>
  `;
}

/** Atualiza as opções de subcategoria conforme a categoria escolhida. */
function populateSubcategorias(category, current) {
  const subSel = byId('skill-form-subcategoria');
  if (!subSel) return;
  const subs = subcategoriasFor(category);
  subSel.innerHTML = `<option value="">—</option>` + optionList(subs, subs.includes(current) ? current : '');
}

/** Sugestão de recurso ao trocar o tipo (não trava — só sugere). */
function onTypeChange() {
  const tipo = getVal('skill-form-tipo');
  const recursoSel = byId('skill-form-recurso');
  const modoSel = byId('skill-form-modo');

  if (tipo === 'Passiva' && modoSel) { modoSel.value = 'Passiva'; onModeChange(); }
  if (tipo === 'Reação' && modoSel && modoSel.value === 'Ativa') modoSel.value = 'Reação';

  if (recursoSel && recursoSel.value === 'Nenhum' && !recursoSel.disabled) {
    if (tipo === 'Manobra')          recursoSel.value = 'Esforço';
    else if (tipo === 'Técnica da Força') recursoSel.value = 'Conexão';
  }
}

/** Aplica a regra de passiva (custo de uso 0 e recurso Nenhum). */
function onModeChange() {
  const modo = getVal('skill-form-modo');
  const custoUso = byId('skill-form-custouso');
  const recursoSel = byId('skill-form-recurso');
  const isPassive = modo === 'Passiva';

  if (custoUso) {
    if (isPassive) custoUso.value = 0;
    custoUso.disabled = isPassive;
  }
  if (recursoSel) {
    if (isPassive) recursoSel.value = 'Nenhum';
    recursoSel.disabled = isPassive;
  }
}

/**
 * Abre o formulário de criação (nodeId = null) ou edição (nodeId = id).
 * @param {string|null} nodeId
 */
export function openSkillForm(nodeId = null) {
  const modal = byId('skilltree-modal');
  if (!modal) return;

  editingNodeId = nodeId;
  const node = nodeId ? getNodeById(nodeId) : null;

  modal.innerHTML = buildSkillFormHtml(node);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  const catSel = byId('skill-form-categoria');
  const subSel = byId('skill-form-subcategoria');
  if (catSel && subSel) {
    catSel.addEventListener('change', () => populateSubcategorias(catSel.value, subSel.value));
  }
  const tipoSel = byId('skill-form-tipo');
  const modoSel = byId('skill-form-modo');
  if (tipoSel) tipoSel.addEventListener('change', onTypeChange);
  if (modoSel) modoSel.addEventListener('change', onModeChange);

  onModeChange(); // aplica a regra de passiva no estado inicial

  const nameInput = byId('skill-form-nome');
  if (nameInput) nameInput.focus();
}

export function closeSkillForm() {
  const modal = byId('skilltree-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = '';
  document.body.classList.remove('modal-open');
  editingNodeId = null;
}

/** Valida os dados do formulário. Retorna mensagem de erro ou null. */
function validateSkillForm(data) {
  if (!data.nome || !data.nome.trim()) return 'Informe um nome para a habilidade.';
  if (!data.categoria) return 'Escolha uma categoria.';
  if (Number(data.custoCompra) < 0) return 'O custo de compra não pode ser negativo.';
  if (Number(data.custoUso) < 0) return 'O custo de uso não pode ser negativo.';
  return null;
}

/** Lê o formulário, valida e cria/atualiza a habilidade. */
export function saveSkillForm() {
  const aprovacao = byId('skill-form-aprovacao');
  let aviso = getVal('skill-form-aviso').trim();
  if (aprovacao && aprovacao.checked && !aviso) aviso = 'Requer aprovação do Mestre.';

  const data = {
    nome:        getVal('skill-form-nome'),
    categoria:   getVal('skill-form-categoria'),
    subcategoria: getVal('skill-form-subcategoria'),
    tipo:        getVal('skill-form-tipo'),
    modo:        getVal('skill-form-modo'),
    custoCompra: getNum('skill-form-custocompra', 0),
    custoUso:    getNum('skill-form-custouso', 0),
    recursoUso:  getVal('skill-form-recurso'),
    acao:        getVal('skill-form-acao'),
    descricao:   getVal('skill-form-descricao'),
    efeito:      getVal('skill-form-efeito'),
    aviso,
    comprada:    !!(byId('skill-form-comprada') && byId('skill-form-comprada').checked),
  };

  const err = validateSkillForm(data);
  if (err) { showStatus(err, 'error', 3000); return; }

  if (editingNodeId) {
    const node = updateSkillNode(editingNodeId, data);
    if (node) showStatus(`Habilidade "${node.nome}" atualizada.`, 'saved', 2500);
  } else {
    const node = createSkillNode(data);
    showStatus(`Habilidade "${node.nome}" criada.`, 'saved', 2500);
  }

  closeSkillForm();
}

/* ------------------------------------------------------------
   INTEGRAÇÃO COM PROGRESSÃO
   Permite que a aba Progressão adicione um nó à árvore. Quando a
   habilidade já foi paga com Pontos de Evolução, custoCompra pode ser 0
   e comprada = true.
------------------------------------------------------------ */
export function addProgressionSkillToTree(skillData = {}) {
  return createSkillNode({
    ...skillData,
    comprada:    skillData.comprada !== undefined ? skillData.comprada : true,
    custoCompra: skillData.custoCompra !== undefined ? skillData.custoCompra : 0,
    aviso:       skillData.aviso || 'Criada por Progressão',
  });
}

/* ------------------------------------------------------------
   PERSISTÊNCIA: NORMALIZAÇÃO / MIGRAÇÃO
------------------------------------------------------------ */
/**
 * Normaliza um objeto de estado da árvore (de JSON/LocalStorage).
 * Gera ids para nós sem id e completa campos faltantes.
 * @param {*} raw
 * @returns {object}
 */
export function normalizeSkillTreeState(raw) {
  const base = defaultSkillTreeState();
  if (!raw || typeof raw !== 'object') return base;

  const nodes = Array.isArray(raw.customNodes) ? raw.customNodes.map(normalizeNode) : [];
  return {
    version:              SKILL_TREE_VERSION,
    customNodes:          nodes,
    selectedNodeId:       (raw.selectedNodeId && nodes.some(n => n.id === raw.selectedNodeId)) ? raw.selectedNodeId : null,
    activeFilter:         FILTER_IDS.includes(raw.activeFilter) ? raw.activeFilter : 'todos',
    migratedFromExamples: !!raw.migratedFromExamples,
  };
}

/**
 * Aplica os dados de uma ficha à árvore (com migração de fichas antigas).
 * - Se houver `skillTree`, usa-o (normalizado).
 * - Senão, inicia a árvore vazia. Se a ficha antiga tinha exemplos
 *   comprados, marca um aviso discreto (sem recriar habilidades).
 * @param {object} data
 */
export function applySkillTreeData(data) {
  let state;

  if (data && data.skillTree && typeof data.skillTree === 'object') {
    state = normalizeSkillTreeState(data.skillTree);
  } else {
    state = defaultSkillTreeState();
    const hadOldExamples = Array.isArray(data && data.unlockedSkillTreeNodes) && data.unlockedSkillTreeNodes.length > 0;
    if (hadOldExamples) state.migratedFromExamples = true;
  }

  // Filtro salvo em campo legado / localStorage.
  if (data && data.skillTreeCategory && FILTER_IDS.includes(data.skillTreeCategory)) {
    state.activeFilter = data.skillTreeCategory;
  }

  sheetState.skillTree = state;
  calculateRadialLayout();
}

/** Alias semântico para migração de dados antigos. */
export function migrateOldSkillTreeData(data) {
  return applySkillTreeData(data);
}

/* ------------------------------------------------------------
   ALIASES (compatibilidade com chamadas existentes)
------------------------------------------------------------ */
export const unlockSkillNode   = buySkillNode;
export const useSkillTreeNode   = useSkillNode;
export const updateSkillTreeSummary = renderSkillTreeSummary;
