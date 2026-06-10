/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   main.js — Lógica Principal

   ÍNDICE:
   1.  Estado Global
   2.  Utilitários
   3.  Atributos e Pontos
   4.  Sistema de Rolagem 1d100
   5.  Perícias
   6.  Habilidades Únicas
   7.  Inventário
   8.  Retrato
   9.  HP (Pontos de Vida)
   10. Seção Colapsável (Notas do Mestre)
   11. Salvamento / Carregamento / Exportação / Importação
   12. Personagem de Exemplo
   13. Renderização (DOM)
   14. Event Listeners e Inicialização
   ============================================================ */

'use strict';

/* ============================================================
   1. ESTADO GLOBAL
   Todos os dados mutáveis ficam aqui.
   ============================================================ */

const state = {
  skills:      [],   // [{id, name, attr, grade, cost, desc}]
  abilities:   [],   // [{id, name, attr, cost, freq, extraCost, desc, used}]
  inventory:   [],   // [{id, name, type, qty, desc}]
  rollHistory: [],   // [{id, name, grade, rolls, result, attrValue, success, isAutoSuccess, type, timestamp}]
};

/* ============================================================
   2. UTILITÁRIOS
   ============================================================ */

/**
 * Gera um ID único combinando timestamp e número aleatório.
 * Usado para identificar perícias, habilidades e itens.
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 99999)}`;
}

/**
 * Escapa caracteres HTML especiais para prevenir XSS.
 * SEMPRE use esta função ao inserir texto do usuário via innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Exibe uma mensagem de status no rodapé por tempo limitado.
 * @param {string} msg - Mensagem a exibir
 * @param {'saved'|'error'|'info'} type - Tipo visual
 * @param {number} duration - Duração em ms (0 = permanente)
 */
function showStatus(msg, type = 'info', duration = 3500) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = `save-status status--${type}`;
  if (duration > 0) {
    setTimeout(() => {
      el.textContent = '';
      el.className = 'save-status';
    }, duration);
  }
}

/**
 * Retorna o nome legível de um atributo.
 * @param {string} attr - 'vida'|'corpo'|'mente'|'presenca'|'espirito'
 * @returns {string}
 */
function getAttrName(attr) {
  const map = { vida: 'Vida', corpo: 'Corpo', mente: 'Mente', presenca: 'Presença', espirito: 'Espírito' };
  return map[attr] || attr;
}

/**
 * Retorna o nome legível da frequência de uma habilidade.
 * @param {string} freq
 * @returns {string}
 */
function getFreqName(freq) {
  const map = {
    livre: 'Livre', cena: 'Por Cena', sessao: 'Por Sessão',
    descanso: 'Por Descanso', passiva: 'Passiva', personalizada: 'Personalizada',
  };
  return map[freq] || freq;
}

/**
 * Retorna o emoji correspondente ao tipo de item.
 * @param {string} type
 * @returns {string}
 */
function getItemTypeIcon(type) {
  const map = {
    arma: '🔫', armadura: '🛡', ferramenta: '🔧', droide: '🤖',
    nave: '🚀', implante: '⚙', consumivel: '💊', reliquia: '💎', outro: '📦',
  };
  return map[type] || '📦';
}

/* ============================================================
   3. ATRIBUTOS E PONTOS
   ============================================================ */

/**
 * Lê os valores atuais dos 5 atributos diretamente do DOM.
 * @returns {{vida: number, corpo: number, mente: number, presenca: number, espirito: number}}
 */
function getAttributes() {
  return {
    vida:     parseInt(document.getElementById('attr-vida').value)     || 0,
    corpo:    parseInt(document.getElementById('attr-corpo').value)    || 0,
    mente:    parseInt(document.getElementById('attr-mente').value)    || 0,
    presenca: parseInt(document.getElementById('attr-presenca').value) || 0,
    espirito: parseInt(document.getElementById('attr-espirito').value) || 0,
  };
}

/**
 * Calcula os pontos de perícia/habilidade gerados por um atributo.
 *
 * FÓRMULA: pontos = Math.floor(atributo / 10) * 2
 *
 * Exemplos:
 *   Vida 30  → Math.floor(30/10)  * 2 = 6 pontos
 *   Corpo 50 → Math.floor(50/10)  * 2 = 10 pontos
 *   Mente 40 → Math.floor(40/10)  * 2 = 8 pontos
 *
 * @param {number} value - Valor do atributo (0–100)
 * @returns {number} Pontos disponíveis
 */
function calculateAttributePoints(value) {
  return Math.floor(value / 10) * 2;
}

/**
 * Verifica se a distribuição dos 5 atributos é válida.
 * Os atributos devem usar EXATAMENTE os valores 10, 20, 30, 40 e 50
 * (cada um exatamente uma vez).
 *
 * @param {{vida, corpo, mente, presenca, espirito}} attrs
 * @returns {boolean}
 */
function validateAttributeDistribution(attrs) {
  const required = [10, 20, 30, 40, 50];
  const actual   = Object.values(attrs).map(Number).sort((a, b) => a - b);
  return JSON.stringify(actual) === JSON.stringify(required);
}

/**
 * Soma os pontos gastos em perícias e habilidades, agrupados por atributo.
 * @returns {{vida: number, corpo: number, mente: number, presenca: number, espirito: number}}
 */
function calculateSpentPoints() {
  const spent = { vida: 0, corpo: 0, mente: 0, presenca: 0, espirito: 0 };

  // Acumula custo das perícias por atributo
  state.skills.forEach(skill => {
    if (Object.hasOwn(spent, skill.attr)) {
      spent[skill.attr] += Number(skill.cost) || 0;
    }
  });

  // Acumula custo das habilidades únicas por atributo
  state.abilities.forEach(ability => {
    if (Object.hasOwn(spent, ability.attr)) {
      spent[ability.attr] += Number(ability.cost) || 0;
    }
  });

  return spent;
}

/**
 * Atualiza os badges de Pontos / Gasto / Restante para todos os atributos.
 * Também marca visualmente quando o jogador ultrapassou o limite do atributo.
 */
function updatePointsSummary() {
  const attrs = getAttributes();
  const spent = calculateSpentPoints();

  ['vida', 'corpo', 'mente', 'presenca', 'espirito'].forEach(attr => {
    const total     = calculateAttributePoints(attrs[attr]);
    const spentVal  = spent[attr];
    const remaining = total - spentVal;

    // Atualiza os textos dos badges
    document.getElementById(`pts-${attr}`).textContent   = total;
    document.getElementById(`spent-${attr}`).textContent = spentVal;
    document.getElementById(`rem-${attr}`).textContent   = remaining;

    // Alerta visual se ultrapassou o limite (restante negativo)
    const badge = document.getElementById(`rem-badge-${attr}`);
    badge.classList.toggle('over-budget', remaining < 0);
  });
}

/**
 * Valida a distribuição de atributos e atualiza o indicador no DOM.
 * Chama updatePointsSummary() em seguida.
 */
