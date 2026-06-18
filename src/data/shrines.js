// Santuários estilo Diablo II: dão buffs temporários ou efeitos instantâneos ao serem ativados.
export const SHRINE_TYPES = [
  { id: 'exp', name: 'Santuário da Experiência', icon: '📖', color: 0xaa66ff, buff: { type: 'exp', mult: 1.5, dur: 40 } },
  { id: 'combat', name: 'Santuário de Combate', icon: '⚔️', color: 0xff5533, buff: { type: 'damage', mult: 1.6, dur: 35 } },
  { id: 'speed', name: 'Santuário Veloz', icon: '👟', color: 0x44ddff, buff: { type: 'speed', mult: 1.4, dur: 35 } },
  { id: 'defense', name: 'Santuário Protetor', icon: '🛡️', color: 0xffcc44, buff: { type: 'defense', add: 0.35, dur: 35 } },
  { id: 'refill', name: 'Santuário Refrescante', icon: '💧', color: 0x44ff88, instant: 'refill' },
  { id: 'mana', name: 'Santuário Arcano', icon: '🔵', color: 0x6688ff, buff: { type: 'mana_regen', mult: 3, dur: 30 } },
];

export function shrineBuffLabel(b) {
  const map = {
    exp: '+50% Experiência', damage: '+60% Dano', speed: '+40% Velocidade',
    defense: '+35% Defesa', mana_regen: 'Regen. de Mana x3',
  };
  return map[b.type] || b.type;
}
