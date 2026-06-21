// Itens estilo Diablo II: bases, qualidades, afixos por nível, set e uniques.
// Qualidade: normal(branco) > magic(azul, 1-2 afixos) > rare(amarelo, 3-6) > set(verde) > unique(dourado)

export const RARITY = {
  normal: { id: 'normal', name: 'Normal', color: '#d8c7a8', cssClass: '', weight: 60 },
  magic: { id: 'magic', name: 'Mágico', color: '#6464ff', cssClass: 'magic', weight: 28 },
  rare: { id: 'rare', name: 'Raro', color: '#ffff64', cssClass: 'rare', weight: 9 },
  set: { id: 'set', name: 'Conjunto', color: '#00ff00', cssClass: 'set', weight: 1.5 },
  unique: { id: 'unique', name: 'Único', color: '#c8aa6e', cssClass: 'unique', weight: 1.5 },
};

// Bases de itens. dmg = [min,max] para armas; def para armaduras.
export const ITEM_BASES = [
  // Armas (reqStr/reqDex e durabilidade como no D2)
  { id: 'short_sword', name: 'Espada Curta', slot: 'weapon', kind: 'sword', icon: '🗡️', dmg: [2, 6], reqLevel: 1, reqStr: 10, dur: 24, classWeapon: ['guardian'] },
  { id: 'long_sword', name: 'Espada Longa', slot: 'weapon', kind: 'sword', icon: '⚔️', dmg: [6, 14], reqLevel: 8, reqStr: 28, dur: 44, classWeapon: ['guardian'] },
  { id: 'great_sword', name: 'Montante', slot: 'weapon', kind: 'sword', icon: '🗡️', dmg: [12, 28], reqLevel: 20, reqStr: 55, dur: 50, classWeapon: ['guardian'] },
  { id: 'oak_staff', name: 'Cajado de Carvalho', slot: 'weapon', kind: 'staff', icon: '🪄', dmg: [3, 7], reqLevel: 1, reqStr: 5, dur: 30, classWeapon: ['arcanist'] },
  { id: 'rune_staff', name: 'Cajado Rúnico', slot: 'weapon', kind: 'staff', icon: '🪄', dmg: [6, 12], reqLevel: 12, reqStr: 12, dur: 35, classWeapon: ['arcanist'] },
  { id: 'short_bow', name: 'Arco Curto', slot: 'weapon', kind: 'bow', icon: '🏹', dmg: [2, 8], reqLevel: 1, reqDex: 15, dur: 24, classWeapon: ['hunter'] },
  { id: 'hunters_bow', name: 'Arco do Caçador', slot: 'weapon', kind: 'bow', icon: '🏹', dmg: [7, 16], reqLevel: 10, reqDex: 32, dur: 40, classWeapon: ['hunter'] },
  { id: 'war_bow', name: 'Arco de Guerra', slot: 'weapon', kind: 'bow', icon: '🏹', dmg: [14, 30], reqLevel: 22, reqDex: 55, dur: 45, classWeapon: ['hunter'] },
  // Armaduras
  { id: 'leather_cap', name: 'Capuz de Couro', slot: 'helm', icon: '🪖', def: [3, 6], reqLevel: 1, reqStr: 5, dur: 18 },
  { id: 'iron_helm', name: 'Elmo de Ferro', slot: 'helm', icon: '⛑️', def: [10, 18], reqLevel: 12, reqStr: 35, dur: 30 },
  { id: 'quilted_armor', name: 'Armadura Acolchoada', slot: 'body', icon: '🧥', def: [8, 14], reqLevel: 1, reqStr: 12, dur: 28 },
  { id: 'chain_mail', name: 'Cota de Malha', slot: 'body', icon: '🥼', def: [20, 36], reqLevel: 12, reqStr: 45, dur: 45 },
  { id: 'plate_mail', name: 'Armadura de Placas', slot: 'body', icon: '🛡️', def: [40, 70], reqLevel: 24, reqStr: 75, dur: 60 },
  { id: 'leather_gloves', name: 'Luvas de Couro', slot: 'gloves', icon: '🧤', def: [2, 4], reqLevel: 1, dur: 14 },
  { id: 'leather_boots', name: 'Botas de Couro', slot: 'boots', icon: '🥾', def: [2, 4], reqLevel: 1, dur: 14 },
  // Cintos: beltRows = fileiras de poções (estilo D2). Capacidade por tipo = fileiras × 4.
  { id: 'sash', name: 'Faixa', slot: 'belt', icon: '🎗️', def: [2, 4], reqLevel: 1, dur: 16, beltRows: 2 },
  { id: 'belt', name: 'Cinto', slot: 'belt', icon: '🩹', def: [5, 9], reqLevel: 8, reqStr: 18, dur: 20, beltRows: 3 },
  { id: 'war_belt', name: 'Cinto de Guerra', slot: 'belt', icon: '🪢', def: [10, 16], reqLevel: 18, reqStr: 35, dur: 26, beltRows: 4 },
  { id: 'buckler', name: 'Broquel', slot: 'shield', icon: '🛡️', def: [4, 8], reqLevel: 1, reqStr: 12, dur: 24, classWeapon: ['guardian'] },
  { id: 'kite_shield', name: 'Escudo Pipa', slot: 'shield', icon: '🛡️', def: [14, 26], reqLevel: 14, reqStr: 40, dur: 40, classWeapon: ['guardian'] },
  // Joias
  { id: 'ring', name: 'Anel', slot: 'ring', icon: '💍', reqLevel: 1 },
  { id: 'amulet', name: 'Amuleto', slot: 'amulet', icon: '📿', reqLevel: 1 },
  // Charms (Talismãs) — ficam no inventário e dão bônus passivos, como no D2.
  { id: 'charm_small', name: 'Talismã Pequeno', slot: 'charm', icon: '🔸', reqLevel: 1, charmSize: 1 },
  { id: 'charm_large', name: 'Talismã Grande', slot: 'charm', icon: '🔶', reqLevel: 10, charmSize: 2 },
  { id: 'charm_grand', name: 'Talismã Imenso', slot: 'charm', icon: '🟧', reqLevel: 20, charmSize: 3 },
];

