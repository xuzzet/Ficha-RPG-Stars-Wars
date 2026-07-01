/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   ui.js — Interface, feedback visual e estados gerais

   Responsabilidade:
   - Mensagens temporárias de status (showStatus).
   - Troca de abas Ficha / Defeitos (switchSheetTab).
   - Acordeões / seções colapsáveis (initAccordions).
   - Retrato do personagem (loadPortrait).
   - Painel de HP (display, dano, cura, restaurar, sugerir).
   ============================================================ */

'use strict';

import { byId, getVal, getNum, escapeHtml } from './dom.js';
import { commit } from './store.js';
import { icon } from './icons.js';
import { ACTIVE_TAB_KEY } from './constants.js';

/** Ícone de status conforme o tipo de feedback. */
const STATUS_ICON = {
  saved:   'sucesso',
  error:   'falha',
  warning: 'aviso',
  info:    'message-circle',
};

/* ============================================================
   FEEDBACK — mensagens temporárias no rodapé
   ============================================================ */

/**
 * Normaliza apelidos de tipo de feedback para as classes CSS existentes.
 * Mantém compatibilidade: 'saved' continua válido e 'success' é tratado
 * como sinônimo (mesmo visual verde).
 * @param {string} type
 * @returns {'saved'|'error'|'warning'|'info'}
 */
function normalizeStatusType(type) {
  if (type === 'success') return 'saved';
  if (type === 'saved' || type === 'error' || type === 'warning' || type === 'info') return type;
  return 'info';
}

/**
 * Exibe uma mensagem de status no rodapé por tempo limitado.
 * @param {string} msg - Mensagem a exibir
 * @param {'success'|'saved'|'error'|'warning'|'info'} [type='info'] - Tipo visual
 * @param {number} [duration=3500] - Duração em ms (0 = permanente)
 */
export function showStatus(msg, type = 'info', duration = 3500) {
  const el = byId('save-status');
  if (!el) return;
  const cssType = normalizeStatusType(type);
  el.innerHTML = `${icon(STATUS_ICON[cssType] || 'message-circle')}<span>${escapeHtml(msg)}</span>`;
  el.className = `save-status status--${cssType} visible icon-label`;
  if (duration > 0) {
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
      el.innerHTML = '';
      el.className = 'save-status';
    }, duration);
  }
}

/**
 * Alias semântico de feedback visual, conforme a especificação de
 * gerenciamento da ficha. Encaminha para showStatus.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=3500]
 */
export function showFeedback(message, type = 'info', duration = 3500) {
  showStatus(message, type, duration);
}

/* ============================================================
   ABAS — Ficha / Defeitos
   ============================================================ */

/**
 * Alterna entre as abas "Ficha" e "Defeitos".
 * Mostra apenas um painel por vez e guarda a aba ativa no LocalStorage.
 * @param {'ficha'|'defeitos'} tabName
 */
export function switchSheetTab(tabName) {
  document.querySelectorAll('.sheet-tab').forEach(button => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    // Roving tabindex (padrão WAI-ARIA tablist): só a aba ativa é tabável.
    button.tabIndex = active ? 0 : -1;
  });

  document.querySelectorAll('.sheet-tab-panel').forEach(panel => {
    const active = panel.id === `tab-${tabName}`;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });

  localStorage.setItem(ACTIVE_TAB_KEY, tabName);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   ACORDEÕES / SEÇÕES COLAPSÁVEIS
   ============================================================ */

/**
 * Configura todos os botões colapsáveis da página.
 * Cada gatilho usa .collapsible-trigger com aria-controls apontando
 * para o ID do conteúdo a recolher/expandir.
 */
export function initAccordions() {
  document.querySelectorAll('.collapsible-trigger').forEach(btn => {
    const contentId = btn.getAttribute('aria-controls');
    const content   = contentId ? byId(contentId) : null;
    if (!content) {
      console.warn('[SWRPG] Conteúdo de acordeão não encontrado:', contentId);
      return;
    }
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      content.hidden = expanded;
    });
  });
}

/* ============================================================
   RETRATO DO PERSONAGEM
   ============================================================ */

/**
 * Carrega a imagem de retrato a partir da URL informada no campo.
 * Mostra o placeholder de erro se a URL for inválida ou inacessível.
 */
export function loadPortrait() {
  const url         = getVal('portrait-url').trim();
  const img         = byId('portrait-img');
  const placeholder = byId('portrait-placeholder');
  if (!img || !placeholder) return;

  if (!url) {
    img.removeAttribute('src');
    img.classList.add('hidden');
    placeholder.style.display = '';
    return;
  }

  img.src = url;
  img.onload = () => {
    img.classList.remove('hidden');
    placeholder.style.display = 'none';
  };
  img.onerror = () => {
    img.classList.add('hidden');
    placeholder.style.display = '';
    showStatus('Não foi possível carregar a imagem. Verifique a URL.', 'error');
  };
}

/** Tamanho máximo recomendado para o retrato (evita estourar o LocalStorage). */
const PORTRAIT_MAX_BYTES = 3 * 1024 * 1024; // 3 MB

