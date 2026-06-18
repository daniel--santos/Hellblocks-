// Mercenário (hireling) estilo Diablo II: contratado na cidade, segue o jogador e ataca.
import * as THREE from 'three';
import { makeHumanoid, animateHumanoid } from '../core/blocks.js';
import { applyDamage, spawnProjectile, nearestMonster } from '../systems/combat.js';
import { getItemMods } from '../systems/sockets.js';

// Tipos de mercenário por ato (como no D2: Rogue, Desert Guard, Iron Wolf, Barbarian).
// aura: buff concedido ao jogador enquanto o mercenário estiver vivo (estilo auras de merc do D2)
export const MERC_TYPES = {
  rogue: { id: 'rogue', name: 'Arqueira Mercenária', icon: '🏹', color: 0x884466, ranged: true, element: 'cold', range: 14, baseHire: 200, aura: { critAdd: 0.08 }, auraText: '+8% crítico' },
  guard: { id: 'guard', name: 'Guarda do Deserto', icon: '🗡️', color: 0xc9a86a, ranged: false, element: 'physical', range: 2.2, baseHire: 400, aura: { damageMul: 1.15 }, auraText: 'Vigor: +15% dano' },
  ironwolf: { id: 'ironwolf', name: 'Lobo de Ferro', icon: '🔥', color: 0x4466aa, ranged: true, element: 'fire', range: 12, baseHire: 700, aura: { manaRegenMul: 2 }, auraText: 'Regen. de mana x2' },
  barbarian: { id: 'barbarian', name: 'Bárbaro', icon: '⚔️', color: 0x886644, ranged: false, element: 'physical', range: 2.4, baseHire: 1000, aura: { damageMul: 1.10, defenseAdd: 0.10 }, auraText: '+10% dano, +10% defesa' },
};

export function mercForAct(actIndex) {
  return [MERC_TYPES.rogue, MERC_TYPES.guard, MERC_TYPES.ironwolf, MERC_TYPES.barbarian][Math.min(actIndex, 3)];
}
export function hireCost(type, playerLevel) {
  return type.baseHire + playerLevel * 60;
}

export class Mercenary {
  constructor(type, level) {
    this.type = type;
    this.level = level;
    this.name = type.name;
    this.gear = {}; // weapon / body / helm dados pelo jogador
    this.maxLife = Math.round(60 + level * 18);
    this.life = this.maxLife;
    this.damage = Math.round(6 + level * 2.4);
    this.range = type.range;
    this.element = type.element;
    this.ranged = type.ranged;
    this.attackCd = 0;
    this.attackSpeed = 1.1;
    this.dead = false;

    const m = makeHumanoid({ color: type.color, accent: 0x333333, scale: 1.0, weapon: type.ranged ? 'bow' : 'sword' });
    this.mesh = m.group;
    this.parts = m.parts;
    this.position = new THREE.Vector3();
    this.facing = 0;
  }

  setLevel(level) { this.level = level; this.recompute(); }

  // recalcula vida/dano a partir do nível + equipamento dado pelo jogador
  recompute() {
    const ratio = this.maxLife ? (this.life / this.maxLife) : 1;
    let dmg = Math.round(6 + this.level * 2.4);
    let life = Math.round(60 + this.level * 18);
    const w = this.gear.weapon;
    if (w && w.baseStats) dmg += Math.round(((w.baseStats.dmgMin || 0) + (w.baseStats.dmgMax || 0)) / 2);
    for (const it of Object.values(this.gear)) {
      if (!it) continue;
      const m = getItemMods(it);
      if (m.physDamagePct) dmg = Math.round(dmg * (1 + m.physDamagePct));
      if (m.lifeFlat) life += m.lifeFlat;
    }
    this.damage = dmg;
    this.maxLife = life;
    this.life = Math.min(life, Math.round(life * ratio) || life);
  }

  // equipa item no mercenário (weapon/body/helm). Retorna o item anterior (ou null).
  equipItem(item) {
    const slot = item.slot;
    if (!['weapon', 'body', 'helm'].includes(slot)) return { ok: false, reason: 'slot inválido p/ mercenário' };
    const prev = this.gear[slot] || null;
    this.gear[slot] = item;
    this.recompute();
    return { ok: true, prev };
  }
  unequipItem(slot) {
    const it = this.gear[slot];
    if (!it) return null;
    delete this.gear[slot];
    this.recompute();
    return it;
  }

  update(game, dt, time) {
    if (this.dead) return;
    const p = game.player;
    const target = nearestMonster(game, this.position, this.ranged ? 16 : 14);
    let moving = false;

    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - dt * 4);

    if (target) {
      const toT = new THREE.Vector3().subVectors(target.position, this.position).setY(0);
      const dist = toT.length();
      this.facing = Math.atan2(toT.x, toT.z);
      if (dist > this.range) { toT.normalize(); this.position.addScaledVector(toT, 6 * dt); moving = true; }
      else if (this.attackCd <= 0) { this.attack(game, target); }
    } else {
      // segue o jogador
      const toP = new THREE.Vector3().subVectors(p.position, this.position).setY(0);
      const dist = toP.length();
      if (dist > 3) { toP.normalize(); this.position.addScaledVector(toP, 6 * dt); moving = true; this.facing = Math.atan2(toP.x, toP.z); }
    }

    // regen leve
    this.life = Math.min(this.maxLife, this.life + this.maxLife * 0.01 * dt);

    animateHumanoid(this.parts, time + 1.7, moving, this.attackAnim || 0);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.facing;
  }

  attack(game, target) {
    this.attackCd = 1 / this.attackSpeed;
    this.attackAnim = 1;
    if (this.ranged) {
      const origin = this.position.clone().setY(1.1);
      const dir = new THREE.Vector3().subVectors(target.position, origin).setY(0).normalize();
      spawnProjectile(game, { origin, dir, speed: 24, range: this.range + 4, damage: this.damage, element: this.element, owner: 'player' });
    } else {
      applyDamage(game, target, this.damage, this.element, game.player);
    }
  }
}
