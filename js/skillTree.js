/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   skillTree.js — Árvore de Habilidades (aba separada)

   Responsabilidade:
   - Definir os nós da árvore (Manobras, Técnicas da Força, Passivas).
   - Renderizar categorias, nós conectados, linhas e painel de detalhes.
   - Desbloquear nós usando Pontos de Defeito (com pré-requisitos).
   - Usar habilidades ativas gastando Esforço ou Conexão.
   - Calcular pontos gastos/restantes e atualizar o resumo.

   Esta aba NÃO substitui nenhuma outra. É uma visualização de
   progressão ramificada inspirada em árvores de habilidades.
   ============================================================ */

'use strict';

import { sheetState } from './state.js';
import { byId, escapeHtml } from './dom.js';
import { showStatus } from './ui.js';
import { calculateDefectPoints } from './defects.js';
import { updateEffort, updateConnection } from './resources.js';
import { addToHistory } from './dice.js';

/* ------------------------------------------------------------
   ESTRUTURA DE CATEGORIAS (menu lateral)
   Cada "árvore" agrupa ramificações (branches).
------------------------------------------------------------ */
export const SKILL_TREES = [
  {
    id: 'sobrevivencia', name: 'Sobrevivência', icon: '🛡',
    branches: [
      { id: 'resistencia', name: 'Resistência' },
      { id: 'mobilidade',  name: 'Mobilidade'  },
      { id: 'recuperacao', name: 'Recuperação' },
    ],
  },
  {
    id: 'combate', name: 'Combate', icon: '⚔',
    branches: [
      { id: 'precisao', name: 'Precisão' },
      { id: 'taticas',  name: 'Táticas'  },
      { id: 'cacador',  name: 'Caçador'  },
    ],
  },
  {
    id: 'forca', name: 'Força', icon: '✦',
    branches: [
      { id: 'instinto',        name: 'Instinto'        },
      { id: 'telecinese',      name: 'Telecinese'      },
      { id: 'controle-mental', name: 'Controle Mental' },
      { id: 'lado-sombrio',    name: 'Lado Sombrio'    },
    ],
  },
];

