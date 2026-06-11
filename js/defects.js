/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   defects.js — Defeitos de personagem (aba separada)

   Responsabilidade:
   - Lista de Defeitos prontos (PRESET_DEFECTS).
   - Adicionar Defeito pronto ou personalizado.
   - Remover Defeito.
   - Calcular pontos totais e maior gravidade.
   - Renderizar a aba de Defeitos e atualizar o resumo.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, getVal, generateId, escapeHtml } from './dom.js';
import { showStatus } from './ui.js';

/**
 * Lista completa de Defeitos prontos, agrupados por gravidade (pontos).
 * Cada item: { name, points, type, description }.
 */
export const PRESET_DEFECTS = [
  // ---- 1 Ponto ----
  { name: 'Odor Marcante',        points: 1, type: 'fisico',      description: 'O personagem possui um cheiro forte, seja por espécie, descuido, química, óleo, sucata ou ambiente de origem. Pode atrapalhar furtividade ou interações sociais específicas.' },
  { name: 'Sotaque Denunciador',  points: 1, type: 'social',      description: 'O modo de falar do personagem entrega sua origem, cultura ou planeta natal.' },
  { name: 'Etiqueta Ruim',        points: 1, type: 'social',      description: 'O personagem não sabe se portar em ambientes formais, nobres, imperiais ou diplomáticos.' },
  { name: 'Equipamento Barulhento', points: 1, type: 'tecnologico', description: 'Alguma peça, armadura, prótese ou equipamento do personagem faz ruídos fáceis de notar.' },
  { name: 'Impulsivo',            points: 1, type: 'mental',      description: 'O personagem tem dificuldade em ignorar provocações, desafios ou oportunidades arriscadas.' },
  { name: 'Desconfiado',          points: 1, type: 'mental',      description: 'O personagem tem dificuldade em aceitar ajuda ou confiar em desconhecidos.' },
  { name: 'Aparência Incomum',    points: 1, type: 'social',      description: 'O personagem chama atenção com facilidade por causa de traços físicos, roupas, implantes ou modificações.' },

  // ---- 2 Pontos ----
  { name: 'Não Sabe Ler',         points: 2, type: 'mental',      description: 'O personagem não consegue ler textos comuns, placas, contratos, códigos escritos ou documentos sem ajuda.' },
  { name: 'Dívida Pequena',       points: 2, type: 'criminal',    description: 'O personagem deve créditos, favores ou recursos para alguém pouco perigoso, mas insistente.' },
  { name: 'Procurado Localmente', points: 2, type: 'criminal',    description: 'O personagem é procurado em uma cidade, estação espacial, lua ou planeta específico.' },
  { name: 'Fobia Específica',     points: 2, type: 'mental',      description: 'O personagem possui medo forte de algo específico, como vácuo, droides, criaturas grandes, altura, fogo ou interrogatórios.' },
  { name: 'Implante Instável',    points: 2, type: 'tecnologico', description: 'Uma prótese, modificação ou implante do personagem apresenta falhas ocasionais.' },
  { name: 'Registro Criminal Menor', points: 2, type: 'criminal', description: 'O personagem já cometeu crimes pequenos e pode ser reconhecido por autoridades locais.' },
  { name: 'Inimigo Pessoal Fraco', points: 2, type: 'narrativo',  description: 'Alguém tem rancor do personagem, mas ainda não possui grande poder ou influência.' },
  { name: 'Discriminação Local',  points: 2, type: 'social',      description: 'O personagem sofre preconceito em certos lugares por causa de sua espécie, cultura, origem, corpo mecânico ou passado. O problema está na sociedade, não no personagem.' },

  // ---- 3 Pontos ----
  { name: 'Procurado pelo Império', points: 3, type: 'imperial',  description: 'O personagem está em registros imperiais e pode ser identificado em postos de controle, patrulhas ou bases.' },
  { name: 'Dívida com o Submundo', points: 3, type: 'criminal',   description: 'O personagem deve favores, créditos ou serviços para criminosos, gangues, Hutts ou sindicatos.' },
  { name: 'Analfabetismo Tecnológico', points: 3, type: 'tecnologico', description: 'O personagem tem grande dificuldade em lidar com terminais, sistemas digitais, painéis de nave e tecnologia comum.' },
  { name: 'Deficiência Visual Parcial', points: 3, type: 'fisico', description: 'O personagem possui visão muito limitada, dependendo de sensores, ajuda, tecnologia ou outros sentidos.' },
  { name: 'Ex-Imperial Desertor', points: 3, type: 'imperial',    description: 'O personagem abandonou o Império e pode ser perseguido por antigos superiores.' },
  { name: 'Trauma de Guerra',     points: 3, type: 'mental',      description: 'Certas cenas de violência, explosões, tortura ou perdas podem abalar o personagem.' },
  { name: 'Voto Pessoal',         points: 3, type: 'narrativo',   description: 'O personagem segue uma promessa rígida, como nunca matar, nunca abandonar aliados, nunca mentir ou nunca recusar um duelo.' },
  { name: 'Caçado por um Rival',  points: 3, type: 'criminal',    description: 'Um caçador de recompensas, mercenário, inquisidor menor ou criminoso está atrás do personagem.' },
  { name: 'Preconceito Sistêmico', points: 3, type: 'social',     description: 'O personagem pertence a um grupo frequentemente perseguido, explorado ou desrespeitado por autoridades, facções ou culturas dominantes.' },

  // ---- 4 Pontos ----
  { name: 'Caçado pelo Império',  points: 4, type: 'imperial',    description: 'O personagem não é apenas procurado; ele é ativamente perseguido por agentes imperiais, ISB, stormtroopers ou caçadores contratados.' },
  { name: 'Grande Dívida',        points: 4, type: 'criminal',    description: 'O personagem deve muito para uma organização criminosa poderosa.' },
  { name: 'Deficiência Visual Grave', points: 4, type: 'fisico',  description: 'O personagem é cego ou quase cego, dependendo de outros sentidos, tecnologia, treinamento ou auxílio narrativo.' },
  { name: 'Suporte Vital Necessário', points: 4, type: 'fisico',  description: 'O personagem precisa de máscara, tanque, medicação, bateria, fluido, recarga ou equipamento especial para sobreviver.' },
  { name: 'Código Rígido',        points: 4, type: 'narrativo',   description: 'O personagem segue um código de honra severo que pode forçá-lo a aceitar duelos, proteger inocentes, vingar insultos ou jamais remover o elmo como os Mandalorianos.' },
  { name: 'Sensitivo Instável',   points: 4, type: 'forca',       description: 'O personagem tem ligação com a Força, mas não consegue controlá-la bem. Emoções fortes podem causar manifestações involuntárias.' },
  { name: 'Segredo Perigoso',     points: 4, type: 'narrativo',   description: 'Se a verdade sobre o personagem for revelada, ele pode ser preso, caçado, traído ou usado como moeda de troca até mesmo por seus aliados.' },
  { name: 'Inimigo Influente',    points: 4, type: 'narrativo',   description: 'Uma figura poderosa do Império, do submundo, de uma ordem religiosa ou de uma facção quer destruir o personagem.' },

  // ---- 5 Pontos ----
  { name: 'Prioridade Imperial',  points: 5, type: 'imperial',    description: 'O personagem é uma ameaça reconhecida pelo Império. Sua captura ou morte é importante para oficiais, inquisidores ou inteligência imperial.' },
  { name: 'Sensitivo Marcado',    points: 5, type: 'forca',       description: 'A presença do personagem na Força já foi percebida por alguém perigoso, como um inquisidor, Sith, culto sombrio ou antigo mestre.' },
  { name: 'Recompensa Galáctica', points: 5, type: 'criminal',    description: 'Existe uma recompensa alta pela cabeça do personagem, atraindo caçadores de recompensa em vários sistemas.' },
  { name: 'Traidor de uma Grande Facção', points: 5, type: 'narrativo', description: 'O personagem traiu uma organização poderosa, como o Império, uma Casa Mandaloriana, um Hutt, um cartel, uma célula rebelde ou uma ordem secreta.' },
  { name: 'Corpo Danificado Permanentemente', points: 5, type: 'fisico', description: 'O personagem possui uma limitação física severa, dano em seu córtex, dano estrutural ou condição permanente que exige adaptação constante. Esse Defeito é especialmente indicado para droides.' },
  { name: 'Alvo de Experimentos', points: 5, type: 'narrativo',   description: 'O personagem foi cobaia de pesquisas imperiais, Sith, corporativas ou criminosas, e ainda carrega marcas disso.' },
  { name: 'Identidade Proibida',  points: 5, type: 'narrativo',   description: 'O personagem é algo que não deveria existir, como um clone ilegal, droide consciente, herdeiro escondido, Jedi sobrevivente ou criação experimental.' },
  { name: 'Ligação Sombria',      points: 5, type: 'forca',       description: 'O personagem possui uma conexão perigosa com o Lado Sombrio, podendo ser tentado, rastreado ou influenciado em momentos de fragilidade.' },
];

