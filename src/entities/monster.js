// Monstros e bosses: criação, escala por nível de área/dificuldade/rank, e IA.
import * as THREE from 'three';
import { makeHumanoid, animateHumanoid, makeMonsterModel, box } from '../core/blocks.js';
import { MONSTER_TYPES, MONSTER_RANKS, MONSTER_AFFIXES, BOSSES } from '../data/monsters.js';
import { applyDamageToPlayer, spawnProjectile, novaBurst, pickMonsterTarget, applyDamageToCompanion } from '../systems/combat.js';

export class Monster {
  constructor(def, level, rank, difficulty, rng, opts = {}) {
    this.def = def;
    this.typeId = def.id;
    this.name = def.name;
    this.level = level;
    this.rank = rank;
    this.isBoss = rank.id === 'boss';
    this.ai = def.ai;
    this.element = def.element || 'physical';
    this.res = { ...(def.res || {}) };
    this.radius = 0.5 * rank.scale;

    // escala estilo D2
    const lifeScale = 1 + level * 0.40;
    const dmgScale = 1 + level * 0.32;
    this.maxLife = Math.round(def.baseLife * lifeScale * rank.lifeMul * difficulty.monsterLifeMul);
    this.life = this.maxLife;
    this.damage = Math.round(def.baseDamage * dmgScale * rank.dmgMul * difficulty.monsterDamageMul);
    this.xpReward = 0; // calculado no Game ao morrer
    this.moveSpeed = def.moveSpeed;
    this.attackSpeed = def.attackSpeed;
    this.range = def.range;
    this.dropMul = rank.dropMul;

    // imunidades aleatórias em dificuldades altas
    if (difficulty.immunityChance && rng.chance(difficulty.immunityChance)) {
      const el = rng.pick(['fire', 'cold', 'lightning']);
      this.res[el] = 1;
      this.immune = el;
    }

    // afixos de monstro (champion/unique)
    this.affixes = [];
    if (rank.id === 'unique') {
      const a1 = rng.pick(MONSTER_AFFIXES); a1.apply(this); this.affixes.push(a1.name);
      const a2 = rng.pick(MONSTER_AFFIXES); if (a2 !== a1) { a2.apply(this); this.affixes.push(a2.name); }
      this.name = def.name + ' ' + this.affixes.join(' ');
    } else if (rank.id === 'champion') {
      const a1 = rng.pick(MONSTER_AFFIXES); a1.apply(this); this.affixes.push(a1.name);
      this.name = 'Campeão ' + def.name;
    }

    // modelo
    const color = rank.color || def.color;
    const m = makeMonsterModel(def.shape || 'humanoid', { color, accent: 0x333333, scale: rank.scale });
    this.mesh = m.group;
    this.parts = m.parts;
    this.modelAnim = m.anim;
    // material próprio do "corpo" (o flash de dano não pode mutar o material em cache compartilhado)
    this.bodyMesh = m.body;
    this.bodyMesh.material = this.bodyMesh.material.clone();
    this._baseEmissive = this.bodyMesh.material.emissive.getHex();
    // HITBOX invisível e generosa para seleção/clique (envolve a figura cúbica)
    const hb = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.4, 1.4),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hb.position.y = 1.1;
    hb.userData.monster = this;
    this.mesh.add(hb);
    this.hitbox = hb;
    if (this.immune || rank.id !== 'normal') {
      // brilho leve para destacar elites
      const light = new THREE.PointLight(rank.color || 0xff8844, 0.6, 4);
      light.position.y = 1.5;
      this.mesh.add(light);
    }

