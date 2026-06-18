// Árvores de skills por classe — estilo Diablo II:
// - tier define o nível mínimo (tier 1 = lvl 1, tier 2 = lvl 6, tier 3 = lvl 12, tier 4 = lvl 18, tier 5 = lvl 24, tier 6 = lvl 30)
// - prereqs: precisa de >=1 ponto nas skills listadas
// - maxRank: 20 (como D2)
// - behavior é interpretado por systems/combat.js
//
// Cada skill expõe getStats(rank) -> { mana, damage, ... } e usa sinergias simples.

const TIER_LEVEL = { 1: 1, 2: 6, 3: 12, 4: 18, 5: 24, 6: 30 };

function S(def) {
  def.reqLevel = TIER_LEVEL[def.tier] || 1;
  def.maxRank = def.maxRank || 20;
  def.prereqs = def.prereqs || [];
  def.synergies = def.synergies || [];
  return def;
}

// fator de sinergia: soma de ranks em skills de sinergia * bônus
function synergyBonus(skill, charSkillRanks) {
  let bonus = 0;
  for (const syn of skill.synergies) {
    const r = charSkillRanks[syn.skill] || 0;
    bonus += r * syn.perRank;
  }
  return bonus;
}

export const SKILLS = {};

function reg(def) { SKILLS[def.id] = S(def); }

/* =====================  GUARDIÃO  ===================== */
// --- Auras de Combate ---
reg({ id: 'might', name: 'Vigor', icon: '💪', tree: 'combat_auras', classId: 'guardian', tier: 1, type: 'aura',
  desc: r => `Aura: +${20 + r * 12}% dano físico para você e aliados.`,
  getStats: r => ({ mana: 0, auraDamagePct: 0.20 + r * 0.12 }) });
reg({ id: 'holy_fire', name: 'Fogo Sagrado', icon: '🔥', tree: 'combat_auras', classId: 'guardian', tier: 2, type: 'aura',
  prereqs: ['might'],
  desc: r => `Aura: queima inimigos próximos por ${4 + r * 3} de fogo/s.`,
  getStats: r => ({ mana: 0, auraBurn: 4 + r * 3, radius: 5 }) });
reg({ id: 'fanaticism', name: 'Fanatismo', icon: '⚡', tree: 'combat_auras', classId: 'guardian', tier: 4, type: 'aura',
  prereqs: ['holy_fire'],
  desc: r => `Aura: +${15 + r * 7}% vel. de ataque e +${20 + r * 9}% dano.`,
  getStats: r => ({ mana: 0, auraAS: 0.15 + r * 0.07, auraDamagePct: 0.20 + r * 0.09 }) });
reg({ id: 'conviction', name: 'Convicção', icon: '☄️', tree: 'combat_auras', classId: 'guardian', tier: 6, type: 'aura',
  prereqs: ['fanaticism'],
  desc: r => `Aura: reduz a resistência dos inimigos próximos em ${25 + r * 3}%.`,
  getStats: r => ({ mana: 0, auraResShred: 0.25 + r * 0.03, radius: 6 }) });

// --- Combate Sagrado (ativas melee) ---
reg({ id: 'smite', name: 'Golpe de Escudo', icon: '🔨', tree: 'holy_combat', classId: 'guardian', tier: 1, type: 'attack',
  behavior: 'melee', range: 2.2, knockback: 1.5,
  desc: r => `Golpeia com o escudo: ${8 + r * 6} de dano e atordoa.`,
  getStats: (r, ranks) => ({ mana: 2, damage: (8 + r * 6) * (1 + synergyBonus(SKILLS.smite, ranks)), stun: 0.6 }),
  synergies: [{ skill: 'holy_shield', perRank: 0.10 }] });
reg({ id: 'zeal', name: 'Zelo', icon: '⚔️', tree: 'holy_combat', classId: 'guardian', tier: 2, type: 'attack',
  prereqs: ['smite'], behavior: 'melee_multi', range: 2.4,
  desc: r => `Ataca até ${2 + Math.min(r, 4)} alvos próximos por ${10 + r * 5} cada.`,
  getStats: (r, ranks) => ({ mana: 2, damage: (10 + r * 5) * (1 + synergyBonus(SKILLS.zeal, ranks)), hits: 2 + Math.min(r, 4) }),
  synergies: [{ skill: 'might', perRank: 0.06 }] });