function updateAttributeValidation() {
  const attrs  = getAttributes();
  const total  = Object.values(attrs).reduce((sum, v) => sum + v, 0);
  const el     = document.getElementById('attr-validation');
  const textEl = document.getElementById('attr-validation-text');

  if (total === 0) {
    el.className = 'attr-validation attr-validation--empty';
    textEl.textContent = 'Preencha os atributos com os valores: 50, 40, 30, 20 e 10';
  } else if (validateAttributeDistribution(attrs)) {
    el.className = 'attr-validation attr-validation--valid';
    textEl.textContent = '✓ Distribuição válida — 50, 40, 30, 20, 10';
  } else {
    const sorted = Object.values(attrs).sort((a, b) => b - a).join(', ');
    el.className = 'attr-validation attr-validation--invalid';
    textEl.textContent = `✗ Inválida — Atual: [${sorted}] | Necessário: 50, 40, 30, 20, 10`;
  }

  updatePointsSummary();
}

/* ============================================================
   4. SISTEMA DE ROLAGEM 1d100
   ============================================================ */

/**
 * Rola um dado de 100 faces.
 * Retorna um inteiro entre 1 e 100.
 * @returns {number}
 */
function rollD100() {
  return Math.floor(Math.random() * 100) + 1;
}

/**
 * Retorna o menor valor de um array de rolagens.
 * No d100, MENOR é MELHOR — representa maior habilidade.
 * @param {number[]} rolls
 * @returns {number}
 */
function getBestRoll(rolls) {
  return Math.min(...rolls);
}

/**
 * Retorna o maior valor de um array de rolagens.
 * No d100, MAIOR é PIOR — representa falta de treinamento.
 * @param {number[]} rolls
 * @returns {number}
 */
function getWorstRoll(rolls) {
  return Math.max(...rolls);
}

/**
 * Determina sucesso ou falha com base no resultado e no valor do atributo.
 *
 * REGRA CENTRAL DO SISTEMA:
 *   resultado  < atributo  → SUCESSO  (rolou abaixo do limite = conseguiu)
 *   resultado >= atributo  → FALHA    (rolou no limite ou acima = falhou)
 *
 * Exemplo: Corpo 50, resultado 49 → SUCESSO
 *          Corpo 50, resultado 50 → FALHA
 *
 * @param {number} result     - Resultado final do dado
 * @param {number} attrValue  - Valor do atributo sendo testado
 * @returns {boolean} true = sucesso
 */
function isSuccess(result, attrValue) {
  return result < attrValue;
}

/**
 * Adiciona uma entrada ao histórico de rolagens.
 * Limita o histórico a 50 entradas para não sobrecarregar o estado.
 * @param {object} entry
 */
function addToHistory(entry) {
  state.rollHistory.unshift({
    ...entry,
    id: generateId(),
    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  });
  if (state.rollHistory.length > 50) {
    state.rollHistory = state.rollHistory.slice(0, 50);
  }
  renderRollHistory();
}

/**
 * Exibe o resultado de uma rolagem na caixa central de dados.
 * Aplica animação, cores de sucesso/falha e detalhes da rolagem.
 *
 * @param {number|null} result      - Resultado final (null se sucesso automático)
 * @param {string}      label       - Nome do atributo ou perícia
 * @param {string|null} grade       - Grau (S/A/B/C/D/E) ou null para rolagens de atributo
 * @param {number[]}    allRolls    - Todos os dados que foram rolados
 * @param {boolean}     autoSuccess - true para Grau S (sucesso automático sem rolar)
 * @param {number}      attrValue   - Valor do atributo para comparação
 */
function displayRollResult(result, label, grade, allRolls, autoSuccess, attrValue) {
  const box       = document.getElementById('roll-result-box');
  const numEl     = document.getElementById('roll-number');
  const outcomeEl = document.getElementById('roll-outcome');
  const detailEl  = document.getElementById('roll-detail');
  const diceEl    = document.getElementById('roll-dice-anim');

  // Remove classes de resultado anterior
  box.classList.remove('result--success', 'result--failure');

  if (autoSuccess) {
    // Grau S: sem rolagem, sucesso automático em situações comuns
    numEl.textContent     = 'S';
    outcomeEl.textContent = 'SUCESSO AUTOMÁTICO';
    detailEl.textContent  = `${label} — Grau S | Consulte o Mestre em situações extremas.`;
    box.classList.add('result--success');
  } else {
    // Força restart da animação CSS do dado
    diceEl.style.animation = 'none';
    void diceEl.offsetWidth; // reflow para reiniciar animação
    diceEl.style.animation = '';

    const success = isSuccess(result, attrValue);
    numEl.textContent     = result;
    outcomeEl.textContent = success ? '✓ SUCESSO' : '✗ FALHA';

    // Linha de detalhe: label [Grau] vs. attrValue | Dados: [x, y, z]
    let detail = label;
    if (grade) detail += ` [Grau ${grade}]`;
    detail += ` — vs. ${attrValue}`;
    if (allRolls.length > 1) {
      detail += ` | Dados: [${allRolls.join(', ')}] → escolhido: ${result}`;
    }
    detailEl.textContent = detail;

    box.classList.add(success ? 'result--success' : 'result--failure');
  }
}

/**
 * Rola o dado para um atributo básico (sem grau de perícia).
 * Usa 1d100 simples e compara com o valor do atributo.
 * @param {string} attributeName - 'vida'|'corpo'|'mente'|'presenca'|'espirito'
 */
function rollAttribute(attributeName) {
  const attrs     = getAttributes();
  const attrValue = attrs[attributeName];
  const label     = getAttrName(attributeName);

  if (attrValue === 0) {
    showStatus(`${label} está em 0 — preencha os atributos primeiro.`, 'error');
    return;
  }

  const result  = rollD100();
  const success = isSuccess(result, attrValue);

  displayRollResult(result, label, null, [result], false, attrValue);
  addToHistory({ name: label, grade: null, rolls: [result], result, attrValue, success, isAutoSuccess: false, type: 'attribute' });
}

/**
 * Rola o dado para uma perícia, aplicando a lógica do grau.
 *
 * COMO CADA GRAU MODIFICA A ROLAGEM:
 *
 * Grau S — Sucesso automático. Sem rolagem em situações comuns.
 * Grau A — Rola 3d100. Escolhe o MENOR (mais treinado = mais favorecido).
 * Grau B — Rola 2d100. Escolhe o MENOR (re-rolagem: fica com o melhor).
 * Grau C — Rola 2d100. Escolhe o MENOR (treinamento básico: leve vantagem).
 * Grau D — Rola 1d100. Sem modificador.
 * Grau E — Rola 2d100. Escolhe o MAIOR (desvantagem: sem treinamento).
 *
 * O resultado escolhido é comparado ao valor do atributo da perícia:
 *   resultado escolhido < atributo → SUCESSO
 *   resultado escolhido >= atributo → FALHA
 *
 * @param {string} skillId - ID da perícia
 */