/* ------------------------------------------------------------
   NÓS DA ÁRVORE
   x / y são coordenadas (px) para posicionar o nó no canvas.
   prereqMode: 'all' (padrão) exige todos; 'any' exige um deles.
------------------------------------------------------------ */
export const SKILL_TREE_NODES = [
  /* ===================== SOBREVIVÊNCIA / RESISTÊNCIA ===================== */
  {
    id: 'recuperar-posicao', name: 'Recuperar Posição', icon: '↺',
    tree: 'sobrevivencia', branch: 'resistencia',
    type: 'maneuver', category: 'Simples', sensitiveRequired: false,
    purchaseCost: 1, resourceCost: 1, resourceType: 'effort', action: 'Movimento',
    description: 'Reposiciona-se rapidamente, livrando-se de condições simples de posicionamento.',
    effect: 'Remove Derrubado, Exposto, penalidade simples de terreno ou desvantagem narrativa de posicionamento.',
    prerequisites: [], x: 232, y: 24,
  },
  {
    id: 'passo-evasivo', name: 'Passo Evasivo', icon: '↯',
    tree: 'sobrevivencia', branch: 'resistencia',
    type: 'maneuver', category: 'Simples', sensitiveRequired: false,
    purchaseCost: 1, resourceCost: 1, resourceType: 'effort', action: 'Movimento',
    description: 'Um deslocamento ágil que dificulta ser atingido.',
    effect: 'Ataques contra o personagem recebem -10% até o início do próximo turno.',
    prerequisites: ['recuperar-posicao'], x: 232, y: 168,
  },
  {
    id: 'bloqueio-tatico', name: 'Bloqueio Tático', icon: '⛨',
    tree: 'sobrevivencia', branch: 'resistencia',
    type: 'maneuver', category: 'Avançada', sensitiveRequired: false,
    purchaseCost: 2, resourceCost: 2, resourceType: 'effort', action: 'Reação',
    description: 'Apara ou absorve parte do impacto recebido.',
    effect: 'Quando sofrer dano, reduz o dano recebido em uma categoria.',
    prerequisites: ['passo-evasivo'], x: 232, y: 312,
  },
  {
    id: 'ultimo-arranque', name: 'Último Arranque', icon: '✸',
    tree: 'sobrevivencia', branch: 'resistencia',
    type: 'maneuver', category: 'Rara / Secreta', sensitiveRequired: false,
    purchaseCost: 3, resourceCost: 3, resourceType: 'effort', action: 'Livre',
    description: 'Reserva de adrenalina liberada em situação crítica.',
    effect: 'Com metade da Vida ou menos, escolhe dois benefícios físicos até o fim do turno. Depois recebe -25% até o próximo Descanso Longo.',
    prerequisites: ['bloqueio-tatico'], x: 232, y: 456,
  },

  /* ===================== COMBATE / PRECISÃO ===================== */
  {
    id: 'saque-rapido', name: 'Saque Rápido', icon: '⚡',
    tree: 'combate', branch: 'precisao',
    type: 'maneuver', category: 'Simples', sensitiveRequired: false,
    purchaseCost: 1, resourceCost: 1, resourceType: 'effort', action: 'Livre',
    description: 'Saca ou guarda a arma num piscar de olhos.',
    effect: 'Pode sacar ou guardar arma sem gastar Ação de Movimento. Se usar antes de ataque no mesmo turno, recebe +10%.',
    prerequisites: [], x: 232, y: 24,
  },
  {
    id: 'mira-concentrada', name: 'Mira Concentrada', icon: '◎',
    tree: 'combate', branch: 'precisao',
    type: 'maneuver', category: 'Simples', sensitiveRequired: false,
    purchaseCost: 1, resourceCost: 1, resourceType: 'effort', action: 'Movimento',
    description: 'Concentra a pontaria no próximo disparo.',
    effect: 'Próximo ataque à distância recebe +10%. Em crítico, dano aumenta em uma categoria.',
    prerequisites: ['saque-rapido'], x: 232, y: 168,
  },
  {
    id: 'disparo-duplo', name: 'Disparo Duplo', icon: '⁑',
    tree: 'combate', branch: 'precisao',
    type: 'maneuver', category: 'Avançada', sensitiveRequired: false,
    purchaseCost: 2, resourceCost: 2, resourceType: 'effort', action: 'Padrão',
    description: 'Dois tiros precisos em sequência.',
    effect: 'Ataque com -15%. Se acertar, causa +2 dados no mesmo alvo ou atinge segundo alvo próximo com metade do dano.',
    prerequisites: ['mira-concentrada'], x: 232, y: 312,
  },
  {
    id: 'execucao-cacador', name: 'Execução de Caçador', icon: '✛',
    tree: 'combate', branch: 'precisao',
    type: 'maneuver', category: 'Rara / Secreta', sensitiveRequired: false,
    purchaseCost: 3, resourceCost: 3, resourceType: 'effort', action: 'Padrão',
    description: 'Golpe certeiro contra um alvo em desvantagem.',
    effect: 'Contra alvo ferido, marcado, encurralado ou em desvantagem narrativa, pode causar Dano Máximo, Atordoado, Imobilizado ou +40% para Captura.',
    prerequisites: ['disparo-duplo'], x: 232, y: 456,
  },

  /* ===================== COMBATE / TÁTICAS ===================== */
  {
    id: 'investida', name: 'Investida', icon: '➤',
    tree: 'combate', branch: 'taticas',
    type: 'maneuver', category: 'Simples', sensitiveRequired: false,
    purchaseCost: 1, resourceCost: 1, resourceType: 'effort', action: 'Padrão',
    description: 'Avança contra o inimigo aproveitando o impulso.',
    effect: 'Move até metade do Movimento como deslocamento bônus e faz ataque corpo a corpo como ação livre. Se acertar, dano +1 dado.',
    prerequisites: [], x: 232, y: 24,
  },
  {
    id: 'golpe-brutal', name: 'Golpe Brutal', icon: '⚒',
    tree: 'combate', branch: 'taticas',
    type: 'maneuver', category: 'Avançada', sensitiveRequired: false,
    purchaseCost: 2, resourceCost: 2, resourceType: 'effort', action: 'Padrão',
    description: 'Um ataque corpo a corpo de força esmagadora.',
    effect: 'Ao acertar corpo a corpo, dano aumenta uma categoria e cada dado recebe +1 fixo.',
    prerequisites: ['investida'], x: 96, y: 184,
  },
  {
    id: 'golpe-desarme', name: 'Golpe de Desarme', icon: '⚔',
    tree: 'combate', branch: 'taticas',
    type: 'maneuver', category: 'Avançada', sensitiveRequired: false,
    purchaseCost: 2, resourceCost: 2, resourceType: 'effort', action: 'Padrão',
    description: 'Mira na arma ou no equipamento do inimigo.',
    effect: 'Ataque com -10%. Se acertar, causa dano ao objeto com +1 dado ou desarma automaticamente.',
    prerequisites: ['investida'], x: 368, y: 184,
  },
  {
    id: 'contra-ataque', name: 'Contra-Ataque', icon: '↩',
    tree: 'combate', branch: 'taticas',
    type: 'maneuver', category: 'Rara / Secreta', sensitiveRequired: false,
    purchaseCost: 3, resourceCost: 3, resourceType: 'effort', action: 'Reação',
    description: 'Responde imediatamente a um ataque frustrado.',
    effect: 'Após esquivar, bloquear ou resistir com sucesso, pode atacar o agressor com -25%.',
    prerequisites: ['golpe-brutal', 'golpe-desarme'], prereqMode: 'any', x: 232, y: 344,
  },

  /* ===================== COMBATE / CAÇADOR ===================== */
  {
    id: 'tiro-supressao', name: 'Tiro de Supressão', icon: '◣',
    tree: 'combate', branch: 'cacador',
    type: 'maneuver', category: 'Avançada', sensitiveRequired: false,
    purchaseCost: 2, resourceCost: 2, resourceType: 'effort', action: 'Padrão',
    description: 'Cobre uma área com fogo de contenção.',
    effect: 'Controla uma área. Inimigos que atravessarem ou agirem livremente recebem -15%.',
    prerequisites: ['mira-concentrada'], x: 120, y: 40,
  },
  {
    id: 'captura-nao-letal', name: 'Captura Não-Letal', icon: '⛓',
    tree: 'combate', branch: 'cacador',
    type: 'maneuver', category: 'Avançada', sensitiveRequired: false,
    purchaseCost: 2, resourceCost: 2, resourceType: 'effort', action: 'Padrão',
    description: 'Neutraliza o alvo sem matá-lo.',
    effect: 'Reduz dano pela metade para aplicar Derrubado, Imobilizado ou Desarmado.',
    prerequisites: ['tiro-supressao'], x: 120, y: 200,
  },
  {
    id: 'pilotagem-impossivel', name: 'Pilotagem Impossível', icon: '✈',
    tree: 'combate', branch: 'cacador',
    type: 'maneuver', category: 'Avançada', sensitiveRequired: false,
    purchaseCost: 2, resourceCost: 2, resourceType: 'effort', action: 'Reação ou Padrão',
    description: 'Manobras de pilotagem que desafiam o possível.',
    effect: 'Recebe +20% em teste de pilotagem para escapar, evitar colisão, atravessar zona perigosa ou realizar curva impossível.',
    prerequisites: [], x: 384, y: 40,
  },

  /* ===================== FORÇA / INSTINTO ===================== */
  {
    id: 'sentir-perigo', name: 'Sentir Perigo', icon: '⚠',
    tree: 'forca', branch: 'instinto',
    type: 'force-technique', category: 'Simples', sensitiveRequired: false,
    purchaseCost: 1, resourceCost: 1, resourceType: 'connection', action: 'Reação',
    description: 'A Força avisa sobre ameaças iminentes.',
    effect: 'Quando for surpreendido, emboscado ou atacado, recebe +10% em esquiva, reação, iniciativa ou percepção por 2 rodadas.',
    prerequisites: [], x: 232, y: 24,
  },
  {
    id: 'calma-interior', name: 'Calma Interior', icon: '☯',
    tree: 'forca', branch: 'instinto',
    type: 'force-technique', category: 'Simples', sensitiveRequired: true,
    purchaseCost: 1, resourceCost: 1, resourceType: 'connection', action: 'Livre',
    description: 'Centraliza-se e afasta o medo.',
    effect: 'Recebe +10% no próximo teste de Espírito e pode resistir/remover medo, pressão emocional ou perturbação da Força.',
    prerequisites: ['sentir-perigo'], x: 96, y: 184,
  },
  {
    id: 'sentir-emocoes', name: 'Sentir Emoções', icon: '❍',
    tree: 'forca', branch: 'instinto',
    type: 'force-technique', category: 'Simples', sensitiveRequired: true,
    purchaseCost: 1, resourceCost: 1, resourceType: 'connection', action: 'Padrão',
    description: 'Percebe os sentimentos ao redor pela Força.',
    effect: 'Teste de Espírito para perceber a emoção dominante próxima.',
    prerequisites: ['sentir-perigo'], x: 368, y: 184,
  },
  {
    id: 'visao-forca', name: 'Visão da Força', icon: '𓂀',
    tree: 'forca', branch: 'instinto',
    type: 'force-technique', category: 'Rara / Secreta', sensitiveRequired: true,
    purchaseCost: 3, resourceCost: 3, resourceType: 'connection', action: 'Padrão',
    description: 'Vislumbres do passado, do perigo e de destinos possíveis.',
    effect: 'Teste de Espírito para fazer 2 perguntas ao Mestre sobre perigo, passado, emoção, destino possível, Lado Sombrio ou caminho seguro.',
    prerequisites: ['calma-interior', 'sentir-emocoes'], prereqMode: 'all', x: 232, y: 344,
  },

  /* ===================== FORÇA / TELECINESE ===================== */
  {
    id: 'puxao-forca', name: 'Puxão da Força', icon: '⇠',
    tree: 'forca', branch: 'telecinese',
    type: 'force-technique', category: 'Simples', sensitiveRequired: true,
    purchaseCost: 1, resourceCost: 1, resourceType: 'connection', action: 'Movimento',
    description: 'Atrai objetos com a Força.',
    effect: 'Puxa objetos leves, armas caídas, alavancas, comunicadores ou itens próximos.',
    prerequisites: [], x: 232, y: 24,
  },
  {
    id: 'empurrao-forca', name: 'Empurrão da Força', icon: '⇢',
    tree: 'forca', branch: 'telecinese',
    type: 'force-technique', category: 'Simples', sensitiveRequired: true,
    purchaseCost: 1, resourceCost: 1, resourceType: 'connection', action: 'Padrão',
    description: 'Repele alvos e objetos com uma onda de Força.',
    effect: 'Teste de Espírito para empurrar alvo até 12m, derrubar, afastar objeto ou abrir espaço.',
    prerequisites: ['puxao-forca'], x: 96, y: 184,
  },
  {
    id: 'salto-forca', name: 'Salto da Força', icon: '⤒',
    tree: 'forca', branch: 'telecinese',
    type: 'force-technique', category: 'Simples', sensitiveRequired: true,
    purchaseCost: 1, resourceCost: 1, resourceType: 'connection', action: 'Movimento',
    description: 'Saltos impossíveis amplificados pela Força.',
    effect: 'Salta grandes distâncias, ignora terreno difícil simples e pode saltar até o dobro do Movimento.',
    prerequisites: ['puxao-forca'], x: 368, y: 184,
  },
  {
    id: 'telecinese', name: 'Telecinese', icon: '✥',
    tree: 'forca', branch: 'telecinese',
    type: 'force-technique', category: 'Avançada', sensitiveRequired: true,
    purchaseCost: 2, resourceCost: 2, resourceType: 'connection', action: 'Padrão',
    description: 'Manipula objetos maiores com a mente.',
    effect: 'Move objeto médio, segura porta, arrasta alvo, desarma alguém ou prende objeto no ar.',
    prerequisites: ['empurrao-forca'], x: 96, y: 344,
  },

  /* ===================== FORÇA / CONTROLE MENTAL ===================== */
  {
    id: 'truque-mental', name: 'Truque Mental', icon: '✋',
    tree: 'forca', branch: 'controle-mental',
    type: 'force-technique', category: 'Avançada', sensitiveRequired: true,
    purchaseCost: 2, resourceCost: 2, resourceType: 'connection', action: 'Padrão',
    description: 'Sugestiona mentes fracas.',
    effect: 'Teste de Espírito para fazer um alvo aceitar uma sugestão simples e plausível.',
    prerequisites: ['sentir-emocoes'], x: 96, y: 44,
  },
  {
    id: 'ocultar-presenca', name: 'Ocultar Presença', icon: '◌',
    tree: 'forca', branch: 'controle-mental',
    type: 'force-technique', category: 'Avançada', sensitiveRequired: true,
    purchaseCost: 2, resourceCost: 2, resourceType: 'connection', action: 'Padrão',
    description: 'Esconde a própria presença na Força e dos sentidos.',
    effect: 'Até o fim da cena ou até ação chamativa, testes para detectar o personagem recebem -15%.',
    prerequisites: ['calma-interior'], x: 368, y: 44,
  },
  {
    id: 'meditacao-batalha', name: 'Meditação de Batalha', icon: '✶',
    tree: 'forca', branch: 'controle-mental',
    type: 'force-technique', category: 'Rara / Secreta', sensitiveRequired: true,
    purchaseCost: 3, resourceCost: 3, resourceType: 'connection', action: 'Padrão',
    description: 'Inspira e coordena aliados pela Força.',
    effect: 'Teste de Espírito para dar +25% nos próximos testes de até 2 aliados. Em crítico, afeta até 4 aliados ou remove Amedrontado.',
    prerequisites: ['truque-mental', 'ocultar-presenca'], prereqMode: 'any', x: 232, y: 204,
  },

  /* ===================== FORÇA / LADO SOMBRIO ===================== */
  {
    id: 'aperto-forca', name: 'Aperto da Força', icon: '✊',
    tree: 'forca', branch: 'lado-sombrio',
    type: 'force-technique', category: 'Rara / Proibida', sensitiveRequired: true,
    purchaseCost: 3, resourceCost: 3, resourceType: 'connection', action: 'Padrão',
    description: 'Sufoca o alvo à distância. Tentação do Lado Sombrio.',
    effect: 'Teste de Espírito contra alvo visível. Em sucesso, causa 5d12 e aplica Imobilizado. Em crítico, dano máximo. Usar pode aproximar do Lado Sombrio.',
    prerequisites: ['telecinese'], x: 232, y: 44,
  },
  {
    id: 'raio-forca', name: 'Raio da Força', icon: '⚡',
    tree: 'forca', branch: 'lado-sombrio',
    type: 'force-technique', category: 'Rara / Proibida', sensitiveRequired: true,
    purchaseCost: 3, resourceCost: 3, resourceType: 'connection', action: 'Padrão',
    description: 'Descarrega relâmpagos sombrios. Profundamente corruptor.',
    effect: 'Teste de Espírito contra alvo. Em sucesso, causa 10d8 energético. Em crítico, causa 20d8 + Espírito e aplica Atordoado a todos os alvos do combate. Usar pode aproximar extremamente do Lado Sombrio.',
    prerequisites: ['aperto-forca'], x: 232, y: 204,
  },
];

