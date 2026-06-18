// Sistema de árvore de skills estilo Diablo II: pontos por nível, pré-requisitos,
// tiers por nível, sinergias (já embutidas nos getStats das skills) e bônus de auras/passivas.
import { SKILLS, skillsForClass } from '../data/skills.js';

// Pode aprender/melhorar a skill?
export function canLearn(player, skillId) {
  const sk = SKILLS[skillId];
  if (!sk) return { ok: false, reason: 'inexistente' };
  if (sk.classId !== player.classId) return { ok: false, reason: 'classe' };
  if (player.skillPoints <= 0) return { ok: false, reason: 'sem pontos' };
  const rank = player.skillRanks[skillId] || 0;
  if (rank >= sk.maxRank) return { ok: false, reason: 'máximo' };
  if (player.level < sk.reqLevel) return { ok: false, reason: `requer nível ${sk.reqLevel}` };
  for (const pre of sk.prereqs) {
    if ((player.skillRanks[pre] || 0) < 1) return { ok: false, reason: `requer ${SKILLS[pre].name}` };
  }
  return { ok: true };
}

export function learnSkill(player, skillId) {
  const check = canLearn(player, skillId);
  if (!check.ok) return false;
  player.skillRanks[skillId] = (player.skillRanks[skillId] || 0) + 1;
  player.skillPoints -= 1;
  return true;
}

// Lista skills ativas (utilizáveis na barra) que o jogador possui com rank>=1.
export function learnedActiveSkills(player) {
  return skillsForClass(player.classId)
    .filter(s => (player.skillRanks[s.id] || 0) >= 1)
    .filter(s => ['attack', 'attack_melee', 'melee', 'projectile', 'nova', 'aoe_ground', 'buff', 'chain', 'summon', 'teleport'].includes(s.type));
}

// Agrega bônus de TODAS as auras e passivas aprendidas (simplificação: auras sempre ativas).
export function aggregateAuraAndPassive(player) {
  const out = {
    auraDamagePct: 0, auraAS: 0, auraBurn: 0, auraRegen: 0, auraDefense: 0,
    auraResAll: 0, auraResShred: 0,
    critChance: 0, dodgeChance: 0, physDamagePct: 0, moveSpeedPct: 0,
    fireDmg: 0, coldDmg: 0, lightDmg: 0,
  };
  for (const s of skillsForClass(player.classId)) {
    const rank = player.skillRanks[s.id] || 0;
    if (rank < 1) continue;
    if (s.type !== 'aura' && s.type !== 'passive') continue;
    // auras: só a AURA ATIVA conta (estilo D2). Passivas sempre contam.
    if (s.type === 'aura' && player.activeAura !== s.id) continue;
    const st = s.getStats(rank + (player.plusSkills || 0), player.skillRanks);
    for (const k of Object.keys(out)) {
      if (st[k] != null) out[k] += st[k];
    }
  }
  return out;
}

// Stats efetivos de uma skill no rank atual do jogador.
// +Todas as Skills (de itens) eleva o rank efetivo de skills já aprendidas (como no D2).
export function skillStats(player, skillId) {
  const sk = SKILLS[skillId];
  const base = player.skillRanks[skillId] || 0;
  if (base < 1) return null;
  const rank = base + (player.plusSkills || 0);
  return sk.getStats(rank, player.skillRanks);
}

// rank efetivo exibível (base + itens)
export function effectiveRank(player, skillId) {
  const base = player.skillRanks[skillId] || 0;
  return base < 1 ? 0 : base + (player.plusSkills || 0);
}
