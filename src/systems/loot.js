// Geração de loot estilo Diablo II: noDrop, rolagem de qualidade, afixos por ilvl,
// uniques/sets fixos, gold e poções. Magic Find aumenta itens azuis+.
import { RNG } from '../core/rng.js';
import { ITEM_BASES, AFFIXES, RARITY, UNIQUES, SETS, JEWEL_AFFIXES, UNIQUE_JEWELS } from '../data/items.js';
import { canHaveSockets, maxSocketsForItem, socketSummary, detectRuneword } from './sockets.js';
import { GEM_QUALITIES, runeList } from '../data/gems.js';

let _uid = 1;
export function nextItemId() { return 'it_' + (_uid++); }

const RARE_NAMES_A = ['Garra', 'Presságio', 'Maldição', 'Fúria', 'Sopro', 'Eco', 'Lâmina', 'Cinza', 'Lamento', 'Crânio'];
const RARE_NAMES_B = ['do Abismo', 'do Crepúsculo', 'da Fome', 'das Sombras', 'do Vazio', 'da Praga', 'do Trovão', 'do Gelo Eterno'];

// Rolagem de qualidade ponderada com Magic Find (% extra para itens azuis+).
function rollRarity(rng, magicFind, difficulty, forceSpecial) {
  if (forceSpecial && rng.chance(0.5)) return rng.chance(0.5) ? 'unique' : 'set';
  const mf = 1 + magicFind / 100;
  const dq = 1 + (difficulty?.dropQualityBonus || 0);
  const pool = [
    { id: 'unique', weight: RARITY.unique.weight * mf * dq },
    { id: 'set', weight: RARITY.set.weight * mf * dq },
    { id: 'rare', weight: RARITY.rare.weight * mf * dq },
    { id: 'magic', weight: RARITY.magic.weight * Math.sqrt(mf) },
    { id: 'normal', weight: RARITY.normal.weight },
  ];
  return rng.weighted(pool).id;
}

function pickAffixes(pool, count, ilvl, rng, slot) {
  const eligible = pool.filter(a => a.ilvl <= ilvl && (!a.slots || a.slots.includes(slot)));
  const chosen = [];
  const used = new Set();
  for (let i = 0; i < count && eligible.length > 0; i++) {
    let tries = 0, a;
    do { a = rng.pick(eligible); tries++; } while (used.has(a.stat) && tries < 8);
    if (used.has(a.stat)) continue;
    used.add(a.stat);
    const raw = rng.range(a.range[0], a.range[1]);
    const value = a.pct ? Math.round(raw * 100) / 100 : Math.round(raw);
    chosen.push({ name: a.name, stat: a.stat, value, pct: a.pct, proc: a.proc });
  }
  return chosen;
}

function rollBaseDef(base, rng) {
  const out = {};
  if (base.dmg) out.dmgMin = base.dmg[0], out.dmgMax = base.dmg[1];
  if (base.def) out.defense = rng.int(base.def[0], base.def[1]);
  return out;
}

