/* ============================================================
   STAR WARS RPG — Ficha de Personagem
   weaponProperties.js — Base de dados das Propriedades de Armas

   Responsabilidade:
   - Definir a lista canônica de propriedades de armas.
   - Fornecer funções utilitárias para buscar, filtrar e validar
     propriedades selecionadas no formulário do inventário.

   Este módulo NÃO mexe na ficha, nos atributos ou nas regras gerais.
   Ele apenas descreve as propriedades e ajuda o inventário a usá-las.
   ============================================================ */

'use strict';

/**
 * Ordem oficial das categorias de propriedades.
 * Usada para montar filtros e agrupar a listagem no formulário.
 */
export const WEAPON_PROPERTY_CATEGORIES = [
  'Gerais',
  'Alcance e Mira',
  'Dano',
  'Energéticas e Tecnológicas',
  'Táticas',
  'Especiais',
];

/**
 * Mapeia o nome de uma categoria para uma classe CSS curta (cor discreta).
 * @param {string} category
 * @returns {string}
 */
export function getCategoryClass(category) {
  const map = {
    'Gerais':                      'cat-gerais',
    'Alcance e Mira':              'cat-alcance',
    'Dano':                        'cat-dano',
    'Energéticas e Tecnológicas':  'cat-energia',
    'Táticas':                     'cat-taticas',
    'Especiais':                   'cat-especiais',
  };
  return map[category] || 'cat-gerais';
}

/**
 * Gera um identificador "slug" a partir de um texto livre
 * (minúsculas, sem acentos, espaços viram hífen).
 * @param {string} text
 * @returns {string}
 */