/* Rótulos legíveis por tipo de habilidade. */
const TYPE_LABELS = {
  'maneuver':        'Manobra',
  'force-technique': 'Técnica da Força',
  'passive':         'Passiva',
};

/* Rótulo legível por recurso usado. */
const RESOURCE_LABELS = {
  effort:     'Esforço',
  connection: 'Conexão',
  none:       'Nenhum',
};

/* Dimensões do nó (usadas para centralizar as linhas SVG). */
const NODE_W = 96;
const NODE_HEAD = 88; // altura da parte circular/hex do nó

/* Categoria (branch) atualmente exibida e nó selecionado. */
let currentBranch = 'resistencia';
let selectedNodeId = null;

/* ------------------------------------------------------------
   ACESSO À CATEGORIA SELECIONADA (usado pela persistência)
------------------------------------------------------------ */
export function getSkillTreeCategory() {
  return currentBranch;
}
export function setSkillTreeCategory(branchId) {
  if (branchId && SKILL_TREE_NODES.some(n => n.branch === branchId)) {
    currentBranch = branchId;
  } else if (branchId && SKILL_TREES.some(t => t.branches.some(b => b.id === branchId))) {
    currentBranch = branchId;
  }
}

/* ------------------------------------------------------------
   CONSULTAS BÁSICAS
------------------------------------------------------------ */
function getNodeById(id) {
  return SKILL_TREE_NODES.find(n => n.id === id) || null;
}
function getNodesByBranch(branchId) {
  return SKILL_TREE_NODES.filter(n => n.branch === branchId);
}
function isNodeUnlocked(id) {
  return sheetState.unlockedSkillTreeNodes.includes(id);
}
function getBranchName(branchId) {
  for (const tree of SKILL_TREES) {
    const b = tree.branches.find(x => x.id === branchId);
    if (b) return b.name;
  }
  return branchId;
}