/** Rótulos legíveis por tipo de Defeito. */
const DEFECT_TYPE_LABELS = {
  social: 'Social', fisico: 'Físico', mental: 'Mental', tecnologico: 'Tecnológico',
  imperial: 'Imperial', criminal: 'Criminal', forca: 'Força', narrativo: 'Narrativo', outro: 'Outro',
};

/** Palavra de gravidade por pontuação. */
const DEFECT_GRAVITY_LABELS = {
  1: 'Leve', 2: 'Moderado', 3: 'Sério', 4: 'Grave', 5: 'Extremo',
};

/** Filtro de gravidade atualmente selecionado na lista de prontos. */
let defectPresetFilter = 'all';

/**
 * Define o filtro de gravidade e re-renderiza a lista de prontos.
 * @param {string} filter - 'all' | '1'..'5'
 */
export function setPresetFilter(filter) {
  defectPresetFilter = filter;
  renderPresetDefects();
}

/**
 * Retorna o nome legível de um tipo de Defeito.
 * @param {string} type
 * @returns {string}
 */
function getDefectTypeName(type) {
  return DEFECT_TYPE_LABELS[type] || 'Outro';
}

/**
 * Soma o total de pontos recebidos por todos os Defeitos escolhidos.
 * @returns {number}
 */