reg({ id: 'charge', name: 'Investida', icon: '🐎', tree: 'holy_combat', classId: 'guardian', tier: 3, type: 'attack',
  prereqs: ['zeal'], behavior: 'dash', range: 10, cooldown: 4,
  desc: r => `Avança até o alvo causando ${15 + r * 8} de dano.`,
  getStats: r => ({ mana: 5, damage: 15 + r * 8 }) });
reg({ id: 'blessed_hammer', name: 'Martelo Bento', icon: '🔱', tree: 'holy_combat', classId: 'guardian', tier: 4, type: 'projectile',
  prereqs: ['charge'], behavior: 'spiral', projectiles: 1, range: 12,
  desc: r => `Lança um martelo sagrado giratório: ${20 + r * 12} de dano mágico.`,
  getStats: (r, ranks) => ({ mana: 5 + r * 0.3, damage: (20 + r * 12) * (1 + synergyBonus(SKILLS.blessed_hammer, ranks)), element: 'magic' }),
  synergies: [{ skill: 'fanaticism', perRank: 0.08 }] });

// --- Auras Defensivas / buffs ---
reg({ id: 'prayer', name: 'Prece', icon: '✨', tree: 'defensive', classId: 'guardian', tier: 1, type: 'aura',
  desc: r => `Aura: regenera ${1 + r * 1.5} de vida/s.`,
  getStats: r => ({ mana: 0, auraRegen: 1 + r * 1.5 }) });
reg({ id: 'defiance', name: 'Resistência', icon: '🛡️', tree: 'defensive', classId: 'guardian', tier: 2, type: 'aura',
  prereqs: ['prayer'],
  desc: r => `Aura: +${30 + r * 15}% de defesa (reduz dano recebido).`,
  getStats: r => ({ mana: 0, auraDefense: 0.30 + r * 0.15 }) });
reg({ id: 'holy_shield', name: 'Escudo Sagrado', icon: '🟡', tree: 'defensive', classId: 'guardian', tier: 3, type: 'buff',
  prereqs: ['defiance'], cooldown: 1, duration: 30,
  desc: r => `Buff: +${20 + r * 6}% chance de bloqueio por 30s.`,
  getStats: r => ({ mana: 8, blockChance: 0.20 + r * 0.06 }) });
reg({ id: 'salvation', name: 'Salvação', icon: '🌟', tree: 'defensive', classId: 'guardian', tier: 5, type: 'aura',
  prereqs: ['holy_shield'],
  desc: r => `Aura: +${20 + r * 5}% a todas as resistências.`,
  getStats: r => ({ mana: 0, auraResAll: 0.20 + r * 0.05 }) });
reg({ id: 'holy_spirits', name: 'Espíritos Sagrados', icon: '👼', tree: 'defensive', classId: 'guardian', tier: 6, type: 'summon',
  prereqs: ['salvation'], behavior: 'summon', summonKind: 'spirit', cooldown: 2,
  desc: r => `Invoca ${1 + Math.min(2, Math.floor(r / 2))} espíritos guerreiros (${30 + r * 12} de dano) por 30s.`,
  getStats: r => ({ mana: 12, count: 1 + Math.min(2, Math.floor(r / 2)), damage: 30 + r * 12, life: 60 + r * 20, duration: 30, element: 'magic' }) });

reg({ id: 'vengeance', name: 'Vingança', icon: '⚜️', tree: 'holy_combat', classId: 'guardian', tier: 5, type: 'attack',
  prereqs: ['blessed_hammer'], behavior: 'melee', range: 2.4,
  desc: r => `Golpe sagrado que adiciona ${12 + r * 6} de dano de fogo, gelo e raio.`,
  getStats: (r, ranks) => ({ mana: 4, damage: (12 + r * 6) * (1 + synergyBonus(SKILLS.vengeance, ranks)), element: 'fire', extraElements: true }),
  synergies: [{ skill: 'zeal', perRank: 0.05 }] });

