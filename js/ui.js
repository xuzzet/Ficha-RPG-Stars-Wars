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

import { byId, getVal, getNum } from './dom.js';

/* ============================================================
   FEEDBACK — mensagens temporárias no rodapé
   ============================================================ */

/**
 * Exibe uma mensagem de status no rodapé por tempo limitado.
 * @param {string} msg - Mensagem a exibir
 * @param {'saved'|'error'|'info'} [type='info'] - Tipo visual
 * @param {number} [duration=3500] - Duração em ms (0 = permanente)
 */
export function showStatus(msg, type = 'info', duration = 3500) {
  const el = byId('save-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `save-status status--${type}`;
  if (duration > 0) {
    setTimeout(() => {
      el.textContent = '';
      el.className = 'save-status';
    }, duration);
  }
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
  });

  document.querySelectorAll('.sheet-tab-panel').forEach(panel => {
    const active = panel.id === `tab-${tabName}`;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });

  localStorage.setItem('activeSheetTab', tabName);
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
}

/** Diminui o PV atual pelo valor do campo delta. Não vai abaixo de 0. */
export function decreaseHp() {
  const current = getNum('hp-current');
  const delta   = getNum('hp-delta', 1);
  byId('hp-current').value = Math.max(0, current - delta);
  updateHpDisplay();
}

/** Restaura o PV atual ao PV Máximo. */
export function restoreHp() {
  const max = getNum('hp-max');
  byId('hp-current').value = max;
  updateHpDisplay();
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
  showStatus(`PV sugerido: Vida (${vida}) × ${PV_MULTIPLIER} = ${suggested}`, 'info');
}
