// Salvar/Carregar progresso em localStorage (estilo "personagem salvo" do Diablo II).
// 3 SLOTS de personagem: chaves cubecraft_save_v1_slot0..2 (a chave antiga vira o slot 0).
const VERSION = 'cubecraft_save_v1';
export const SAVE_SLOTS = 3;
const slotKey = (slot) => `${VERSION}_slot${slot}`;

// migra o save antigo (chave única) para o slot 0, uma vez.
function migrateLegacy() {
  try {
    const legacy = localStorage.getItem(VERSION);
    if (legacy) {
      if (!localStorage.getItem(slotKey(0))) localStorage.setItem(slotKey(0), legacy);
      localStorage.removeItem(VERSION);
    }
  } catch {}
}
migrateLegacy();

export function hasSave(slot = 0) {
  try { return !!localStorage.getItem(slotKey(slot)); } catch { return false; }
}

export function loadSaveData(slot = 0) {
  try { return JSON.parse(localStorage.getItem(slotKey(slot))); } catch { return null; }
}

export function clearSave(slot = 0) {
  try { localStorage.removeItem(slotKey(slot)); } catch {}
}

// Serializa apenas DADOS (nada de objetos Three.js) no slot indicado.
export function saveGame(game, slot = (game.saveSlot ?? 0)) {
  const p = game.player;
  if (!p) return;
  const data = {
    v: 1, ts: Date.now(),
    classId: p.classId, level: p.level, xp: p.xp,
    stats: p.stats, statPoints: p.statPoints, skillPoints: p.skillPoints, skillRanks: p.skillRanks,
    gold: p.gold, potions: p.potions, scrolls: p.scrolls,
    inventory: p.inventory, equipment: p.equipment,
    beltSkills: p.beltSkills, rightSkill: p.rightSkill, leftSkill: p.leftSkill, activeAura: p.activeAura,
    difficulty: game.difficulty, hardcore: !!game.hardcore, titleRank: game.titleRank || 0, actIndex: game.actIndex, zoneIndex: game.zoneIndex,
    stashTabs: game.stashTabs, waypointList: game.waypointList,
    questLog: game.questLog, killCount: game.killCount, questAct: game._questAct,
    merc: (game.mercenary && !game.mercenary.dead) ? { typeId: game.mercenary.type.id, level: game.mercenary.level } : null,
  };
  try { localStorage.setItem(slotKey(slot), JSON.stringify(data)); return true; } catch { return false; }
}

// Resumo curto de um slot para a tela inicial.
export function saveSummary(slot = 0) {
  const d = loadSaveData(slot);
  if (!d) return null;
  const clsName = { guardian: 'Guardião', arcanist: 'Arcanista', hunter: 'Caçadora' }[d.classId] || d.classId;
  const diffName = { normal: 'Normal', nightmare: 'Pesadelo', hell: 'Inferno' }[d.difficulty] || d.difficulty;
  return `${clsName} Nv ${d.level} · Ato ${(d.actIndex || 0) + 1} · ${diffName}`;
}

// Lista os 3 slots para a tela inicial: { slot, summary|null, classId, level, hardcore }.
export function listSaves() {
  const out = [];
  for (let i = 0; i < SAVE_SLOTS; i++) {
    const d = loadSaveData(i);
    out.push(d
      ? { slot: i, summary: saveSummary(i), classId: d.classId, level: d.level, hardcore: !!d.hardcore }
      : { slot: i, summary: null });
  }
  return out;
}
