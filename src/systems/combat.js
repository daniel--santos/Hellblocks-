// Sistema de combate: conjuração de skills, projéteis, dano elemental com resistências,
// crítico, roubo de vida, status (lentidão/atordoamento/queimadura) — lógica estilo Diablo II.
import * as THREE from 'three';
import { SKILLS } from '../data/skills.js';
import { skillStats } from './skilltree.js';

const ELEMENT_COLOR = {
  physical: 0xdddddd, fire: 0xff5522, cold: 0x66ccff, lightning: 0xffee44, magic: 0xcc66ff, poison: 0x66cc33,
};

function projMesh(element, size = 0.3) {
  const color = ELEMENT_COLOR[element] || 0xffffff;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  const light = new THREE.PointLight(color, 0.8, 4);
  m.add(light);
  return m;
}

// Flecha fina e alongada (haste + ponta + penas), com o eixo longo em +Z.
// updateProjectiles orienta o grupo via lookAt(pos+dir), então a flecha voa "de ponta".
function arrowMesh(element) {
  const color = ELEMENT_COLOR[element] || 0xffffff;
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.8), new THREE.MeshBasicMaterial({ color: 0x6a4a2a }));
  g.add(shaft);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.16), new THREE.MeshBasicMaterial({ color }));
  tip.position.z = 0.46; g.add(tip);
  // penas (fletching) na traseira, em cruz
  const flh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.14), new THREE.MeshBasicMaterial({ color }));
  flh.position.z = -0.34; g.add(flh);
  const flv = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.14), new THREE.MeshBasicMaterial({ color }));
  flv.position.z = -0.34; g.add(flv);
  const light = new THREE.PointLight(color, 0.5, 3); g.add(light);
  return g;
}