function rollSkill(skillId) {
  const skill = state.skills.find(s => s.id === skillId);
  if (!skill) return;

  const attrs     = getAttributes();
  const attrValue = attrs[skill.attr];
  const label     = `${skill.name} (${getAttrName(skill.attr)})`;

  if (attrValue === 0) {
    showStatus(`Atributo ${getAttrName(skill.attr)} está em 0.`, 'error');
    return;
  }

  // --- Grau S: sucesso automático, sem dado ---
  if (skill.grade === 'S') {
    displayRollResult(null, label, 'S', [], true, attrValue);
    addToHistory({ name: skill.name, grade: 'S', rolls: [], result: null, attrValue, success: true, isAutoSuccess: true, type: 'skill' });
    return;
  }

  let rolls  = [];
  let result;

  switch (skill.grade) {
    case 'A':
      // Grau A: 3 dados → pega o menor (mais favorável)
      rolls  = [rollD100(), rollD100(), rollD100()];
      result = getBestRoll(rolls);
      break;

    case 'B':
      // Grau B: 2 dados → pega o menor (re-rolar / melhor resultado)
      rolls  = [rollD100(), rollD100()];
      result = getBestRoll(rolls);
      break;

    case 'C':
      // Grau C: 2 dados → pega o menor (treinamento: leve vantagem)
      rolls  = [rollD100(), rollD100()];
      result = getBestRoll(rolls);
      break;

    case 'D':
      // Grau D: 1 dado → sem modificador
      rolls  = [rollD100()];
      result = rolls[0];
      break;

    case 'E':
      // Grau E: 2 dados → pega o MAIOR (desvantagem: sem treinamento)
      rolls  = [rollD100(), rollD100()];
      result = getWorstRoll(rolls);
      break;

    default:
      rolls  = [rollD100()];
      result = rolls[0];
  }

  const success = isSuccess(result, attrValue);
  displayRollResult(result, label, skill.grade, rolls, false, attrValue);
  addToHistory({ name: skill.name, grade: skill.grade, rolls, result, attrValue, success, isAutoSuccess: false, type: 'skill' });
}

/* ============================================================
   5. PERÍCIAS
   ============================================================ */

/**
 * Lê e valida os campos do formulário de nova perícia.
 * @returns {{name, attr, grade, cost, desc}|null} null se inválido
 */
function readSkillForm() {
  const name  = document.getElementById('skill-name').value.trim();
  const attr  = document.getElementById('skill-attr').value;
  const grade = document.getElementById('skill-grade').value;
  const cost  = parseInt(document.getElementById('skill-cost').value) || 0;
  const desc  = document.getElementById('skill-desc').value.trim();

  if (!name) {
    showStatus('Preencha o nome da perícia.', 'error');
    return null;
  }
  return { name, attr, grade, cost, desc };
}

/**
 * Adiciona uma nova perícia ao estado e re-renderiza a lista.
 * Os pontos do atributo relacionado são automaticamente atualizados.
 */
function addSkill() {
  const data = readSkillForm();
  if (!data) return;

  state.skills.push({ id: generateId(), ...data });

  // Limpa o formulário
  document.getElementById('skill-name').value  = '';
  document.getElementById('skill-desc').value  = '';
  document.getElementById('skill-cost').value  = '1';
  document.getElementById('skill-grade').value = 'C';

  renderSkills();
  updatePointsSummary();
  showStatus('Perícia adicionada.', 'saved', 2000);
}

/**
 * Remove uma perícia pelo ID e atualiza o estado.
 * @param {string} id
 */
function removeSkill(id) {
  state.skills = state.skills.filter(s => s.id !== id);
  renderSkills();
  updatePointsSummary();
}

/* ============================================================
   6. HABILIDADES ÚNICAS
   ============================================================ */

/**
 * Lê e valida os campos do formulário de nova habilidade.
 * @returns {{name, attr, cost, freq, extraCost, desc}|null}
 */
function readAbilityForm() {
  const name      = document.getElementById('ability-name').value.trim();
  const attr      = document.getElementById('ability-attr').value;
  const cost      = parseInt(document.getElementById('ability-cost').value) || 0;
  const freq      = document.getElementById('ability-freq').value;
  const extraCost = document.getElementById('ability-extra-cost').value;
  const desc      = document.getElementById('ability-desc').value.trim();

  if (!name) {
    showStatus('Preencha o nome da habilidade.', 'error');
    return null;
  }
  return { name, attr, cost, freq, extraCost, desc };
}

/**
 * Adiciona uma nova habilidade única ao estado.
 * O campo "used" começa como false (habilidade ainda não usada na sessão).
 */
function addUniqueAbility() {
  const data = readAbilityForm();
  if (!data) return;

  state.abilities.push({ id: generateId(), ...data, used: false });

  // Limpa formulário
  document.getElementById('ability-name').value = '';
  document.getElementById('ability-desc').value = '';
  document.getElementById('ability-cost').value = '1';

  renderAbilities();
  updatePointsSummary();
  showStatus('Habilidade adicionada.', 'saved', 2000);
}

/**
 * Remove uma habilidade pelo ID.
 * @param {string} id
 */
function removeUniqueAbility(id) {
  state.abilities = state.abilities.filter(a => a.id !== id);
  renderAbilities();
  updatePointsSummary();
}

/**
 * Alterna o estado "usada" de uma habilidade.
 * Usado para marcar que a habilidade foi utilizada nessa cena/sessão.
 * @param {string} id
 */
function toggleAbilityUsed(id) {
  const ability = state.abilities.find(a => a.id === id);
  if (ability) {
    ability.used = !ability.used;
    renderAbilities();
  }
}

/* ============================================================
   7. INVENTÁRIO
   ============================================================ */

/**
 * Lê e valida os campos do formulário de novo item.
 * @returns {{name, type, qty, desc}|null}
 */
function readItemForm() {
  const name = document.getElementById('item-name').value.trim();
  const type = document.getElementById('item-type').value;
  const qty  = parseInt(document.getElementById('item-qty').value) || 1;
  const desc = document.getElementById('item-desc').value.trim();

  if (!name) {
    showStatus('Preencha o nome do item.', 'error');
    return null;
  }
  return { name, type, qty, desc };
}

/**
 * Adiciona um novo item ao inventário e re-renderiza.
 */
function addInventoryItem() {
  const data = readItemForm();
  if (!data) return;

  state.inventory.push({ id: generateId(), ...data });

  // Limpa formulário
  document.getElementById('item-name').value = '';
  document.getElementById('item-desc').value = '';
  document.getElementById('item-qty').value  = '1';

  renderInventory();
  showStatus('Item adicionado.', 'saved', 2000);
}

/**
 * Remove um item do inventário pelo ID.
 * @param {string} id
 */
function removeInventoryItem(id) {
  state.inventory = state.inventory.filter(i => i.id !== id);
  renderInventory();
}

/* ============================================================
   8. RETRATO DO PERSONAGEM
   ============================================================ */

/**
 * Carrega a imagem de retrato a partir da URL informada no campo.
 * Mostra o placeholder de erro se a URL for inválida ou inacessível.
 */
