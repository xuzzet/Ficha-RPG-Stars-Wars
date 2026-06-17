/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   skillTree.js — Árvore de Habilidades (aba separada)

   Responsabilidade:
   - Definir os nós da árvore (Manobras, Técnicas da Força, Passivas).
   - Montar um mapa radial (hub-and-spoke) com um Núcleo central e três
     pilares (Sobrevivência, Combate, Força) em camadas concêntricas.
   - Comprar nós usando Pontos de Defeito (sem pré-requisitos: todas as
     habilidades ficam disponíveis desde o começo).
   - Usar habilidades ativas gastando Esforço ou Conexão.
   - Calcular pontos gastos/restantes e atualizar o resumo.

   As trilhas entre os nós são apenas organização visual/temática —
   nunca bloqueiam a compra de nenhuma habilidade.
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
      { id: 'protecao',        name: 'Proteção'        },
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
    tree: 'sobrevivencia', branch: 'recuperacao',
    type: 'maneuver', category: 'Simples', sensitiveRequired: false,
    purchaseCost: 1, resourceCost: 1, resourceType: 'effort', action: 'Movimento',
    description: 'Reposiciona-se rapidamente, livrando-se de condições simples de posicionamento.',
    effect: 'Remove Derrubado, Exposto, penalidade simples de terreno ou desvantagem narrativa de posicionamento.',
    prerequisites: [], x: 232, y: 24,
  },
  {
    id: 'passo-evasivo', name: 'Passo Evasivo', icon: '↯',
    tree: 'sobrevivencia', branch: 'mobilidade',
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
    tree: 'sobrevivencia', branch: 'recuperacao',
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
    tree: 'combate', branch: 'cacador',
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
    tree: 'sobrevivencia', branch: 'mobilidade',
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

  /* ===================== FORÇA / PROTEÇÃO ===================== */
  {
    id: 'deflexao-blaster', name: 'Deflexão de Blaster', icon: '⟁',
    tree: 'forca', branch: 'protecao',
    type: 'force-technique', category: 'Avançada', sensitiveRequired: true,
    purchaseCost: 2, resourceCost: 2, resourceType: 'connection', action: 'Reação',
    description: 'Desvia disparos guiando a lâmina ou a Força até a trajetória do tiro.',
    effect: 'Como Reação, teste de Espírito para defletir um disparo à distância. Em crítico, redireciona o tiro contra um alvo visível.',
    prerequisites: ['sentir-perigo'], x: 0, y: 0,
  },
  {
    id: 'cura-forca', name: 'Cura pela Força', icon: '✚',
    tree: 'forca', branch: 'protecao',
    type: 'force-technique', category: 'Rara / Secreta', sensitiveRequired: true,
    purchaseCost: 3, resourceCost: 3, resourceType: 'connection', action: 'Padrão',
    description: 'Canaliza a Força para fechar ferimentos e estabilizar o corpo.',
    effect: 'Teste de Espírito para recuperar Vida de si ou de um aliado tocado. Em crítico, remove também uma condição física simples.',
    prerequisites: ['calma-interior'], x: 0, y: 0,
  },
];

/* ------------------------------------------------------------
   NÓ CENTRAL (âncora visual — não é comprado)
------------------------------------------------------------ */
export const CORE_NODE = {
  id: '__core__',
  name: 'Núcleo do Personagem',
  icon: '◈',
  description: 'Centro da árvore. As habilidades se organizam ao redor dos três pilares: Sobrevivência, Combate e Força.',
};

/* ------------------------------------------------------------
   LAYOUT RADIAL (hub-and-spoke)
   Calcula coordenadas percentuais (0–100) para cada nó:
   cada pilar ocupa um setor angular distinto e cada ramo (branch)
   vira um "spoke" radial. Quanto mais longe do centro, mais
   avançada/rara é a habilidade (organização visual — não bloqueia).
------------------------------------------------------------ */
const PILLAR_SECTORS = {
  sobrevivencia: { center: 150, half: 52 },  // base-esquerda
  combate:       { center: 30,  half: 52 },  // base-direita
  forca:         { center: 270, half: 74 },  // topo (mais ramos → setor maior)
};
const BRANCH_BASE_RADIUS = 15;   // raio (%) do nó mais próximo do centro
const BRANCH_RADIUS_STEP = 8.5;  // distância (%) entre nós empilhados no spoke
const BRANCH_STAGGER = 4;        // desloca ramos vizinhos p/ evitar anel cheio
const PILLAR_HUB_RADIUS = 9.5;   // raio (%) do hub discreto de cada pilar