export function slugifyProperty(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Lista canônica de propriedades de armas.
 * Cada propriedade tem: id, nome, categoria, efeito e (opcional) resumo.
 * O "resumo" é um aviso curto exibido em "Efeitos rápidos" no card.
 */
export const WEAPON_PROPERTIES = [
  /* ---------------- GERAIS ---------------- */
  {
    id: 'simples', nome: 'Simples', categoria: 'Gerais',
    efeito: 'Arma fácil de usar, comum e sem exigências especiais. Pode ser utilizada por praticamente qualquer personagem sem penalidade.',
  },
  {
    id: 'improvisavel', nome: 'Improvisável', categoria: 'Gerais',
    efeito: 'Pode ser encontrada, adaptada ou usada a partir de objetos comuns do cenário. Em caso de Falha, pode quebrar, entortar ou se tornar inutilizável.',
  },
  {
    id: 'leve', nome: 'Leve', categoria: 'Gerais',
    efeito: 'Fácil de carregar, sacar e usar. Pode ser usada com uma mão. Recebe +10% em testes para sacar rapidamente, esconder ou usar em espaços apertados.',
    resumo: '+10% para sacar rápido, esconder ou usar em espaços apertados.',
  },
  {
    id: 'pesada', nome: 'Pesada', categoria: 'Gerais',
    efeito: 'Exige força, apoio ou preparo para usar corretamente. Caso o personagem não tenha Corpo 30 ou maior, recebe -10% em testes de ataque com essa arma.',
    resumo: 'Exige Corpo 30+. Caso contrário, -10% em ataques.',
  },
  {
    id: 'duas-maos', nome: 'Duas Mãos', categoria: 'Gerais',
    efeito: 'Precisa ser usada com as duas mãos. Enquanto estiver usando essa arma, o personagem não pode segurar escudo, item ou segunda arma sem penalidade.',
    resumo: 'Ocupa as duas mãos: sem escudo, item ou segunda arma sem penalidade.',
  },
  {
    id: 'ocultavel', nome: 'Ocultável', categoria: 'Gerais',
    efeito: 'Pode ser escondida facilmente em roupas, bolsas, botas, coldres ocultos ou compartimentos secretos. Testes para encontrar essa arma recebem -20%.',
    resumo: '-20% nos testes para encontrar a arma.',
  },
  {
    id: 'restrita', nome: 'Restrita', categoria: 'Gerais',
    efeito: 'Arma legalmente limitada, militar, nobre, imperial ou de facção. Carregar essa arma pode gerar revistas, suspeitas, multas, prisão ou denúncia.',
  },
  {
    id: 'ilegal', nome: 'Ilegal', categoria: 'Gerais',
    efeito: 'Arma proibida em setores comuns. Se for encontrada por autoridades, pode gerar perseguição, prisão, confisco ou aumento de recompensa.',
  },

  /* ---------------- ALCANCE E MIRA ---------------- */
  {
    id: 'curto-alcance', nome: 'Curto Alcance', categoria: 'Alcance e Mira',
    efeito: 'Funciona melhor em combates próximos. Ataques contra alvos distantes recebem -10% ou -20%, dependendo da cena.',
    resumo: '-10% a -20% contra alvos distantes.',
  },
  {
    id: 'medio-alcance', nome: 'Médio Alcance', categoria: 'Alcance e Mira',
    efeito: 'Funciona bem na maioria dos combates comuns. Não recebe penalidade em distâncias normais de combate.',
  },
  {
    id: 'longo-alcance', nome: 'Longo Alcance', categoria: 'Alcance e Mira',
    efeito: 'Pode atingir alvos distantes sem penalidade comum. Recebe +10% em testes de ataque contra alvos afastados, caso o personagem tenha tempo para mirar.',
    resumo: '+10% contra alvos afastados se houver tempo para mirar.',
  },
  {
    id: 'precisa', nome: 'Precisa', categoria: 'Alcance e Mira',
    efeito: 'Arma feita para acertos calculados. Se o personagem usar uma ação para mirar antes de atacar, recebe +20% no teste de ataque em vez de +10%.',
    resumo: 'Mirar antes de atacar concede +20% em vez de +10%.',
  },
  {
    id: 'mira-instavel', nome: 'Mira Instável', categoria: 'Alcance e Mira',
    efeito: 'Arma difícil de controlar. Se o personagem atacar depois de se mover no mesmo turno, recebe -10% no teste de ataque.',
    resumo: '-10% no ataque se mover no mesmo turno.',
  },
  {
    id: 'dispersao', nome: 'Dispersão', categoria: 'Alcance e Mira',
    efeito: 'Arma espalha o disparo em uma área curta. Recebe +15% contra alvos próximos, mas -20% contra alvos distantes.',
    resumo: '+15% contra alvos próximos, -20% contra distantes.',
  },
  {
    id: 'rajada', nome: 'Rajada', categoria: 'Alcance e Mira',
    efeito: 'Pode disparar vários tiros rapidamente. Ao atacar, o personagem pode escolher receber -10% no teste para causar +1 dado de dano se acertar.',
    resumo: 'Pode aceitar -10% no ataque para causar +1 dado de dano.',
  },
  {
    id: 'automatica', nome: 'Automática', categoria: 'Alcance e Mira',
    efeito: 'Arma de disparo contínuo. Pode atacar uma pequena área ou grupo próximo. O ataque recebe -20%, mas pode atingir mais de um alvo, com aprovação do Mestre.',
    resumo: '-20% no ataque, mas pode atingir vários alvos próximos.',
  },
  {
    id: 'silenciosa', nome: 'Silenciosa', categoria: 'Alcance e Mira',
    efeito: 'Produz pouco som ou pode ser usada sem chamar atenção facilmente. Testes para perceber o ataque recebem -20%, se o alvo não estiver atento.',
    resumo: '-20% nos testes para perceber o ataque.',
  },

  /* ---------------- DANO ---------------- */
  {
    id: 'letal', nome: 'Letal', categoria: 'Dano',
    efeito: 'Pode causar Ferimento Mortal. Alvos que tiverem seus PV zerados podem morrer automaticamente dependendo de onde o ataque foi desferido.',
    resumo: 'Pode causar Ferimento Mortal.',
  },
  {
    id: 'brutal', nome: 'Brutal', categoria: 'Dano',
    efeito: 'Ao causar dano, se um dos resultados dos dados for o valor máximo, adicione +1 dado do mesmo tipo uma vez.',
    resumo: 'Resultado máximo no dado adiciona +1 dado uma vez.',
  },
  {
    id: 'perfurante', nome: 'Perfurante', categoria: 'Dano',
    efeito: 'Ignora 1 ponto de Proteção do alvo.',
    resumo: 'Ignora 1 ponto de Proteção.',
  },
  {
    id: 'anti-armadura', nome: 'Anti-Armadura', categoria: 'Dano',
    efeito: 'Ignora 2 pontos de Proteção do alvo.',
    resumo: 'Ignora 2 pontos de Proteção.',
  },
  {
    id: 'corta-tudo', nome: 'Corta Tudo', categoria: 'Dano',
    efeito: 'Ignora proteções comuns, portas simples, grades, armas frágeis e materiais comuns. Materiais raros, campos de energia e beskar podem resistir normalmente.',
    resumo: 'Ignora proteções comuns e materiais frágeis.',
  },
  {
    id: 'devastador', nome: 'Devastador', categoria: 'Dano',
    efeito: 'Quando causar Ferimento Mortal, o alvo recebe -20% no teste de Vida para resistir.',
    resumo: 'Ferimento Mortal: alvo testa Vida com -20%.',
  },
  {
    id: 'explosiva', nome: 'Explosiva', categoria: 'Dano',
    efeito: 'Causa dano em uma área. Alvos próximos podem testar Corpo para sofrer metade do dano, se houver espaço ou cobertura.',
    resumo: 'Dano em área; alvos testam Corpo por metade do dano.',
  },
  {
    id: 'area', nome: 'Área', categoria: 'Dano',
    efeito: 'Afeta todos dentro de uma pequena zona, sala, corredor ou ponto de impacto. O Mestre define quantos alvos podem ser atingidos.',
    resumo: 'Atinge vários alvos na zona de impacto.',
  },
  {
    id: 'concussiva', nome: 'Concussiva', categoria: 'Dano',
    efeito: 'O impacto causa onda de choque. Se acertar, o alvo deve testar Corpo ou ficar Derrubado.',
    resumo: 'Ao acertar, alvo testa Corpo ou fica Derrubado.',
  },
  {
    id: 'atordoante', nome: 'Atordoante', categoria: 'Dano',
    efeito: 'Pode causar dano não letal. Em vez de causar dano total, pode aplicar Atordoado em caso de Sucesso ou Sucesso Crítico.',
    resumo: 'Pode aplicar Atordoado em vez de dano total.',
  },
  {
    id: 'queimando', nome: 'Queimando', categoria: 'Dano',
    efeito: 'Se o ataque causar dano, o alvo pode ficar Queimando. No início do próprio turno, sofre 5 de dano energético até apagar as chamas.',
    resumo: 'Pode deixar Queimando: 5 de dano por turno.',
  },
  {
    id: 'sangramento', nome: 'Sangramento', categoria: 'Dano',
    efeito: 'Se causar dano em um alvo orgânico, ele pode ficar Sangrando. No início do próprio turno, perde 1d6+2 PV até ser tratado.',
    resumo: 'Pode deixar Sangrando: 1d6+2 PV por turno.',
  },
  {
    id: 'desmembradora', nome: 'Desmembradora', categoria: 'Dano',
    efeito: 'Em Sucesso Crítico ou Ferimento Mortal, pode inutilizar, arrancar ou destruir um membro, peça ou parte do alvo, com decisão do Mestre.',
    resumo: 'Em crítico, pode arrancar membros ou peças do alvo.',
  },

  /* ---------------- ENERGÉTICAS E TECNOLÓGICAS ---------------- */
  {
    id: 'energetica', nome: 'Energética', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Causa dano de energia, calor, plasma, laser ou descarga. Pode afetar materiais inflamáveis, sistemas sensíveis e alvos orgânicos.',
    resumo: 'Dano de energia, calor, plasma ou descarga.',
  },
  {
    id: 'ionica', nome: 'Iônica', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Especial contra droides, máquinas, portas eletrônicas e sistemas. Contra máquinas, pode ser considerada Letal. Contra orgânicos, normalmente causa Atordoado ou desorientação.',
    resumo: 'Letal contra máquinas; atordoa orgânicos.',
  },
  {
    id: 'anti-escudo', nome: 'Anti-Escudo', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Causa dano dobrado contra Escudos, mas dano normal contra Integridade, Vida ou casco.',
    resumo: 'Causa dano dobrado contra Escudos.',
  },
  {
    id: 'sobrecarregada', nome: 'Sobrecarregada', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Pode ser forçada para causar +1 dado de dano. Depois do ataque, role 1d100. Em resultado 80 ou maior, a arma superaquece, trava ou precisa de uma ação para recarregar.',
    resumo: '+1 dado de dano; role 1d100, 80+ superaquece.',
  },
  {
    id: 'instavel', nome: 'Instável', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Em Falha Crítica, a arma falha de forma perigosa. Pode explodir, descarregar energia, travar, ferir o usuário ou gerar uma complicação.',
    resumo: 'Falha Crítica pode ferir o usuário ou explodir.',
  },
  {
    id: 'recarregavel', nome: 'Recarregável', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Após certo número de ataques, precisa de uma ação para recarregar, trocar célula, esfriar ou reativar. O Mestre define a frequência.',
  },
  {
    id: 'carga-limitada', nome: 'Carga Limitada', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Possui munição ou energia limitada. Após a cena ou após uso excessivo, pode exigir célula de energia, munição, manutenção ou peça extra.',
  },
  {
    id: 'canalizadora', nome: 'Canalizadora', categoria: 'Energéticas e Tecnológicas',
    efeito: 'Pode conduzir energia, Força, eletricidade ou outro poder especial. Permite que certas Técnicas da Força ou habilidades sejam usadas através da arma, com aprovação do Mestre.',
  },

  /* ---------------- TÁTICAS ---------------- */
  {
    id: 'desarmadora', nome: 'Desarmadora', categoria: 'Táticas',
    efeito: 'Pode ser usada para tirar arma, item ou equipamento da mão do alvo. Ataques para desarmar recebem apenas -10%, em vez de -20%.',
    resumo: 'Desarmar custa apenas -10%, em vez de -20%.',
  },
  {
    id: 'imobilizante', nome: 'Imobilizante', categoria: 'Táticas',
    efeito: 'Pode prender, enrolar, travar ou impedir movimento. Em sucesso, o alvo pode ficar Imobilizado até gastar uma ação para escapar.',
    resumo: 'Pode deixar o alvo Imobilizado.',
  },
  {
    id: 'empurrao', nome: 'Empurrão', categoria: 'Táticas',
    efeito: 'Ao acertar, pode empurrar o alvo alguns metros, afastar de cobertura ou jogar contra uma parede, queda ou obstáculo.',
    resumo: 'Pode empurrar o alvo ao acertar.',
  },
  {
    id: 'derrubadora', nome: 'Derrubadora', categoria: 'Táticas',
    efeito: 'Ao acertar, o alvo deve testar Corpo ou ficar Derrubado.',
    resumo: 'Ao acertar, alvo testa Corpo ou fica Derrubado.',
  },
  {
    id: 'defensiva', nome: 'Defensiva', categoria: 'Táticas',
    efeito: 'Pode ser usada para bloquear ataques. Enquanto estiver empunhando essa arma, o personagem recebe +10% em testes de Bloqueio.',
    resumo: '+10% em testes de Bloqueio.',
  },
  {
    id: 'aparadora', nome: 'Aparadora', categoria: 'Táticas',
    efeito: 'Especial para duelos corpo a corpo. Contra armas corpo a corpo, recebe +20% em testes de Bloqueio ou Contra-Ataque.',
    resumo: '+20% em Bloqueio/Contra-Ataque corpo a corpo.',
  },
  {
    id: 'arremessavel', nome: 'Arremessável', categoria: 'Táticas',
    efeito: 'Pode ser lançada contra um alvo. Depois de arremessada, precisa ser recuperada, puxada de volta ou substituída.',
  },
  {
    id: 'retornavel', nome: 'Retornável', categoria: 'Táticas',
    efeito: 'Após ser arremessada, pode voltar para a mão do usuário por tecnologia, cabo, magnetismo ou efeito especial.',
  },
  {
    id: 'acoplavel', nome: 'Acoplável', categoria: 'Táticas',
    efeito: 'Pode ser instalada em armaduras, próteses, droides ou suportes. Quando acoplada, não precisa ser segurada diretamente.',
  },
  {
    id: 'montada', nome: 'Montada', categoria: 'Táticas',
    efeito: 'Precisa estar presa em suporte, tripé ou estrutura. Se usada sem suporte adequado, recebe -30% no teste de ataque.',
    resumo: 'Sem suporte adequado: -30% no ataque.',
  },

  /* ---------------- ESPECIAIS ---------------- */
  {
    id: 'viva', nome: 'Viva', categoria: 'Especiais',
    efeito: 'A arma possui consciência, instinto, espírito, IA, cristal ou vontade própria. Pode reagir a situações, recusar usuários ou criar efeitos narrativos.',
  },
  {
    id: 'sombria', nome: 'Sombria', categoria: 'Especiais',
    efeito: 'Ligada ao Lado Sombrio, Sith, medo, ódio ou energia corrompida. Usar essa arma pode causar aproximação com o Lado Sombrio.',
  },
  {
    id: 'sagrada', nome: 'Sagrada', categoria: 'Especiais',
    efeito: 'Ligada a uma tradição, ordem, clã, mestre ou juramento. Pode conceder bônus em situações específicas, mas também exigir conduta ou propósito.',
  },
  {
    id: 'experimental', nome: 'Experimental', categoria: 'Especiais',
    efeito: 'Possui uma função incomum definida com o Mestre. Em Falha Crítica, sempre gera uma complicação tecnológica, energética ou narrativa.',
  },
  {
    id: 'personalizada', nome: 'Personalizada', categoria: 'Especiais',
    efeito: 'Criada ou modificada para um usuário específico. Nas mãos do dono, recebe +15% em testes apropriados. Nas mãos de outro usuário, pode não funcionar direito.',
    resumo: 'Nas mãos do dono, +15% em testes apropriados.',
  },
  {
    id: 'assinatura-marcante', nome: 'Assinatura Marcante', categoria: 'Especiais',
    efeito: 'A arma deixa marcas fáceis de reconhecer, como queimadura específica, som único, cor de disparo ou padrão de corte. Pode ajudar inimigos a rastrear o usuário.',
  },
  {
    id: 'juramentada', nome: 'Juramentada', categoria: 'Especiais',
    efeito: 'A arma está ligada a um juramento, clã, credo ou código. Quando usada contra o propósito dela, o Mestre pode aplicar penalidade ou consequência narrativa.',
  },
];

/** Índice id → propriedade, montado uma vez. */
const PROPERTY_INDEX = new Map(WEAPON_PROPERTIES.map(p => [p.id, p]));

/** Conjunto de ids válidos, montado uma vez. */
const VALID_IDS = new Set(WEAPON_PROPERTIES.map(p => p.id));

/**
 * Retorna a lista completa de propriedades.
 * @returns {Array<object>}
 */
export function getWeaponProperties() {
  return WEAPON_PROPERTIES;
}

/**
 * Retorna uma propriedade pelo id (ou undefined).
 * @param {string} id
 * @returns {object|undefined}
 */
export function getWeaponPropertyById(id) {
  return PROPERTY_INDEX.get(id);
}

/**
 * Retorna as propriedades de uma categoria.
 * @param {string} category
 * @returns {Array<object>}
 */
export function getWeaponPropertiesByCategory(category) {
  if (!category) return WEAPON_PROPERTIES.slice();
  return WEAPON_PROPERTIES.filter(p => p.categoria === category);
}

/**
 * Filtra propriedades por texto (nome/efeito) e/ou categoria.
 * @param {string} query
 * @param {string} category
 * @returns {Array<object>}
 */
export function filterWeaponProperties(query, category) {
  const q = String(query || '').trim().toLowerCase();
  const normQ = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return WEAPON_PROPERTIES.filter(p => {
    if (category && p.categoria !== category) return false;
    if (!normQ) return true;
    const haystack = `${p.nome} ${p.efeito} ${p.categoria}`
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return haystack.includes(normQ);
  });
}

/**
 * Garante que a seleção de propriedades seja um array de ids válidos,
 * sem duplicatas e preservando a ordem de seleção.
 * @param {Array<string>} propertyIds
 * @returns {Array<string>}
 */
export function sanitizeWeaponProperties(propertyIds) {
  if (!Array.isArray(propertyIds)) return [];
  return [...new Set(propertyIds)].filter(id => VALID_IDS.has(id));
}

/**
 * Normaliza uma lista "crua" de propriedades (de fichas antigas ou de
 * importação) para ids válidos. Aceita ids diretos OU nomes livres
 * (ex.: "Letal", "Longo Alcance"), convertendo-os por slug.
 * @param {Array<string>} list
 * @returns {Array<string>}
 */
export function normalizePropertyList(list) {
  if (!Array.isArray(list)) return [];
  const result = [];

  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const raw = entry.trim();
    if (!raw) continue;

    // 1) já é um id válido
    if (VALID_IDS.has(raw) && !result.includes(raw)) {
      result.push(raw);
      continue;
    }

    // 2) slug do texto bate com um id
    const slug = slugifyProperty(raw);
    if (VALID_IDS.has(slug)) {
      if (!result.includes(slug)) result.push(slug);
      continue;
    }

    // 3) slug bate com o nome de alguma propriedade
    const byName = WEAPON_PROPERTIES.find(p => slugifyProperty(p.nome) === slug);
    if (byName && !result.includes(byName.id)) {
      result.push(byName.id);
    }
    // senão: ignora entrada inválida
  }

  return result;
}
