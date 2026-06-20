// Cubo Horadric estilo Diablo II: receitas de transmutação.
import { GEMS, RUNES, GEM_QUALITIES, getInsertable } from '../data/gems.js';
import { canHaveSockets, maxSocketsForItem } from './sockets.js';
import { generateItem, nextItemId } from './loot.js';

function makeSocketableItem(defId) {
  const def = getInsertable(defId);
  return { id: nextItemId(), name: def.name, icon: def.icon, rarity: 'normal', identified: true, kind: def.kind, socketableId: def.id, slot: def.kind, reqLevel: def.reqLevel || 1, mods: {} };
}

// Funde vários charms num único: soma os atributos iguais e adiciona os demais.
function fuseCharms(charms) {
  const mods = {};
  let reqLevel = 1;
  for (const c of charms) {
    for (const [k, v] of Object.entries(c.mods || {})) mods[k] = (mods[k] || 0) + v;
    reqLevel = Math.max(reqLevel, c.reqLevel || 1);
  }
  for (const k in mods) mods[k] = Math.round(mods[k] * 100) / 100; // evita lixo de ponto flutuante
  return {
    id: nextItemId(), name: 'Talismã Condensado', rarity: 'rare', slot: 'charm', kind: 'charm',
    baseId: 'charm_grand', icon: '🟥', reqLevel, ilvl: reqLevel, mods, affixes: [], identified: true,
    charmSize: 3, condensed: true,
  };
}

// Tipos de "craft" estilo Diablo II, mapeados pela GEMA usada. Mods GARANTIDOS escalam por
// tier da gema (g) e da runa (r). O item ainda ganha afixos raros aleatórios por cima.
const CRAFT_TYPES = {
  ruby:     { name: 'Sangue',     mods: (g, r) => ({ lifeFlat: 10 + g * 5 + r, lifeLeech: 2 + Math.floor(g / 2) }) },
  amethyst: { name: 'Conjurador', mods: (g, r) => ({ fcr: 0.05 + g * 0.02, manaFlat: 12 + g * 5 + r }) },
  sapphire: { name: 'Impacto',    mods: (g, r) => ({ lifeFlat: 8 + g * 3, attackRating: 25 + g * 12 + r * 3 }) },
  emerald:  { name: 'Segurança',  mods: (g, r) => ({ defenseFlat: 15 + g * 9 + r * 2, resAll: 3 + g * 2, fhr: 0.05 + g * 0.02 }) },
  topaz:    { name: 'Tempestade', mods: (g, r) => ({ flatLight: 4 + g * 3, resLight: 6 + g * 5, magicFind: 5 + g * 3 }) },
  diamond:  { name: 'Sagrado',    mods: (g, r) => ({ resAll: 4 + g * 3, attackRating: 25 + g * 12 }) },
  skull:    { name: 'Espírito',   mods: (g, r) => ({ manaPerKill: 1 + Math.floor(g / 2), lifePerKill: 1 + Math.floor(g / 2) }) },
};

// Item CRAVEJADO (Crafted) estilo D2: usa a BASE escolhida (slot/kind/baseStats), aplica os mods
// garantidos do tipo de craft (pela gema) + afixos raros aleatórios (via generateItem). A joia é reagente.
function craftItem(base, runeDef, gemDef, rng) {
  const craft = CRAFT_TYPES[gemDef.gemBase] || CRAFT_TYPES.diamond;
  const ilvl = Math.min(85, (base.reqLevel || 10) + runeDef.tier * 2 + gemDef.tier * 2);
  const roll = generateItem(ilvl, 'rare', rng, { slot: base.slot }); // só p/ colher afixos raros do slot
  const mods = { ...roll.mods };
  for (const [k, v] of Object.entries(craft.mods(gemDef.tier, runeDef.tier))) {
    mods[k] = Math.round(((mods[k] || 0) + v) * 100) / 100;
  }
  const it = {
    id: nextItemId(), name: `${base.name} Cravejado (${craft.name})`,
    rarity: 'rare', crafted: true, craftType: craft.name,
    baseId: base.baseId, slot: base.slot, kind: base.kind, icon: base.icon,
    baseStats: { ...(base.baseStats || {}) },
    mods, affixes: roll.affixes || [],
    reqLevel: Math.max(base.reqLevel || 1, roll.reqLevel || 1),
    ilvl, identified: true,
    reqStr: base.reqStr || 0, reqDex: base.reqDex || 0,
    flavor: `Cravejado: ${craft.name}`,
  };
  if (base.durability) it.durability = { cur: base.durability.max, max: base.durability.max };
  return it;
}

const RUNE_BY_TIER = Object.values(RUNES).sort((a, b) => a.tier - b.tier);
function nextRuneId(runeId) {
  const cur = RUNES[runeId];
  const nx = RUNE_BY_TIER.find(r => r.tier === cur.tier + 1);
  return nx ? nx.id : null;
}
function nextGemId(gemId) {
  const g = GEMS[gemId];
  const idx = GEM_QUALITIES.indexOf(g.quality);
  if (idx >= GEM_QUALITIES.length - 1) return null;
  return `${g.gemBase}_${GEM_QUALITIES[idx + 1]}`;
}