/**
 * Retorna o estado de um nó: 'unlocked' | 'available'.
 * Todas as habilidades estão disponíveis desde o começo — não existe
 * estado 'locked' por pré-requisito. Só muda quando a habilidade é comprada.
 * @param {string} nodeId
 * @returns {'unlocked'|'available'}
 */
export function getSkillNodeStatus(nodeId) {
  return isNodeUnlocked(nodeId) ? 'unlocked' : 'available';
}

/**
 * Indica se um nó pode ser comprado agora (apenas se ainda não foi comprado).
 * Não verifica pré-requisitos. A falta de pontos NÃO bloqueia — apenas
 * gera alerta (regra do sistema: o Mestre pode permitir exceções).
 * @param {string} nodeId
 * @returns {boolean}
 */
export function canUnlockSkillNode(nodeId) {
  const node = getNodeById(nodeId);
  return !!node && !isNodeUnlocked(nodeId);
}

/* ------------------------------------------------------------
   PONTOS
------------------------------------------------------------ */
/** Soma o custo de compra de todos os nós desbloqueados. */
export function calculateSkillTreeSpentPoints() {
  return sheetState.unlockedSkillTreeNodes.reduce((sum, id) => {
    const node = getNodeById(id);
    return sum + (node ? node.purchaseCost : 0);
  }, 0);
}