// Fileiras de poções de um cinto (por baseId). Cintos melhores = mais fileiras. Default 2 (faixa).
export function beltRowsFor(baseId) {
  const b = ITEM_BASES.find(x => x.id === baseId);
  return (b && b.beltRows) || 2;
}

// Pool de afixos. tier limita por ilvl. mod aplicado em rolagem [min,max].
// stat: chave em player.bonuses
export const AFFIXES = {
  prefix: [
    { id: 'p_str', name: 'Forte', stat: 'str', range: [1, 5], ilvl: 1 },
    { id: 'p_str2', name: 'Brutal', stat: 'str', range: [6, 12], ilvl: 15 },
    { id: 'p_dex', name: 'Ágil', stat: 'dex', range: [1, 5], ilvl: 1 },
    { id: 'p_dex2', name: 'Felino', stat: 'dex', range: [6, 12], ilvl: 15 },
    { id: 'p_ene', name: 'Sábio', stat: 'ene', range: [1, 5], ilvl: 1 },
    { id: 'p_phys', name: 'Afiado', stat: 'physDamagePct', range: [0.10, 0.30], ilvl: 4, pct: true },
    { id: 'p_phys2', name: 'Cruel', stat: 'physDamagePct', range: [0.30, 0.70], ilvl: 20, pct: true },
    { id: 'p_ed', name: 'Flamejante', stat: 'flatFire', range: [2, 8], ilvl: 6 },
    { id: 'p_cold', name: 'Glacial', stat: 'flatCold', range: [2, 8], ilvl: 6 },
    { id: 'p_light', name: 'Faiscante', stat: 'flatLight', range: [1, 14], ilvl: 6 },
    { id: 'p_def', name: 'Reforçado', stat: 'defenseFlat', range: [10, 30], ilvl: 8 },
    { id: 'p_aspd', name: 'Veloz', stat: 'attackSpeed', range: [0.05, 0.15], ilvl: 10, pct: true },
    { id: 'p_allattr', name: 'do Titã', stat: 'allAttrs', range: [1, 4], ilvl: 18 },
    { id: 'p_ar', name: 'Certeiro', stat: 'attackRating', range: [10, 60], ilvl: 5 },
    { id: 'p_fcr', name: 'Arcano', stat: 'fcr', range: [0.10, 0.20], ilvl: 12, pct: true },
  ],
  suffix: [
    { id: 's_vit', name: 'da Vitalidade', stat: 'vit', range: [1, 5], ilvl: 1 },
    { id: 's_vit2', name: 'do Touro', stat: 'vit', range: [6, 14], ilvl: 16 },
    { id: 's_life', name: 'da Vida', stat: 'lifeFlat', range: [5, 20], ilvl: 4 },
    { id: 's_life2', name: 'do Coloso', stat: 'lifeFlat', range: [21, 50], ilvl: 22 },
    { id: 's_mana', name: 'da Mente', stat: 'manaFlat', range: [5, 20], ilvl: 4 },
    { id: 's_resfire', name: 'do Calor', stat: 'resFire', range: [5, 20], ilvl: 6, pct: true },
    { id: 's_rescold', name: 'do Frio', stat: 'resCold', range: [5, 20], ilvl: 6, pct: true },
    { id: 's_reslight', name: 'da Tempestade', stat: 'resLight', range: [5, 20], ilvl: 6, pct: true },
    { id: 's_resall', name: 'do Prisma', stat: 'resAll', range: [3, 12], ilvl: 18, pct: true },
    { id: 's_mf', name: 'da Sorte', stat: 'magicFind', range: [5, 25], ilvl: 10, pct: true },
    { id: 's_ll', name: 'da Sanguessuga', stat: 'lifeLeech', range: [2, 6], ilvl: 14, pct: true },
    { id: 's_fhr', name: 'da Reação', stat: 'moveSpeedPct', range: [0.03, 0.10], ilvl: 12, pct: true },
    { id: 's_skills', name: 'da Maestria', stat: 'allSkills', range: [1, 2], ilvl: 24, slots: ['weapon', 'amulet'] },
    { id: 's_deadly', name: 'da Morte', stat: 'critChance', range: [0.05, 0.15], ilvl: 16, pct: true },
    { id: 's_maxres', name: 'do Bastião', stat: 'maxResAll', range: [2, 5], ilvl: 26 },
    { id: 's_cb', name: 'do Esmagamento', stat: 'crushingBlow', range: [0.05, 0.15], ilvl: 18, pct: true, slots: ['weapon', 'gloves'] },
    { id: 's_ow', name: 'das Feridas', stat: 'openWounds', range: [0.08, 0.20], ilvl: 14, pct: true, slots: ['weapon', 'gloves'] },
    { id: 's_fhr2', name: 'da Recuperação', stat: 'fhr', range: [0.10, 0.30], ilvl: 12, pct: true, slots: ['body', 'helm', 'belt'] },
    { id: 's_cbf', name: 'do Descongelamento', stat: 'cannotFreeze', range: [1, 1], ilvl: 18, slots: ['body', 'boots', 'ring'] },
    { id: 's_lpk', name: 'da Caçada', stat: 'lifePerKill', range: [1, 6], ilvl: 10 },
    { id: 's_mpk', name: 'do Êxtase', stat: 'manaPerKill', range: [1, 4], ilvl: 10 },
    { id: 's_stamina', name: 'do Vigor', stat: 'staminaFlat', range: [15, 50], ilvl: 8, slots: ['boots', 'belt', 'body'] },
  ],
};