/* =====================  ARCANISTA  ===================== */
// --- Fogo ---
reg({ id: 'fire_bolt', name: 'Dardo de Fogo', icon: '🔥', tree: 'fire', classId: 'arcanist', tier: 1, type: 'projectile',
  behavior: 'bolt', projectiles: 1, range: 16, speed: 22,
  desc: r => `Dispara um dardo de fogo: ${6 + r * 4} de dano de fogo.`,
  getStats: (r, ranks) => ({ mana: 2.5, damage: (6 + r * 4) * (1 + synergyBonus(SKILLS.fire_bolt, ranks)), element: 'fire' }),
  synergies: [{ skill: 'fire_ball', perRank: 0.06 }, { skill: 'meteor', perRank: 0.06 }] });
reg({ id: 'fire_ball', name: 'Bola de Fogo', icon: '☄️', tree: 'fire', classId: 'arcanist', tier: 3, type: 'projectile',
  prereqs: ['fire_bolt'], behavior: 'bolt_aoe', projectiles: 1, range: 16, speed: 18, aoe: 3,
  desc: r => `Bola explosiva: ${12 + r * 7} de dano de fogo em área.`,
  getStats: (r, ranks) => ({ mana: 5, damage: (12 + r * 7) * (1 + synergyBonus(SKILLS.fire_ball, ranks)), element: 'fire', radius: 3 }),
  synergies: [{ skill: 'fire_bolt', perRank: 0.06 }, { skill: 'meteor', perRank: 0.06 }] });
reg({ id: 'meteor', name: 'Meteoro', icon: '🌠', tree: 'fire', classId: 'arcanist', tier: 5, type: 'aoe_ground',
  prereqs: ['fire_ball'], behavior: 'meteor', range: 16, aoe: 4, cooldown: 1.2, delay: 0.9,
  desc: r => `Conjura um meteoro: ${30 + r * 16} de dano + fogo no chão.`,
  getStats: (r, ranks) => ({ mana: 10, damage: (30 + r * 16) * (1 + synergyBonus(SKILLS.meteor, ranks)), element: 'fire', radius: 4 }),
  synergies: [{ skill: 'fire_ball', perRank: 0.05 }] });
reg({ id: 'fire_mastery', name: 'Maestria do Fogo', icon: '🔥', tree: 'fire', classId: 'arcanist', tier: 4, type: 'passive',
  prereqs: ['fire_ball'],
  desc: r => `Passiva: +${20 + r * 8}% de dano de fogo.`,
  getStats: r => ({ fireDmg: 0.20 + r * 0.08 }) });
reg({ id: 'hydra', name: 'Hidra', icon: '🐉', tree: 'fire', classId: 'arcanist', tier: 6, type: 'summon',
  prereqs: ['meteor'], behavior: 'summon', summonKind: 'hydra', cooldown: 2,
  desc: r => `Conjura ${1 + Math.min(2, Math.floor(r / 3))} torre(s) de fogo que disparam (${14 + r * 7}) por 20s.`,
  getStats: (r, ranks) => ({ mana: 14, count: 1 + Math.min(2, Math.floor(r / 3)), damage: (14 + r * 7) * (1 + synergyBonus(SKILLS.hydra, ranks)), life: 40, duration: 20, element: 'fire', ranged: true, stationary: true }),
  synergies: [{ skill: 'fire_ball', perRank: 0.04 }, { skill: 'meteor', perRank: 0.04 }] });

// --- Gelo ---
reg({ id: 'ice_bolt', name: 'Dardo de Gelo', icon: '❄️', tree: 'cold', classId: 'arcanist', tier: 1, type: 'projectile',
  behavior: 'bolt', projectiles: 1, range: 16, speed: 20,
  desc: r => `Dardo gelado: ${5 + r * 3.5} de dano de gelo e lentidão.`,
  getStats: (r, ranks) => ({ mana: 2.5, damage: (5 + r * 3.5) * (1 + synergyBonus(SKILLS.ice_bolt, ranks)), element: 'cold', slow: 0.4 }),
  synergies: [{ skill: 'glacial_spike', perRank: 0.06 }] });