/** Pontos restantes = Pontos de Defeito totais − pontos gastos na árvore. */
export function calculateSkillTreeRemainingPoints() {
  return calculateDefectPoints() - calculateSkillTreeSpentPoints();
}

/* ------------------------------------------------------------
   AÇÕES: DESBLOQUEAR E USAR
------------------------------------------------------------ */
/**
 * Desbloqueia (compra) um nó disponível.
 * @param {string} nodeId
 */
export function unlockSkillNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return;

  if (isNodeUnlocked(nodeId)) {
    showStatus('Esta habilidade já está comprada.', 'info', 2000);
    return;
  }

  // Todas as habilidades estão disponíveis desde o começo — sem bloqueio
  // por pré-requisito. O jogador só precisa comprar com Pontos de Defeito.
  sheetState.unlockedSkillTreeNodes.push(nodeId);

  // Aviso de sensibilidade à Força (não bloqueia).
  if (node.sensitiveRequired) {
    showStatus('Requer sensibilidade à Força ou autorização narrativa do Mestre.', 'info', 4000);
  }

  // Aviso de pontos excedidos (não bloqueia).
  const remaining = calculateSkillTreeRemainingPoints();
  if (remaining < 0) {
    showStatus(`Habilidade comprada, mas você excedeu os Pontos de Defeito em ${Math.abs(remaining)}.`, 'error', 4000);
  } else {
    showStatus(`Comprado: ${node.name} (−${node.purchaseCost} ponto${node.purchaseCost > 1 ? 's' : ''}).`, 'saved', 2500);
  }

  selectedNodeId = nodeId;
  renderSkillTreePage();
}

/**
 * Usa uma habilidade ativa já desbloqueada, gastando o recurso correspondente.
 * @param {string} nodeId
 */