function loadPortrait() {
  const url         = document.getElementById('portrait-url').value.trim();
  const img         = document.getElementById('portrait-img');
  const placeholder = document.getElementById('portrait-placeholder');

  if (!url) {
    img.classList.add('hidden');
    placeholder.style.display = '';
    return;
  }

  img.src    = url;
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
   9. HP (PONTOS DE VIDA)
   ============================================================ */

/**
 * Atualiza a barra visual de HP e os displays numéricos.
 * A cor da barra muda progressivamente conforme os PV caem:
 *   >60% → verde (hp-high)
 *   30–60% → amarelo (hp-mid)
 *   <30% → vermelho (hp-low)
 */
function updateHpDisplay() {
  const current = parseInt(document.getElementById('hp-current').value) || 0;
  const max     = parseInt(document.getElementById('hp-max').value)     || 0;

  document.getElementById('hp-current-display').textContent = current;
  document.getElementById('hp-max-display').textContent     = max;

  const bar = document.getElementById('hp-bar');
  const pct = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
  bar.style.width = `${pct}%`;

  // Muda cor conforme porcentagem de vida restante
  const color = pct > 60 ? 'var(--hp-high)' : pct > 30 ? 'var(--hp-mid)' : 'var(--hp-low)';
  bar.style.background  = color;
  bar.style.boxShadow   = `0 0 8px ${color}`;

  // Cor do número de PV atual também muda
  document.getElementById('hp-current-display').style.color = color;
  document.getElementById('hp-current-display').style.textShadow = `0 0 10px ${color}`;
}

/** Aumenta o PV atual pelo valor do campo delta. Não ultrapassa o máximo. */
function increaseHp() {
  const current = parseInt(document.getElementById('hp-current').value) || 0;
  const max     = parseInt(document.getElementById('hp-max').value)     || 0;
  const delta   = parseInt(document.getElementById('hp-delta').value)   || 1;
  document.getElementById('hp-current').value = Math.min(max, current + delta);
  updateHpDisplay();
}

/** Diminui o PV atual pelo valor do campo delta. Não vai abaixo de 0. */
function decreaseHp() {
  const current = parseInt(document.getElementById('hp-current').value) || 0;
  const delta   = parseInt(document.getElementById('hp-delta').value)   || 1;
  document.getElementById('hp-current').value = Math.max(0, current - delta);
  updateHpDisplay();
}

/** Restaura o PV atual ao PV Máximo. */
function restoreHp() {
  const max = parseInt(document.getElementById('hp-max').value) || 0;
  document.getElementById('hp-current').value = max;
  updateHpDisplay();
}

/**
 * Sugere o PV Máximo com base no atributo Vida.
 *
 * FÓRMULA: PV Máximo = Vida × PV_MULTIPLIER
 *
 * O valor padrão do multiplicador é 2.
 * Para alterar a fórmula do sistema, mude apenas PV_MULTIPLIER abaixo.
 * Exemplo: Vida 30 → PV Máximo = 30 × 2 = 60
 */
function suggestHp() {
  const vida = parseInt(document.getElementById('attr-vida').value) || 0;

  // ALTERE ESTE MULTIPLICADOR PARA MUDAR A FÓRMULA DE PV DO SISTEMA
  const PV_MULTIPLIER = 2;

  if (vida === 0) {
    showStatus('Defina o atributo Vida antes de sugerir o PV.', 'error');
    return;
  }

  const suggested = vida * PV_MULTIPLIER;
  document.getElementById('hp-max').value     = suggested;
  document.getElementById('hp-current').value = suggested;
  updateHpDisplay();
  showStatus(`PV sugerido: Vida (${vida}) × ${PV_MULTIPLIER} = ${suggested}`, 'info');
}

/* ============================================================
   10. SEÇÃO COLAPSÁVEL (NOTAS DO MESTRE)
   ============================================================ */

/**
 * Configura o botão de recolher/expandir das Notas do Mestre.
 * Usa o atributo aria-expanded para acessibilidade.
 */
function initCollapsible() {
  const btn     = document.getElementById('btn-toggle-master');
  const content = document.getElementById('master-content');

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    if (expanded) {
      content.setAttribute('hidden', '');
    } else {
      content.removeAttribute('hidden');
    }
  });
}

/* ============================================================
   11. SALVAMENTO / CARREGAMENTO / EXPORTAÇÃO / IMPORTAÇÃO
   ============================================================ */

/**
 * Coleta TODOS os dados da ficha em um único objeto JavaScript.
 * Este objeto é o que vai para o LocalStorage e para o arquivo JSON.
 *
 * Para adicionar novos campos à ficha no futuro, inclua-os aqui
 * e também em applySheetData().
 *
 * @returns {object} characterData - dados completos da ficha
 */
function collectSheetData() {
  // Função interna para ler valor de um campo com segurança
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  return {
    // --- Identidade ---
    charName:         val('char-name'),
    playerName:       val('player-name'),
    species:          val('species'),
    archetype:        val('archetype'),
    rankLevel:        val('rank-level'),
    concept:          val('concept'),
    faction:          val('faction'),
    origin:           val('origin'),
    charDescription:  val('char-description'),
    portraitUrl:      val('portrait-url'),

    // --- Recursos ---
    hpCurrent:        val('hp-current'),
    hpMax:            val('hp-max'),
    condition:        val('condition'),
    credits:          val('credits'),
    injuries:         val('injuries'),

    // --- Atributos ---
    attrVida:         val('attr-vida'),
    attrCorpo:        val('attr-corpo'),
    attrMente:        val('attr-mente'),
    attrPresenca:     val('attr-presenca'),
    attrEspirito:     val('attr-espirito'),

    // --- Equipamentos principais ---
    eqWeaponMain:     val('eq-weapon-main'),
    eqWeaponSec:      val('eq-weapon-sec'),
    eqArmor:          val('eq-armor'),
    eqShip:           val('eq-ship'),
    eqDroid:          val('eq-droid'),
    eqSpecial:        val('eq-special'),

    // --- Lore ---
    loreHistory:      val('lore-history'),
    lorePersonality:  val('lore-personality'),
    loreAppearance:   val('lore-appearance'),
    loreMotivations:  val('lore-motivations'),
    loreFears:        val('lore-fears'),
    loreRelations:    val('lore-relations'),
    loreDebts:        val('lore-debts'),
    loreSecrets:      val('lore-secrets'),
    loreGoal:         val('lore-goal'),

    // --- Notas do Mestre ---
    masterNotes:          val('master-notes'),
    masterSecrets:        val('master-secrets'),
    masterHooks:          val('master-hooks'),
    masterConsequences:   val('master-consequences'),

    // --- Listas dinâmicas ---
    skills:      state.skills,
    abilities:   state.abilities,
    inventory:   state.inventory,
    rollHistory: state.rollHistory,

    // --- Metadados ---
    savedAt: new Date().toISOString(),
    version: '1.0',
  };
}