/* Hub (ponto-âncora invisível) de cada pilar: { pilarId: {x, y} }. */
const PILLAR_HUBS = {};

/* Cadeias de tronco por ramo (ordem do centro p/ a borda).
   Cada item: { pillar, branchId, isDark, rootId, nodeIds: [...] }. */
const branchChains = [];

/** Converte a categoria textual numa camada concêntrica (2, 3 ou 4). */
function categoryToLayer(category) {
  if (/Rara|Proibida|Secreta/i.test(category)) return 4;
  if (/Avançada/i.test(category)) return 3;
  return 2;
}

/** Calcula x/y (em %) de cada nó e marca os nós-raiz de cada ramo. */
function computeRadialLayout() {
  branchChains.length = 0;
  SKILL_TREE_NODES.forEach(n => { n.layer = categoryToLayer(n.category); });

  SKILL_TREES.forEach(tree => {
    const sector = PILLAR_SECTORS[tree.id];
    if (!sector) return;

    // Hub discreto do pilar, no ângulo central do setor.
    const hubRad = sector.center * Math.PI / 180;
    PILLAR_HUBS[tree.id] = {
      x: +(50 + PILLAR_HUB_RADIUS * Math.cos(hubRad)).toFixed(2),
      y: +(50 + PILLAR_HUB_RADIUS * Math.sin(hubRad)).toFixed(2),
    };

    const branchesWithNodes = tree.branches
      .map(b => ({
        branch: b,
        nodes: SKILL_TREE_NODES.filter(n => n.tree === tree.id && n.branch === b.id),
      }))
      .filter(entry => entry.nodes.length);

    const total = branchesWithNodes.length;
    const pad = Math.min(sector.half * 0.25, 10);
    const lo = sector.center - sector.half + pad;
    const hi = sector.center + sector.half - pad;

    branchesWithNodes.forEach((entry, bi) => {
      const angle = total === 1
        ? sector.center
        : lo + (hi - lo) * (bi + 0.5) / total;

      // Ramos vizinhos começam em raios alternados para não lotar o anel interno.
      const baseR = BRANCH_BASE_RADIUS + (bi % 2) * BRANCH_STAGGER;

      const sorted = entry.nodes.slice().sort((a, b) =>
        a.layer - b.layer ||
        a.purchaseCost - b.purchaseCost ||
        a.name.localeCompare(b.name, 'pt'));

      sorted.forEach((node, i) => {
        const radius = baseR + i * BRANCH_RADIUS_STEP;
        const rad = angle * Math.PI / 180;
        node.x = +(50 + radius * Math.cos(rad)).toFixed(2);
        node.y = +(50 + radius * Math.sin(rad)).toFixed(2);
      });

      // Registra a cadeia de tronco do ramo (para desenhar trilhas locais).
      branchChains.push({
        pillar: tree.id,
        branchId: entry.branch.id,
        isDark: entry.branch.id === 'lado-sombrio',
        rootId: sorted[0].id,
        nodeIds: sorted.map(n => n.id),
      });
    });
  });
}

computeRadialLayout();

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

/* Filtros da aba (organização visual — nenhum filtro bloqueia compra). */
export const SKILL_FILTERS = [
  { id: 'todos',         label: 'Todos'         },
  { id: 'sobrevivencia', label: 'Sobrevivência' },
  { id: 'combate',       label: 'Combate'       },
  { id: 'forca',         label: 'Força'         },
  { id: 'compradas',     label: 'Compradas'     },
  { id: 'disponiveis',   label: 'Disponíveis'   },
  { id: 'avisos',        label: 'Avisos'        },
];
const FILTER_IDS = SKILL_FILTERS.map(f => f.id);

