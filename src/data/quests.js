// Cadeia de quests por ato (estilo Diablo II: Den of Evil, etc.), com recompensas variadas.
import { ACTS } from './acts.js';
import { BOSSES } from './monsters.js';

export function buildActQuests(actIndex) {
  const act = ACTS[actIndex] || ACTS[0];
  const bossName = (act.boss && BOSSES[act.boss]) ? BOSSES[act.boss].name : 'o chefe';
  return [
    { id: 'clear', text: 'Limpe a região (derrote 30 inimigos)', type: 'kills', target: 30, done: false, reward: { skillPoints: 1 }, rewardText: '+1 ponto de skill' },
    { id: 'shrine', text: 'Ative um santuário', type: 'shrine', done: false, reward: { statPoints: 5 }, rewardText: '+5 pontos de atributo' },
    { id: 'boss', text: `Derrote ${bossName}`, type: 'boss', done: false, reward: { skillPoints: 1, gold: 500 }, rewardText: '+1 skill, +500 ouro' },
  ];
}
