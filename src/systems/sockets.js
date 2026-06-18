// Soquetes, gemas/runas e runewords estilo Diablo II.
import { GEMS, RUNES, RUNEWORDS, getInsertable, isRune } from '../data/gems.js';

// Quantos soquetes uma base pode ter no máximo (por slot/tipo).
export function maxSocketsForItem(item) {
  switch (item.slot) {
    case 'weapon': return item.kind === 'bow' ? 4 : (item.kind === 'staff' ? 4 : 6);
    case 'body': return 4;
    case 'helm': return 3;
    case 'shield': return 3;
    default: return 0; // luvas, botas, cinto, anel, amuleto, charm não recebem soquete
  }
}

export function canHaveSockets(item) { return maxSocketsForItem(item) > 0; }
export function emptySockets(item) { return (item.sockets || 0) - (item.socketed?.length || 0); }

// Insere uma gema/runa (id string) OU uma joia (objeto-item) num soquete livre.
// Retorna {ok} ou {ok:false,reason}.
export function insertIntoSocket(item, insertable) {
  if (!item.sockets || emptySockets(item) <= 0) return { ok: false, reason: 'sem soquete livre' };
  const isJewel = insertable && typeof insertable === 'object' && insertable.kind === 'jewel';
  if (!isJewel && !getInsertable(insertable)) return { ok: false, reason: 'objeto inválido' };
  item.socketed = item.socketed || [];
  item.socketed.push(insertable);
  return { ok: true };
}

// Mods agregados das gemas/runas/joias inseridas (gema/runa variam por arma vs armadura;
// joias dão o MESMO bônus nos dois, como no D2).
function socketedMods(item) {
  const mods = {};
  const target = item.slot === 'weapon' ? 'weapon' : 'armor';
  for (const entry of (item.socketed || [])) {
    let m;
    if (entry && typeof entry === 'object') m = entry.mods || {}; // joia: bônus próprio do item
    else {
      const ins = getInsertable(entry);
      if (!ins) continue;
      m = ins.modsFor(target);
    }
    for (const [k, v] of Object.entries(m)) mods[k] = (mods[k] || 0) + v;
  }
  return mods;
}

// Detecta runeword ativo: soquetes 100% cheios SÓ com runas, na sequência exata, no item certo.
export function detectRuneword(item) {
  if (!item.sockets || emptySockets(item) > 0) return null;
  const socketed = item.socketed || [];
  if (socketed.length === 0 || !socketed.every(isRune)) return null;
  for (const rw of RUNEWORDS) {
    if (rw.sockets !== item.sockets) continue;
    if (!rw.targets.includes(item.slot)) continue;
    if (rw.runes.length !== socketed.length) continue;
    if (rw.runes.every((r, i) => r === socketed[i])) return rw;
  }
  return null;
}

// Mods TOTAIS de um item: afixos próprios + (runeword OU mods de gemas/runas).
export function getItemMods(item) {
  const total = { ...(item.mods || {}) };
  const rw = detectRuneword(item);
  if (rw) {
    for (const [k, v] of Object.entries(rw.mods)) total[k] = (total[k] || 0) + v;
    item._runeword = rw.name;
  } else {
    item._runeword = null;
    const sm = socketedMods(item);
    for (const [k, v] of Object.entries(sm)) total[k] = (total[k] || 0) + v;
  }
  return total;
}

// Texto das gemas/runas inseridas para tooltip.
export function socketSummary(item) {
  if (!item.sockets) return null;
  const filled = (item.socketed || []).map(e => (e && typeof e === 'object') ? e.name : (getInsertable(e)?.name || '?'));
  const empty = emptySockets(item);
  const parts = [...filled, ...Array(empty).fill('(vazio)')];
  return `Soquetes [${item.sockets}]: ${parts.join(', ')}`;
}