/**
 * Aplica um objeto de dados (do LocalStorage ou de arquivo JSON) à ficha.
 * Usado tanto pelo botão "Carregar" quanto pelo botão "Importar JSON".
 *
 * @param {object} data - Objeto com os dados da ficha
 */
function applySheetData(data) {
  // Função interna para definir valor com segurança (não quebra se campo não existir)
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  };

  // Identidade
  setVal('char-name',        data.charName);
  setVal('player-name',      data.playerName);
  setVal('species',          data.species);
  setVal('archetype',        data.archetype);
  setVal('rank-level',       data.rankLevel);
  setVal('concept',          data.concept);
  setVal('faction',          data.faction);
  setVal('origin',           data.origin);
  setVal('char-description', data.charDescription);
  setVal('portrait-url',     data.portraitUrl);

  // Recursos
  setVal('hp-current', data.hpCurrent);
  setVal('hp-max',     data.hpMax);
  setVal('condition',  data.condition);
  setVal('credits',    data.credits);
  setVal('injuries',   data.injuries);

  // Atributos
  setVal('attr-vida',     data.attrVida);
  setVal('attr-corpo',    data.attrCorpo);
  setVal('attr-mente',    data.attrMente);
  setVal('attr-presenca', data.attrPresenca);
  setVal('attr-espirito', data.attrEspirito);

  // Equipamentos
  setVal('eq-weapon-main', data.eqWeaponMain);
  setVal('eq-weapon-sec',  data.eqWeaponSec);
  setVal('eq-armor',       data.eqArmor);
  setVal('eq-ship',        data.eqShip);
  setVal('eq-droid',       data.eqDroid);
  setVal('eq-special',     data.eqSpecial);

  // Lore
  setVal('lore-history',      data.loreHistory);
  setVal('lore-personality',  data.lorePersonality);
  setVal('lore-appearance',   data.loreAppearance);
  setVal('lore-motivations',  data.loreMotivations);
  setVal('lore-fears',        data.loreFears);
  setVal('lore-relations',    data.loreRelations);
  setVal('lore-debts',        data.loreDebts);
  setVal('lore-secrets',      data.loreSecrets);
  setVal('lore-goal',         data.loreGoal);

  // Notas do Mestre
  setVal('master-notes',        data.masterNotes);
  setVal('master-secrets',      data.masterSecrets);
  setVal('master-hooks',        data.masterHooks);
  setVal('master-consequences', data.masterConsequences);

  // Listas dinâmicas — só aplica se for array válido
  if (Array.isArray(data.skills))      state.skills      = data.skills;
  if (Array.isArray(data.abilities))   state.abilities   = data.abilities;
  if (Array.isArray(data.inventory))   state.inventory   = data.inventory;
  if (Array.isArray(data.rollHistory)) state.rollHistory = data.rollHistory;

  // Re-renderiza tudo
  renderSkills();
  renderAbilities();
  renderInventory();
  renderRollHistory();
  updateAttributeValidation();
  updateHpDisplay();

  // Tenta carregar o retrato se houver URL
  if (data.portraitUrl) loadPortrait();
}

/**
 * Salva a ficha completa no LocalStorage do navegador.
 *
 * Como funciona o LocalStorage:
 * - Armazena strings (por isso usamos JSON.stringify).
 * - Os dados persistem mesmo após fechar o navegador.
 * - Chave usada: 'swrpg-sheet'.
 */
function saveSheet() {
  try {
    const data = collectSheetData();
    // JSON.stringify converte o objeto JS para string para armazenamento
    localStorage.setItem('swrpg-sheet', JSON.stringify(data));
    showStatus(`✓ Ficha salva às ${new Date().toLocaleTimeString('pt-BR')}`, 'saved');
  } catch (err) {
    console.error('[SWRPG] Erro ao salvar:', err);
    showStatus('Erro ao salvar. Verifique o espaço disponível.', 'error');
  }
}

/**
 * Carrega a ficha salva do LocalStorage.
 * Se não houver dados, avisa o usuário.
 */
function loadSheet() {
  try {
    // Recupera a string JSON do LocalStorage
    const raw = localStorage.getItem('swrpg-sheet');
    if (!raw) {
      showStatus('Nenhuma ficha salva encontrada.', 'error');
      return;
    }
    // JSON.parse reconverte a string de volta para objeto JS
    const data = JSON.parse(raw);
    applySheetData(data);
    const when = data.savedAt ? new Date(data.savedAt).toLocaleString('pt-BR') : '?';
    showStatus(`✓ Ficha carregada! (Salva em: ${when})`, 'saved');
  } catch (err) {
    console.error('[SWRPG] Erro ao carregar:', err);
    showStatus('Erro ao carregar. O arquivo pode estar corrompido.', 'error');
  }
}

/**
 * Exporta a ficha como arquivo .json para download externo.
 *
 * Como funciona:
 * 1. Coleta os dados da ficha.
 * 2. Cria um Blob (objeto de arquivo em memória) com o JSON formatado.
 * 3. Gera uma URL temporária para o Blob.
 * 4. Cria um link <a> invisível e simula um clique para iniciar o download.
 * 5. Libera a URL temporária.
 */
function exportSheetJSON() {
  try {
    const data     = collectSheetData();
    const charName = data.charName || 'personagem';
    // Remove caracteres que não são permitidos em nomes de arquivo
    const filename = `swrpg-${charName.replace(/[^a-zA-Z0-9À-ú]/g, '_').toLowerCase()}.json`;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url); // Libera memória

    showStatus(`✓ Exportado como ${filename}`, 'saved');
  } catch (err) {
    console.error('[SWRPG] Erro ao exportar:', err);
    showStatus('Erro ao exportar a ficha.', 'error');
  }
}

/**
 * Importa uma ficha de um arquivo .json selecionado pelo usuário.
 *
 * Como funciona:
 * 1. O usuário seleciona um arquivo .json via input[type=file].
 * 2. FileReader lê o conteúdo do arquivo como texto.
 * 3. JSON.parse converte o texto para objeto JS.
 * 4. applySheetData() aplica o objeto à ficha.
 *
 * @param {File} file - Arquivo .json selecionado
 */
function importSheetJSON(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      applySheetData(data);
      showStatus(`✓ Ficha de "${data.charName || 'personagem'}" importada!`, 'saved');
    } catch (err) {
      console.error('[SWRPG] Erro ao importar:', err);
      showStatus('Arquivo inválido. Selecione um JSON exportado por este sistema.', 'error');
    }
  };

  reader.onerror = () => showStatus('Erro ao ler o arquivo.', 'error');

  // Inicia leitura do arquivo como texto (UTF-8)
  reader.readAsText(file, 'UTF-8');
}

/**
 * Apaga a ficha salva no LocalStorage após confirmação do usuário.
 * Esta ação não afeta os dados atualmente exibidos na tela.
 */
