// Cadeia de quests por ATO, exclusivas e nomeadas (estilo Diablo II), com recompensas icônicas.
// Os gatilhos de conclusão reusam os 3 mecanismos já existentes no jogo:
//   type 'kills'  -> matar N inimigos no ato (killCount, reseta por ato)
//   type 'shrine' -> ativar um santuário
//   type 'boss'   -> derrotar o boss do ato
// Recompensas (aplicadas em Game._grantReward): skillPoints, statPoints, gold, item,
//   resAll (perm.: +% a todas as resistências), lifeFlat (perm.: +vida), socket (soqueta 1 item).
import { ACTS } from './acts.js';
import { BOSSES } from './monsters.js';

// 3 quests por ato. {boss} é substituído pelo nome do boss do ato.
const ACT_QUESTS = [
  // Ato I — Bioma das Sombras
  [
    { id: 'den_of_evil', type: 'kills', target: 30, text: 'O Covil do Mal — limpe os Campos Sombrios (30 inimigos)', reward: { skillPoints: 1 }, rewardText: '+1 ponto de skill' },
    { id: 'tools_trade', type: 'shrine', text: 'Ferramentas do Ofício — ative o santuário da forja de Pedregulho', reward: { socket: true }, rewardText: 'Larzuk: soqueta 1 item' },
    { id: 'sisters', type: 'boss', text: 'As Irmãs do Massacre — derrote {boss}', reward: { skillPoints: 1, gold: 500 }, rewardText: '+1 skill, +500 ouro' },
  ],
  // Ato II — Deserto Escaldante
  [
    { id: 'radament', type: 'kills', target: 35, text: 'A Toca de Radament — destrua os mortos do deserto (35 inimigos)', reward: { skillPoints: 1 }, rewardText: '+1 ponto de skill' },
    { id: 'arcane_sanctuary', type: 'shrine', text: 'O Santuário Arcano — ative o santuário das brasas', reward: { resAll: 10 }, rewardText: 'Anya: +10% a todas resistências (perm.)' },
    { id: 'seven_tombs', type: 'boss', text: 'As Sete Tumbas — derrote {boss}', reward: { skillPoints: 1, gold: 750 }, rewardText: '+1 skill, +750 ouro' },
  ],
  // Ato III — Pântano do Ender
  [
    { id: 'lam_esen', type: 'kills', target: 40, text: 'O Tomo de Lam Esen — recupere o saber proibido (40 inimigos)', reward: { statPoints: 5 }, rewardText: '+5 atributos' },
    { id: 'golden_bird', type: 'shrine', text: 'O Pássaro Dourado — ative o santuário do mangue', reward: { lifeFlat: 20 }, rewardText: 'Poção da Vida: +20 vida (perm.)' },
    { id: 'the_guardian', type: 'boss', text: 'O Guardião — derrote {boss}', reward: { skillPoints: 1, gold: 1000 }, rewardText: '+1 skill, +1000 ouro' },
  ],
  // Ato IV — Terras Finais
  [
    { id: 'fallen_angel', type: 'kills', target: 45, text: 'O Anjo Caído — destrua a hoste de Izual (45 inimigos)', reward: { skillPoints: 2 }, rewardText: '+2 pontos de skill' },
    { id: 'hells_forge', type: 'shrine', text: 'A Forja do Inferno — ative a forja das cinzas', reward: { socket: true }, rewardText: 'Forja: soqueta 1 item' },
    { id: 'terrors_end', type: 'boss', text: 'O Fim do Terror — derrote {boss}', reward: { skillPoints: 1, gold: 2000 }, rewardText: '+1 skill, +2000 ouro' },
  ],
];

export function buildActQuests(actIndex) {
  const act = ACTS[actIndex] || ACTS[0];
  const bossName = (act.boss && BOSSES[act.boss]) ? BOSSES[act.boss].name : 'o chefe';
  const chain = ACT_QUESTS[actIndex] || ACT_QUESTS[0];
  // clona (templates não podem ser mutados: 'done' muda e o questLog é salvo)
  return chain.map(q => ({
    ...q,
    text: q.text.replace('{boss}', bossName),
    reward: { ...q.reward },
    done: false,
  }));
}