// Constrói um item a partir de base + raridade.
export function generateItem(ilvl, rarity, rng, opts = {}) {
  // bases elegíveis pelo nível e (opcional) slot
  let bases = ITEM_BASES.filter(b => b.reqLevel <= ilvl + 2);
  if (opts.slot) bases = bases.filter(b => b.slot === opts.slot);
  if (bases.length === 0) bases = ITEM_BASES.filter(b => b.reqLevel <= ilvl + 2);
  const base = rng.pick(bases);

  if (rarity === 'unique' || rarity === 'set') {
    const pool = (rarity === 'unique' ? UNIQUES : SETS).filter(u => u.reqLevel <= ilvl + 4);
    if (pool.length > 0) {
      const sp = rng.pick(pool);
      const b = ITEM_BASES.find(x => x.id === sp.baseId) || base;
      const it = {
        id: nextItemId(), name: sp.name, rarity, baseId: b.id, slot: b.slot, kind: b.kind,
        icon: sp.icon || b.icon, reqLevel: sp.reqLevel, ilvl,
        baseStats: rollBaseDef(b, rng), mods: { ...sp.mods }, affixes: [],
        setName: sp.setName, flavor: sp.flavor, special: true, identified: false,
        reqStr: b.reqStr || 0, reqDex: b.reqDex || 0,
      };
      if (b.dur) it.durability = { cur: b.dur, max: b.dur };
      return it;
    }
    rarity = 'rare'; // fallback se não houver especial elegível
  }

  const item = {
    id: nextItemId(), name: base.name, rarity, baseId: base.id, slot: base.slot, kind: base.kind,
    icon: base.icon, reqLevel: base.reqLevel, ilvl, baseStats: rollBaseDef(base, rng),
    mods: {}, affixes: [], reqStr: base.reqStr || 0, reqDex: base.reqDex || 0,
  };

  let affixes = [];
  const slot = base.slot;
  if (rarity === 'magic') {
    const nPre = rng.chance(0.6) ? 1 : 0;
    const nSuf = (nPre === 0 || rng.chance(0.6)) ? 1 : 0;
    affixes = [...pickAffixes(AFFIXES.prefix, nPre, ilvl, rng, slot), ...pickAffixes(AFFIXES.suffix, nSuf, ilvl, rng, slot)];
    if (affixes.length === 0) affixes = pickAffixes(AFFIXES.suffix, 1, ilvl, rng, slot);
    const pre = affixes.find(a => AFFIXES.prefix.some(p => p.stat === a.stat));
    const suf = affixes.find(a => AFFIXES.suffix.some(p => p.stat === a.stat));
    item.name = (pre ? pre.name + ' ' : '') + base.name + (suf ? ' ' + suf.name : '');
  } else if (rarity === 'rare') {
    const nPre = rng.int(1, 3), nSuf = rng.int(1, 3);
    affixes = [...pickAffixes(AFFIXES.prefix, nPre, ilvl, rng, slot), ...pickAffixes(AFFIXES.suffix, nSuf, ilvl, rng, slot)];
    item.name = rng.pick(RARE_NAMES_A) + ' ' + rng.pick(RARE_NAMES_B);
  }

  // agrega afixos em mods; afixos de PROC vão para item.procs (chance de conjurar)
  for (const a of affixes) {
    if (a.proc) {
      item.procs = item.procs || [];
      item.procs.push({ chance: a.value / 100, pct: a.value, skill: a.proc.skill, skillName: a.proc.skillName, level: a.proc.level, trigger: a.proc.trigger });
    } else {
      item.mods[a.stat] = (item.mods[a.stat] || 0) + a.value;
    }
  }
  item.affixes = affixes;
  // requisito de nível sobe um pouco com afixos fortes
  item.reqLevel = Math.max(item.reqLevel, Math.min(ilvl, base.reqLevel + Math.floor(affixes.length * 1.5)));
  // identificação estilo D2: itens mágicos/normais já vêm identificados; raros/sets/uniques NÃO.
  item.identified = (rarity === 'normal' || rarity === 'magic');
  // itens NORMAIS "Superiores" (qualidade do D2): bônus aos status base
  if (rarity === 'normal' && (item.baseStats.defense || item.baseStats.dmgMax) && rng.chance(0.30)) {
    item.superior = true;
    const f = 1 + rng.range(0.12, 0.30);
    if (item.baseStats.defense) item.baseStats.defense = Math.round(item.baseStats.defense * f);
    if (item.baseStats.dmgMin) { item.baseStats.dmgMin = Math.round(item.baseStats.dmgMin * f); item.baseStats.dmgMax = Math.round(item.baseStats.dmgMax * f); }
    item.name = 'Superior ' + item.name;
  }
  // durabilidade + itens ETÉREOS (+50% nos status base, durabilidade reduzida, não reparáveis)
  if (base.dur) {
    let maxDur = base.dur;
    if (rng.chance(0.10)) {
      item.ethereal = true;
      if (item.baseStats.dmgMin) { item.baseStats.dmgMin = Math.round(item.baseStats.dmgMin * 1.5); item.baseStats.dmgMax = Math.round(item.baseStats.dmgMax * 1.5); }
      if (item.baseStats.defense) item.baseStats.defense = Math.round(item.baseStats.defense * 1.5);
      maxDur = Math.max(2, Math.floor(maxDur / 2));
      item.name += ' (Etéreo)';
    }
    item.durability = { cur: maxDur, max: maxDur };
  }
  // soquetes (estilo D2): chance por raridade, contagem limitada pelo ilvl e pela base
  if (canHaveSockets(item)) {
    const chance = rarity === 'normal' ? 0.30 : rarity === 'magic' ? 0.18 : rarity === 'rare' ? 0.08 : 0;
    if (chance && rng.chance(chance)) {
      const maxS = maxSocketsForItem(item);
      item.sockets = rng.int(1, Math.max(1, Math.min(maxS, 2 + Math.floor(ilvl / 15))));
      item.socketed = [];
    }
  }
  return item;
}