// Lista de receitas (texto exibido na UI).
export const CUBE_RECIPES = [
  '3 gemas iguais → 1 gema de qualidade superior',
  '3 runas iguais → 1 runa superior',
  '3 gemas quaisquer + 1 item sem soquete → adiciona soquetes',
  '1 item raro + 1 gema → re-rola o item raro',
  '1 item mágico + 1 gema → re-rola o item mágico',
  '1 base + 1 runa + 1 gema + 1 joia → item CRAVEJADO (mods garantidos pela gema + afixos)',
  'runa Hel + 1 item encravado → esvazia os soquetes',
  '(opcional) só charms → funde todos num único Talismã (soma os mods)',
];

// Tenta transmutar o conteúdo do cubo. Retorna { ok, message, result } (result = novo conteúdo).
// opts.condenseCharms liga a receita de fundir charms (charms-only → 1 só).
export function transmute(items, rng, opts = {}) {
  const gems = items.filter(i => i.kind === 'gem');
  const runes = items.filter(i => i.kind === 'rune');
  const jewels = items.filter(i => i.slot === 'jewel');
  const gear = items.filter(i => i.slot && !['gem', 'rune', 'charm', 'jewel'].includes(i.slot));

  // SÓ charms (2+) -> funde todos num único Talismã, somando os mods (se a feature estiver ligada)
  if (opts.condenseCharms && items.length >= 2 && items.every(i => i.slot === 'charm')) {
    return { ok: true, message: `${items.length} charms condensados num só Talismã!`, result: [fuseCharms(items)] };
  }

  // 3 gemas iguais -> próxima qualidade
  if (items.length === 3 && gems.length === 3) {
    const id = gems[0].socketableId;
    if (gems.every(g => g.socketableId === id)) {
      const nid = nextGemId(id);
      if (!nid) return { ok: false, message: 'Gema já está na qualidade máxima.' };
      return { ok: true, message: `Transmutado em ${GEMS[nid].name}!`, result: [makeSocketableItem(nid)] };
    }
  }
  // 3 runas iguais -> próxima runa
  if (items.length === 3 && runes.length === 3) {
    const id = runes[0].socketableId;
    if (runes.every(r => r.socketableId === id)) {
      const nid = nextRuneId(id);
      if (!nid) return { ok: false, message: 'Runa já é a mais alta.' };
      return { ok: true, message: `Transmutado em ${RUNES[nid].name}!`, result: [makeSocketableItem(nid)] };
    }
  }
  // 3 gemas + 1 item sem soquete -> adiciona soquetes
  if (items.length === 4 && gems.length === 3 && gear.length === 1) {
    const it = gear[0];
    if (!canHaveSockets(it)) return { ok: false, message: 'Este item não aceita soquetes.' };
    if (it.sockets) return { ok: false, message: 'O item já tem soquetes.' };
    it.sockets = rng.int(1, Math.min(maxSocketsForItem(it), 3));
    it.socketed = [];
    return { ok: true, message: `${it.sockets} soquete(s) adicionado(s) a ${it.name}!`, result: [it] };
  }
  // CRAVEJADO (Crafted): 1 base + 1 runa + 1 gema + 1 joia -> raro com mods garantidos (por gema) + afixos
  if (items.length === 4 && gear.length === 1 && runes.length === 1 && gems.length === 1 && jewels.length === 1) {
    const gemDef = GEMS[gems[0].socketableId];
    const runeDef = RUNES[runes[0].socketableId];
    if (!gemDef || !runeDef) return { ok: false, message: 'Gema ou runa inválida para cravejar.' };
    const crafted = craftItem(gear[0], runeDef, gemDef, rng);
    return { ok: true, message: `${crafted.name} forjado!`, result: [crafted] };
  }
  // 1 item raro + 1 gema -> re-rola raro
  if (items.length === 2 && gear.length === 1 && gems.length === 1 && gear[0].rarity === 'rare') {
    const old = gear[0];
    const rerolled = generateItem(old.ilvl || old.reqLevel || 20, 'rare', rng, { slot: old.slot });
    return { ok: true, message: `${old.name} re-rolado!`, result: [rerolled] };
  }
  // 1 item mágico + 1 gema -> re-rola mágico
  if (items.length === 2 && gear.length === 1 && gems.length === 1 && gear[0].rarity === 'magic') {
    const old = gear[0];
    const rerolled = generateItem(old.ilvl || old.reqLevel || 15, 'magic', rng, { slot: old.slot });
    return { ok: true, message: `${old.name} re-rolado (mágico)!`, result: [rerolled] };
  }
  // runa Hel + 1 item encravado -> esvazia os soquetes (gemas/runas destruídas)
  if (items.length === 2 && runes.length === 1 && runes[0].socketableId === 'hel' && gear.length === 1) {
    const it = gear[0];
    if (!it.sockets || !(it.socketed && it.socketed.length)) return { ok: false, message: 'O item não tem nada encravado.' };
    it.socketed = [];
    return { ok: true, message: `Soquetes de ${it.name} esvaziados!`, result: [it] };
  }

  return { ok: false, message: 'Nenhuma receita corresponde a esses itens.' };
}
