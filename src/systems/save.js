// Salvar/Carregar progresso em localStorage (estilo "personagem salvo" do Diablo II).
const KEY = 'cubecraft_save_v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadSaveData() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch {}
}

// Serializa apenas DADOS (nada de objetos Three.js).
export function saveGame(game) {
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
    stash: game.stash, waypointList: game.waypointList,
    questLog: game.questLog, killCount: game.killCount, questAct: game._questAct,
    merc: (game.mercenary && !game.mercenary.dead) ? { typeId: game.mercenary.type.id, level: game.mercenary.level } : null,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

// Resumo curto para a tela inicial.
export function saveSummary() {
  const d = loadSaveData();
  if (!d) return null;
  const clsName = { guardian: 'Guardião', arcanist: 'Arcanista', hunter: 'Caçadora' }[d.classId] || d.classId;
  const diffName = { normal: 'Normal', nightmare: 'Pesadelo', hell: 'Inferno' }[d.difficulty] || d.difficulty;
  return `${clsName} Nv ${d.level} · Ato ${(d.actIndex || 0) + 1} · ${diffName}`;
}