export function useSkillTreeNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return;

  if (!isNodeUnlocked(nodeId)) {
    showStatus('Desbloqueie esta habilidade antes de usá-la.', 'error', 2500);
    return;
  }

  if (node.type === 'passive' || node.resourceType === 'none') {
    if (node.type === 'passive') {
      showStatus(`${node.name} é uma habilidade passiva — sempre ativa.`, 'info', 2500);
    } else {
      showStatus(`${node.name} usada.`, 'saved', 2000);
    }
    registerSkillUse(node, 0);
    return;
  }

  const isEffort = node.resourceType === 'effort';
  const current  = isEffort ? sheetState.effortCurrent : sheetState.connectionCurrent;
  const label    = RESOURCE_LABELS[node.resourceType];

  if (current < node.resourceCost) {
    showStatus(`${label} insuficiente para usar ${node.name} (precisa de ${node.resourceCost}).`, 'error', 3000);
    return;
  }

  if (isEffort) updateEffort(-node.resourceCost);
  else          updateConnection(-node.resourceCost);

  registerSkillUse(node, node.resourceCost);
  showStatus(`${node.name} usada (−${node.resourceCost} ${label}).`, 'saved', 2500);
  updateSkillTreeSummary();
}

/**
 * Registra o uso de uma habilidade no histórico de rolagens/ações.
 * @param {object} node
 * @param {number} spent - quantidade de recurso gasto
 */
function registerSkillUse(node, spent) {
  const label = RESOURCE_LABELS[node.resourceType];
  const remaining = node.resourceType === 'effort'
    ? sheetState.effortCurrent
    : node.resourceType === 'connection'
      ? sheetState.connectionCurrent
      : '—';

  addToHistory({
    name: `${TYPE_LABELS[node.type]}: ${node.name}`,
    result: 'S',
    isAutoSuccess: true,
    success: true,
    attrValue: remaining,
    grade: spent > 0 ? `−${spent} ${label}` : 'Passiva',
    rolls: [],
    type: 'skill-use',
  });
}

/* ------------------------------------------------------------
   SELEÇÃO
------------------------------------------------------------ */
/**
 * Seleciona uma categoria (branch) e re-renderiza a árvore.
 * @param {string} branchId
 */
export function selectSkillTreeCategory(branchId) {
  currentBranch = branchId;
  selectedNodeId = null;
  localStorage.setItem('skillTreeCategory', branchId);
  renderSkillTreeCategories();
  renderSkillTreeNodes();
  renderSkillTreeLines();
  renderSkillNodeDetails(null);
}

/**
 * Seleciona um nó e mostra seus detalhes no painel lateral.
 * @param {string} nodeId
 */
export function selectSkillNode(nodeId) {
  selectedNodeId = nodeId;
  const canvas = byId('skilltree-canvas');
  if (canvas) {
    canvas.querySelectorAll('.skill-node').forEach(el =>
      el.classList.toggle('is-selected', el.dataset.nodeId === nodeId));
  }
  renderSkillNodeDetails(getNodeById(nodeId));
}

/* ------------------------------------------------------------
   RENDERIZAÇÃO
------------------------------------------------------------ */
/** Renderiza o menu lateral de categorias agrupado por árvore. */
export function renderSkillTreeCategories() {
  const container = byId('skilltree-categories');
  if (!container) return;
  container.innerHTML = '';

  SKILL_TREES.forEach(tree => {
    const group = document.createElement('div');
    group.className = 'skill-tree-category-group';

    const heading = document.createElement('div');
    heading.className = 'skill-tree-category-heading';
    heading.innerHTML = `<span aria-hidden="true">${tree.icon}</span> ${escapeHtml(tree.name)}`;
    group.appendChild(heading);

    tree.branches.forEach(branch => {
      const nodes = getNodesByBranch(branch.id);
      const unlockedCount = nodes.filter(n => isNodeUnlocked(n.id)).length;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill-tree-category-button';
      btn.classList.toggle('active', branch.id === currentBranch);
      btn.dataset.branch = branch.id;
      btn.innerHTML = `
        <span class="skill-tree-category-name">${escapeHtml(branch.name)}</span>
        <span class="skill-tree-category-count">${unlockedCount}/${nodes.length}</span>
      `;
      group.appendChild(btn);
    });

    container.appendChild(group);
  });
}