reg({ id: 'frost_nova', name: 'Nova de Gelo', icon: '💠', tree: 'cold', classId: 'arcanist', tier: 2, type: 'nova',
  prereqs: ['ice_bolt'], behavior: 'nova', radius: 5, cooldown: 0.5,
  desc: r => `Explosão gelada em volta: ${8 + r * 4} de dano e congela.`,
  getStats: (r, ranks) => ({ mana: 6, damage: (8 + r * 4) * (1 + synergyBonus(SKILLS.frost_nova, ranks)), element: 'cold', slow: 0.6, radius: 5 }),
  synergies: [{ skill: 'ice_bolt', perRank: 0.05 }] });
reg({ id: 'cold_mastery', name: 'Maestria do Gelo', icon: '❄️', tree: 'cold', classId: 'arcanist', tier: 3, type: 'passive',
  prereqs: ['frost_nova'],
  desc: r => `Passiva: +${20 + r * 8}% de dano de gelo.`,
  getStats: r => ({ coldDmg: 0.20 + r * 0.08 }) });
reg({ id: 'glacial_spike', name: 'Lança Glacial', icon: '🧊', tree: 'cold', classId: 'arcanist', tier: 4, type: 'projectile',
  prereqs: ['frost_nova'], behavior: 'bolt_aoe', projectiles: 1, range: 15, speed: 16, aoe: 2.5,
  desc: r => `Projétil que congela em área: ${16 + r * 9} de dano de gelo.`,
  getStats: (r, ranks) => ({ mana: 8, damage: (16 + r * 9) * (1 + synergyBonus(SKILLS.glacial_spike, ranks)), element: 'cold', slow: 0.8, radius: 2.5 }),
  synergies: [{ skill: 'ice_bolt', perRank: 0.05 }] });

// --- Raio ---
reg({ id: 'charged_bolt', name: 'Dardos Elétricos', icon: '⚡', tree: 'lightning', classId: 'arcanist', tier: 1, type: 'projectile',
  behavior: 'bolt', projectiles: 3, range: 14, speed: 24, spread: 0.4,
  desc: r => `Dispara ${3 + Math.floor(r / 2)} dardos elétricos: ${3 + r * 2.5} cada.`,
  getStats: (r, ranks) => ({ mana: 3, damage: (3 + r * 2.5) * (1 + synergyBonus(SKILLS.charged_bolt, ranks)), element: 'lightning', count: 3 + Math.floor(r / 2) }),
  synergies: [{ skill: 'nova', perRank: 0.05 }] });
reg({ id: 'nova', name: 'Nova', icon: '🌀', tree: 'lightning', classId: 'arcanist', tier: 3, type: 'nova',
  prereqs: ['charged_bolt'], behavior: 'nova', radius: 6, cooldown: 0.4,
  desc: r => `Anel de raios: ${10 + r * 5} de dano elétrico em volta.`,
  getStats: (r, ranks) => ({ mana: 8, damage: (10 + r * 5) * (1 + synergyBonus(SKILLS.nova, ranks)), element: 'lightning', radius: 6 }),
  synergies: [{ skill: 'charged_bolt', perRank: 0.04 }, { skill: 'chain_lightning', perRank: 0.04 }] });
reg({ id: 'lightning_mastery', name: 'Maestria do Raio', icon: '⚡', tree: 'lightning', classId: 'arcanist', tier: 4, type: 'passive',
  prereqs: ['nova'],
  desc: r => `Passiva: +${20 + r * 8}% de dano elétrico.`,
  getStats: r => ({ lightDmg: 0.20 + r * 0.08 }) });
reg({ id: 'teleport', name: 'Teleporte', icon: '✨', tree: 'lightning', classId: 'arcanist', tier: 4, type: 'teleport',
  prereqs: ['charged_bolt'], behavior: 'teleport', range: 14, cooldown: 0.5,
  desc: r => `Teleporta instantaneamente para o cursor. Custo de mana cai com o rank.`,
  getStats: r => ({ mana: Math.max(6, 24 - r), range: 14 }) });