// Constrói um unique/set específico por id (ex.: 'anihilus') — recompensa garantida.
export function makeUnique(id) {
  const sp = UNIQUES.find(u => u.id === id) || SETS.find(s => s.id === id);
  if (!sp) return null;
  const b = ITEM_BASES.find(x => x.id === sp.baseId);
  if (!b) return null;
  const it = {
    id: nextItemId(), name: sp.name, rarity: sp.rarity, baseId: b.id, slot: b.slot, kind: b.kind,
    icon: sp.icon || b.icon, reqLevel: sp.reqLevel, ilvl: sp.reqLevel, baseStats: rollBaseDefFixed(b),
    mods: { ...sp.mods }, affixes: [], setName: sp.setName, flavor: sp.flavor, special: true, identified: false,
    reqStr: b.reqStr || 0, reqDex: b.reqDex || 0,
  };
  if (b.dur) it.durability = { cur: b.dur, max: b.dur };
  return it;
}
function rollBaseDefFixed(base) {
  const out = {};
  if (base.dmg) { out.dmgMin = base.dmg[0]; out.dmgMax = base.dmg[1]; }
  if (base.def) out.defense = base.def[1];
  return out;
}

// JOIAS (jewels) estilo D2: item encravável com afixos próprios. Magic/rare/unique.
// Encrava em QUALQUER soquete (arma ou armadura) e dá o mesmo bônus nos dois.
export function generateJewel(ilvl, rarity, rng) {
  if (rarity === 'unique') return makeJewelUnique(rng.pick(UNIQUE_JEWELS).id);
  if (rarity !== 'rare') rarity = 'magic';
  const item = {
    id: nextItemId(), name: 'Joia', rarity, slot: 'jewel', kind: 'jewel', icon: '🔷',
    reqLevel: 1, ilvl, mods: {}, affixes: [], socketable: true,
  };
  let nPre, nSuf;
  if (rarity === 'rare') { nPre = rng.int(1, 2); nSuf = rng.int(1, 2); }
  else { nPre = rng.chance(0.65) ? 1 : 0; nSuf = (nPre === 0 || rng.chance(0.5)) ? 1 : 0; }
  let affixes = [
    ...pickAffixes(JEWEL_AFFIXES.prefix, nPre, ilvl, rng, 'jewel'),
    ...pickAffixes(JEWEL_AFFIXES.suffix, nSuf, ilvl, rng, 'jewel'),
  ];
  if (affixes.length === 0) affixes = pickAffixes(JEWEL_AFFIXES.suffix, 1, ilvl, rng, 'jewel');
  for (const a of affixes) item.mods[a.stat] = (item.mods[a.stat] || 0) + a.value;
  item.affixes = affixes;
  const pre = affixes.find(a => JEWEL_AFFIXES.prefix.some(p => p.stat === a.stat));
  const suf = affixes.find(a => JEWEL_AFFIXES.suffix.some(p => p.stat === a.stat));
  item.name = rarity === 'rare'
    ? 'Joia ' + rng.pick(RARE_NAMES_B)
    : (pre ? pre.name + ' ' : '') + 'Joia' + (suf ? ' ' + suf.name : '');
  item.reqLevel = Math.max(1, Math.min(ilvl, 1 + Math.floor(affixes.length * 2)));
  item.identified = (rarity === 'magic'); // mágicas já vêm ID; raras precisam de pergaminho
  return item;
}

// Constrói uma joia única (Faceta Arco-Íris) por id.
export function makeJewelUnique(id) {
  const sp = UNIQUE_JEWELS.find(j => j.id === id);
  if (!sp) return null;
  return {
    id: nextItemId(), name: sp.name, rarity: 'unique', slot: 'jewel', kind: 'jewel', icon: sp.icon,
    reqLevel: sp.reqLevel, ilvl: sp.reqLevel, mods: { ...sp.mods }, affixes: [],
    flavor: sp.flavor, identified: false, socketable: true, special: true,
  };
}