/* Filtro atual (destaque visual) e nó selecionado (começa no Núcleo). */
let currentFilter = 'todos';
let selectedNodeId = '__core__';

/* ------------------------------------------------------------
   ACESSO AO FILTRO SELECIONADO (usado pela persistência)
------------------------------------------------------------ */
export function getSkillTreeCategory() {
  return currentFilter;
}
export function setSkillTreeCategory(filterId) {
  currentFilter = (filterId && FILTER_IDS.includes(filterId)) ? filterId : 'todos';
}

/* ------------------------------------------------------------
   CONSULTAS BÁSICAS
------------------------------------------------------------ */
function getNodeById(id) {
  return SKILL_TREE_NODES.find(n => n.id === id) || null;
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
function getPillarName(treeId) {
  const t = SKILL_TREES.find(x => x.id === treeId);
  return t ? t.name : treeId;
}
function isForbiddenNode(node) {
  return /Proibida/i.test(node.category);
}
function nodeHasWarning(node) {
  return isForbiddenNode(node) || !!node.sensitiveRequired;
}
function nodeMatchesFilter(node, filter) {
  switch (filter) {
    case 'sobrevivencia':
    case 'combate':
    case 'forca':       return node.tree === filter;
    case 'compradas':   return isNodeUnlocked(node.id);
    case 'disponiveis': return !isNodeUnlocked(node.id);
    case 'avisos':      return nodeHasWarning(node);
    case 'todos':
    default:            return true;
  }
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
 * Desfaz a compra de um nó (estorno), devolvendo os Pontos de Defeito.
 * Útil caso o jogador tenha clicado por engano.
 * @param {string} nodeId
 */
export function refundSkillNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return;

  if (!isNodeUnlocked(nodeId)) {
    showStatus('Esta habilidade não está comprada.', 'info', 2000);
    return;
  }

  const idx = sheetState.unlockedSkillTreeNodes.indexOf(nodeId);
  if (idx !== -1) sheetState.unlockedSkillTreeNodes.splice(idx, 1);

  showStatus(`Compra desfeita: ${node.name} (+${node.purchaseCost} ponto${node.purchaseCost > 1 ? 's' : ''} devolvido${node.purchaseCost > 1 ? 's' : ''}).`, 'saved', 2500);

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
   SELEÇÃO E FILTRO
------------------------------------------------------------ */
/**
 * Aplica um filtro de destaque. Organização visual apenas:
 * nenhum filtro bloqueia compra ou esconde a árvore por completo.
 * @param {string} filterId
 */
export function filterSkillTree(filterId) {
  setSkillTreeCategory(filterId);
  localStorage.setItem('skillTreeCategory', currentFilter);
  renderSkillTreeFilters();
  applySkillTreeFilterHighlight();
}
/* Alias compatível com o restante da ficha. */
export const selectSkillTreeCategory = filterSkillTree;

/**
 * Seleciona um nó (ou o Núcleo) e mostra seus detalhes no painel.
 * @param {string} nodeId
 */
export function selectSkillNode(nodeId) {
  selectedNodeId = nodeId;
  const map = byId('skilltree-map');
  if (map) {
    map.querySelectorAll('.skill-node').forEach(el =>
      el.classList.toggle('focused', el.dataset.nodeId === nodeId));
  }
  highlightLinesForNode(nodeId);
  renderSkillNodeDetails(nodeId);
}

/* ------------------------------------------------------------
   RENDERIZAÇÃO
------------------------------------------------------------ */
/** Renderiza os botões de filtro com contadores. */
export function renderSkillTreeFilters() {
  const container = byId('skilltree-filters');
  if (!container) return;
  container.innerHTML = '';

  SKILL_FILTERS.forEach(filter => {
    const count = SKILL_TREE_NODES.filter(n => nodeMatchesFilter(n, filter.id)).length;
    const active = filter.id === currentFilter;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-tree-filter-btn';
    btn.classList.toggle('active', active);
    btn.dataset.filter = filter.id;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.innerHTML = `<span class="skill-tree-filter-label">${escapeHtml(filter.label)}</span><span class="skill-tree-filter-count">${count}</span>`;
    container.appendChild(btn);
  });
}

/** Reduz a opacidade dos nós que não combinam com o filtro atual. */
function applySkillTreeFilterHighlight() {
  const map = byId('skilltree-map');
  if (!map) return;
  const all = currentFilter === 'todos';

  map.querySelectorAll('.skill-node[data-node-id]').forEach(el => {
    if (el.classList.contains('skill-node-core')) return;
    const node = getNodeById(el.dataset.nodeId);
    const match = all || (node && nodeMatchesFilter(node, currentFilter));
    el.classList.toggle('is-dimmed', !match);
  });

  const svg = byId('skilltree-lines');
  if (svg) svg.classList.toggle('is-filtered', !all);
}

/** Renderiza o Núcleo e todos os nós no mapa radial. */
export function renderSkillTreeNodes() {
  const map = byId('skilltree-map');
  if (!map) return;

  // Remove apenas os nós (mantém a SVG de linhas).
  map.querySelectorAll('.skill-node').forEach(el => el.remove());

  // Núcleo central (âncora — não é comprado).
  const core = document.createElement('button');
  core.type = 'button';
  core.className = 'skill-node skill-node-core';
  if (selectedNodeId === CORE_NODE.id) core.classList.add('focused');
  core.dataset.nodeId = CORE_NODE.id;
  core.style.setProperty('--x', 50);
  core.style.setProperty('--y', 50);
  core.setAttribute('aria-label', `${CORE_NODE.name} — centro da árvore`);
  core.title = `${CORE_NODE.name} — centro da árvore`;
  core.innerHTML = `
    <span class="skill-node-shape">
      <span class="skill-node-icon" aria-hidden="true">${escapeHtml(CORE_NODE.icon)}</span>
    </span>
    <span class="skill-node-label">Núcleo</span>
  `;
  map.appendChild(core);

  // Demais nós.
  SKILL_TREE_NODES.forEach(node => {
    const status = getSkillNodeStatus(node.id);
    const warning = nodeHasWarning(node);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `skill-node ${status}`;
    if (isForbiddenNode(node)) btn.classList.add('is-forbidden');
    if (warning) btn.classList.add('warning');
    if (node.id === selectedNodeId) btn.classList.add('focused');
    btn.dataset.nodeId = node.id;
    btn.style.setProperty('--x', node.x);
    btn.style.setProperty('--y', node.y);

    const typeLabel = TYPE_LABELS[node.type];
    const aria = `${node.name}. ${typeLabel}. ${getPillarName(node.tree)} — ${getBranchName(node.branch)}. ` +
      `Compra ${node.purchaseCost} ponto${node.purchaseCost > 1 ? 's' : ''} de Defeito. ` +
      `${status === 'unlocked' ? 'Comprada.' : 'Disponível.'}${warning ? ' Atenção.' : ''}`;
    btn.setAttribute('aria-label', aria);
    btn.title = `${node.name} · ${typeLabel} · ${node.purchaseCost} PD\n${node.description}`;

    btn.innerHTML = `
      <span class="skill-node-shape">
        <span class="skill-node-icon" aria-hidden="true">${escapeHtml(node.icon)}</span>
        <span class="skill-node-cost" title="Custo de compra">${node.purchaseCost}</span>
        ${status === 'unlocked' ? '<span class="skill-node-check" aria-hidden="true">✓</span>' : ''}
        ${warning ? '<span class="skill-node-flag" aria-hidden="true">!</span>' : ''}
      </span>
      <span class="skill-node-label">${escapeHtml(node.name)}</span>
    `;

    // Hover realça apenas as trilhas locais; ao sair, volta ao nó selecionado.
    btn.addEventListener('mouseenter', () => highlightLinesForNode(node.id));
    btn.addEventListener('mouseleave', () => highlightLinesForNode(selectedNodeId));
    btn.addEventListener('focus', () => highlightLinesForNode(node.id));
    btn.addEventListener('blur', () => highlightLinesForNode(selectedNodeId));

    map.appendChild(btn);
  });
}

/** Renderiza o mapa radial completo (nós + linhas) e aplica o filtro. */
export function renderRadialSkillTree() {
  renderSkillTreeNodes();
  renderSkillTreeLines();
  applySkillTreeFilterHighlight();
}

/** Desenha as trilhas SVG (Núcleo → hubs de pilar → troncos de ramo).
 *  As trilhas são decorativas/organizacionais — NÃO representam pré-requisito.
 *  Estrutura limpa (sem teia): o Núcleo liga só aos 3 hubs; cada hub liga às
 *  raízes dos seus ramos; e cada ramo tem um tronco local entre nós vizinhos. */
export function renderSkillTreeLines() {
  const svg = byId('skilltree-lines');
  if (!svg) return;
  svg.innerHTML = '';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const addLine = (ax, ay, bx, by, opts = {}) => {
    const line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', ax);
    line.setAttribute('y1', ay);
    line.setAttribute('x2', bx);
    line.setAttribute('y2', by);
    let cls = `skill-tree-line line-${opts.pillar || 'core'}`;
    if (opts.isDark) cls += ' line-dark';
    if (opts.active) cls += ' active';
    line.setAttribute('class', cls);
    if (opts.kind)   line.dataset.kind = opts.kind;
    if (opts.pillar) line.dataset.pillar = opts.pillar;
    if (opts.branch) line.dataset.branch = opts.branch;
    if (opts.nodes)  line.dataset.nodes = opts.nodes;
    svg.appendChild(line);
  };

  // 1) Núcleo → hub de cada pilar (apenas 3 trilhas saindo do centro).
  Object.entries(PILLAR_HUBS).forEach(([pillar, hub]) => {
    addLine(50, 50, hub.x, hub.y, { kind: 'core', pillar });
  });

  // 2) Hub do pilar → raiz de cada ramo  e  3) tronco local entre nós vizinhos.
  branchChains.forEach(chain => {
    const hub = PILLAR_HUBS[chain.pillar];
    const root = getNodeById(chain.rootId);
    if (hub && root) {
      addLine(hub.x, hub.y, root.x, root.y, {
        kind: 'hub',
        pillar: chain.pillar,
        branch: chain.branchId,
        isDark: chain.isDark,
        nodes: chain.rootId,
        active: isNodeUnlocked(chain.rootId),
      });
    }
    for (let i = 0; i < chain.nodeIds.length - 1; i++) {
      const a = getNodeById(chain.nodeIds[i]);
      const b = getNodeById(chain.nodeIds[i + 1]);
      if (!a || !b) continue;
      addLine(a.x, a.y, b.x, b.y, {
        kind: 'trunk',
        pillar: chain.pillar,
        branch: chain.branchId,
        isDark: chain.isDark,
        nodes: `${a.id} ${b.id}`,
        active: isNodeUnlocked(a.id) && isNodeUnlocked(b.id),
      });
    }
  });

  // Mantém o realce coerente com o nó atualmente selecionado.
  highlightLinesForNode(selectedNodeId);
}

/** Realça apenas as trilhas ligadas ao nó (ramo local + caminho até o Núcleo),
 *  esmaecendo as demais. Passar null/Núcleo limpa o realce. */
export function highlightLinesForNode(nodeId) {
  const svg = byId('skilltree-lines');
  if (!svg) return;
  const lines = svg.querySelectorAll('.skill-tree-line');
  const node = getNodeById(nodeId);

  if (!node) {
    lines.forEach(l => l.classList.remove('is-linked', 'is-muted'));
    return;
  }

  lines.forEach(l => {
    const sameBranch = l.dataset.branch === node.branch && l.dataset.pillar === node.tree;
    const corePath   = l.dataset.kind === 'core' && l.dataset.pillar === node.tree;
    const touchesNode = (l.dataset.nodes || '').split(' ').includes(nodeId);
    const linked = sameBranch || corePath || touchesNode;
    l.classList.toggle('is-linked', linked);
    l.classList.toggle('is-muted', !linked);
  });
}

/** Painel de detalhes do Núcleo (âncora visual). */
function renderCoreDetails(panel) {
  panel.innerHTML = `
    <div class="skill-node-details-head">
      <span class="skill-node-details-icon" aria-hidden="true">${escapeHtml(CORE_NODE.icon)}</span>
      <div>
        <h3 class="skill-node-details-name">${escapeHtml(CORE_NODE.name)}</h3>
        <span class="skill-node-status-badge">Núcleo</span>
      </div>
    </div>
    <div class="skill-detail-block">
      <span class="skill-detail-label">Descrição</span>
      <p class="skill-detail-text">${escapeHtml(CORE_NODE.description)}</p>
    </div>
    <div class="skill-detail-block">
      <span class="skill-detail-label">Pilares</span>
      <div class="skill-prereq-list">
        <span class="skill-prereq">Sobrevivência</span>
        <span class="skill-prereq">Combate</span>
        <span class="skill-prereq">Força</span>
      </div>
    </div>
    <p class="skill-detail-text">Todas as habilidades estão disponíveis desde o começo. Selecione um nó ao redor para ver custos e efeitos.</p>
  `;
}

/** Renderiza o painel de detalhes do nó selecionado (ou do Núcleo). */
export function renderSkillNodeDetails(nodeId = selectedNodeId) {
  const panel = byId('skilltree-details');
  if (!panel) return;

  if (nodeId === CORE_NODE.id) { renderCoreDetails(panel); return; }

  const node = getNodeById(nodeId);
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
  const warning = nodeHasWarning(node);

  const resourceLabel = RESOURCE_LABELS[node.resourceType];
  const useCostText = node.resourceType === 'none'
    ? 'Nenhum'
    : `${node.resourceCost} ${resourceLabel}`;

  // Relações temáticas — apenas informativas (não bloqueiam a compra).
  const prereqText = (node.prerequisites && node.prerequisites.length)
    ? node.prerequisites.map(id => {
        const p = getNodeById(id);
        return `<span class="skill-prereq">${escapeHtml(p ? p.name : id)}</span>`;
      }).join(node.prereqMode === 'any' ? ' <em>ou</em> ' : ' ')
    : '<span class="skill-prereq">Nenhuma</span>';

  const sensitiveWarning = node.sensitiveRequired
    ? `<div class="skill-tree-warning">⚠ Requer sensibilidade à Força ou autorização narrativa do Mestre.</div>`
    : '';
  const forbiddenWarning = isForbiddenNode(node)
    ? `<div class="skill-tree-warning skill-tree-warning--dark">☠ Técnica do Lado Sombrio: usá-la pode aproximar o personagem do Lado Sombrio.</div>`
    : '';

  // Preview textual (exemplo de uso).
  const previewText = node.type === 'passive'
    ? 'Permanece sempre ativa enquanto comprada.'
    : `Use quando precisar de ${node.name.toLowerCase()} — gasta ${node.resourceCost} de ${resourceLabel} (${node.action}).`;

  let actionBtn = '';
  if (status === 'available') {
    const remaining = calculateSkillTreeRemainingPoints();
    const insufficient = remaining < node.purchaseCost;
    actionBtn = `
      ${insufficient ? `<div class="skill-tree-warning">⚠ Pontos de Defeito insuficientes (faltam ${node.purchaseCost - remaining}). Você ainda pode comprar se o Mestre permitir.</div>` : ''}
      <button type="button" class="btn btn--primary skill-action-btn" data-action="unlock-node" data-id="${escapeHtml(node.id)}">⊕ Comprar (−${node.purchaseCost})</button>
    `;
  } else {
    const useBtn = node.type === 'passive'
      ? `<div class="skill-action-passive">✓ Passiva — sempre ativa</div>`
      : `<button type="button" class="btn btn--secondary skill-action-btn" data-action="use-node" data-id="${escapeHtml(node.id)}">▶ Usar (−${useCostText})</button>`;
    actionBtn = `
      ${useBtn}
      <button type="button" class="btn btn--secondary skill-action-btn skill-action-refund" data-action="refund-node" data-id="${escapeHtml(node.id)}">↺ Desfazer compra (+${node.purchaseCost})</button>
    `;
  }

  const badgeClass = warning ? `${status} is-warning` : status;

  panel.innerHTML = `
    <div class="skill-node-details-head">
      <span class="skill-node-details-icon ${status}" aria-hidden="true">${escapeHtml(node.icon || '◆')}</span>
      <div>
        <h3 class="skill-node-details-name">${escapeHtml(node.name)}</h3>
        <span class="skill-node-status-badge ${badgeClass}">${statusLabel}${warning ? ' · Atenção' : ''}</span>
      </div>
    </div>

    <div class="skill-node-details-grid">
      <div class="skill-detail"><span class="skill-detail-label">Pilar</span><span class="skill-detail-value">${escapeHtml(getPillarName(node.tree))}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Subcategoria</span><span class="skill-detail-value">${escapeHtml(getBranchName(node.branch))} · ${escapeHtml(node.category)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Tipo</span><span class="skill-detail-value">${escapeHtml(TYPE_LABELS[node.type])}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Ação</span><span class="skill-detail-value">${escapeHtml(node.action)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Custo de Compra</span><span class="skill-detail-value">${node.purchaseCost} Ponto${node.purchaseCost > 1 ? 's' : ''} de Defeito</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Custo de Uso</span><span class="skill-detail-value">${escapeHtml(useCostText)}</span></div>
      <div class="skill-detail"><span class="skill-detail-label">Recurso</span><span class="skill-detail-value">${escapeHtml(resourceLabel)}</span></div>
    </div>

    <div class="skill-detail-block">
      <span class="skill-detail-label">Relações temáticas (informativo)</span>
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

    <div class="skill-detail-block skill-detail-preview">
      <span class="skill-detail-label">Preview</span>
      <p class="skill-detail-text">${escapeHtml(previewText)}</p>
    </div>

    ${sensitiveWarning}
    ${forbiddenWarning}

    <div class="skill-node-details-actions">
      ${actionBtn}
    </div>
  `;
}

/** Atualiza os cards de resumo da árvore. */
export function renderSkillTreeSummary() {
  const total     = calculateDefectPoints();
  const spent     = calculateSkillTreeSpentPoints();
  const remaining = total - spent;
  const unlockedNodes = sheetState.unlockedSkillTreeNodes.map(getNodeById).filter(Boolean);

  const maneuvers  = unlockedNodes.filter(n => n.type === 'maneuver').length;
  const techniques = unlockedNodes.filter(n => n.type === 'force-technique').length;
  const warnings   = unlockedNodes.filter(nodeHasWarning).length;

  const set = (id, val) => { const el = byId(id); if (el) el.textContent = val; };

  set('skilltree-total-points', total);
  set('skilltree-spent-points', spent);
  set('skilltree-remaining-points', remaining);
  set('skilltree-unlocked-count', unlockedNodes.length);
  set('skilltree-maneuvers-count', maneuvers);
  set('skilltree-techniques-count', techniques);
  set('skilltree-warnings-count', warnings);
  set('skilltree-effort', `${sheetState.effortCurrent}/${sheetState.effortMax}`);
  set('skilltree-connection', `${sheetState.connectionCurrent}/${sheetState.connectionMax}`);

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

/** Render mestre da aba: resumo + filtros + mapa radial + detalhes. */
export function renderSkillTreePage() {
  renderSkillTreeSummary();
  renderSkillTreeFilters();
  renderRadialSkillTree();
  renderSkillNodeDetails(selectedNodeId);
}

/* ------------------------------------------------------------
   ALIASES (nomes alternativos / compatibilidade)
------------------------------------------------------------ */
export const buySkillNode = unlockSkillNode;
export const useSkillNode = useSkillTreeNode;
export const canBuySkillNode = canUnlockSkillNode;
export const updateSkillTreeSummary = renderSkillTreeSummary;