export function calculateDefectPoints() {
  return sheetState.defects.reduce((sum, d) => sum + (Number(d.points) || 0), 0);
}

/**
 * Retorna a maior gravidade (pontos) entre os Defeitos escolhidos.
 * @returns {number} 0 se não houver Defeitos
 */
function getHighestDefectGravity() {
  return sheetState.defects.reduce((max, d) => Math.max(max, Number(d.points) || 0), 0);
}

/**
 * Atualiza o painel de resumo: total, quantidade, maior gravidade,
 * aviso de Defeitos graves e o contador na aba.
 */
export function updateDefectSummary() {
  const total   = calculateDefectPoints();
  const count   = sheetState.defects.length;
  const highest = getHighestDefectGravity();

  const totalEl   = byId('defect-total-points');
  const countEl   = byId('defect-count');
  const highestEl = byId('defect-highest');
  if (totalEl)   totalEl.textContent   = total;
  if (countEl)   countEl.textContent   = count;
  if (highestEl) highestEl.textContent = highest > 0 ? `${highest} (${DEFECT_GRAVITY_LABELS[highest]})` : '—';

  const warning = byId('defect-warning');
  if (warning) warning.hidden = highest < 4;

  const tabBadge = byId('tab-defeitos-count');
  if (tabBadge) {
    tabBadge.textContent = count;
    tabBadge.hidden = count === 0;
  }
}

/**
 * Adiciona um Defeito personalizado a partir do formulário.
 */
export function addDefect() {
  const name   = getVal('defect-name').trim();
  const points = parseInt(getVal('defect-points'), 10) || 1;
  const type   = getVal('defect-type');
  const desc   = getVal('defect-desc').trim();

  if (!name) {
    showStatus('Preencha o nome do Defeito.', 'error');
    return;
  }

  sheetState.defects.push({
    id: generateId(), name, points, type, description: desc, source: 'custom',
  });

  byId('defect-name').value = '';
  byId('defect-desc').value = '';
  byId('defect-points').value = '3';

  renderDefects();
  showStatus('Defeito personalizado adicionado (requer aprovação do Mestre).', 'saved', 2500);
}

/**
 * Adiciona um Defeito pronto da lista pelo índice em PRESET_DEFECTS.
 * @param {number} index
 */
export function addPresetDefect(index) {
  const preset = PRESET_DEFECTS[index];
  if (!preset) return;

  sheetState.defects.push({
    id: generateId(),
    name: preset.name,
    points: preset.points,
    type: preset.type,
    description: preset.description,
    source: 'preset',
  });

  renderDefects();
  showStatus(`Defeito adicionado: ${preset.name} (+${preset.points}).`, 'saved', 2000);
}