// Resultado de um drop de monstro: pode conter vários objetos (item/gold/potion).
export function rollDrops(monsterLevel, rank, magicFind, difficulty, rng) {
  const drops = [];
  const dropMul = rank.dropMul || 1;

  // gold
  if (rng.chance(0.7)) {
    const gold = Math.floor((rng.int(1, 6) + monsterLevel * 1.5) * dropMul);
    drops.push({ type: 'gold', amount: gold });
  }

  // poções
  if (rng.chance(0.18 * dropMul)) {
    drops.push({ type: 'potion', potion: rng.chance(0.6) ? 'life' : 'mana', icon: rng.chance(0.6) ? '🧪' : '🔵' });
  }

  // pergaminhos (Identificação / Portal) — como no D2
  if (rng.chance(0.10 * dropMul)) {
    drops.push({ type: 'scroll', scroll: rng.chance(0.6) ? 'id' : 'tp' });
  }

  // gemas — qualidade escala com o nível do monstro
  if (rng.chance(0.08 * dropMul)) {
    const tier = Math.min(5, 1 + Math.floor(monsterLevel / 14) + (rng.chance(0.3) ? 1 : 0));
    const q = GEM_QUALITIES[tier - 1];
    const base = rng.pick(['ruby', 'sapphire', 'topaz', 'emerald', 'diamond', 'skull', 'amethyst']);
    drops.push({ type: 'gem', id: `${base}_${q}` });
  }
  // runas — tier limitado pelo nível (runas baixas mais comuns)
  if (rng.chance(0.05 * dropMul)) {
    const maxRuneTier = Math.min(16, 2 + Math.floor(monsterLevel / 6));
    const pool = runeList().filter(r => r.tier <= maxRuneTier);
    if (pool.length) drops.push({ type: 'rune', id: rng.pick(pool).id });
  }

  // joias (jewels) — item encravável; chance pequena de Faceta Arco-Íris (única)
  if (rng.chance(0.04 * dropMul)) {
    const jr = rng.chance(0.03) ? 'unique' : rng.chance(0.28) ? 'rare' : 'magic';
    drops.push({ type: 'item', item: generateJewel(monsterLevel, jr, rng) });
  }

  // itens — número de tentativas escala com rank
  const tries = rank.id === 'boss' ? 6 : rank.id === 'unique' ? 3 : rank.id === 'champion' ? 2 : 1;
  for (let i = 0; i < tries; i++) {
    const noDrop = rank.id === 'normal' ? 0.55 : 0.15;
    if (rng.chance(noDrop)) continue;
    const rarity = rollRarity(rng, magicFind, difficulty, rank.id === 'boss' || rank.id === 'unique');
    const item = generateItem(monsterLevel, rarity, rng);
    drops.push({ type: 'item', item });
  }
  return drops;
}

// Texto de tooltip de um item (linhas).
export function itemTooltipLines(item) {
  const lines = [];
  const bs = item.baseStats || {};
  if (bs.dmgMin != null) lines.push({ text: `Dano: ${bs.dmgMin}-${bs.dmgMax}`, cls: 'desc' });
  if (bs.defense != null) lines.push({ text: `Defesa: ${bs.defense}`, cls: 'desc' });
  if (item.identified === false) {
    lines.push({ text: 'Não identificado', cls: 'affix' });
    lines.push({ text: 'Use um Pergaminho de Identificação.', cls: 'desc' });
  } else {
    for (const [stat, val] of Object.entries(item.mods || {})) {
      lines.push({ text: '+ ' + statLabel(stat, val), cls: 'affix' });
    }
    // procs (chance de conjurar)
    for (const pr of (item.procs || [])) {
      lines.push({ text: `${pr.pct}% de conjurar ${pr.skillName} (nv ${pr.level}) ${pr.trigger === 'strike' ? 'ao acertar' : 'ao ser atingido'}`, cls: 'affix' });
    }
    // soquetes / runeword
    if (item.sockets) {
      const rw = detectRuneword(item);
      if (rw) {
        lines.push({ text: `★ Runeword: ${rw.name}`, cls: 'affix' });
        for (const [stat, val] of Object.entries(rw.mods)) lines.push({ text: '  + ' + statLabel(stat, val), cls: 'affix' });
      } else {
        lines.push({ text: socketSummary(item), cls: 'desc' });
      }
    }
  }
  if (item.kind === 'jewel' && item.identified !== false) lines.push({ text: 'Joia — encrava em qualquer soquete (arma ou armadura).', cls: 'desc' });
  if (item.ethereal) lines.push({ text: 'Etéreo (não reparável)', cls: 'affix' });
  if (item.durability) {
    const broken = item.durability.cur <= 0;
    lines.push({ text: broken ? 'QUEBRADO (sem bônus até reparar)' : `Durabilidade: ${item.durability.cur}/${item.durability.max}`, cls: broken ? 'dmg' : 'desc' });
  }
  lines.push({ text: `Requer Nível ${item.reqLevel}`, cls: 'desc' });
  if (item.reqStr) lines.push({ text: `Requer Força ${item.reqStr}`, cls: 'desc' });
  if (item.reqDex) lines.push({ text: `Requer Destreza ${item.reqDex}`, cls: 'desc' });
  if (item.identified !== false && item.flavor) lines.push({ text: item.flavor, cls: 'desc' });
  return lines;
}