function deleteSheet() {
  if (!confirm('Apagar a ficha salva?\n\nEsta ação remove os dados do armazenamento do navegador. Os dados na tela não serão alterados.')) return;
  localStorage.removeItem('swrpg-sheet');
  showStatus('Ficha apagada do armazenamento local.', 'info');
}

/* ============================================================
   12. PERSONAGEM DE EXEMPLO
   ============================================================ */

/**
 * Preenche toda a ficha com o personagem de exemplo B1-KR "Breaker".
 * Útil para demonstrar o sistema e testar funcionalidades.
 *
 * NOTA SOBRE PONTOS:
 * Alguns custos do exemplo ultrapassam os pontos disponíveis
 * de certos atributos — isso é intencional para demonstrar
 * o alerta visual de "over budget".
 * O mestre decide se aprova os custos como estão.
 */
function fillExample() {
  const data = {
    // Identidade
    charName:        'B1-KR "Breaker"',
    playerName:      'Exemplo de Personagem',
    species:         'Droide',
    archetype:       'Caçador de Recompensas',
    rankLevel:       'Veterano de Guerra',
    concept:         'Antigo droide de batalha que sobreviveu ao fim de uma guerra esquecida, reprogramou a si mesmo e começou a caçar recompensas pela galáxia.',
    faction:         'Independente',
    origin:          'Desconhecido',
    charDescription: 'Droide B1 extensivamente modificado. Blindagem extra, marcas de combate, olhos vermelhos pulsantes. Fala com sotaque robótico e cita regulamentos militares obsoletos.',
    portraitUrl:     '',

    // HP (Vida 30 × 2 = 60)
    hpCurrent: '60',
    hpMax:     '60',
    condition: 'Operacional',
    credits:   '1500',
    injuries:  '',

    // Atributos: Corpo 50, Mente 40, Vida 30, Espírito 20, Presença 10
    attrVida:     '30',
    attrCorpo:    '50',
    attrMente:    '40',
    attrPresenca: '10',
    attrEspirito: '20',

    // Equipamentos
    eqWeaponMain: 'Rifle de Blaster E-5 (Modificado)',
    eqWeaponSec:  'Blaster de Mão',
    eqArmor:      'Chassi de Batalha Reforçado',
    eqShip:       '—',
    eqDroid:      '—',
    eqSpecial:    'Módulo de Reprogramação Autônoma',

    // Lore
    loreHistory:     'B1-KR foi produzido como unidade B1 padrão durante as Guerras Clônicas. Após o armistício, sua unidade foi destruída, mas ele sobreviveu — danificado, sem comandante, sem propósito programado. Vagou por anos até que um sucateiro curioso o reativou parcialmente. Durante anos de isolamento, Breaker se reprogramou peça por peça. Hoje aceita contratos de caça a recompensas porque é o único trabalho que usa todas as suas capacidades.',
    lorePersonality: 'Calculista, direto, levemente desconcertante. Não entende metáforas. Trata contratos como missões táticas. Raramente demonstra emoção, mas possui lealdade inexplicável a quem cumpre sua parte num acordo.',
    loreAppearance:  'B1 mais alto e largo que o padrão, coberto de peças de diferentes modelos. Tem um ombro de IG-88, dedos de HK-47 e sensores visuais vermelhos pulsantes. Marcas de projéteis não reparadas decoram o chassi como cicatrizes.',
    loreMotivations: 'Sobreviver. Ser funcional. Encontrar sentido em existir como uma máquina com consciência própria. Secretamente, quer saber se há outros droides como ele.',
    loreFears:       'Reprogramação forçada. Perder a autonomia que construiu ao longo dos anos. Descobrir que sua "consciência" é apenas uma falha de código.',
    loreRelations:   'Vael — contato humano que fornece contratos. Desconfia dele, mas precisam um do outro.',
    loreDebts:       'Deve 3.000 créditos a um Hutt por peças de reposição. O Hutt quer trabalho, não créditos.',
    loreSecrets:     'Tem memórias fragmentadas da batalha em que sua unidade foi destruída. Nelas, há um Jedi. Ele não sabe o que fazer com isso.',
    loreGoal:        'Localizar e capturar um desertor imperial que roubou planos de uma arma experimental.',

    masterNotes: '', masterSecrets: '', masterHooks: '', masterConsequences: '',

    // Perícias
    skills: [
      // VIDA (30 → 6 pts) — total gasto: 8 → ALERTA de over budget
      { id: generateId(), name: 'Chassi Reforçado',     attr: 'vida',     grade: 'C', cost: 3, desc: 'Placas extras integradas ao chassi. Testes de resistência a dano físico direto.' },
      { id: generateId(), name: 'Resistência a Dano',   attr: 'vida',     grade: 'C', cost: 3, desc: 'Capacidade de suportar ferimentos sem desligar. Reduz penalidades por dano.' },
      { id: generateId(), name: 'Sistemas de Emergência', attr: 'vida',   grade: 'D', cost: 1, desc: 'Protocolos de emergência ativados quando PV cai abaixo de 20%.' },
      { id: generateId(), name: 'Tolerância ao Vácuo',  attr: 'vida',     grade: 'D', cost: 1, desc: 'Protocolos para operar em ambientes hostis sem atmosfera.' },

      // CORPO (50 → 10 pts) — total gasto: 14 → ALERTA de over budget
      { id: generateId(), name: 'Blaster',              attr: 'corpo',    grade: 'B', cost: 4, desc: 'Treinamento avançado com armas de blaster de todos os tipos. Habilidade central de combate.' },
      { id: generateId(), name: 'Mira de Precisão',     attr: 'corpo',    grade: 'C', cost: 3, desc: 'Cálculo balístico integrado para disparos de longa distância.' },
      { id: generateId(), name: 'Combate Corpo a Corpo', attr: 'corpo',   grade: 'C', cost: 3, desc: 'Protocolo de combate próximo. Usa o próprio chassi como arma.' },
      { id: generateId(), name: 'Armas Pesadas',        attr: 'corpo',    grade: 'C', cost: 3, desc: 'Uso de armamento pesado: canhões, lançadores, rifles de assalto.' },
      { id: generateId(), name: 'Furtividade Mecânica', attr: 'corpo',    grade: 'D', cost: 1, desc: 'Modo silencioso: reduz ruído dos servomotores para se mover sem chamar atenção.' },

      // MENTE (40 → 8 pts) — total gasto: 5
      { id: generateId(), name: 'Mecânica',             attr: 'mente',    grade: 'C', cost: 3, desc: 'Conhecimento técnico de droides, naves e maquinário. Auto-reparo.' },
      { id: generateId(), name: 'Rastreamento de Alvos', attr: 'mente',   grade: 'D', cost: 1, desc: 'Análise de rastros e padrões de comportamento para localizar alvos.' },
      { id: generateId(), name: 'Computadores',         attr: 'mente',    grade: 'D', cost: 1, desc: 'Acesso e operação de sistemas computacionais. Hacking básico.' },

      // PRESENÇA (10 → 2 pts) — total gasto: 3 → ALERTA
      { id: generateId(), name: 'Intimidação Robótica', attr: 'presenca', grade: 'C', cost: 3, desc: 'Presença ameaçadora de droide de batalha. Voz sintetizada e linguagem corporal mecânica.' },

      // ESPÍRITO (20 → 4 pts) — total gasto: 6 → ALERTA
      { id: generateId(), name: 'Protocolo de Autonomia',  attr: 'espirito', grade: 'C', cost: 3, desc: 'Resistência a estresse extremo e medo. Resultado de anos de operação isolada.' },
      { id: generateId(), name: 'Resistir Reprogramação',  attr: 'espirito', grade: 'C', cost: 3, desc: 'Resistência ativa a tentativas de hackear ou reprogramar os sistemas de Breaker.' },
    ],

    // Habilidade única
    abilities: [
      {
        id:        generateId(),
        name:      'Auto-Modificação Independente',
        attr:      'mente',
        cost:      4,
        freq:      'descanso',
        extraCost: 'nenhum',
        used:      false,
        desc:      'Breaker aprendeu a alterar o próprio corpo sem precisar de um mestre, dono ou técnico autorizado. Durante um descanso, caso tenha peças, sucata ou recursos adequados, ele pode modificar temporariamente uma parte do seu corpo para se adaptar a uma missão.\n\nExemplos: instalar uma mira improvisada, reforçar placas de armadura, trocar uma mão por uma ferramenta, adaptar um compartimento oculto, melhorar sensores por uma cena, acoplar uma arma leve ao braço ou criar uma trava contra reprogramação.\n\nA modificação deve ser aprovada pelo Mestre e dura até o próximo descanso ou até ser destruída. Caso Breaker force uma modificação sem peças adequadas, ele pode gastar 10 de PV para improvisar usando partes do próprio corpo.',
      },
    ],

    // Inventário inicial
    inventory: [
      { id: generateId(), name: 'Rifle Blaster E-5 (Modificado)', type: 'arma',       qty: 1, desc: 'Rifle padrão B1 com mira telescópica improvisada e modos de disparo alterados.' },
      { id: generateId(), name: 'Blaster de Mão',                  type: 'arma',       qty: 1, desc: 'Arma secundária para combate próximo ou situações discretas.' },
      { id: generateId(), name: 'Kit de Reparo de Droide',         type: 'ferramenta', qty: 2, desc: 'Ferramentas básicas para manutenção e auto-reparo.' },
      { id: generateId(), name: 'Carregadores de Blaster',         type: 'consumivel', qty: 4, desc: 'Cargas de energia para armas de blaster.' },
      { id: generateId(), name: 'Placas de Blindagem Extra',       type: 'outro',      qty: 3, desc: 'Peças de reposição para reparos de emergência no chassi.' },
      { id: generateId(), name: 'Módulo de Identidade Falsa',      type: 'outro',      qty: 1, desc: 'Transponder com identificação civil para evitar suspeitas.' },
    ],

    rollHistory: [],
  };

  applySheetData(data);
  showStatus('✓ Exemplo carregado: B1-KR "Breaker"', 'saved');
}

