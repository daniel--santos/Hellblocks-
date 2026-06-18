// Cidades FIXAS de cada ato (como em Diablo II): layout determinístico por ato.
// Cada cidade tem praça segura, NPCs, waypoint, portal para a selva e (secret) portal do Cow Level.
import * as THREE from 'three';
import { box, makeHumanoid, makeProp } from '../core/blocks.js';
import { RNG } from '../core/rng.js';

function npc(color, x, z, name) {
  const m = makeHumanoid({ color, accent: 0x553311, scale: 1.0 });
  m.group.position.set(x, 0, z);
  m.group.userData.npcName = name;
  return m.group;
}

function portalFrame(x, z, color) {
  const g = new THREE.Group();
  const a = box(0.3, 3, 0.3, 0x222233, color);
  a.position.set(-0.9, 1.5, 0);
  const b = a.clone(); b.position.x = 0.9;
  const top = box(2.1, 0.3, 0.3, 0x222233, color); top.position.y = 3;
  const inner = box(1.5, 2.6, 0.1, color, color);
  inner.position.y = 1.4;
  inner.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
  const light = new THREE.PointLight(color, 1.2, 8);
  light.position.y = 1.6;
  g.add(a, b, top, inner, light);
  g.position.set(x, 0, z);
  return g;
}

// Constrói a cidade fixa de um ato. Retorna a "zona" usada pelo Game.
export function buildTown(act) {
  const group = new THREE.Group();
  const pal = act.palette;

  // chão da cidade — pedregulho
  const floor = box(40, 0.4, 40, 0x6a6a6a);
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  group.add(floor);

  // praça central mais clara
  const plaza = box(14, 0.5, 14, 0x8a8a8a);
  plaza.position.y = -0.18;
  group.add(plaza);

  // muralha de blocos em volta (estética, não bloqueia)
  for (let i = -20; i <= 20; i += 2) {
    for (const [x, z] of [[i, -20], [i, 20], [-20, i], [20, i]]) {
      const w = box(2, 3, 2, pal.accent);
      w.position.set(x, 1.3, z);
      group.add(w);
    }
  }

  // NPCs fixos (interativos)
  const smith = npc(0x886644, -5, -4, 'Ferreiro');
  const healer = npc(0x447788, 5, -4, 'Curandeira');
  const merchant = npc(0x778844, 0, 6, 'Mercador');
  group.add(smith, healer, merchant);
  // placas de identificação
  const sign = (x, z, text, color) => { const s = box(0.9, 0.5, 0.1, color, color); s.position.set(x, 2.4, z); group.add(s); };
  sign(-5, -4, 'F', 0xaa8844); sign(5, -4, 'C', 0x4488aa); sign(0, 6, 'M', 0x88aa44);

  // Waypoint (pad azul brilhante)
  const wp = new THREE.Group();
  const pad = box(2.4, 0.3, 2.4, 0x2244aa, 0x1133aa);
  pad.position.y = 0.1;
  const wpLight = new THREE.PointLight(0x3366ff, 1.5, 10);
  wpLight.position.y = 1;
  wp.add(pad, wpLight);
  wp.position.set(-8, 0, 8);
  group.add(wp);

  // Portal para a selva (saída do ato)
  const exitPortal = portalFrame(8, -8, new THREE.Color(pal.accent).getHex());
  group.add(exitPortal);

  // Portal SECRETO do Cow Level — escondido num canto, com vaca de pedra
  const cowShrine = new THREE.Group();
  const cowStatue = makeProp('rock');
  cowStatue.position.set(0, 0, 0);
  const cowPortal = portalFrame(0, 0, 0x66ff66);
  const cowSign = box(1, 0.8, 0.1, 0xffffff);
  cowSign.position.set(0, 2, 0.6);
  cowShrine.add(cowStatue, cowPortal, cowSign);
  cowShrine.position.set(-15, 0, -15);
  group.add(cowShrine);

  // alguns props do bioma para ambientação
  const rng = new RNG(act.id * 777);
  for (let i = 0; i < 12; i++) {
    const prop = makeProp(pal.prop, rng);
    const ang = rng.range(0, Math.PI * 2);
    const r = rng.range(12, 18);
    prop.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    group.add(prop);
  }

  const V3 = (x, z) => new THREE.Vector3(x, 0, z);
  const interactables = [
    { type: 'npc', role: 'smith', name: 'Ferreiro', mesh: smith, position: V3(-5, -4) },
    { type: 'npc', role: 'healer', name: 'Curandeira', mesh: healer, position: V3(5, -4) },
    { type: 'npc', role: 'merchant', name: 'Mercador', mesh: merchant, position: V3(0, 6) },
    { type: 'waypoint', mesh: wp, position: V3(-8, 8), wpId: `town-${act.id}`, label: `${act.townName} (Ato ${act.id})`, actIndex: act.id - 1, isTown: true },
  ];

  return {
    type: 'town',
    name: act.townName,
    actId: act.id,
    group,
    palette: pal,
    spawns: [],            // cidade é segura, sem monstros
    waypoint: { x: -8, z: 8 },
    exits: [{ x: 8, z: -8, to: 'wilderness', label: 'Selva' }],
    cowPortal: { x: -15, z: -15 },
    interactables,
    playerStart: { x: 0, z: 0 },
  };
}