/** Renderiza os nós da categoria atual posicionados no canvas. */
export function renderSkillTreeNodes() {
  const canvas = byId('skilltree-canvas');
  if (!canvas) return;

  // Remove apenas os nós (mantém a SVG de linhas).
  canvas.querySelectorAll('.skill-node').forEach(el => el.remove());

  const nodes = getNodesByBranch(currentBranch);

  // Mensagem vazia para ramificações ainda sem habilidades.
  let emptyMsg = byId('skilltree-empty');
  if (nodes.length === 0) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('p');
      emptyMsg.id = 'skilltree-empty';
      emptyMsg.className = 'skill-tree-empty';
      canvas.appendChild(emptyMsg);
    }
    emptyMsg.textContent = 'Nenhuma habilidade nesta ramificação ainda.';
    sizeCanvas(canvas, nodes);
    return;
  }
  if (emptyMsg) emptyMsg.remove();

  nodes.forEach(node => {
    const status = getSkillNodeStatus(node.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `skill-node ${status}`;
    if (/Proibida/i.test(node.category)) btn.classList.add('is-forbidden');
    if (node.id === selectedNodeId) btn.classList.add('is-selected');
    btn.dataset.nodeId = node.id;
    btn.style.left = `${node.x}px`;
    btn.style.top  = `${node.y}px`;
    btn.setAttribute('aria-label', `${node.name} — ${TYPE_LABELS[node.type]} — custo ${node.purchaseCost}`);

    const typeShort = node.type === 'force-technique' ? 'F' : node.type === 'passive' ? 'P' : 'M';

    btn.innerHTML = `
      <span class="skill-node-hex">
        <span class="skill-node-icon" aria-hidden="true">${escapeHtml(node.icon || typeShort)}</span>
        <span class="skill-node-cost" title="Custo de compra">${node.purchaseCost}</span>
        ${status === 'unlocked' ? '<span class="skill-node-check" aria-hidden="true">✓</span>' : ''}
      </span>
      <span class="skill-node-name">${escapeHtml(node.name)}</span>
    `;
    canvas.appendChild(btn);
  });

  sizeCanvas(canvas, nodes);
}

/** Ajusta o tamanho do canvas conforme as coordenadas dos nós. */
function sizeCanvas(canvas, nodes) {
  let maxX = 360, maxY = 320;
  nodes.forEach(n => {
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + NODE_HEAD + 40);
  });
  canvas.style.width     = `${maxX + 40}px`;
  canvas.style.minHeight = `${maxY + 24}px`;

  const svg = byId('skilltree-lines');
  if (svg) {
    svg.setAttribute('width', maxX + 40);
    svg.setAttribute('height', maxY + 24);
    svg.setAttribute('viewBox', `0 0 ${maxX + 40} ${maxY + 24}`);
  }
}

/** Desenha as linhas SVG conectando os pré-requisitos dentro da categoria atual. */
export function renderSkillTreeLines() {
  const svg = byId('skilltree-lines');
  if (!svg) return;
  svg.innerHTML = '';

  const nodes = getNodesByBranch(currentBranch);
  const inBranch = new Set(nodes.map(n => n.id));

  const center = node => ({
    x: node.x + NODE_W / 2,
    y: node.y + NODE_HEAD / 2,
  });

  nodes.forEach(node => {
    if (!node.prerequisites) return;
    node.prerequisites.forEach(prereqId => {
      if (!inBranch.has(prereqId)) return; // ignora pré-requisitos de outra categoria
      const prereq = getNodeById(prereqId);
      if (!prereq) return;

      const a = center(prereq);
      const b = center(node);

      // Estado da linha: ativa se ambos desbloqueados; disponível se o destino pode ser comprado.
      let lineClass = 'skill-line';
      if (isNodeUnlocked(node.id)) lineClass += ' is-unlocked';
      else if (getSkillNodeStatus(node.id) === 'available') lineClass += ' is-available';

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      line.setAttribute('class', lineClass);
      svg.appendChild(line);
    });
  });
}