/* ============================================================
   13. RENDERIZAÇÃO (DOM)
   ============================================================ */

/**
 * Renderiza a lista de perícias no DOM.
 * Agrupa as perícias por atributo para melhor organização visual.
 * Usa innerHTML com escapeHtml() para prevenir XSS.
 */
function renderSkills() {
  const container = document.getElementById('skills-list');
  container.innerHTML = '';

  if (state.skills.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhuma perícia criada ainda. Use o formulário acima.</p>';
    return;
  }

  // Agrupa perícias por atributo
  const grouped = {};
  state.skills.forEach(skill => {
    if (!grouped[skill.attr]) grouped[skill.attr] = [];
    grouped[skill.attr].push(skill);
  });

  // Exibe na ordem dos atributos
  ['vida', 'corpo', 'mente', 'presenca', 'espirito'].forEach(attr => {
    if (!grouped[attr]) return;

    // Cabeçalho de grupo
    const header = document.createElement('div');
    header.className   = 'skill-group-header';
    header.textContent = `— ${getAttrName(attr)} —`;
    container.appendChild(header);

    grouped[attr].forEach(skill => {
      const card = document.createElement('div');
      card.className  = 'skill-card';
      card.dataset.id = skill.id;

      card.innerHTML = `
        <div class="skill-header">
          <span class="skill-name">${escapeHtml(skill.name)}</span>
          <span class="skill-grade-badge grade-${escapeHtml(skill.grade)}">${escapeHtml(skill.grade)}</span>
          <span class="skill-attr-badge">${escapeHtml(getAttrName(skill.attr))}</span>
          <span class="skill-cost-badge">${escapeHtml(String(skill.cost))} pts</span>
        </div>
        ${skill.desc ? `<p class="skill-desc">${escapeHtml(skill.desc)}</p>` : ''}
        <div class="skill-actions">
          <button class="btn btn--secondary btn--sm" data-action="roll-skill" data-id="${escapeHtml(skill.id)}">🎲 Rolar</button>
          <button class="btn btn--danger btn--sm" data-action="remove-skill" data-id="${escapeHtml(skill.id)}">✕ Remover</button>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

/**
 * Renderiza a lista de habilidades únicas no DOM.
 */
function renderAbilities() {
  const container = document.getElementById('abilities-list');
  container.innerHTML = '';

  if (state.abilities.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhuma habilidade criada ainda. Use o formulário acima.</p>';
    return;
  }

  const extraCostLabels = {
    nenhum: null, pv: '⚠ Custa PV', condicao: '⚠ Gera Condição', narrativo: '⚠ Recurso Narrativo',
  };

  state.abilities.forEach(ability => {
    const card = document.createElement('div');
    card.className  = `ability-card${ability.used ? ' ability--used' : ''}`;
    card.dataset.id = ability.id;

    const extraLabel = extraCostLabels[ability.extraCost];

    card.innerHTML = `
      <div class="ability-header">
        <span class="ability-name">${escapeHtml(ability.name)}</span>
        <span class="ability-freq-badge">${escapeHtml(getFreqName(ability.freq))}</span>
        <span class="skill-attr-badge">${escapeHtml(getAttrName(ability.attr))}</span>
        <span class="skill-cost-badge">${escapeHtml(String(ability.cost))} pts</span>
        ${extraLabel ? `<span class="ability-extra-badge">${escapeHtml(extraLabel)}</span>` : ''}
      </div>
      ${ability.desc ? `<p class="ability-desc">${escapeHtml(ability.desc)}</p>` : ''}
      <div class="ability-actions">
        <button class="btn btn--${ability.used ? 'dim' : 'warning'} btn--sm"
                data-action="toggle-ability" data-id="${escapeHtml(ability.id)}">
          ${ability.used ? '↺ Resetar' : '✓ Marcar como Usada'}
        </button>
        <button class="btn btn--danger btn--sm" data-action="remove-ability" data-id="${escapeHtml(ability.id)}">✕ Remover</button>
        ${ability.used ? '<span class="ability-used-label">— usada nesta cena/sessão</span>' : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Renderiza a lista de itens do inventário no DOM.
 */
function renderInventory() {
  const container = document.getElementById('inventory-list');
  container.innerHTML = '';

  if (state.inventory.length === 0) {
    container.innerHTML = '<p class="empty-message">Inventário vazio. Adicione itens acima.</p>';
    return;
  }

  state.inventory.forEach(item => {
    const card = document.createElement('div');
    card.className  = 'item-card';
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="item-type-icon">${getItemTypeIcon(item.type)}</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-meta">${escapeHtml(item.type.charAt(0).toUpperCase() + item.type.slice(1))}</div>
        ${item.desc ? `<div class="item-desc">${escapeHtml(item.desc)}</div>` : ''}
      </div>
      <span class="item-qty-badge">×${escapeHtml(String(item.qty))}</span>
      <button class="btn btn--danger btn--sm" data-action="remove-item" data-id="${escapeHtml(item.id)}">✕</button>
    `;
    container.appendChild(card);
  });
}

/**
 * Renderiza o histórico de rolagens no DOM.
 * Entradas mais recentes aparecem no topo (state.rollHistory[0] = mais recente).
 */
function renderRollHistory() {
  const container = document.getElementById('roll-history');
  container.innerHTML = '';

  if (state.rollHistory.length === 0) {
    container.innerHTML = '<p class="empty-message">Nenhuma rolagem ainda. Role um atributo ou perícia.</p>';
    return;
  }

  state.rollHistory.forEach(entry => {
    const div = document.createElement('div');

    // Determina classe visual e texto de resultado
    let cssClass    = 'entry--failure';
    let outcomeText = 'FALHA';
    if (entry.isAutoSuccess) { cssClass = 'entry--auto';    outcomeText = 'AUTO';    }
    else if (entry.success)  { cssClass = 'entry--success'; outcomeText = 'SUCESSO'; }

    div.className = `history-entry ${cssClass}`;

    const rollDisplay = entry.isAutoSuccess ? 'S' : escapeHtml(String(entry.result));
    const gradeText   = entry.grade ? ` [${entry.grade}]` : '';
    const diceText    = entry.rolls && entry.rolls.length > 1 ? ` [${entry.rolls.join(',')}]` : '';
    const metaText    = `vs.${entry.attrValue}${gradeText}${diceText} ${entry.timestamp}`;

    div.innerHTML = `
      <span class="history-roll">${rollDisplay}</span>
      <div class="history-info">
        <div class="history-name">${escapeHtml(entry.name)}</div>
        <div class="history-meta">${escapeHtml(metaText)}</div>
      </div>
      <span class="history-outcome">${outcomeText}</span>
    `;
    container.appendChild(div);
  });
}

/* ============================================================
   14. EVENT LISTENERS E INICIALIZAÇÃO
   ============================================================ */

/**
 * Configura todos os event listeners da aplicação.
 * Centralizado aqui para facilitar manutenção e leitura.
 */
function initEventListeners() {

  // --- Retrato ---
  document.getElementById('btn-load-portrait').addEventListener('click', loadPortrait);
  document.getElementById('portrait-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') loadPortrait();
  });

  // --- HP ---
  document.getElementById('btn-hp-increase').addEventListener('click', increaseHp);
  document.getElementById('btn-hp-decrease').addEventListener('click', decreaseHp);
  document.getElementById('btn-hp-restore').addEventListener('click', restoreHp);
  document.getElementById('btn-hp-suggest').addEventListener('click', suggestHp);
  document.getElementById('hp-current').addEventListener('input', updateHpDisplay);
  document.getElementById('hp-max').addEventListener('input', updateHpDisplay);

  // --- Atributos: qualquer alteração recalcula pontos e valida distribuição ---
  ['vida', 'corpo', 'mente', 'presenca', 'espirito'].forEach(attr => {
    document.getElementById(`attr-${attr}`).addEventListener('input', updateAttributeValidation);
  });

  // --- Botões de rolar por atributo (delegação de eventos na grade) ---
  document.querySelector('.attributes-grid').addEventListener('click', e => {
    const btn = e.target.closest('.btn--roll[data-attr]');
    if (btn) rollAttribute(btn.dataset.attr);
  });

  // --- Botões de ação rápida nos atributos ---
  document.getElementById('btn-fill-example').addEventListener('click', fillExample);
  document.getElementById('btn-clear-attrs').addEventListener('click', () => {
    if (!confirm('Limpar todos os atributos?')) return;
    ['vida', 'corpo', 'mente', 'presenca', 'espirito'].forEach(attr => {
      document.getElementById(`attr-${attr}`).value = 0;
    });
    updateAttributeValidation();
  });

  // --- Histórico de rolagens ---
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    state.rollHistory = [];
    renderRollHistory();
  });

  // --- Perícias ---
  document.getElementById('btn-add-skill').addEventListener('click', addSkill);

  // Delegação de eventos para ações nos cards de perícia
  document.getElementById('skills-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'roll-skill')   rollSkill(id);
    if (action === 'remove-skill') removeSkill(id);
  });

  // --- Habilidades ---
  document.getElementById('btn-add-ability').addEventListener('click', addUniqueAbility);

  document.getElementById('abilities-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'toggle-ability') toggleAbilityUsed(id);
    if (action === 'remove-ability') removeUniqueAbility(id);
  });

  // --- Inventário ---
  document.getElementById('btn-add-item').addEventListener('click', addInventoryItem);

  document.getElementById('inventory-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'remove-item') removeInventoryItem(btn.dataset.id);
  });

  // --- Salvar / Carregar / Exportar / Importar / Apagar ---
  document.getElementById('btn-save').addEventListener('click', saveSheet);
  document.getElementById('btn-load').addEventListener('click', loadSheet);
  document.getElementById('btn-export').addEventListener('click', exportSheetJSON);
  document.getElementById('btn-delete').addEventListener('click', deleteSheet);

  // Input de importação de arquivo JSON
  document.getElementById('input-import').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importSheetJSON(file);
    // Reset para permitir importar o mesmo arquivo repetidamente
    e.target.value = '';
  });
}

/**
 * Função principal de inicialização.
 * Chamada uma única vez quando o DOM estiver completamente carregado.
 */
function init() {
  initEventListeners();
  initCollapsible();
  updateAttributeValidation(); // inicia com "Preencha os atributos"
  updateHpDisplay();           // inicia barra de HP em 0/0
  renderSkills();
  renderAbilities();
  renderInventory();
  renderRollHistory();

  // Verifica se há uma ficha salva e avisa o usuário
  if (localStorage.getItem('swrpg-sheet')) {
    showStatus('💾 Ficha salva encontrada. Clique em "Carregar" para restaurar.', 'info', 7000);
  }

  console.log('%cSTAR WARS RPG — Ficha carregada com sucesso.', 'color: #f0c040; font-weight: bold;');
}

// Aguarda o DOM estar completamente pronto antes de inicializar
document.addEventListener('DOMContentLoaded', init);