// ---------- Conjuração ----------
// Retorna true se conjurou (gastou mana / iniciou ação).
export function castSkill(game, caster, skillId, targetPoint) {
  const sk = SKILLS[skillId];
  if (!sk) return false;
  const stats = skillStats(caster, skillId);
  if (!stats) return false;

  // cooldown
  caster._cooldowns = caster._cooldowns || {};
  if (sk.cooldown && (caster._cooldowns[skillId] || 0) > 0) return false;

  // mana
  const mana = stats.mana || 0;
  if (caster.mana < mana) return false;
  caster.mana -= mana;
  if (sk.cooldown) caster._cooldowns[skillId] = sk.cooldown;

  const origin = caster.position.clone();
  origin.y = 1.2;
  const dir = new THREE.Vector3().subVectors(targetPoint, origin);
  dir.y = 0;
  if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
  dir.normalize();
  caster.facing = Math.atan2(dir.x, dir.z);

  const dmg = scaleSkillDamage(game, caster, stats.damage || 0);

  switch (sk.behavior) {
    case 'bolt': case 'arrow': case 'arrow_seek': {
      const count = stats.count || sk.projectiles || 1;
      const spread = sk.spread || 0;
      for (let i = 0; i < count; i++) {
        const a = spread ? (i - (count - 1) / 2) * (spread / Math.max(1, count - 1)) : 0;
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        spawnProjectile(game, {
          origin: origin.clone(), dir: d, speed: sk.speed || 22, range: sk.range || 16,
          damage: dmg, element: stats.element || 'physical', slow: stats.slow, owner: 'player',
          seek: sk.behavior === 'arrow_seek',
          arrow: sk.behavior === 'arrow' || sk.behavior === 'arrow_seek',
        });
      }
      break;
    }
    case 'bolt_aoe': case 'spiral': {
      spawnProjectile(game, {
        origin: origin.clone(), dir, speed: sk.speed || 16, range: sk.range || 14,
        damage: dmg, element: stats.element || 'magic', aoe: stats.radius || sk.aoe || 2.5,
        slow: stats.slow, owner: 'player', spiral: sk.behavior === 'spiral',
      });
      break;
    }
    case 'nova': {
      novaBurst(game, origin, stats.radius || 5, dmg, stats.element || 'cold', stats.slow, 'player');
      break;
    }
    case 'chain': {
      chainLightning(game, caster, targetPoint, dmg, stats.chains || 4);
      break;
    }
    case 'meteor': case 'trap': case 'sentry': {
      groundEffect(game, targetPoint.clone(), {
        damage: dmg, element: stats.element || 'fire', radius: stats.radius || sk.aoe || 3,
        delay: sk.delay || 0.6, behavior: sk.behavior, duration: sk.duration || 0,
      });
      break;
    }
    case 'melee': {
      caster.attackAnim = 1;
      meleeHit(game, caster, sk.range || 2.2, dmg, stats.element || 'physical', { stun: stats.stun, knockback: sk.knockback });
      // Vingança: adiciona gelo e raio ao mesmo golpe
      if (stats.extraElements) {
        meleeHit(game, caster, sk.range || 2.2, dmg, 'cold', { slow: 0.4 });
        meleeHit(game, caster, sk.range || 2.2, dmg, 'lightning', {});
      }
      break;
    }
    case 'teleport': {
      const tp = targetPoint.clone(); tp.y = 0;
      const from = caster.position.clone();
      const move = new THREE.Vector3().subVectors(tp, from); move.y = 0;
      const range = sk.range || 14;
      if (move.length() > range) move.setLength(range);
      spawnBurstFx(game, from.clone(), 1.4, 'lightning');
      caster.position.copy(from.add(move));
      caster.moveTarget = null; caster.attackTarget = null;
      spawnBurstFx(game, caster.position.clone(), 1.4, 'lightning');
      break;
    }
    case 'melee_multi': {
      caster.attackAnim = 1;
      const targets = monstersInRange(game, caster.position, sk.range || 2.4).slice(0, stats.hits || 2);
      for (const m of targets) applyDamage(game, m, dmg, stats.element || 'physical', caster);
      break;
    }
    case 'dash': {
      const tp = targetPoint.clone(); tp.y = 0;
      caster._dashTo = tp;
      caster.attackAnim = 1;
      meleeHit(game, caster, sk.range || 3, dmg, 'physical', {});
      break;
    }
    case 'summon': {
      if (game.spawnSummon) game.spawnSummon(sk, stats);
      break;
    }
    case 'buff': {
      caster.buffs = caster.buffs || {};
      caster.buffs.blockChance = stats.blockChance || 0;
      caster.buffs.blockUntil = game.time + (sk.duration || 30);
      game.log(`${sk.name} ativado!`, 'magic');
      break;
    }
    default: return false;
  }
  return true;
}

// dano da skill modificado por bônus do jogador (passivas/itens) e crítico
function scaleSkillDamage(game, caster, base) {
  if (!base) return 0;
  let dmg = base;
  if (caster.isPlayer) {
    const b = caster.bonuses || {};
    dmg *= (1 + (b.physDamagePart || 0));
    dmg *= (caster._damageMul || 1); // buff de Santuário de Combate
  }
  return dmg;
}