    this.position = new THREE.Vector3();
    this.facing = 0;
    this.dead = false;
    this.attackCd = 0;
    this.attackAnim = 0;
    this.abilityCd = rng.range(2, 5);
    this.bossAbilities = opts.abilities || [];
    this.title = opts.title || null;
  }

  setPosition(x, z) { this.position.set(x, 0, z); this.mesh.position.copy(this.position); }

  update(game, dt, time) {
    if (this.dead) return;
    // sangramento (Ferida Aberta)
    if (this.bleedUntil && time < this.bleedUntil) {
      this.life -= (this.bleedDps || 0) * dt;
      if (this.life <= 0) { this.dead = true; game.onMonsterDeath(this, game.player); return; }
    }
    const p = game.player;
    // alvo: jogador ou companheiro (merc/invocação) mais próximo
    const tgt = pickMonsterTarget(game, this);
    this._tgt = tgt;
    const toPlayer = new THREE.Vector3().subVectors(tgt.position, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    this.facing = Math.atan2(toPlayer.x, toPlayer.z);
    // buff de matilha de monstro único (concedido a este monstro neste frame)
    const packed = !!(this._packBuffUntil && time < this._packBuffUntil);

    // status
    const stunned = this.stunUntil && time < this.stunUntil;
    let speed = this.moveSpeed * (packed ? 1.15 : 1);
    if (this.slowUntil && time < this.slowUntil) speed *= (1 - (this.slowAmt || 0.5));

    let moving = false;
    if (!stunned) {
      this.attackCd = Math.max(0, this.attackCd - dt);
      if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - dt * 4);

      const aggroRange = this.isBoss ? 40 : 22;
      if (dist < aggroRange) {
        if (this.ai === 'ranged' || this.ai === 'boss_ranged' || this.ai === 'boss_caster') {
          // mantém distância e atira
          if (dist > this.range) { this.moveToward(toPlayer, speed, dt); moving = true; }
          else if (dist < this.range * 0.5) { this.moveToward(toPlayer.clone().negate(), speed * 0.7, dt); moving = true; }
          if (this.attackCd <= 0 && dist <= this.range) this.rangedAttack(game);
        } else if (this.ai === 'exploder') {
          this.moveToward(toPlayer, speed, dt); moving = true;
          if (dist <= this.range) this.explode(game);
        } else if (this.ai === 'teleporter' || this.ai === 'boss_teleporter') {
          if (dist > 6 && this.attackCd <= 0) { this.teleportNear(game, tgt.ref); }
          else if (dist > this.range) { this.moveToward(toPlayer, speed, dt); moving = true; }
          else if (this.attackCd <= 0) this.meleeAttack(game);
        } else { // melee / boss_melee
          if (dist > this.range) { this.moveToward(toPlayer, speed, dt); moving = true; }
          else if (this.attackCd <= 0) this.meleeAttack(game);
        }

        // habilidades de boss + FÚRIA em vida baixa (estilo D2)
        if (this.isBoss) {
          this.abilityCd -= dt;
          if (this.abilityCd <= 0) { this.useBossAbility(game); this.abilityCd = 5; }
          if (!this.enraged && this.life < this.maxLife * 0.33) {
            this.enraged = true;
            this.moveSpeed *= 1.4; this.attackSpeed *= 1.4; this.damage = Math.round(this.damage * 1.4);
            this._baseEmissive = 0x550000; // brilho vermelho permanente
            game.log(`🔥 ${this.name} entrou em FÚRIA!`, 'unique');
          }
        }
      }
    }

    // aura de matilha: monstro único/super-único reforça aliados próximos
    if ((this.rank.id === 'unique' || this.superUnique) && !this.dead) {
      for (const o of game.monsters) {
        if (o === this || o.dead) continue;
        if (o.position.distanceTo(this.position) < 6) o._packBuffUntil = time + 0.4;
      }
    }

    // efeito de flash ao tomar dano (restaura o emissivo base do corpo)
    if (this._hitFlash > 0) {
      this._hitFlash -= dt;
      this.bodyMesh.material.emissive.setHex(0x660000);
    } else {
      this.bodyMesh.material.emissive.setHex(this._baseEmissive);
    }

    this.modelAnim(this.parts, time + this.position.x, moving, this.attackAnim);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.facing;
  }

  moveToward(dir, speed, dt) {
    const d = dir.clone().setY(0);
    if (d.lengthSq() < 0.0001) return;
    d.normalize();
    this.position.addScaledVector(d, speed * dt);
  }

  _dmgOut(game) {
    return this.damage * (this._packBuffUntil && game.time < this._packBuffUntil ? 1.25 : 1);
  }

  meleeAttack(game) {
    this.attackCd = 1 / this.attackSpeed;
    this.attackAnim = 1;
    const tgt = this._tgt || { isPlayer: true, ref: game.player, position: game.player.position };
    if (this.position.distanceTo(tgt.position) <= this.range + 0.5) {
      if (tgt.isPlayer) applyDamageToPlayer(game, this._dmgOut(game), this.element, { slow: this.applySlow ? 0.4 : 0 }, this);
      else applyDamageToCompanion(game, tgt.ref, this._dmgOut(game), this.element);
    }
  }

  rangedAttack(game) {
    this.attackCd = 1 / this.attackSpeed;
    this.attackAnim = 1;
    const tgt = this._tgt || { position: game.player.position };
    const origin = this.position.clone().setY(1.0);
    const dir = new THREE.Vector3().subVectors(tgt.position, origin).setY(0).normalize();
    spawnProjectile(game, { origin, dir, speed: 14, range: this.range + 4, damage: this._dmgOut(game), element: this.element, owner: 'monster', slow: this.applySlow ? 0.4 : 0 });
  }

  explode(game) {
    if (this._exploded) return;
    this._exploded = true;
    this.dead = true;
    novaBurst(game, this.position.clone(), 2.6, this.damage * 1.6, 'fire', 0, 'monster');
    game.onMonsterDeath(this, null);
  }

  teleportNear(game, p) {
    this.attackCd = 2;
    const ang = game.rng.range(0, Math.PI * 2);
    this.position.set(p.position.x + Math.cos(ang) * 2.2, 0, p.position.z + Math.sin(ang) * 2.2);
    this.meleeAttack(game);
  }

  useBossAbility(game) {
    const ab = this.bossAbilities[Math.floor(game.rng.next() * this.bossAbilities.length)];
    const p = game.player;
    switch (ab) {
      case 'summon_zombies': case 'summon_endermites': case 'summon_minions':
        game.spawnMinions(this, 3);
        game.log(`${this.name} invoca lacaios!`, 'rare');
        break;
      case 'slam': case 'flame_nova':
        novaBurst(game, this.position.clone(), 5, this.damage * 1.5, this.element, 0.3, 'monster');
        break;
      case 'fire_rain': case 'meteor_storm':
        for (let i = 0; i < 5; i++) {
          const tp = p.position.clone().add(new THREE.Vector3(game.rng.range(-5, 5), 0, game.rng.range(-5, 5)));
          game.delayedMeteor(tp, this.damage * 1.2, this.element);
        }
        game.log(`${this.name} invoca uma tempestade!`, 'rare');
        break;
      case 'wither_skulls': case 'teleport_strike':
        for (let i = 0; i < 3; i++) {
          const origin = this.position.clone().setY(1.2);
          const a = (i - 1) * 0.3;
          const dir = new THREE.Vector3().subVectors(p.position, origin).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
          spawnProjectile(game, { origin, dir, speed: 16, range: 20, damage: this.damage, element: this.element, owner: 'monster' });
        }
        break;
      case 'stampede':
        this.moveSpeed *= 1.5;
        break;
    }
  }
}

// fábrica
export function makeMonster(typeId, level, rankId, difficulty, rng) {
  const def = MONSTER_TYPES[typeId];
  const rank = MONSTER_RANKS[rankId] || MONSTER_RANKS.normal;
  return new Monster(def, level, rank, difficulty, rng);
}

export function makeBoss(bossId, level, difficulty, rng) {
  const bd = BOSSES[bossId];
  // boss usa def própria (que se parece com um MONSTER_TYPE); herda a forma do seu tipo
  const def = { ...bd, baseLife: bd.baseLife, baseDamage: bd.baseDamage, shape: (MONSTER_TYPES[bd.type] && MONSTER_TYPES[bd.type].shape) || 'humanoid' };
  const rank = MONSTER_RANKS.boss;
  const m = new Monster(def, level, rank, difficulty, rng, { abilities: bd.abilities, title: bd.title });
  m.bossId = bossId;
  m.name = bd.name;
  return m;
}
