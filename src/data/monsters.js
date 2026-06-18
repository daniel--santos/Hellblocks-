// Monstros estilo Diablo II — mobs do Minecraft tematizados.
// Ranks: normal, champion (mais vida/dano), unique (com afixos), boss (ato).
// Vida/dano escalam por nível de área e dificuldade (ver systems/difficulty.js).

export const MONSTER_RANKS = {
  normal: { id: 'normal', lifeMul: 1, dmgMul: 1, xpMul: 1, scale: 1, color: null, dropMul: 1 },
  champion: { id: 'champion', lifeMul: 3, dmgMul: 1.6, xpMul: 3, scale: 1.25, color: 0xffcc44, dropMul: 2 },
  unique: { id: 'unique', lifeMul: 6, dmgMul: 2.2, xpMul: 8, scale: 1.45, color: 0xff5544, dropMul: 4 },
  boss: { id: 'boss', lifeMul: 11, dmgMul: 2.8, xpMul: 40, scale: 2.6, color: 0xaa00ff, dropMul: 10 },
};

// Afixos de monstros raros/únicos (como D2)
export const MONSTER_AFFIXES = [
  { id: 'fast', name: 'Veloz', apply: m => { m.moveSpeed *= 1.5; m.attackSpeed *= 1.4; } },
  { id: 'fire_enchant', name: 'Encantado-Fogo', apply: m => { m.element = 'fire'; m.damage *= 1.3; } },
  { id: 'cold_enchant', name: 'Encantado-Gelo', apply: m => { m.element = 'cold'; m.applySlow = true; } },
  { id: 'lightning_enchant', name: 'Encantado-Raio', apply: m => { m.element = 'lightning'; m.damage *= 1.25; } },
  { id: 'spectral_hit', name: 'Golpe Espectral', apply: m => { m.damage *= 1.4; } },
  { id: 'extra_strong', name: 'Forte', apply: m => { m.damage *= 1.6; } },
  { id: 'extra_fast', name: 'Frenético', apply: m => { m.moveSpeed *= 1.6; } },
  { id: 'stone_skin', name: 'Pele de Pedra', apply: m => { m.maxLife *= 2; m.life = m.maxLife; } },
];

// Tipos base de monstro. base = stats em nível 1; escalam por área.
export const MONSTER_TYPES = {
  zombie: { id: 'zombie', name: 'Zumbi', icon: '🧟', color: 0x4a7a4a, baseLife: 14, baseDamage: 3, moveSpeed: 1.6, attackSpeed: 1, range: 1.6, ai: 'melee', res: {} },
  skeleton: { id: 'skeleton', name: 'Esqueleto', icon: '💀', color: 0xdedede, baseLife: 10, baseDamage: 4, moveSpeed: 2.2, attackSpeed: 1.2, range: 1.6, ai: 'melee', res: { cold: 0.5 } },
  spider: { id: 'spider', name: 'Aranha das Cavernas', icon: '🕷️', color: 0x222222, baseLife: 8, baseDamage: 3, moveSpeed: 3, attackSpeed: 1.5, range: 1.4, ai: 'melee', res: { poison: 1 }, shape: 'spider' },
  creeper: { id: 'creeper', name: 'Creeper', icon: '🟩', color: 0x4caf50, baseLife: 12, baseDamage: 10, moveSpeed: 2.4, attackSpeed: 1, range: 1.8, ai: 'exploder', res: {}, shape: 'creeper' },
  skeleton_archer: { id: 'skeleton_archer', name: 'Arqueiro Esqueleto', icon: '🏹', color: 0xcccccc, baseLife: 9, baseDamage: 5, moveSpeed: 1.8, attackSpeed: 1, range: 12, ai: 'ranged', res: {} },
  husk: { id: 'husk', name: 'Husk do Deserto', icon: '🟫', color: 0xc9a86a, baseLife: 20, baseDamage: 5, moveSpeed: 1.8, attackSpeed: 0.9, range: 1.6, ai: 'melee', res: { fire: 0.5 } },
  blaze: { id: 'blaze', name: 'Blaze', icon: '🔥', color: 0xffaa00, baseLife: 16, baseDamage: 7, moveSpeed: 2, attackSpeed: 1.1, range: 10, ai: 'ranged', element: 'fire', res: { fire: 1 }, shape: 'blaze' },
  stray: { id: 'stray', name: 'Esqueleto Gélido', icon: '🥶', color: 0x9fd8ff, baseLife: 14, baseDamage: 5, moveSpeed: 2, attackSpeed: 1, range: 11, ai: 'ranged', element: 'cold', res: { cold: 1 } },
  enderman: { id: 'enderman', name: 'Enderman', icon: '🟪', color: 0x1a0033, baseLife: 30, baseDamage: 12, moveSpeed: 2.6, attackSpeed: 1.2, range: 1.8, ai: 'teleporter', res: {} },
  pigman: { id: 'pigman', name: 'Zumbi Suíno', icon: '🐷', color: 0xd98080, baseLife: 22, baseDamage: 9, moveSpeed: 2, attackSpeed: 1.1, range: 1.6, ai: 'melee', res: { fire: 0.5 } },
  wither_skeleton: { id: 'wither_skeleton', name: 'Esqueleto Wither', icon: '☠️', color: 0x333333, baseLife: 26, baseDamage: 11, moveSpeed: 2.2, attackSpeed: 1.2, range: 1.8, ai: 'melee', res: { fire: 0.5, poison: 0.5 } },
  ghast: { id: 'ghast', name: 'Ghast', icon: '👻', color: 0xf0f0f0, baseLife: 24, baseDamage: 14, moveSpeed: 1.4, attackSpeed: 0.7, range: 14, ai: 'ranged', element: 'fire', res: {}, shape: 'ghast' },
  cow_hell: { id: 'cow_hell', name: 'Vaca Demoníaca', icon: '🐄', color: 0xffffff, baseLife: 18, baseDamage: 8, moveSpeed: 2.6, attackSpeed: 1.3, range: 1.8, ai: 'melee', res: {}, shape: 'cow' },
};