reg({ id: 'chain_lightning', name: 'Raio em Cadeia', icon: '🔗', tree: 'lightning', classId: 'arcanist', tier: 5, type: 'chain',
  prereqs: ['nova'], behavior: 'chain', range: 14, chains: 5,
  desc: r => `Raio que salta entre ${4 + Math.floor(r / 2)} inimigos: ${14 + r * 8} cada.`,
  getStats: (r, ranks) => ({ mana: 9, damage: (14 + r * 8) * (1 + synergyBonus(SKILLS.chain_lightning, ranks)), element: 'lightning', chains: 4 + Math.floor(r / 2) }),
  synergies: [{ skill: 'nova', perRank: 0.04 }] });

reg({ id: 'blizzard', name: 'Nevasca', icon: '🌨️', tree: 'cold', classId: 'arcanist', tier: 6, type: 'aoe_ground',
  prereqs: ['glacial_spike'], behavior: 'trap', range: 16, aoe: 4.5, duration: 5, cooldown: 1.5,
  desc: r => `Tempestade de gelo numa área: ${14 + r * 8} de dano de gelo por onda.`,
  getStats: (r, ranks) => ({ mana: 12, damage: (14 + r * 8) * (1 + synergyBonus(SKILLS.blizzard, ranks)), element: 'cold', radius: 4.5, slow: 0.5 }),
  synergies: [{ skill: 'glacial_spike', perRank: 0.05 }, { skill: 'ice_bolt', perRank: 0.04 }] });

/* =====================  CAÇADORA  ===================== */
// --- Arco ---
reg({ id: 'magic_arrow', name: 'Flecha Mágica', icon: '🏹', tree: 'bow', classId: 'hunter', tier: 1, type: 'projectile',
  behavior: 'arrow', projectiles: 1, range: 18, speed: 28,
  desc: r => `Flecha mágica: ${5 + r * 4} de dano (parte mágico).`,
  getStats: (r, ranks) => ({ mana: 1.5, damage: (5 + r * 4) * (1 + synergyBonus(SKILLS.magic_arrow, ranks)), element: 'physical' }),
  synergies: [{ skill: 'multi_shot', perRank: 0.05 }] });
reg({ id: 'cold_arrow', name: 'Flecha Gélida', icon: '🏹', tree: 'bow', classId: 'hunter', tier: 2, type: 'projectile',
  prereqs: ['magic_arrow'], behavior: 'arrow', projectiles: 1, range: 18, speed: 26,
  desc: r => `Flecha de gelo: ${7 + r * 4} de dano de gelo e lentidão.`,
  getStats: (r, ranks) => ({ mana: 3, damage: (7 + r * 4) * (1 + synergyBonus(SKILLS.cold_arrow, ranks)), element: 'cold', slow: 0.5 }),
  synergies: [{ skill: 'magic_arrow', perRank: 0.04 }] });
reg({ id: 'multi_shot', name: 'Tiro Múltiplo', icon: '🎯', tree: 'bow', classId: 'hunter', tier: 3, type: 'projectile',
  prereqs: ['cold_arrow'], behavior: 'arrow', projectiles: 5, range: 16, speed: 26, spread: 0.7,
  desc: r => `Dispara ${4 + Math.floor(r / 2)} flechas em leque: ${5 + r * 3} cada.`,
  getStats: (r, ranks) => ({ mana: 4, damage: (5 + r * 3) * (1 + synergyBonus(SKILLS.multi_shot, ranks)), element: 'physical', count: 4 + Math.floor(r / 2) }),
  synergies: [{ skill: 'magic_arrow', perRank: 0.04 }] });
reg({ id: 'freezing_arrow', name: 'Flecha Congelante', icon: '❄️', tree: 'bow', classId: 'hunter', tier: 4, type: 'projectile',
  prereqs: ['multi_shot'], behavior: 'bolt_aoe', projectiles: 1, range: 18, speed: 26, aoe: 3,
  desc: r => `Flecha que explode em gelo: ${12 + r * 7} de dano de gelo em área e congela.`,
  getStats: (r, ranks) => ({ mana: 5, damage: (12 + r * 7) * (1 + synergyBonus(SKILLS.freezing_arrow, ranks)), element: 'cold', radius: 3, slow: 0.7 }),
  synergies: [{ skill: 'cold_arrow', perRank: 0.05 }] });
