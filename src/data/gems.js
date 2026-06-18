// Gemas, Runas e Runewords estilo Diablo II.
// - Gemas: 7 tipos x 5 qualidades. Os mods variam se o soquete está em ARMA ou em ARMADURA/ELMO.
// - Runas: dão mods por categoria do item; em sequência exata formam RUNEWORDS.

export const GEM_QUALITIES = ['chipped', 'flawed', 'normal', 'flawless', 'perfect'];
const QUALITY_NAME = { chipped: 'Lascada', flawed: 'Imperfeita', normal: '', flawless: 'Refinada', perfect: 'Perfeita' };

// tipo base: nome, ícone, e função de mods(tier 1..5, alvo 'weapon'|'armor')
const GEM_BASES = [
  { id: 'ruby', name: 'Rubi', icon: '🔴', weapon: t => ({ flatFire: 3 + t * 4 }), armor: t => ({ lifeFlat: 5 + t * 5 }) },
  { id: 'sapphire', name: 'Safira', icon: '🔵', weapon: t => ({ flatCold: 2 + t * 3 }), armor: t => ({ manaFlat: 5 + t * 4 }) },
  { id: 'topaz', name: 'Topázio', icon: '🟡', weapon: t => ({ flatLight: 1 + t * 6 }), armor: t => ({ resLight: 5 + t * 6 }) },
  { id: 'emerald', name: 'Esmeralda', icon: '🟢', weapon: t => ({ flatFire: 2 + t * 2, physDamagePct: 0.02 * t }), armor: t => ({ dex: 2 + t * 2 }) },
  { id: 'diamond', name: 'Diamante', icon: '💎', weapon: t => ({ attackRating: 10 + t * 18 }), armor: t => ({ resAll: 2 + t * 3 }) },
  { id: 'skull', name: 'Crânio', icon: '💀', weapon: t => ({ lifeLeech: 1 + t }), armor: t => ({ lifeFlat: 2 + t * 2, manaFlat: 2 + t * 2 }) },
  { id: 'amethyst', name: 'Ametista', icon: '🟣', weapon: t => ({ attackRating: 8 + t * 10 }), armor: t => ({ str: 2 + t * 2 }) },
];

// Constrói o dicionário de todas as gemas: id ex. "ruby_perfect"
export const GEMS = {};
for (const base of GEM_BASES) {
  GEM_QUALITIES.forEach((q, i) => {
    const tier = i + 1;
    const id = `${base.id}_${q}`;
    GEMS[id] = {
      id, kind: 'gem', gemBase: base.id, quality: q, tier, icon: base.icon,
      name: `${base.name}${QUALITY_NAME[q] ? ' ' + QUALITY_NAME[q] : ''}`,
      modsFor: (target) => (target === 'weapon' ? base.weapon(tier) : base.armor(tier)),
      reqLevel: tier * 4,
    };
  });
}

// Runas (subconjunto). modsFor(target) onde target: 'weapon'|'armor'|'helm'|'shield'
function R(id, name, tier, weapon, armor) {
  return { id, kind: 'rune', name: `Runa ${name}`, runeName: name, icon: '🔣', tier, reqLevel: tier * 3,
    modsFor: (target) => (target === 'weapon' ? weapon : armor) };
}
export const RUNES = {
  el: R('el', 'El', 1, { attackRating: 50, flatLight: 1 }, { defenseFlat: 15, lifeFlat: 0 }),
  eld: R('eld', 'Eld', 2, { physDamagePct: 0.05 }, { manaFlat: 3 }),
  tir: R('tir', 'Tir', 3, { manaFlat: 6 }, { manaFlat: 6 }),
  nef: R('nef', 'Nef', 4, { physDamagePct: 0.08 }, { defenseFlat: 30 }),
  eth: R('eth', 'Eth', 5, { attackRating: 40 }, { manaFlat: 8 }),
  ith: R('ith', 'Ith', 6, { physDamagePct: 0.12 }, { manaFlat: 10 }),
  tal: R('tal', 'Tal', 7, { flatFire: 8 }, { resPoison: 30 }),
  ral: R('ral', 'Ral', 8, { flatFire: 10 }, { resFire: 30 }),
  ort: R('ort', 'Ort', 9, { flatLight: 12 }, { resLight: 30 }),
  thul: R('thul', 'Thul', 10, { flatCold: 8 }, { resCold: 30 }),
  amn: R('amn', 'Amn', 11, { lifeLeech: 5 }, { lifeFlat: 14 }),
  sol: R('sol', 'Sol', 12, { physDamagePct: 0.18 }, { defenseFlat: 50 }),
  shael: R('shael', 'Shael', 13, { attackSpeed: 0.20 }, { moveSpeedPct: 0.05 }),
  dol: R('dol', 'Dol', 14, { physDamagePct: 0.20 }, { lifeFlat: 20 }),
  hel: R('hel', 'Hel', 15, { attackSpeed: 0.10 }, { str: 0 }),
  io: R('io', 'Io', 16, { vit: 10 }, { vit: 10 }),
  lum: R('lum', 'Lum', 17, { ene: 10 }, { ene: 10 }),
};