// Super Únicos (monstros nomeados na selva, com matilha) — como Bishibosh, Rakanishu no D2.
export const SUPER_UNIQUES = {
  1: [
    { name: 'Pedregulho, o Esmagador', typeId: 'zombie' },
    { name: 'Aracne Rainha', typeId: 'spider' },
    { name: 'Ossobranco', typeId: 'skeleton' },
  ],
  2: [
    { name: 'Sehk, a Chama', typeId: 'blaze' },
    { name: 'Múmia Maldita', typeId: 'husk' },
  ],
  3: [
    { name: 'Vazio Sussurrante', typeId: 'enderman' },
    { name: 'Gélido Antigo', typeId: 'stray' },
  ],
  4: [
    { name: 'Carrasco das Cinzas', typeId: 'wither_skeleton' },
    { name: 'Olho do Abismo', typeId: 'ghast' },
  ],
};

// Bosses dos 4 atos.
export const BOSSES = {
  rotjaw: {
    id: 'rotjaw', name: 'Mandíbula Pútrida', type: 'zombie', act: 1, icon: '🧟',
    color: 0x2a5a2a, baseLife: 30, baseDamage: 8, moveSpeed: 1.8, attackSpeed: 1, range: 2.2,
    ai: 'boss_melee', res: {}, abilities: ['summon_zombies', 'slam'],
    title: 'A Carniceira do Bioma das Sombras',
  },
  emberlord: {
    id: 'emberlord', name: 'Senhor das Brasas', type: 'blaze', act: 2, icon: '🔥',
    color: 0xff6600, baseLife: 30, baseDamage: 10, moveSpeed: 1.6, attackSpeed: 1, range: 12,
    ai: 'boss_ranged', element: 'fire', res: { fire: 1 }, abilities: ['fire_rain', 'flame_nova'],
    title: 'Tirano do Deserto Escaldante',
  },
  voidmother: {
    id: 'voidmother', name: 'Mãe do Vazio', type: 'enderman', act: 3, icon: '🟪',
    color: 0x4400aa, baseLife: 32, baseDamage: 13, moveSpeed: 2.6, attackSpeed: 1.2, range: 2,
    ai: 'boss_teleporter', res: { cold: 0.5 }, abilities: ['teleport_strike', 'summon_endermites'],
    title: 'Rainha do Pântano do Ender',
  },
  withergeist: {
    id: 'withergeist', name: 'Wither Ancião', type: 'wither_skeleton', act: 4, icon: '☠️',
    color: 0x111111, baseLife: 40, baseDamage: 16, moveSpeed: 2, attackSpeed: 1.2, range: 14,
    ai: 'boss_caster', element: 'fire', res: { fire: 0.75, cold: 0.5, lightning: 0.5 }, abilities: ['wither_skulls', 'meteor_storm', 'summon_minions'],
    title: 'Soberano das Terras Finais',
  },
  // Boss secreto do Cow Level
  cow_king: {
    id: 'cow_king', name: 'Rei das Vacas', type: 'cow_hell', act: 99, icon: '👑',
    color: 0xffdd55, baseLife: 28, baseDamage: 9, moveSpeed: 2.8, attackSpeed: 1.4, range: 2,
    ai: 'boss_melee', res: {}, abilities: ['stampede'],
    title: 'Monarca do Pasto Proibido',
  },
};
