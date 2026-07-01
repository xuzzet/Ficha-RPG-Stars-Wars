/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   icons.js — Sistema centralizado de ícones (Lucide)

   Responsabilidade:
   - Mapa único (ICONS) semântico → nome de ícone Lucide.
   - Helper `icon()` que devolve a marcação de um ícone SVG.
   - Conversão automática dos ícones após qualquer re-render
     dinâmico (via MutationObserver), reaproveitando o Lucide
     carregado por CDN no index.html.

   Uso:
   - Em HTML estático:  <i data-lucide="save" class="icon"></i>
   - Em templates JS:   ${icon('salvar')}  ou  ${icon('trash-2')}

   O `icon()` aceita tanto uma CHAVE semântica do mapa ICONS
   quanto um nome de ícone Lucide cru, facilitando manutenção.
   ============================================================ */

'use strict';

/**
 * Mapa central de ícones: chave semântica → nome do ícone Lucide.
 * Centralizar aqui permite trocar o ícone de um conceito em um só lugar.
 * @readonly
 */
export const ICONS = Object.freeze({
  // --- Abas ---
  ficha:            'scroll-text',
  defeitos:         'triangle-alert',
  arvore:           'git-branch',
  progressao:       'trending-up',

  // --- Atributos ---
  vida:             'heart-pulse',
  corpo:            'dumbbell',
  mente:            'brain',
  presenca:         'message-circle',
  espirito:         'sparkles',

  // --- Núcleo / domínios ---
  nucleo:           'hexagon',
  combate:          'swords',
  tecnica:          'settings',
  forca:            'sparkles',
  sobrevivencia:    'shield',
  social:           'users',

  // --- Sessão / recursos ---
  sessao:           'gauge',
  hp:               'heart-pulse',
  esforco:          'zap',
  conexao:          'sparkles',
  armaRapida:       'swords',
  rolagens:         'dices',

  // --- Ações ---
  rolar:            'dice-6',
  editar:           'pencil',
  remover:          'trash-2',
  excluir:          'trash-2',
  salvar:           'save',
  carregar:         'folder-open',
  exportar:         'download',
  importar:         'upload',
  adicionar:        'plus',
  criar:            'plus',
  limpar:           'x',
  fechar:           'x',
  resetar:          'rotate-ccw',
  usar:             'play',
  buscar:           'search',

  // --- Status / alertas ---
  sucesso:          'check',
  falha:            'x',
  aviso:            'triangle-alert',
  estrela:          'star',
  pe:               'star',
  ladoSombrio:      'skull',
  explosivo:        'bomb',

  // --- Inventário / habilidades ---
  inventario:       'package',
  habilidades:      'zap',
  habilidadeUnica:  'star',
  manobra:          'swords',
  tecnicaForca:     'sparkles',
  nave:             'rocket',

  // --- Tipos de item ---
  arma:             'swords',
  armadura:         'shield',
  ferramenta:       'wrench',
  droide:           'bot',
  implante:         'settings',
  consumivel:       'pill',
  reliquia:         'gem',
  outro:            'package',
});

/**
 * Resolve uma chave semântica (ou nome cru) para o nome do ícone Lucide.
 * @param {string} nameOrKey
 * @returns {string}
 */
export function resolveIconName(nameOrKey) {
  return ICONS[nameOrKey] || nameOrKey;
}

/**
 * Devolve a marcação de um ícone (placeholder Lucide).
 * O Lucide converte `<i data-lucide>` em `<svg>` preservando as classes.
 * @param {string} nameOrKey - Chave de {@link ICONS} ou nome Lucide.
 * @param {string} [extraClass=''] - Classes CSS adicionais.
 * @returns {string} HTML do ícone.
 */
export function icon(nameOrKey, extraClass = '') {
  const lucideName = resolveIconName(nameOrKey);
  const cls = `icon${extraClass ? ` ${extraClass}` : ''}`;
  return `<i data-lucide="${lucideName}" class="${cls}" aria-hidden="true"></i>`;
}

/**
 * Converte todos os placeholders `[data-lucide]` presentes no documento
 * em SVGs, se o Lucide já estiver carregado.
 */
export function refreshIcons() {
  const lucide = window.lucide;
  if (lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

let observer = null;
let scheduled = false;

/**
 * Agenda uma conversão de ícones para o próximo frame, evitando laços:
 * o observer é desconectado durante a conversão (que também altera o DOM)
 * e reconectado logo após.
 */
function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    if (observer) observer.disconnect();
    refreshIcons();
    if (observer && document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
}

/**
 * Inicializa o sistema de ícones:
 * - Converte os ícones estáticos iniciais.
 * - Observa o DOM para converter ícones inseridos por re-renders.
 * Deve ser chamada uma única vez, após o DOM estar pronto.
 */
export function initIcons() {
  // Se o Lucide ainda não carregou (CDN), tenta novamente ao carregar a página.
  if (!window.lucide) {
    window.addEventListener('load', () => {
      refreshIcons();
      startObserver();
    }, { once: true });
    return;
  }
  refreshIcons();
  startObserver();
}

/** Liga o MutationObserver que reconverte ícones após re-renders. */
function startObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
}
