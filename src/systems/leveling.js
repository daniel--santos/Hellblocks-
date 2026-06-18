// Progressão de nível 1 -> 99 (curva crescente inspirada no Diablo II, reescalada
// para ser alcançável numa sessão de demo mantendo a sensação de grind tardio).

export const MAX_LEVEL = 99;

// XP total acumulado necessário para ATINGIR o nível L.
const _cumCache = [0, 0]; // index = level
function buildTable() {
  let total = 0;
  for (let L = 1; L < MAX_LEVEL; L++) {
    // requisito para passar de L -> L+1
    const req = Math.floor(80 * Math.pow(L, 1.9) * (1 + L / 40));
    total += req;
    _cumCache[L + 1] = total;
  }
}
buildTable();

export function xpToReach(level) {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return _cumCache[MAX_LEVEL];
  return _cumCache[level];
}

export function xpForNext(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return xpToReach(level + 1) - xpToReach(level);
}

// XP base concedido por um monstro de dado nível (antes de multiplicadores de rank/dif).
export function monsterBaseXP(monsterLevel) {
  return Math.floor(5 + monsterLevel * monsterLevel * 0.9 + monsterLevel * 4);
}

// Penalidade de XP por diferença de nível (como D2: muito acima/abaixo dá menos).
export function xpLevelPenalty(playerLevel, monsterLevel) {
  const diff = Math.abs(playerLevel - monsterLevel);
  if (diff <= 5) return 1;
  return Math.max(0.1, 1 - (diff - 5) * 0.08);
}