// Runewords: sequência exata de runas, categoria do item alvo, e mods do conjunto.
// targets: 'weapon' | 'body' | 'helm' | 'shield' (slot do item)
export const RUNEWORDS = [
  { id: 'steel', name: 'Steel', runes: ['tir', 'el'], sockets: 2, targets: ['weapon'],
    mods: { attackSpeed: 0.25, physDamagePct: 0.20, attackRating: 50, lifeLeech: 3 } },
  { id: 'stealth', name: 'Stealth', runes: ['tal', 'eth'], sockets: 2, targets: ['body'],
    mods: { fcr: 0.25, moveSpeedPct: 0.25, dex: 6, resPoison: 30 } },
  { id: 'lore', name: 'Lore', runes: ['ort', 'sol'], sockets: 2, targets: ['helm'],
    mods: { allSkills: 1, resLight: 30, ene: 5 } },
  { id: 'ancients_pledge', name: "Ancient's Pledge", runes: ['ral', 'ort', 'tal'], sockets: 3, targets: ['shield'],
    mods: { resAll: 43, defenseFlat: 50 } },
  { id: 'spirit', name: 'Spirit', runes: ['tal', 'thul', 'ort', 'amn'], sockets: 4, targets: ['weapon', 'shield'],
    mods: { allSkills: 2, fcr: 0.35, vit: 22, manaFlat: 100, resCold: 30 } },
  { id: 'insight', name: 'Insight', runes: ['ral', 'tir', 'tal', 'sol'], sockets: 4, targets: ['weapon'],
    mods: { allSkills: 1, physDamagePct: 0.35, manaFlat: 60, attackRating: 180 } },
  { id: 'leaf', name: 'Leaf', runes: ['tir', 'ral'], sockets: 2, targets: ['weapon'],
    mods: { allSkills: 1, flatFire: 30, manaFlat: 20 } },
  { id: 'malice', name: 'Malice', runes: ['ith', 'el', 'eth'], sockets: 3, targets: ['weapon'],
    mods: { openWounds: 0.30, physDamagePct: 0.30, attackRating: 60, crushingBlow: 0.10 } },
  { id: 'smoke', name: 'Smoke', runes: ['nef', 'lum'], sockets: 2, targets: ['body'],
    mods: { resAll: 50, defenseFlat: 75, fhr: 0.20 } },
  { id: 'zephyr', name: 'Zephyr', runes: ['ort', 'eth'], sockets: 2, targets: ['weapon'],
    mods: { attackSpeed: 0.25, moveSpeedPct: 0.25, attackRating: 66, flatLight: 8 } },
  { id: 'rhyme', name: 'Rhyme', runes: ['shael', 'eth'], sockets: 2, targets: ['shield'],
    mods: { resAll: 25, magicFind: 25, fhr: 0.20, cannotFreeze: 1 } },
  { id: 'black', name: 'Black', runes: ['thul', 'io', 'nef'], sockets: 3, targets: ['weapon'],
    mods: { physDamagePct: 1.20, attackSpeed: 0.15, crushingBlow: 0.40, lifeFlat: 15 } },
  { id: 'wealth', name: 'Wealth', runes: ['dol', 'io', 'nef'], sockets: 3, targets: ['body'],
    mods: { magicFind: 100, dex: 10, defenseFlat: 30 } },
  { id: 'hoto', name: 'Heart of the Oak', runes: ['dol', 'ort', 'amn', 'lum'], sockets: 4, targets: ['weapon'],
    mods: { allSkills: 3, fcr: 0.40, resAll: 40, vit: 10, manaFlat: 100 } },
];

export function gemList() { return Object.values(GEMS); }
export function runeList() { return Object.values(RUNES); }
export function isGem(id) { return !!GEMS[id]; }
export function isRune(id) { return !!RUNES[id]; }
export function getInsertable(id) { return GEMS[id] || RUNES[id] || null; }