// Afixo de prefixo extra: Espinhos (reflete dano físico ao atacante).
AFFIXES.prefix.push({ id: 'p_thorns', name: 'Espinhoso', stat: 'thorns', range: [10, 50], ilvl: 10, slots: ['body', 'shield'] });

// Afixos de PROC (estilo D2: "X% de conjurar [skill] ao acertar / ao ser atingido"). O `range` rola a
// CHANCE em %; `proc` descreve a skill, o nível fixo e o gatilho. Aplicados em item.procs (não em mods).
AFFIXES.suffix.push(
  { id: 's_proc_nova', name: 'do Relâmpago', stat: 'proc_nova', range: [5, 12], ilvl: 16, slots: ['body', 'helm', 'shield', 'amulet'],
    proc: { skill: 'nova', skillName: 'Nova', level: 6, trigger: 'struck' } },
  { id: 's_proc_frost', name: 'do Inverno', stat: 'proc_frost', range: [5, 12], ilvl: 14, slots: ['body', 'helm', 'shield', 'amulet'],
    proc: { skill: 'frost_nova', skillName: 'Nova de Gelo', level: 5, trigger: 'struck' } },
  { id: 's_proc_cbolt', name: 'da Carga', stat: 'proc_cbolt', range: [5, 12], ilvl: 12, slots: ['weapon', 'gloves', 'amulet'],
    proc: { skill: 'charged_bolt', skillName: 'Dardos Elétricos', level: 6, trigger: 'strike' } },
  { id: 's_proc_fire', name: 'da Brasa', stat: 'proc_fire', range: [5, 12], ilvl: 10, slots: ['weapon', 'gloves', 'amulet'],
    proc: { skill: 'fire_bolt', skillName: 'Dardo de Fogo', level: 8, trigger: 'strike' } },
);