reg({ id: 'strafe', name: 'Saraivada', icon: '💥', tree: 'bow', classId: 'hunter', tier: 5, type: 'projectile',
  prereqs: ['multi_shot'], behavior: 'arrow_seek', projectiles: 6, range: 16, speed: 30,
  desc: r => `Dispara ${5 + Math.floor(r / 2)} flechas teleguiadas: ${8 + r * 5} cada.`,
  getStats: (r, ranks) => ({ mana: 5, damage: (8 + r * 5) * (1 + synergyBonus(SKILLS.strafe, ranks)), element: 'physical', count: 5 + Math.floor(r / 2) }),
  synergies: [{ skill: 'multi_shot', perRank: 0.04 }] });

// --- Armadilhas ---
reg({ id: 'fire_trap', name: 'Armadilha Flamejante', icon: '🪤', tree: 'traps', classId: 'hunter', tier: 1, type: 'aoe_ground',
  behavior: 'trap', range: 12, aoe: 3, duration: 8,
  desc: r => `Planta uma armadilha que explode: ${8 + r * 5} de fogo em área.`,
  getStats: (r, ranks) => ({ mana: 4, damage: (8 + r * 5) * (1 + synergyBonus(SKILLS.fire_trap, ranks)), element: 'fire', radius: 3 }),
  synergies: [{ skill: 'lightning_sentry', perRank: 0.04 }] });
reg({ id: 'lightning_sentry', name: 'Sentinela Elétrica', icon: '🗼', tree: 'traps', classId: 'hunter', tier: 3, type: 'aoe_ground',
  prereqs: ['fire_trap'], behavior: 'sentry', range: 12, duration: 12,
  desc: r => `Torre que dispara raios: ${10 + r * 6} de dano elétrico.`,
  getStats: (r, ranks) => ({ mana: 6, damage: (10 + r * 6) * (1 + synergyBonus(SKILLS.lightning_sentry, ranks)), element: 'lightning' }),
  synergies: [{ skill: 'fire_trap', perRank: 0.04 }] });
reg({ id: 'valkyrie', name: 'Valquíria', icon: '🛡️', tree: 'traps', classId: 'hunter', tier: 5, type: 'summon',
  prereqs: ['lightning_sentry'], behavior: 'summon', summonKind: 'valkyrie', cooldown: 3,
  desc: r => `Invoca uma Valquíria guerreira (${40 + r * 16} de dano, ${120 + r * 30} de vida) por 40s.`,
  getStats: r => ({ mana: 16, count: 1, damage: 40 + r * 16, life: 120 + r * 30, duration: 40, element: 'physical' }) });

// --- Agilidade (passivas) ---
reg({ id: 'critical_strike', name: 'Golpe Crítico', icon: '🎲', tree: 'agility', classId: 'hunter', tier: 1, type: 'passive',
  desc: r => `Passiva: +${5 + r * 3}% de chance de dano dobrado.`,
  getStats: r => ({ critChance: 0.05 + r * 0.03 }) });
reg({ id: 'dodge', name: 'Esquiva', icon: '🌫️', tree: 'agility', classId: 'hunter', tier: 2, type: 'passive',
  prereqs: ['critical_strike'],
  desc: r => `Passiva: +${8 + r * 2}% de chance de evitar dano.`,
  getStats: r => ({ dodgeChance: 0.08 + r * 0.02 }) });
reg({ id: 'penetrate', name: 'Perfuração', icon: '➹', tree: 'agility', classId: 'hunter', tier: 3, type: 'passive',
  prereqs: ['dodge'],
  desc: r => `Passiva: +${15 + r * 8}% de dano físico.`,
  getStats: r => ({ physDamagePct: 0.15 + r * 0.08 }) });
reg({ id: 'speed', name: 'Pés Rápidos', icon: '👟', tree: 'agility', classId: 'hunter', tier: 4, type: 'passive',
  prereqs: ['penetrate'],
  desc: r => `Passiva: +${8 + r * 2}% velocidade de movimento.`,
  getStats: r => ({ moveSpeedPct: 0.08 + r * 0.02 }) });

// Helpers
export function skillsForClass(classId) {
  return Object.values(SKILLS).filter(s => s.classId === classId);
}
export function skillsForTree(treeId) {
  return Object.values(SKILLS).filter(s => s.tree === treeId);
}