// distância de um ponto ao segmento (no plano XZ) — evita "tunneling" de projéteis rápidos
function segDistXZ(pt, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((pt.x - a.x) * dx + (pt.z - a.z) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(pt.x - (a.x + dx * t), pt.z - (a.z + dz * t));
}

// ---------- Projéteis ----------
export function spawnProjectile(game, opts) {
  const mesh = opts.arrow ? arrowMesh(opts.element) : projMesh(opts.element, opts.spiral ? 0.4 : 0.3);
  mesh.position.copy(opts.origin);
  if (opts.arrow) mesh.lookAt(opts.origin.x + opts.dir.x, opts.origin.y + opts.dir.y, opts.origin.z + opts.dir.z);
  game.scene.add(mesh);
  game.projectiles.push({
    mesh, pos: opts.origin.clone(), dir: opts.dir.clone(),
    speed: opts.speed, traveled: 0, range: opts.range,
    damage: opts.damage, element: opts.element, aoe: opts.aoe || 0,
    slow: opts.slow || 0, owner: opts.owner, seek: opts.seek || false,
    spiral: opts.spiral || false, spiralT: 0, hit: new Set(), arrow: opts.arrow || false,
    curse: opts.curse || false, manaBurn: opts.manaBurn || false, // únicos Malditos/Queima-Mana à distância
  });
}

export function updateProjectiles(game, dt) {
  const toRemove = [];
  for (const p of game.projectiles) {
    // teleguiado: ajusta direção para o monstro mais próximo
    if (p.seek && p.owner === 'player') {
      const m = nearestMonster(game, p.pos, 12);
      if (m) {
        const want = new THREE.Vector3().subVectors(m.position, p.pos); want.y = 0; want.normalize();
        p.dir.lerp(want, 0.15).normalize();
      }
    }
    let step = p.speed * dt;
    const prev = p.pos.clone(); // posição anterior (para colisão por varredura)
    if (p.spiral) {
      p.spiralT += dt * 6;
      const perp = new THREE.Vector3(-p.dir.z, 0, p.dir.x).multiplyScalar(Math.sin(p.spiralT) * 0.18);
      p.pos.addScaledVector(p.dir, step).add(perp);
    } else {
      p.pos.addScaledVector(p.dir, step);
    }
    p.traveled += step;
    p.mesh.position.copy(p.pos);
    // flechas apontam na direção do voo; bolts mágicos giram
    if (p.arrow) p.mesh.lookAt(p.pos.x + p.dir.x, p.pos.y + p.dir.y, p.pos.z + p.dir.z);
    else p.mesh.rotation.y += dt * 10;

    // colisão
    if (p.owner === 'player') {
      for (const m of game.monsters) {
        if (m.dead || p.hit.has(m)) continue;
        if (segDistXZ(m.position, prev, p.pos) < 1.0 + (m.radius || 0.5)) {
          if (p.aoe > 0) {
            novaBurst(game, p.pos.clone(), p.aoe, p.damage, p.element, p.slow, 'player');
          } else {
            applyDamage(game, m, p.damage, p.element, game.player, { slow: p.slow });
          }
          p.hit.add(m);
          if (p.aoe > 0 || !p.pierce) { toRemove.push(p); break; }
        }
      }
    } else {
      // projétil de monstro acerta o jogador OU um companheiro
      if (!p.hitPlayer) {
        if (segDistXZ(game.player.position, prev, p.pos) < 1.0) {
          // projétil NÃO é atacante p/ Espinhos (Espinhos é corpo-a-corpo, como no D2); maldição/queima vão por opts
          applyDamageToPlayer(game, p.damage, p.element, { slow: p.slow, curse: p.curse, manaBurn: p.manaBurn });
          p.hitPlayer = true; toRemove.push(p);
        } else {
          for (const c of companionsOf(game)) {
            if (segDistXZ(c.position, prev, p.pos) < 1.0) { applyDamageToCompanion(game, c, p.damage, p.element); p.hitPlayer = true; toRemove.push(p); break; }
          }
        }
      }
    }

    if (p.traveled >= p.range) toRemove.push(p);
  }
  for (const p of toRemove) removeProjectile(game, p);
}

function removeProjectile(game, p) {
  const i = game.projectiles.indexOf(p);
  if (i >= 0) game.projectiles.splice(i, 1);
  game.scene.remove(p.mesh);
  // a flecha é um Group (várias geometrias); o bolt é um Mesh único
  p.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}

// ---------- Explosões / áreas ----------
export function novaBurst(game, center, radius, damage, element, slow, owner) {
  // efeito visual
  spawnBurstFx(game, center, radius, element);
  if (owner === 'player') {
    for (const m of monstersInRange(game, center, radius)) {
      applyDamage(game, m, damage, element, game.player, { slow });
    }
  } else {
    if (center.distanceTo(game.player.position) <= radius) {
      applyDamageToPlayer(game, damage, element, { slow });
    }
    for (const c of companionsOf(game)) {
      if (center.distanceTo(c.position) <= radius) applyDamageToCompanion(game, c, damage, element);
    }
  }
}

export function groundEffect(game, pos, opts) {
  pos.y = 0.05;
  game.groundEffects = game.groundEffects || [];
  const ring = makeGroundRing(opts.radius || 2, opts.element);
  ring.position.copy(pos);
  game.scene.add(ring);
  game.groundEffects.push({
    pos, mesh: ring, ...opts, timer: opts.delay || 0, fired: false,
    age: 0, tickTimer: 0,
  });
}

export function updateGroundEffects(game, dt) {
  if (!game.groundEffects) return;
  const remove = [];
  for (const g of game.groundEffects) {
    g.age += dt;
    g.mesh.rotation.z += dt * 2;
    if (g.behavior === 'meteor') {
      g.timer -= dt;
      if (g.timer <= 0 && !g.fired) {
        g.fired = true;
        novaBurst(game, g.pos.clone(), g.radius, g.damage, g.element, 0, 'player');
        remove.push(g);
      }
    } else if (g.behavior === 'trap' || g.behavior === 'sentry') {
      g.tickTimer -= dt;
      if (g.tickTimer <= 0) {
        g.tickTimer = g.behavior === 'sentry' ? 0.7 : 1.0;
        const target = nearestMonster(game, g.pos, 12);
        if (target) {
          if (g.behavior === 'sentry') {
            spawnProjectile(game, { origin: g.pos.clone().setY(0.6), dir: new THREE.Vector3().subVectors(target.position, g.pos).setY(0).normalize(), speed: 24, range: 12, damage: g.damage, element: g.element, owner: 'player' });
          } else {
            novaBurst(game, g.pos.clone(), g.radius, g.damage, g.element, 0, 'player');
          }
        }
      }
      if (g.age >= (g.duration || 8)) remove.push(g);
    }
  }
  for (const g of remove) {
    game.scene.remove(g.mesh);
    const i = game.groundEffects.indexOf(g);
    if (i >= 0) game.groundEffects.splice(i, 1);
  }
}

export function chainLightning(game, caster, targetPoint, damage, chains) {
  let from = caster.position.clone().setY(0.8);
  const hit = new Set();
  let current = nearestMonster(game, targetPoint, 6) || nearestMonster(game, caster.position, 14);
  for (let i = 0; i < chains && current; i++) {
    drawBeam(game, from, current.position.clone().setY(0.8), 0xffee44);
    applyDamage(game, current, damage, 'lightning', game.player);
    hit.add(current);
    from = current.position.clone().setY(0.8);
    current = nearestMonster(game, from, 8, hit);
  }
}

// ---------- Melee ----------
function meleeHit(game, caster, range, damage, element, opts) {
  const targets = monstersInRange(game, caster.position, range);
  // só o(s) mais próximo(s) na direção
  let best = null, bd = Infinity;
  for (const m of targets) {
    const d = m.position.distanceTo(caster.position);
    if (d < bd) { bd = d; best = m; }
  }
  if (best) applyDamage(game, best, damage, element, caster, opts);
}

// ---------- Dano ----------
export function applyDamage(game, monster, amount, element, source, opts = {}) {
  if (monster.dead) return 0;
  let dmg = amount;

  // crítico do jogador (inclui aura do mercenário)
  if (source && source.isPlayer) {
    const crit = (source.bonuses?.critChance || 0) + (source._auraCrit || 0);
    if (game.rng.chance(crit)) { dmg *= 2; }
    // maestria elemental (passiva) amplia o dano do elemento
    const ele = source.bonuses?.eleDmg;
    if (ele && ele[element]) dmg *= (1 + ele[element]);
  }

  // shred de resistência por aura (Convicção)
  const shred = source && source.isPlayer ? (source.bonuses?.auraResShred || 0) : 0;

  // resistência do monstro ao elemento
  let resist = (monster.res && monster.res[element]) || 0;
  resist = Math.max(-0.5, resist - shred);
  if (resist >= 1) { game.floatText(monster.position, 'IMUNE', 'desc'); return 0; }
  dmg *= (1 - resist);

  dmg = Math.max(1, Math.round(dmg));
  monster.life -= dmg;

  // roubo de vida do jogador
  if (source && source.isPlayer && element === 'physical') {
    const leech = (source.bonuses?.lifeLeech || 0) / 100;
    if (leech > 0) healPlayer(game, dmg * leech);
  }

  game.floatText(monster.position, '' + dmg, 'dmg');

  // afixos de combate do jogador
  if (source && source.isPlayer) {
    const b = source.bonuses || {};
    // Golpe Esmagador: dano extra = fração da vida ATUAL do monstro
    if (b.crushingBlow && game.rng.chance(b.crushingBlow)) {
      const extra = Math.max(1, Math.round(monster.life * (monster.isBoss ? 0.10 : 0.25)));
      monster.life -= extra;
      game.floatText(monster.position, '💥' + extra, 'dmg');
    }
    // Ferida Aberta: sangramento (DoT) por alguns segundos
    if (b.openWounds && game.rng.chance(b.openWounds)) {
      monster.bleedUntil = game.time + 4;
      monster.bleedDps = Math.max(2, Math.round((source.derived?.weaponMax || 6) * 0.5));
    }
  }

  if (opts.slow) { monster.slowUntil = game.time + 1.5; monster.slowAmt = opts.slow; }
  if (opts.stun) { monster.stunUntil = game.time + opts.stun; }
  if (opts.knockback) {
    const kb = new THREE.Vector3().subVectors(monster.position, source.position).setY(0).normalize().multiplyScalar(opts.knockback);
    monster.position.add(kb);
  }
  monster._hitFlash = 0.12;

  if (monster.life <= 0) {
    monster.dead = true;
    game.onMonsterDeath(monster, source);
  }
  return dmg;
}

export function applyDamageToPlayer(game, amount, element, opts = {}, attacker = null) {
  const p = game.player;
  if (p.dead) return;
  // Espinhos: reflete dano físico ao atacante corpo-a-corpo
  if (attacker && !attacker.dead && (p.bonuses?.thorns || 0) > 0) {
    applyDamage(game, attacker, p.bonuses.thorns, 'physical', null);
  }
  // esquiva
  if (game.rng.chance(p.bonuses?.dodgeChance || 0)) { game.floatText(p.position, 'esquiva', 'desc'); return; }
  // bloqueio
  if (p.buffs && p.buffs.blockUntil > game.time && game.rng.chance(p.buffs.blockChance || 0)) {
    game.floatText(p.position, 'bloqueio', 'desc'); return;
  }
  let dmg = amount;
  // Maldição (Amplificar Dano): enquanto amaldiçoado, recebe mais dano de QUALQUER fonte
  if (p.curseUntil && p.curseUntil > game.time) dmg *= (1 + (p.curseAmp || 0.25));
  // redução física por defesa (aura Resistência + defesa de itens)
  if (element === 'physical') {
    const dr = Math.min(0.85, (p.bonuses?.auraDefense || 0) + (p.derived?.physReduction || 0) + (p._tempDefense || 0));
    dmg *= (1 - dr);
  } else {
    // resistência elemental (com penalidade da dificuldade) capada em 75%
    const res = game.resistFor(element);
    dmg *= (1 - res / 100);
  }
  dmg = Math.max(1, Math.round(dmg));
  p.life -= dmg;
  if (Math.random() < 0.12 && p.loseDurability) p.loseDurability('armor'); // desgaste da armadura
  game.floatText(p.position, '-' + dmg, 'dmg');
  // Queima de Mana: monstro único drena mana ao acertar (corpo-a-corpo via attacker, à distância via opts)
  if (((attacker && attacker.manaBurn) || opts.manaBurn) && p.mana > 0) {
    const burn = Math.min(p.mana, dmg);
    p.mana -= burn;
    game.floatText(p.position, '-' + Math.round(burn) + ' mana', 'magic');
  }
  // Maldito: aplica/renova Amplificar Dano (mostra o texto só quando ativa de novo)
  if ((attacker && attacker.curses) || opts.curse) {
    const wasCursed = p.curseUntil && p.curseUntil > game.time;
    p.curseUntil = game.time + 4; p.curseAmp = 0.25;
    if (!wasCursed) game.floatText(p.position, 'Maldição!', 'desc');
  }
  // lentidão/congelamento: anulada por "Não Pode Ser Congelado"; reduzida por Recuperação Rápida (FHR)
  if (opts.slow && !p.bonuses?.cannotFreeze) {
    p.slowUntil = game.time + 1.0 * (1 - (p.bonuses?.fhr || 0));
    p.slowAmt = opts.slow;
  }
  p._hitFlash = 0.12;
  if (p.life <= 0) { p.life = 0; game.onPlayerDeath(); }
}

export function healPlayer(game, amount) {
  const p = game.player;
  p.life = Math.min(p.maxLife, p.life + amount);
}

// ---------- Companheiros (mercenário / invocações) como alvos ----------
export function companionsOf(game) {
  const list = [];
  if (game.mercenary && !game.mercenary.dead) list.push(game.mercenary);
  for (const s of (game.summons || [])) if (!s.dead) list.push(s);
  return list;
}

// monstro escolhe alvo: jogador por padrão; companheiro só se nitidamente mais perto
export function pickMonsterTarget(game, monster) {
  let best = { position: game.player.position, isPlayer: true, ref: game.player };
  let bd = monster.position.distanceTo(game.player.position);
  for (const c of companionsOf(game)) {
    const d = monster.position.distanceTo(c.position);
    if (d < bd * 0.8) { bd = d; best = { position: c.position, isPlayer: false, ref: c }; }
  }
  return best;
}

export function applyDamageToCompanion(game, comp, amount, element) {
  if (!comp || comp.dead) return;
  const dmg = Math.max(1, Math.round(amount));
  comp.life -= dmg;
  comp._hitFlash = 0.12;
  game.floatText(comp.position, '-' + dmg, 'dmg');
  if (comp.life <= 0) {
    comp.dead = true;
    game.floatText(comp.position, '💀', 'desc');
    if (comp === game.mercenary) {
      if (comp.mesh) comp.mesh.visible = false; // some da tela ao morrer; reviveMercenary() reexibe na cidade
      game.log('Seu mercenário caiu! Reviva-o na cidade.', 'dmg');
    }
  }
}

// ---------- helpers de busca ----------
export function monstersInRange(game, pos, range) {
  return game.monsters.filter(m => !m.dead && m.position.distanceTo(pos) <= range + (m.radius || 0.5));
}
export function nearestMonster(game, pos, range, exclude) {
  let best = null, bd = range;
  for (const m of game.monsters) {
    if (m.dead || (exclude && exclude.has(m))) continue;
    const d = m.position.distanceTo(pos);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

// ---------- FX ----------
function spawnBurstFx(game, center, radius, element) {
  const color = ELEMENT_COLOR[element] || 0xffffff;
  const geo = new THREE.RingGeometry(0.1, radius, 24);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(center).setY(0.1);
  game.scene.add(ring);
  game.fx = game.fx || [];
  game.fx.push({ mesh: ring, age: 0, ttl: 0.4, type: 'expand', mat });
}

function makeGroundRing(radius, element) {
  const color = ELEMENT_COLOR[element] || 0xff5522;
  const geo = new THREE.RingGeometry(radius * 0.6, radius, 20);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function drawBeam(game, a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geo, mat);
  game.scene.add(line);
  game.fx = game.fx || [];
  game.fx.push({ mesh: line, age: 0, ttl: 0.2, type: 'fade', mat });
}

export function updateFx(game, dt) {
  if (!game.fx) return;
  const remove = [];
  for (const f of game.fx) {
    f.age += dt;
    const t = f.age / f.ttl;
    if (f.type === 'expand') { f.mesh.scale.setScalar(1 + t); f.mat.opacity = 0.7 * (1 - t); }
    if (f.type === 'fade') { f.mat.opacity = 1 - t; }
    if (f.age >= f.ttl) remove.push(f);
  }
  for (const f of remove) {
    game.scene.remove(f.mesh);
    const i = game.fx.indexOf(f);
    if (i >= 0) game.fx.splice(i, 1);
  }
}