// Pool de afixos de JOIA (jewel) — subconjunto "legal" do D2. Joias encravam em
// qualquer soquete (arma OU armadura) e dão o MESMO bônus independente do alvo.
export const JEWEL_AFFIXES = {
  prefix: [
    { id: 'j_phys', name: 'Afiada', stat: 'physDamagePct', range: [0.10, 0.40], ilvl: 4, pct: true },
    { id: 'j_fire', name: 'Flamejante', stat: 'flatFire', range: [3, 12], ilvl: 6 },
    { id: 'j_cold', name: 'Glacial', stat: 'flatCold', range: [2, 10], ilvl: 6 },
    { id: 'j_light', name: 'Faiscante', stat: 'flatLight', range: [1, 18], ilvl: 6 },
    { id: 'j_ar', name: 'Certeira', stat: 'attackRating', range: [20, 80], ilvl: 4 },
    { id: 'j_aspd', name: 'Veloz', stat: 'attackSpeed', range: [0.05, 0.15], ilvl: 10, pct: true },
    { id: 'j_def', name: 'Robusta', stat: 'defenseFlat', range: [10, 40], ilvl: 8 },
  ],
  suffix: [
    { id: 'j_life', name: 'da Vida', stat: 'lifeFlat', range: [5, 18], ilvl: 4 },
    { id: 'j_mana', name: 'da Mente', stat: 'manaFlat', range: [5, 18], ilvl: 4 },
    { id: 'j_str', name: 'do Touro', stat: 'str', range: [1, 6], ilvl: 6 },
    { id: 'j_dex', name: 'da Raposa', stat: 'dex', range: [1, 6], ilvl: 6 },
    { id: 'j_resfire', name: 'do Calor', stat: 'resFire', range: [5, 16], ilvl: 8, pct: true },
    { id: 'j_rescold', name: 'do Frio', stat: 'resCold', range: [5, 16], ilvl: 8, pct: true },
    { id: 'j_reslight', name: 'da Tempestade', stat: 'resLight', range: [5, 16], ilvl: 8, pct: true },
    { id: 'j_resall', name: 'do Prisma', stat: 'resAll', range: [3, 9], ilvl: 18, pct: true },
    { id: 'j_mf', name: 'da Sorte', stat: 'magicFind', range: [3, 12], ilvl: 12, pct: true },
    { id: 'j_maxres', name: 'do Bastião', stat: 'maxResAll', range: [1, 2], ilvl: 26 },
  ],
};

