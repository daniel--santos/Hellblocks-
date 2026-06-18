// Invocações (summons) aliadas estilo Diablo II: Espíritos, Hidra, Valquíria.
import * as THREE from 'three';
import { makeHumanoid, animateHumanoid, box } from '../core/blocks.js';
import { applyDamage, spawnProjectile, nearestMonster } from '../systems/combat.js';

const KIND_COLOR = { spirit: 0xffee88, hydra: 0xff5522, valkyrie: 0xcfd8ff };

export class Summon {
  constructor(kind, opts = {}) {
    this.kind = kind;
    this.maxLife = opts.life || 50;
    this.life = this.maxLife;
    this.damage = opts.damage || 10;
    this.element = opts.element || 'physical';
    this.ranged = !!opts.ranged;
    this.stationary = !!opts.stationary;     // Hidra fica parada onde foi conjurada
    this.range = opts.range || (this.ranged ? 12 : 2.2);
    this.attackSpeed = opts.attackSpeed || 1.2;
    this.expireAt = opts.expireAt || null;
    this.attackCd = 0;
    this.attackAnim = 0;
    this.dead = false;

    const color = KIND_COLOR[kind] || 0xffffff;
    if (kind === 'hydra') {
      // torre de fogo cúbica
      const g = new THREE.Group();
      const base = box(0.6, 0.6, 0.6, 0x661100, 0x220800); base.position.y = 0.3;
      const head = box(0.5, 0.5, 0.5, color, color); head.position.y = 0.9;
      head.material = new THREE.MeshBasicMaterial({ color });
      const l = new THREE.PointLight(color, 1.2, 6); l.position.y = 1;
      g.add(base, head, l);
      this.mesh = g; this.parts = null;
    } else {
      const m = makeHumanoid({ color, accent: 0x222233, scale: kind === 'valkyrie' ? 1.2 : 0.9, weapon: kind === 'valkyrie' ? 'sword' : null });
      this.mesh = m.group; this.parts = m.parts;
      const l = new THREE.PointLight(color, 0.7, 5); l.position.y = 1.5; this.mesh.add(l);
    }
    this.position = new THREE.Vector3();
    this.facing = 0;
  }

  setPosition(x, z) { this.position.set(x, 0, z); this.mesh.position.copy(this.position); }

  update(game, dt, time) {
    if (this.dead) return;
    if (this.expireAt && time > this.expireAt) { this.dead = true; return; }
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - dt * 4);

    const target = nearestMonster(game, this.position, this.ranged ? 16 : 14);
    let moving = false;
    if (target) {
      const to = new THREE.Vector3().subVectors(target.position, this.position).setY(0);
      const d = to.length();
      this.facing = Math.atan2(to.x, to.z);
      if (!this.stationary && d > this.range) { to.normalize(); this.position.addScaledVector(to, 6 * dt); moving = true; }
      else if (d <= this.range + (this.stationary ? 12 : 0) && this.attackCd <= 0) this.attack(game, target);
    } else if (!this.stationary) {
      // segue o jogador
      const to = new THREE.Vector3().subVectors(game.player.position, this.position).setY(0);
      if (to.length() > 4) { to.normalize(); this.position.addScaledVector(to, 6 * dt); moving = true; this.facing = Math.atan2(to.x, to.z); }
    }

    if (this.parts) animateHumanoid(this.parts, time + 0.5, moving, this.attackAnim || 0);
    else this.mesh.rotation.y += dt * 1.5; // hidra gira
    this.mesh.position.copy(this.position);
    if (this.parts) this.mesh.rotation.y = this.facing;
  }

  attack(game, target) {
    this.attackCd = 1 / this.attackSpeed;
    this.attackAnim = 1;
    if (this.ranged) {
      const o = this.position.clone().setY(1.0);
      const dir = new THREE.Vector3().subVectors(target.position, o).setY(0).normalize();
      spawnProjectile(game, { origin: o, dir, speed: 22, range: this.range + 6, damage: this.damage, element: this.element, owner: 'player' });
    } else {
      if (this.position.distanceTo(target.position) <= this.range + 0.5) applyDamage(game, target, this.damage, this.element, null);
    }
  }
}
