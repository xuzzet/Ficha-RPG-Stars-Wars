/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   store.js — Fluxo de dados unificado (commit → persistência)

   Responsabilidade:
   - Oferecer um ÚNICO ponto (`commit`) chamado após qualquer
     operação de criar/editar/remover no estado central.
   - Disparar a persistência automática (auto-save silencioso)
     através do evento 'swrpg:autosave', mantendo os módulos de
     dados desacoplados da camada de armazenamento (storage.js).

   Este módulo NÃO importa nada de propósito: assim evitamos
   dependências circulares e ele pode ser usado por qualquer
   módulo de lógica (skills, abilities, inventory, defects...).
   ============================================================ */

'use strict';

/**
 * Confirma uma alteração no estado central.
 *
 * Deve ser chamado ao final de TODA operação que altere o estado
 * (criar, editar, remover). A camada de interface já é atualizada
 * pelas funções `renderX()` de cada módulo; aqui garantimos apenas
 * o terceiro passo do fluxo unificado: persistir automaticamente.
 *
 * @param {{ reason?: string }} [meta] - Metadados opcionais (ex: origem).
 */
export function commit(meta = {}) {
  document.dispatchEvent(new CustomEvent('swrpg:autosave', { detail: meta }));
}