// Bônus de CONJUNTO (set): aplicado conforme o nº de peças do mesmo set equipadas.
export const SET_BONUSES = {
  'Traje do Minerador': {
    2: { resAll: 25, lifeFlat: 40, magicFind: 20 },
  },
  'Pele do Lobo': {
    2: { moveSpeedPct: 0.20, attackSpeed: 0.20, dex: 10 },
  },
  // Conjunto de 3 peças com bônus CRESCENTES (parciais 2/3 e completo 3/3), como no D2.
  'Arsenal do Esqueleto': {
    2: { dex: 15, attackSpeed: 0.15, attackRating: 60 },
    3: { allSkills: 1, critChance: 0.10, flatCold: 20, resCold: 25 },
  },
};

// Itens únicos (fixos). Caem raramente.
export const UNIQUES = [
  { id: 'cube_grandfather', name: 'O Bloco Ancestral', baseId: 'great_sword', rarity: 'unique', icon: '⚔️',
    mods: { physDamagePct: 1.5, str: 20, vit: 20, lifeFlat: 80 }, reqLevel: 30, flavor: 'Forjado no primeiro bioma.' },
  { id: 'creeper_heart', name: 'Coração de Creeper', baseId: 'amulet', rarity: 'unique', icon: '📿',
    mods: { flatFire: 20, resFire: 30, ene: 15, manaFlat: 40 }, reqLevel: 18, flavor: 'Ainda pulsa, prestes a explodir.' },
  { id: 'enderwalk', name: 'Passos do Ender', baseId: 'leather_boots', rarity: 'unique', icon: '🥾',
    mods: { moveSpeedPct: 0.35, dex: 15, resAll: 15 }, reqLevel: 14, flavor: 'Teletransporta o portador entre passos.' },
  { id: 'diamond_aegis', name: 'Égide de Diamante', baseId: 'kite_shield', rarity: 'unique', icon: '🛡️',
    mods: { defenseFlat: 120, resAll: 25, lifeFlat: 50 }, reqLevel: 24, flavor: 'Mais dura que a bigorna.' },
  { id: 'wither_band', name: 'Anel do Definhamento', baseId: 'ring', rarity: 'unique', icon: '💍',
    mods: { flatLight: 18, resAll: 15, manaFlat: 40, fcr: 0.10 }, reqLevel: 16, flavor: 'Sussurra fórmulas proibidas.' },
  { id: 'creeper_crown', name: 'Coroa do Creeper', baseId: 'iron_helm', rarity: 'unique', icon: '👑',
    mods: { flatFire: 25, str: 15, lifeFlat: 60, crushingBlow: 0.10 }, reqLevel: 20, flavor: 'Tssss... BOOM.' },
  { id: 'spider_fang', name: 'Presa da Aracne', baseId: 'war_bow', rarity: 'unique', icon: '🏹',
    mods: { physDamagePct: 1.2, dex: 25, openWounds: 0.25, attackSpeed: 0.20 }, reqLevel: 28, flavor: 'Cada flecha deixa veneno cúbico.' },
  { id: 'anihilus', name: 'Anihilus', baseId: 'charm_grand', rarity: 'unique', icon: '🟧',
    mods: { allSkills: 1, allAttrs: 8, resAll: 12, lifeFlat: 30 }, reqLevel: 30, flavor: 'O charm lendário — pulsa com o Caos cúbico. (recompensa do Pasto Proibido)' },
  { id: 'golem_fist', name: 'Punho do Golem', baseId: 'leather_gloves', rarity: 'unique', icon: '🧤',
    mods: { attackSpeed: 0.20, str: 15, crushingBlow: 0.15, lifeFlat: 25 }, reqLevel: 18, flavor: 'Pedra viva moldada em luva.' },
  { id: 'void_belt', name: 'Cinto do Vazio', baseId: 'sash', rarity: 'unique', icon: '🎗️',
    mods: { lifeFlat: 50, resAll: 15, fhr: 0.20, vit: 12 }, reqLevel: 16, flavor: 'Engole golpes no escuro entre os blocos.' },
  { id: 'wither_carapace', name: 'Carapaça do Wither', baseId: 'plate_mail', rarity: 'unique', icon: '🛡️',
    mods: { defenseFlat: 200, vit: 25, resAll: 20, lifeFlat: 60 }, reqLevel: 28, flavor: 'Ossos de três crânios fundidos.' },
  { id: 'chaos_scepter', name: 'Cetro do Caos', baseId: 'rune_staff', rarity: 'unique', icon: '🪄',
    mods: { allSkills: 2, fcr: 0.30, flatFire: 30, manaFlat: 80 }, reqLevel: 24, flavor: 'Cada conjuração reescreve a realidade cúbica.' },
];

