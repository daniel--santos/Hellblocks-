// Dificuldades estilo Diablo II: Normal, Pesadelo (Nightmare), Inferno (Hell).
// Cada uma aumenta nível/vida/dano dos monstros e impõe penalidade de resistência ao jogador.

export const DIFFICULTIES = {
  normal: {
    id: 'normal', name: 'Normal', order: 0,
    monsterLevelBonus: 0, monsterLifeMul: 1, monsterDamageMul: 1, monsterXPMul: 1,
    resPenalty: 0,            // penalidade às resistências do jogador
    immunityChance: 0,        // chance de monstro ter imunidade elemental
    dropQualityBonus: 0,
  },
  nightmare: {
    id: 'nightmare', name: 'Pesadelo', order: 1,
    monsterLevelBonus: 38, monsterLifeMul: 3.2, monsterDamageMul: 2.4, monsterXPMul: 2.0,
    resPenalty: 40,
    immunityChance: 0.06,
    dropQualityBonus: 0.15,
  },
  hell: {
    id: 'hell', name: 'Inferno', order: 2,
    monsterLevelBonus: 70, monsterLifeMul: 7.5, monsterDamageMul: 4.0, monsterXPMul: 3.0,
    resPenalty: 100,
    immunityChance: 0.15,
    dropQualityBonus: 0.30,
  },
};

export const DIFFICULTY_LIST = [DIFFICULTIES.normal, DIFFICULTIES.nightmare, DIFFICULTIES.hell];

// nível efetivo de uma área nesta dificuldade
export function effectiveAreaLevel(baseAreaLevel, difficulty) {
  return baseAreaLevel + difficulty.monsterLevelBonus;
}

// resistência efetiva do jogador (capada em 75% como D2, com penalidade da dificuldade)
export function effectiveResist(baseResist, difficulty) {
  return Math.min(75, baseResist - difficulty.resPenalty);
}
