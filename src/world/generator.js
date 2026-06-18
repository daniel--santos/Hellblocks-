// Geração PROCEDURAL das zonas selvagens, arena de boss e Cow Level.
// Cidades são fixas (town.js); aqui tudo é gerado por seed (determinístico).
import * as THREE from 'three';
import { box, makeProp, makeShrine, makeChest } from '../core/blocks.js';
import { RNG, hashSeed } from '../core/rng.js';
import { effectiveAreaLevel } from '../systems/difficulty.js';
import { SHRINE_TYPES } from '../data/shrines.js';
import { SUPER_UNIQUES } from '../data/monsters.js';

// Espalha santuários e baús interativos pela zona, retornando a lista de interativos.
function scatterInteractables(group, rng, radius, areaLevel) {
  const interactables = [];
  const nShrines = rng.int(1, 3);
  for (let i = 0; i < nShrines; i++) {
    const st = rng.pick(SHRINE_TYPES);
    const x = rng.range(-radius + 4, radius - 4), z = rng.range(-radius + 4, radius - 4);
    if (Math.hypot(x, z) < 7) continue;
    const mesh = makeShrine(st.color);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    interactables.push({ type: 'shrine', shrine: st, mesh, position: mesh.position.clone(), used: false });
  }
  const nChests = rng.int(2, 4);
  for (let i = 0; i < nChests; i++) {
    const x = rng.range(-radius + 4, radius - 4), z = rng.range(-radius + 4, radius - 4);
    if (Math.hypot(x, z) < 6) continue;
    const mesh = makeChest();
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rng.range(0, Math.PI * 2);
    group.add(mesh);
    interactables.push({ type: 'chest', mesh, position: mesh.position.clone(), used: false, areaLevel });
  }
  return interactables;
}

function buildGround(rng, pal, radius) {
  const g = new THREE.Group();
  // chão base
  const base = box(radius * 2 + 8, 0.4, radius * 2 + 8, pal.ground);
  base.position.y = -0.2;
  base.receiveShadow = true;
  g.add(base);
  // manchas de cor alternada (textura voxel)
  const patches = Math.floor(radius * 2.2);
  for (let i = 0; i < patches; i++) {
    const s = rng.range(1.5, 4);
    const patch = box(s, 0.12, s, pal.groundAlt);
    patch.position.set(rng.range(-radius, radius), 0.02, rng.range(-radius, radius));
    patch.receiveShadow = true;
    g.add(patch);
  }
  // morros / formações de blocos
  for (let i = 0; i < radius / 2; i++) {
    const hx = rng.range(-radius, radius), hz = rng.range(-radius, radius);
    if (Math.hypot(hx, hz) < 6) continue; // longe do spawn
    const h = rng.int(1, 3);
    for (let y = 0; y < h; y++) {
      const blk = box(2, 1, 2, y === h - 1 ? pal.accent : pal.groundAlt);
      blk.position.set(hx, y + 0.5, hz);
      g.add(blk);
    }
  }
  return g;
}

function scatterProps(g, rng, pal, radius, count) {
  for (let i = 0; i < count; i++) {
    const x = rng.range(-radius, radius), z = rng.range(-radius, radius);
    if (Math.hypot(x, z) < 5) continue;
    const prop = makeProp(pal.prop, rng);
    prop.position.set(x, 0, z);
    prop.rotation.y = rng.range(0, Math.PI * 2);
    g.add(prop);
  }
}

// embaralha packs de monstros pela zona
function generatePacks(rng, monsterPool, radius, areaLevel, packCount) {
  const spawns = [];
  for (let i = 0; i < packCount; i++) {
    const cx = rng.range(-radius + 4, radius - 4);
    const cz = rng.range(-radius + 4, radius - 4);
    if (Math.hypot(cx, cz) < 8) continue; // não nasce em cima do jogador
    const packSize = rng.int(3, 6);
    // chance de pack de elite (champion/unique) — como D2
    const eliteRoll = rng.next();
    let packRank = 'normal';
    if (eliteRoll < 0.08) packRank = 'unique';
    else if (eliteRoll < 0.22) packRank = 'champion';

    const typeId = rng.pick(monsterPool);
    for (let j = 0; j < packSize; j++) {
      const ang = rng.range(0, Math.PI * 2);
      const r = rng.range(0.5, 3);
      spawns.push({
        x: cx + Math.cos(ang) * r,
        z: cz + Math.sin(ang) * r,
        typeId: rng.chance(0.7) ? typeId : rng.pick(monsterPool),
        rankId: j === 0 ? packRank : (packRank === 'unique' ? (rng.chance(0.5) ? 'champion' : 'normal') : 'normal'),
        level: areaLevel,
      });
    }
  }
  return spawns;
}