// JOIAS ÚNICAS — Facetas Arco-Íris (Rainbow Facet): encravam em qualquer soquete,
// dão dano + resistência do elemento e +1% ao máx. de todas as resistências.
export const UNIQUE_JEWELS = [
  { id: 'facet_fire', name: 'Faceta Arco-Íris (Fogo)', icon: '🔥', reqLevel: 30,
    mods: { flatFire: 22, resFire: 15, maxResAll: 1 }, flavor: 'Um prisma que arde por dentro.' },
  { id: 'facet_cold', name: 'Faceta Arco-Íris (Gelo)', icon: '❄️', reqLevel: 30,
    mods: { flatCold: 16, resCold: 15, maxResAll: 1 }, flavor: 'Frio absoluto preso em vidro.' },
  { id: 'facet_light', name: 'Faceta Arco-Íris (Raio)', icon: '⚡', reqLevel: 30,
    mods: { flatLight: 28, resLight: 15, maxResAll: 1 }, flavor: 'Uma tempestade em miniatura.' },
];

// Conjuntos (set) — caem como peças que dão bônus parciais (simplificado).
export const SETS = [
  { id: 'miners_set_helm', name: 'Capacete do Minerador', baseId: 'iron_helm', rarity: 'set', setName: 'Traje do Minerador', icon: '⛑️',
    mods: { defenseFlat: 30, str: 10, magicFind: 15 }, reqLevel: 12, flavor: 'Conjunto do Minerador (1/2)' },
  { id: 'miners_set_body', name: 'Macacão do Minerador', baseId: 'chain_mail', rarity: 'set', setName: 'Traje do Minerador', icon: '🥼',
    mods: { defenseFlat: 60, vit: 15, lifeFlat: 40 }, reqLevel: 14, flavor: 'Conjunto do Minerador (2/2): +25 todas resist. com o set completo.' },
  { id: 'wolf_gloves', name: 'Garras do Lobo', baseId: 'leather_gloves', rarity: 'set', setName: 'Pele do Lobo', icon: '🧤',
    mods: { attackSpeed: 0.10, dex: 8 }, reqLevel: 6, flavor: 'Conjunto Pele do Lobo (1/2)' },
  { id: 'wolf_boots', name: 'Patas do Lobo', baseId: 'leather_boots', rarity: 'set', setName: 'Pele do Lobo', icon: '🥾',
    mods: { moveSpeedPct: 0.15, dex: 8 }, reqLevel: 6, flavor: 'Conjunto Pele do Lobo (2/2): +vel. ataque/mov. e destreza com o set.' },
  // Conjunto de 3 peças (arma + elmo + luvas), bônus parciais 2/3 e completo 3/3.
  { id: 'skele_bow', name: 'Arco do Esqueleto', baseId: 'short_bow', rarity: 'set', setName: 'Arsenal do Esqueleto', icon: '🏹',
    mods: { flatCold: 10, dex: 10 }, reqLevel: 8, flavor: 'Arsenal do Esqueleto (peça).' },
  { id: 'skele_cap', name: 'Crânio do Esqueleto', baseId: 'leather_cap', rarity: 'set', setName: 'Arsenal do Esqueleto', icon: '💀',
    mods: { defenseFlat: 20, dex: 8 }, reqLevel: 8, flavor: 'Arsenal do Esqueleto (peça).' },
  { id: 'skele_gloves', name: 'Falanges do Esqueleto', baseId: 'leather_gloves', rarity: 'set', setName: 'Arsenal do Esqueleto', icon: '🦴',
    mods: { attackSpeed: 0.10, dex: 8 }, reqLevel: 8, flavor: 'Arsenal do Esqueleto (peça): 2 peças e o set completo (3) dão bônus crescentes.' },
];

export const ALL_SPECIALS = [...UNIQUES, ...SETS];