/**
 * Carrega o retrato a partir de um arquivo de imagem (arrastado ou escolhido).
 * Converte a imagem em Data URL, guarda no campo #portrait-url (para persistir
 * junto com a ficha) e exibe no quadro do retrato.
 * @param {File} file
 */
export function loadPortraitFromFile(file) {
  if (!file) return;

  if (!file.type || !file.type.startsWith('image/')) {
    showStatus('Arquivo inválido. Selecione uma imagem.', 'error');
    return;
  }
  if (file.size > PORTRAIT_MAX_BYTES) {
    showStatus('Imagem muito grande (máx. 3 MB). Use um arquivo menor ou uma URL.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const input = byId('portrait-url');
    if (input) input.value = String(reader.result);
    loadPortrait();
    showStatus('Retrato carregado.', 'success');
  };
  reader.onerror = () => {
    showStatus('Não foi possível ler o arquivo de imagem.', 'error');
  };
  reader.readAsDataURL(file);
}

/**
 * Configura o quadro do retrato como zona de clique e de arrastar-e-soltar.
 * - Clicar (ou Enter/Espaço com foco) abre o seletor de arquivos.
 * - Arrastar uma imagem para o quadro a carrega diretamente.
 */
export function initPortraitDropzone() {
  const zone  = byId('portrait-dropzone');
  const input = byId('portrait-file');
  if (!zone || !input) return;

  // Clique no quadro abre o seletor de arquivos.
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // Seleção via diálogo de arquivos.
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) loadPortraitFromFile(input.files[0]);
    input.value = ''; // permite recarregar o mesmo arquivo depois
  });

  // Arrastar-e-soltar.
  ['dragenter', 'dragover'].forEach(type => {
    zone.addEventListener(type, e => {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'dragend'].forEach(type => {
    zone.addEventListener(type, () => zone.classList.remove('is-dragover'));
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('is-dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadPortraitFromFile(file);
  });
}

/* ============================================================
   HP (PONTOS DE VIDA)
   ============================================================ */

/**
 * Atualiza a barra visual de HP e os displays numéricos.
 * A cor da barra muda progressivamente conforme os PV caem:
 *   >60% → verde (hp-high)
 *   30–60% → amarelo (hp-mid)
 *   <30% → vermelho (hp-low)
 */
export function updateHpDisplay() {
  const current = getNum('hp-current');
  const max     = getNum('hp-max');

  byId('hp-current-display').textContent = current;
  byId('hp-max-display').textContent     = max;

  const bar = byId('hp-bar');
  const effective = max > 0 ? Math.min(current, max) : current;
  const pct = max > 0 ? Math.min(100, Math.max(0, (effective / max) * 100)) : 0;
  bar.style.width = `${pct}%`;

  const color = pct > 60 ? 'var(--hp-high)' : pct > 30 ? 'var(--hp-mid)' : 'var(--hp-low)';
  bar.style.background = color;
  bar.style.boxShadow  = `0 0 8px ${color}`;

  const display = byId('hp-current-display');
  display.style.color      = color;
  display.style.textShadow = `0 0 10px ${color}`;
}

/** Aumenta o PV atual pelo valor do campo delta. Não ultrapassa o máximo. */
export function increaseHp() {
  const current = getNum('hp-current');
  const max     = getNum('hp-max');
  const delta   = getNum('hp-delta', 1);
  byId('hp-current').value = Math.min(max, current + delta);
  updateHpDisplay();
  commit({ reason: 'hp:increase' });
}

/** Diminui o PV atual pelo valor do campo delta. Não vai abaixo de 0. */
export function decreaseHp() {
  const current = getNum('hp-current');
  const delta   = getNum('hp-delta', 1);
  byId('hp-current').value = Math.max(0, current - delta);
  updateHpDisplay();
  commit({ reason: 'hp:decrease' });
}

/** Restaura o PV atual ao PV Máximo. */
export function restoreHp() {
  const max = getNum('hp-max');
  byId('hp-current').value = max;
  updateHpDisplay();
  commit({ reason: 'hp:restore' });
}

/**
 * Sugere o PV Máximo com base no atributo Vida.
 *
 * FÓRMULA: PV Máximo = Vida × PV_MULTIPLIER (padrão 2)
 * Exemplo: Vida 30 → PV Máximo = 30 × 2 = 60
 * Para mudar a fórmula do sistema, altere apenas PV_MULTIPLIER abaixo.
 */
export function suggestHp() {
  const vida = getNum('attr-vida');

  // ALTERE ESTE MULTIPLICADOR PARA MUDAR A FÓRMULA DE PV DO SISTEMA
  const PV_MULTIPLIER = 2;

  if (vida === 0) {
    showStatus('Defina o atributo Vida antes de sugerir o PV.', 'error');
    return;
  }

  const suggested = vida * PV_MULTIPLIER;
  byId('hp-max').value     = suggested;
  byId('hp-current').value = suggested;
  updateHpDisplay();
  commit({ reason: 'hp:suggest' });
  showStatus(`PV sugerido: Vida (${vida}) × ${PV_MULTIPLIER} = ${suggested}`, 'info');
}