/**
 * Remove um Defeito escolhido pelo ID.
 * @param {string} id
 */
export function removeDefect(id) {
  sheetState.defects = sheetState.defects.filter(d => d.id !== id);
  renderDefects();
}

/**
 * Renderiza a lista de Defeitos prontos, respeitando o filtro de gravidade.
 */
export function renderPresetDefects() {
  const container = byId('defect-presets-list');
  if (!container) return;
  container.innerHTML = '';

  const grades = defectPresetFilter === 'all' ? [1, 2, 3, 4, 5] : [Number(defectPresetFilter)];

  grades.forEach(grade => {
    const presetsOfGrade = PRESET_DEFECTS
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => p.points === grade);
    if (!presetsOfGrade.length) return;

    const section = document.createElement('section');
    section.className = `preset-defects-section defect-severity-${grade} grav-${grade}`;
    section.innerHTML = `
      <div class="preset-defects-section-header">
        <span class="preset-section-title">Defeitos de ${grade} ${grade === 1 ? 'Ponto' : 'Pontos'}</span>
        <span class="defect-grav-badge grav-${grade}">${DEFECT_GRAVITY_LABELS[grade]}</span>
        <span class="preset-section-count">${presetsOfGrade.length}</span>
      </div>
    `;

    const grid = document.createElement('div');
    grid.className = 'preset-defects-grid';

    presetsOfGrade.forEach(preset => {
      const card = document.createElement('article');
      card.className = `defect-card preset-defect-card grav-${preset.points} defect-severity-${preset.points}`;
      card.innerHTML = `
        <div class="defect-card-header">
          <span class="defect-card-name">${escapeHtml(preset.name)}</span>
          <span class="defect-points-badge grav-${preset.points}">+${preset.points}</span>
        </div>
        <div class="defect-card-meta">
          <span class="defect-type-badge">${escapeHtml(getDefectTypeName(preset.type))}</span>
        </div>
        <details class="defect-card-details">
          <summary class="defect-card-summary">Descrição</summary>
          <p class="defect-card-desc">${escapeHtml(preset.description)}</p>
        </details>
        <div class="defect-card-foot">
          <button class="btn btn--secondary btn--sm" data-action="add-preset" data-index="${preset.index}">+ Adicionar</button>
        </div>
      `;
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

/**
 * Renderiza a lista de Defeitos escolhidos e atualiza o resumo.
 */
export function renderDefects() {
  const container = byId('defects-list');
  if (!container) return;
  container.innerHTML = '';

  if (sheetState.defects.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhum Defeito escolhido ainda. Use o formulário ou a lista de Defeitos prontos.</p>';
    updateDefectSummary();
    return;
  }

  sheetState.defects.forEach(defect => {
    const card = document.createElement('div');
    card.className  = `defect-card grav-${defect.points} defect-severity-${defect.points}`;
    card.dataset.id = defect.id;

    const sourceLabel = defect.source === 'custom'
      ? '<span class="defect-source-badge defect-source-badge--custom">Personalizado — requer aprovação do Mestre</span>'
      : '<span class="defect-source-badge">Pronto</span>';

    const severeNote = defect.points >= 4
      ? '<p class="defect-severe-note">⚠ Defeito grave: deve impactar bastante a história.</p>'
      : '';

    card.innerHTML = `
      <div class="defect-card-header">
        <span class="defect-card-name">${escapeHtml(defect.name)}</span>
        <span class="defect-points-badge grav-${defect.points}">+${escapeHtml(String(defect.points))}</span>
      </div>
      <div class="defect-card-meta">
        <span class="defect-type-badge">${escapeHtml(getDefectTypeName(defect.type))}</span>
        <span class="defect-grav-badge grav-${defect.points}">${DEFECT_GRAVITY_LABELS[defect.points] || ''}</span>
        ${sourceLabel}
      </div>
      ${defect.description ? `<p class="defect-card-desc">${escapeHtml(defect.description)}</p>` : ''}
      ${severeNote}
      <div class="defect-card-foot">
        <button class="btn btn--danger btn--sm" data-action="remove-defect" data-id="${escapeHtml(defect.id)}" aria-label="Remover ${escapeHtml(defect.name)}">✕ Remover</button>
      </div>
    `;
    container.appendChild(card);
  });

  updateDefectSummary();
}