// Zona selvagem procedural. zoneIndex 0..n; a última leva à arena do boss.
export function buildWilderness(act, zoneIndex, difficulty, seedStr) {
  const seed = hashSeed(`${seedStr}-a${act.id}-z${zoneIndex}-${difficulty.id}`);
  const rng = new RNG(seed);
  const pal = act.palette;
  const radius = 32 + zoneIndex * 4;
  const areaLevel = effectiveAreaLevel(act.areaLevel + zoneIndex * 2, difficulty);

  const group = new THREE.Group();
  group.add(buildGround(rng, pal, radius));
  scatterProps(group, rng, pal, radius, Math.floor(radius * 1.5));

  const isLast = zoneIndex >= act.zones.length - 2;
  const packCount = 5 + zoneIndex * 2;
  const spawns = generatePacks(rng, act.monsterPool, radius, areaLevel, packCount);

  // saídas: entrada (volta) e próxima
  const exits = [];
  // portal de retorno para a cidade
  exits.push({ x: 0, z: radius - 3, to: 'town', label: 'Cidade', color: 0x66aaff });
  // próxima zona ou arena do boss
  const nextAng = rng.range(0, Math.PI * 2);
  const ex = Math.cos(nextAng) * (radius - 4);
  const ez = Math.sin(nextAng) * (radius - 4);
  if (isLast) {
    exits.push({ x: ex, z: ez, to: 'boss', label: `${act.name.split('—')[1]?.trim() || 'Boss'} (Boss)`, color: 0xff3333 });
  } else {
    exits.push({ x: ex, z: ez, to: 'wilderness', nextZone: zoneIndex + 1, label: act.zones[zoneIndex + 1] || 'Adiante', color: 0xffaa33 });
  }

  const interactables = scatterInteractables(group, rng, radius, areaLevel);

  // Super Único nomeado com matilha (chance), estilo D2
  let superUnique = null;
  const pool = SUPER_UNIQUES[act.id];
  if (pool && rng.chance(0.45)) {
    const def = rng.pick(pool);
    const sx = rng.range(-radius + 6, radius - 6), sz = rng.range(-radius + 6, radius - 6);
    superUnique = { name: def.name, typeId: def.typeId, x: sx, z: sz, level: areaLevel, minions: rng.int(3, 6) };
  }

  // waypoint ocasional (interativo: descobre e permite teleporte)
  const waypoint = rng.chance(0.6) ? { x: rng.range(-8, 8), z: rng.range(-8, 8) } : null;
  if (waypoint) {
    const wp = box(2.2, 0.3, 2.2, 0x2244aa, 0x1133aa);
    wp.position.set(waypoint.x, 0.1, waypoint.z);
    const l = new THREE.PointLight(0x3366ff, 1.2, 8); l.position.set(waypoint.x, 1, waypoint.z);
    group.add(wp, l);
    interactables.push({ type: 'waypoint', mesh: wp, position: new THREE.Vector3(waypoint.x, 0, waypoint.z), wpId: `wild-${act.id}-${zoneIndex}`, label: `${act.zones[zoneIndex]} (Ato ${act.id})`, actIndex: act.id - 1, zoneIndex });
  }

  return {
    type: 'wilderness', name: act.zones[zoneIndex] || 'Selva', actId: act.id, zoneIndex,
    group, palette: pal, areaLevel, spawns, exits, waypoint, radius, interactables, superUnique,
    playerStart: { x: 0, z: radius - 6 },
  };
}

// Arena do boss do ato.
export function buildBossArena(act, difficulty, seedStr) {
  const seed = hashSeed(`${seedStr}-a${act.id}-boss-${difficulty.id}`);
  const rng = new RNG(seed);
  const pal = act.palette;
  const radius = 24;
  const areaLevel = effectiveAreaLevel(act.areaLevel + 6, difficulty);

  const group = new THREE.Group();
  group.add(buildGround(rng, pal, radius));
  // arena: anel de pilares
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = box(1.4, 5, 1.4, pal.accent, 0x110000);
    p.position.set(Math.cos(a) * (radius - 3), 2.5, Math.sin(a) * (radius - 3));
    group.add(p);
  }
  scatterProps(group, rng, pal, radius - 6, 8);

  // guarda-costas do boss + boss
  const spawns = [];
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2);
    spawns.push({ x: Math.cos(a) * 6, z: Math.sin(a) * 6 - 6, typeId: rng.pick(act.monsterPool), rankId: 'normal', level: areaLevel });
  }

  return {
    type: 'boss', name: `${act.townName} — Covil`, actId: act.id, group, palette: pal, areaLevel, spawns,
    boss: { x: 0, z: -10, bossId: act.boss, level: areaLevel },
    exits: [{ x: 0, z: radius - 3, to: 'town', label: 'Cidade', color: 0x66aaff }],
    playerStart: { x: 0, z: radius - 6 },
  };
}

// Cow Level secreto — campo enorme cheio de vacas demoníacas + Rei das Vacas.
export function buildCowLevel(cowDef, difficulty, seedStr) {
  const seed = hashSeed(`${seedStr}-cow-${difficulty.id}`);
  const rng = new RNG(seed);
  const pal = cowDef.palette;
  const radius = 40;
  const areaLevel = effectiveAreaLevel(cowDef.areaLevel, difficulty);

  const group = new THREE.Group();
  group.add(buildGround(rng, pal, radius));
  scatterProps(group, rng, pal, radius, 120); // muito trigo

  const spawns = [];
  for (let i = 0; i < cowDef.cowCount; i++) {
    const ang = rng.range(0, Math.PI * 2);
    const r = rng.range(8, radius - 4);
    spawns.push({
      x: Math.cos(ang) * r, z: Math.sin(ang) * r,
      typeId: 'cow_hell', rankId: rng.chance(0.1) ? 'champion' : 'normal', level: areaLevel,
    });
  }

  return {
    type: 'cow', name: cowDef.name, group, palette: pal, areaLevel, spawns,
    boss: { x: 0, z: -14, bossId: cowDef.boss, level: areaLevel },
    exits: [{ x: 0, z: radius - 3, to: 'town', label: 'Cidade', color: 0x66aaff }],
    playerStart: { x: 0, z: radius - 6 },
  };
}
