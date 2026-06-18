// Cubo Horadric estilo Diablo II: receitas de transmutação.
import { GEMS, RUNES, GEM_QUALITIES, getInsertable } from '../data/gems.js';
import { canHaveSockets, maxSocketsForItem } from './sockets.js';
import { generateItem, nextItemId } from './loot.js';

function makeSocketableItem(defId) {
  const def = getInsertable(defId);
  return { id: nextItemId(), name: def.name, icon: def.icon, rarity: 'normal', identified: true, kind: def.kind, socketableId: def.id, slot: def.kind, reqLevel: def.reqLevel || 1, mods: {} };
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
  'runa Hel + 1 item encravado → esvazia os soquetes',
];

// Tenta transmutar o conteúdo do cubo. Retorna { ok, message, result } (result = novo conteúdo).
export function transmute(items, rng) {
  const gems = items.filter(i => i.kind === 'gem');
  const runes = items.filter(i => i.kind === 'rune');
  const gear = items.filter(i => i.slot && !['gem', 'rune', 'charm', 'jewel'].includes(i.slot));

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