// Ordena uma lista de itens do inventário/baú para gerência fácil (botão "Organizar"):
// agrupa por categoria (equipamento → charm → joia → gema → runa), depois raridade
// (único > set > raro > mágico > normal), depois nível requerido e nome. Função PURA.
const _RARITY_SORT = { unique: 5, set: 4, rare: 3, magic: 2, normal: 1 };
const _EQUIP_SLOT_ORDER = { weapon: 0, shield: 0, helm: 1, body: 1, gloves: 1, boots: 1, belt: 1, amulet: 2, ring: 2, ring2: 2 };
function _itemCategory(it) {
  if (it.kind === 'gem') return 7;
  if (it.kind === 'rune') return 6;
  if (it.kind === 'jewel') return 5;
  if (it.slot === 'charm') return 4;
  return _EQUIP_SLOT_ORDER[it.slot] ?? 3; // equipamento primeiro (0-3)
}
export function sortInventoryItems(items) {
  return [...items].sort((a, b) => {
    const ca = _itemCategory(a), cb = _itemCategory(b);
    if (ca !== cb) return ca - cb;
    const ra = _RARITY_SORT[a.rarity] || 0, rb = _RARITY_SORT[b.rarity] || 0;
    if (ra !== rb) return rb - ra;
    const la = a.reqLevel || 0, lb = b.reqLevel || 0;
    if (la !== lb) return lb - la;
    return (a.name || '').localeCompare(b.name || '');
  });
}

export function statLabel(stat, val) {
  const pct = (v) => Math.round(v * 100) + '%';
  const map = {
    str: `${val} Força`, dex: `${val} Destreza`, ene: `${val} Energia`, vit: `${val} Vitalidade`,
    lifeFlat: `${val} Vida`, manaFlat: `${val} Mana`, defenseFlat: `${val} Defesa`,
    physDamagePct: `${pct(val)} Dano Físico`, attackSpeed: `${pct(val)} Vel. de Ataque`,
    moveSpeedPct: `${pct(val)} Vel. de Movimento`, magicFind: `${val}% Magic Find`,
    lifeLeech: `${val}% Roubo de Vida`, critChance: `${pct(val)} Crítico`,
    flatFire: `${val} Dano de Fogo`, flatCold: `${val} Dano de Gelo`, flatLight: `${val} Dano de Raio`,
    resFire: `${val}% Resist. Fogo`, resCold: `${val}% Resist. Gelo`, resLight: `${val}% Resist. Raio`,
    resAll: `${val}% a Todas Resist.`, resPoison: `${val}% Resist. Veneno`,
    allAttrs: `${val} a Todos Atributos`, attackRating: `${val} Precisão`,
    fcr: `${pct(val)} Conjuração Rápida`, allSkills: `+${val} a Todas as Skills`,
    maxResAll: `+${val}% ao Máx. de Resistências`,
    crushingBlow: `${pct(val)} Golpe Esmagador`, openWounds: `${pct(val)} Ferida Aberta`,
    thorns: `Espinhos: reflete ${val} de dano`,
    fhr: `${pct(val)} Recuperação Rápida`, cannotFreeze: `Não Pode Ser Congelado`,
    lifePerKill: `+${val} Vida por Morte`, manaPerKill: `+${val} Mana por Morte`,
  };
  return map[stat] || `${val} ${stat}`;
}