/** Renderiza o painel de detalhes da habilidade selecionada. */
export function renderSkillNodeDetails(node) {
  const panel = byId('skilltree-details');
  if (!panel) return;

  if (!node) {
    panel.innerHTML = `
      <div class="skill-node-details-empty">
        <span class="skill-node-details-empty-icon" aria-hidden="true">✧</span>
        <p>Selecione um nó na árvore para ver os detalhes da habilidade.</p>
      </div>
    `;
    return;
  }

  const status = getSkillNodeStatus(node.id);
  const statusLabel = status === 'unlocked' ? 'Comprada' : 'Disponível';

  const resourceLabel = RESOURCE_LABELS[node.resourceType];
  const useCostText = node.resourceType === 'none'
    ? 'Nenhum'
    : `${node.resourceCost} ${resourceLabel}`;

  // Pré-requisitos são apenas informativos (não bloqueiam a compra).
  const prereqText = (node.prerequisites && node.prerequisites.length)
    ? node.prerequisites.map(id => {
        const p = getNodeById(id);
        const name = p ? p.name : id;
        return `<span class="skill-prereq">${escapeHtml(name)}</span>`;
      }).join(node.prereqMode === 'any' ? ' <em>ou</em> ' : ' ')
    : '<span class="skill-prereq">Nenhuma</span>';

  const sensitiveWarning = node.sensitiveRequired
    ? `<div class="skill-tree-warning">⚠ Requer sensibilidade à Força ou autorização narrativa do Mestre.</div>`
    : '';

  const forbiddenWarning = /Proibida/i.test(node.category)
    ? `<div class="skill-tree-warning skill-tree-warning--dark">☠ Técnica do Lado Sombrio: usá-la pode aproximar o personagem do Lado Sombrio.</div>`
    : '';

  // Botões de ação conforme estado.
  let actionBtn = '';
  if (status === 'available') {
    const remaining = calculateSkillTreeRemainingPoints();
    const insufficient = remaining < node.purchaseCost;
    actionBtn = `
      ${insufficient ? `<div class="skill-tree-warning">⚠ Pontos de Defeito insuficientes (faltam ${node.purchaseCost - remaining}). Você ainda pode comprar se o Mestre permitir.</div>` : ''}
      <button type="button" class="btn btn--primary skill-action-btn" data-action="unlock-node" data-id="${escapeHtml(node.id)}">⊕ Comprar (−${node.purchaseCost})</button>
    `;
  } else {
    if (node.type === 'passive') {
      actionBtn = `<div class="skill-action-passive">✓ Passiva — sempre ativa</div>`;
    } else {
      actionBtn = `<button type="button" class="btn btn--secondary skill-action-btn" data-action="use-node" data-id="${escapeHtml(node.id)}">▶ Usar (−${useCostText})</button>`;
    }
  }

  panel.innerHTML = `
    <div class="skill-node-details-head">
      <span class="skill-node-details-icon ${status}" aria-hidden="true">${escapeHtml(node.icon || '◆')}</span>
      <div>
        <h3 class="skill-node-details-name">${escapeHtml(node.name)}</h3>
        <span class="skill-node-status-badge ${status}">${statusLabel}</span>
      </div>
    </div>

    <div class="skill-node-details-grid">
      <div class="skill-detail"><span class="skill-detail-label">Categoria</span><span class="skill-detail-value">${escapeHtml(getBranchName(node.branch))} · ${escapeHtml(node.category)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Tipo</span><span class="skill-detail-value">${escapeHtml(TYPE_LABELS[node.type])}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Custo de Compra</span><span class="skill-detail-value">${node.purchaseCost} Ponto${node.purchaseCost > 1 ? 's' : ''} de Defeito</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Custo de Uso</span><span class="skill-detail-value">${escapeHtml(useCostText)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Recurso</span><span class="skill-detail-value">${escapeHtml(resourceLabel)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Ação</span><span class="skill-detail-value">${escapeHtml(node.action)}</span></div>
    </div>

    <div class="skill-detail-block">
      <span class="skill-detail-label">Conexões na árvore (informativo)</span>
      <div class="skill-prereq-list">${prereqText}</div>
    </div>

    <div class="skill-detail-block">
      <span class="skill-detail-label">Descrição</span>
      <p class="skill-detail-text">${escapeHtml(node.description)}</p>
    </div>

    <div class="skill-detail-block">
      <span class="skill-detail-label">Efeito Mecânico</span>
      <p class="skill-detail-text">${escapeHtml(node.effect)}</p>
    </div>

    ${sensitiveWarning}
    ${forbiddenWarning}

    <div class="skill-node-details-actions">
      ${actionBtn}
    </div>
  `;
}

/** Atualiza os cards de resumo da árvore. */
export function updateSkillTreeSummary() {
  const total     = calculateDefectPoints();
  const spent     = calculateSkillTreeSpentPoints();
  const remaining = total - spent;
  const unlocked  = sheetState.unlockedSkillTreeNodes.length;

  const set = (id, val) => { const el = byId(id); if (el) el.textContent = val; };

  set('skilltree-total-points', total);
  set('skilltree-spent-points', spent);
  set('skilltree-remaining-points', remaining);
  set('skilltree-effort', `${sheetState.effortCurrent}/${sheetState.effortMax}`);
  set('skilltree-connection', `${sheetState.connectionCurrent}/${sheetState.connectionMax}`);
  set('skilltree-unlocked-count', unlocked);

  const remCard = byId('skilltree-remaining-card');
  if (remCard) remCard.classList.toggle('is-over', remaining < 0);

  const warning = byId('skilltree-warning');
  if (warning) {
    if (remaining < 0) {
      warning.hidden = false;
      warning.textContent = `⚠ Você gastou ${Math.abs(remaining)} ponto(s) além dos Pontos de Defeito disponíveis. O Mestre deve aprovar.`;
    } else {
      warning.hidden = true;
    }
  }
}

/** Render mestre da aba: categorias + nós + linhas + resumo + detalhes. */
export function renderSkillTreePage() {
  // Garante que a categoria atual exista; senão usa a primeira com nós.
  if (!getNodesByBranch(currentBranch).length && !SKILL_TREES.some(t => t.branches.some(b => b.id === currentBranch))) {
    currentBranch = 'resistencia';
  }
  renderSkillTreeCategories();
  renderSkillTreeNodes();
  renderSkillTreeLines();
  updateSkillTreeSummary();
  renderSkillNodeDetails(selectedNodeId ? getNodeById(selectedNodeId) : null);
}
