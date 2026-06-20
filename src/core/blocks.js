// Construção de modelos low-poly "voxel" (estética Minecraft) a partir de caixas.
import * as THREE from 'three';

const materialCache = new Map();
export function blockMaterial(color, emissive = 0x000000) {
  const key = color + '_' + emissive;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshLambertMaterial({ color, emissive, flatShading: true }));
  }
  return materialCache.get(key);
}

export function box(w, h, d, color, emissive) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, blockMaterial(color, emissive));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Humanoide cúbico (estilo Steve): cabeça, torso, 2 braços, 2 pernas.
// escurece/clareia uma cor hex por um fator
function shade(hex, f) {
  const r = Math.min(255, Math.round((hex >> 16 & 255) * f));
  const g = Math.min(255, Math.round((hex >> 8 & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

// Humanoide cúbico estilo Minecraft (proporções "Steve") com cabelo, rosto, mãos e botas.
// mono=true -> figura toda da mesma cor (mobs uniformes: zumbi, esqueleto, etc.)
// Retorna { group, parts } com refs para animar a caminhada/ataque.
export function makeHumanoid({ color = 0x88aacc, accent = 0xffffff, scale = 1, weapon = null,
  skin = 0xd9a066, hair = 0x4a3324, mono = false } = {}) {
  const g = new THREE.Group();
  const headColor = mono ? color : skin;
  const sleeve = color;                          // mangas = cor do corpo
  const hand = mono ? shade(color, 0.85) : skin; // mãos
  const pants = mono ? shade(color, 0.8) : accent;
  const boot = shade(pants, 0.6);

  // ----- Cabeça -----
  const head = box(0.56, 0.56, 0.56, headColor);
  head.position.y = 1.74;
  g.add(head);
  // olhos (relativos à cabeça)
  const eyeWhiteL = box(0.13, 0.13, 0.04, mono ? shade(color, 1.4) : 0xf2f2f2);
  eyeWhiteL.position.set(-0.13, 0.03, 0.27); head.add(eyeWhiteL);
  const eyeWhiteR = eyeWhiteL.clone(); eyeWhiteR.position.x = 0.13; head.add(eyeWhiteR);
  const pupilL = box(0.06, 0.09, 0.03, 0x161616); pupilL.position.set(-0.13, 0.02, 0.30); head.add(pupilL);
  const pupilR = pupilL.clone(); pupilR.position.x = 0.13; head.add(pupilR);
  // boca
  const mouth = box(0.22, 0.04, 0.03, shade(headColor, 0.55)); mouth.position.set(0, -0.16, 0.29); head.add(mouth);
  // cabelo (topo + nuca) — só para personagens, não para mobs uniformes
  if (!mono) {
    const top = box(0.6, 0.14, 0.6, hair); top.position.set(0, 0.34, 0); head.add(top);
    const back = box(0.6, 0.4, 0.16, hair); back.position.set(0, 0.05, -0.23); head.add(back);
  }

  // ----- Torso -----
  const torso = box(0.62, 0.72, 0.3, color);
  torso.position.y = 1.16;
  g.add(torso);
  // cinto + detalhe de peito (acento)
  const belt = box(0.66, 0.1, 0.34, boot); belt.position.set(0, -0.3, 0); torso.add(belt);
  if (!mono) { const stripe = box(0.18, 0.5, 0.03, accent); stripe.position.set(0, 0.05, 0.16); torso.add(stripe); }

  // ----- Braços (grupos-pivô no ombro) -----
  const mkArm = (x) => {
    const arm = new THREE.Group();
    const sl = box(0.22, 0.5, 0.22, sleeve); sl.position.y = -0.25; arm.add(sl);
    const hd = box(0.24, 0.2, 0.24, hand); hd.position.y = -0.56; arm.add(hd);
    arm.position.set(x, 1.46, 0);
    g.add(arm);
    return arm;
  };
  const armL = mkArm(-0.43);
  const armR = mkArm(0.43);

  // ----- Pernas (grupos-pivô no quadril) -----
  const mkLeg = (x) => {
    const leg = new THREE.Group();
    const th = box(0.24, 0.56, 0.24, pants); th.position.y = -0.3; leg.add(th);
    const bt = box(0.26, 0.2, 0.3, boot); bt.position.set(0, -0.6, 0.03); leg.add(bt);
    leg.position.set(x, 0.78, 0);
    g.add(leg);
    return leg;
  };
  const legL = mkLeg(-0.16);
  const legR = mkLeg(0.16);

  // arma na mão direita
  let weaponMesh = null;
  if (weapon) {
    weaponMesh = makeWeapon(weapon);
    weaponMesh.position.set(0, -0.62, 0.12);
    armR.add(weaponMesh);
  }

  g.scale.setScalar(scale);
  return {
    group: g,
    parts: { head, torso, armL, armR, legL, legR, weaponMesh },
  };
}

// Aldeão (Villager) estilo Minecraft: cabeça grande com NARIZ comprido + monocelha,
// roupão longo até o chão (mais largo embaixo), braços cruzados na frente e a cor da
// profissão no avental. robe=cor do roupão, apron=faixa da profissão, skin=pele.
export function makeVillager({ robe = 0x7a6a55, apron = 0x3a2e1f, skin = 0xbd9b71, scale = 1.0 } = {}) {
  const g = new THREE.Group();
  const robeDk = shade(robe, 0.82);

  // ----- Roupão (corpo) — duas caixas: saia larga embaixo, torso em cima -----
  const skirt = box(0.74, 0.62, 0.58, robeDk); skirt.position.y = 0.43; g.add(skirt);
  const torso = box(0.62, 0.62, 0.5, robe); torso.position.y = 1.02; g.add(torso);
  // avental / faixa da profissão na frente
  const apronB = box(0.5, 0.92, 0.05, apron); apronB.position.set(0, 0.82, 0.28); g.add(apronB);
  const collar = box(0.62, 0.12, 0.52, shade(robe, 1.12)); collar.position.y = 1.3; g.add(collar);

  // ----- Cabeça grande -----
  const head = box(0.62, 0.62, 0.6, skin); head.position.y = 1.66; g.add(head);
  // NARIZ comprido (a marca do aldeão) — relativo à cabeça
  const nose = box(0.17, 0.4, 0.3, shade(skin, 0.88)); nose.position.set(0, -0.08, 0.37); head.add(nose);
  // monocelha (unibrow) escura
  const brow = box(0.5, 0.08, 0.05, 0x2e2016); brow.position.set(0, 0.12, 0.3); head.add(brow);
  // olhos
  const eyeL = box(0.12, 0.16, 0.04, 0xf3f3f3); eyeL.position.set(-0.18, -0.02, 0.305); head.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.18; head.add(eyeR);
  const pupL = box(0.07, 0.1, 0.03, 0x5a3a6a); pupL.position.set(-0.18, -0.02, 0.33); head.add(pupL);
  const pupR = pupL.clone(); pupR.position.x = 0.18; head.add(pupR);

  // ----- Braços cruzados na frente (pose clássica do aldeão) -----
  const mkArm = (x) => {
    const arm = box(0.18, 0.5, 0.22, robe);
    arm.position.set(x, 0.96, 0.12);
    arm.rotation.x = -0.5;            // inclina os antebraços para frente
    arm.rotation.z = x > 0 ? 0.32 : -0.32; // junta as mãos no centro
    g.add(arm);
    return arm;
  };
  mkArm(-0.34); mkArm(0.34);
  // mãos juntas na barriga
  const hands = box(0.3, 0.2, 0.22, skin); hands.position.set(0, 0.7, 0.34); g.add(hands);

  // ----- Pés saindo por baixo do roupão -----
  for (const fx of [-0.14, 0.14]) { const f = box(0.18, 0.12, 0.24, 0x2e241a); f.position.set(fx, 0.06, 0.06); g.add(f); }

  g.scale.setScalar(scale);
  return { group: g, parts: { head, nose, torso } };
}

// ---- Modelos de monstros NÃO-humanoides (estética cúbica Minecraft) ----
// Cada um retorna { group, parts, body, anim } onde body é o mesh do flash de dano
// e anim(parts, t, moving, attackPhase) anima.

function makeSpider({ color = 0x222222, scale = 1 } = {}) {
  const g = new THREE.Group();
  const abd = box(0.85, 0.5, 0.95, color); abd.position.set(0, 0.45, -0.3);
  const head = box(0.55, 0.5, 0.55, shade(color, 1.25)); head.position.set(0, 0.42, 0.45);
  g.add(abd, head);
  // olhos vermelhos brilhantes
  for (const sx of [-0.13, 0.13]) { const e = box(0.09, 0.09, 0.05, 0xff3322, 0x661010); e.position.set(sx, 0.5, 0.72); g.add(e); }
  // 8 pernas (4 por lado) como grupos-pivô
  const legs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const leg = new THREE.Group();
    const seg = box(0.62, 0.07, 0.07, shade(color, 0.8)); seg.position.x = side * 0.34; leg.add(seg);
    leg.position.set(side * 0.34, 0.45, 0.22 - i * 0.26);
    leg.rotation.z = side * -0.55;
    g.add(leg); legs.push(leg);
  }
  g.scale.setScalar(scale);
  return {
    group: g, body: abd, parts: { legs },
    anim: (parts, t, moving) => parts.legs.forEach((L, i) => { L.rotation.x = (moving ? Math.sin(t * 13 + i * 1.3) * 0.35 : Math.sin(t * 2 + i) * 0.06); }),
  };
}

function makeCreeper({ color = 0x4caf50, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = box(0.5, 1.05, 0.42, color); body.position.y = 0.95;
  const head = box(0.56, 0.56, 0.56, shade(color, 1.08)); head.position.y = 1.72;
  g.add(body, head);
  // rosto clássico do creeper (cubos escuros)
  const dk = shade(color, 0.25);
  for (const sx of [-0.14, 0.14]) { const e = box(0.13, 0.13, 0.04, dk); e.position.set(sx, 1.78, 0.29); g.add(e); }
  const m1 = box(0.12, 0.22, 0.04, dk); m1.position.set(0, 1.62, 0.29); g.add(m1);
  for (const sx of [-0.12, 0.12]) { const mm = box(0.12, 0.12, 0.04, dk); mm.position.set(sx, 1.55, 0.29); g.add(mm); }
  // 4 pernas curtas
  const legs = [];
  for (const [x, z] of [[-0.16, 0.16], [0.16, 0.16], [-0.16, -0.16], [0.16, -0.16]]) {
    const leg = new THREE.Group();
    const seg = box(0.22, 0.4, 0.22, shade(color, 0.85)); seg.position.y = -0.2; leg.add(seg);
    leg.position.set(x, 0.42, z); g.add(leg); legs.push({ leg, front: z > 0 });
  }
  g.scale.setScalar(scale);
  return {
    group: g, body, parts: { legs },
    anim: (parts, t, moving) => parts.legs.forEach((L) => { L.leg.rotation.x = (moving ? Math.sin(t * 9) * 0.5 * (L.front ? 1 : -1) : 0); }),
  };
}

function makeBlaze({ color = 0xffaa00, scale = 1 } = {}) {
  const g = new THREE.Group();
  const float = new THREE.Group(); float.position.y = 1.2; g.add(float);
  const core = box(0.5, 0.62, 0.5, color, 0x884400); float.add(core);
  for (const sx of [-0.13, 0.13]) { const e = box(0.1, 0.12, 0.04, 0x331100, 0x110800); e.position.set(sx, 0.05, 0.27); float.add(e); }
  const rods = new THREE.Group(); float.add(rods);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rod = box(0.12, 0.75, 0.12, shade(color, 1.05), 0x884400); rod.position.set(Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46); rods.add(rod); }
  const light = new THREE.PointLight(0xff8800, 1.1, 6); light.position.y = 1.2; g.add(light);
  g.scale.setScalar(scale);
  return {
    group: g, body: core, parts: { float, rods },
    anim: (parts, t) => { parts.rods.rotation.y = t * 1.6; parts.float.position.y = 1.2 + Math.sin(t * 3) * 0.12; },
  };
}

function makeGhast({ color = 0xf0f0f0, scale = 1 } = {}) {
  const g = new THREE.Group();
  const float = new THREE.Group(); float.position.y = 1.7; g.add(float);
  const body = box(1.3, 1.3, 1.3, color); float.add(body);
  const dk = 0x222222;
  for (const sx of [-0.32, 0.32]) { const e = box(0.18, 0.26, 0.05, dk); e.position.set(sx, 0.18, 0.66); float.add(e); }
  const mouth = box(0.5, 0.18, 0.05, dk); mouth.position.set(0, -0.32, 0.66); float.add(mouth);
  // tentáculos pendurados
  const tents = [];
  for (const x of [-0.4, 0, 0.4]) for (const z of [-0.4, 0, 0.4]) {
    const t = new THREE.Group();
    const seg = box(0.16, 0.62, 0.16, shade(color, 0.82)); seg.position.y = -0.31; t.add(seg);
    t.position.set(x, -0.65, z); float.add(t); tents.push(t);
  }
  g.scale.setScalar(scale);
  return {
    group: g, body, parts: { float, tents },
    anim: (parts, t) => { parts.float.position.y = 1.7 + Math.sin(t * 2) * 0.15; parts.tents.forEach((T, i) => { T.rotation.x = Math.sin(t * 3 + i) * 0.25; }); },
  };
}

function makeCow({ color = 0xffffff, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = box(1.15, 0.6, 0.6, color); body.position.set(0, 0.72, 0);
  g.add(body);
  // manchas escuras
  for (const [x, z] of [[0.25, 0.18], [-0.2, -0.15], [0.1, -0.2]]) { const sp = box(0.22, 0.04, 0.22, shade(color, 0.4)); sp.position.set(x, 1.03, z); g.add(sp); }
  const head = box(0.45, 0.45, 0.45, shade(color, 0.95)); head.position.set(0, 0.8, 0.6); g.add(head);
  const snout = box(0.32, 0.26, 0.2, 0xe7a9a9); snout.position.set(0, 0.7, 0.85); g.add(snout);
  for (const sx of [-0.16, 0.16]) { // chifres
    const h = box(0.08, 0.16, 0.08, 0xeeeac8); h.position.set(sx, 1.06, 0.55); g.add(h);
    const ear = box(0.12, 0.07, 0.1, shade(color, 0.8)); ear.position.set(sx * 1.6, 0.92, 0.55); g.add(ear);
    const eye = box(0.07, 0.07, 0.04, 0xcc2020, 0x440808); eye.position.set(sx, 0.86, 0.83); g.add(eye);
  }
  const legs = [];
  for (const [x, z] of [[-0.4, 0.2], [0.4, 0.2], [-0.4, -0.2], [0.4, -0.2]]) {
    const leg = new THREE.Group();
    const seg = box(0.16, 0.44, 0.16, shade(color, 0.7)); seg.position.y = -0.22; leg.add(seg);
    leg.position.set(x, 0.44, z); g.add(leg); legs.push({ leg, diag: (x < 0) === (z > 0) });
  }
  g.scale.setScalar(scale);
  return {
    group: g, body, parts: { legs },
    anim: (parts, t, moving) => parts.legs.forEach((L) => { L.leg.rotation.x = (moving ? Math.sin(t * 8 + (L.diag ? 0 : Math.PI)) * 0.5 : 0); }),
  };
}

// Dispatcher: cria o modelo certo conforme a "shape" do monstro.
export function makeMonsterModel(shape, opts = {}) {
  switch (shape) {
    case 'spider': return makeSpider(opts);
    case 'creeper': return makeCreeper(opts);
    case 'blaze': return makeBlaze(opts);
    case 'ghast': return makeGhast(opts);
    case 'cow': return makeCow(opts);
    default: {
      const m = makeHumanoid({ color: opts.color, accent: opts.accent || 0x333333, scale: opts.scale, mono: true, weapon: opts.weapon || null });
      return { group: m.group, parts: m.parts, body: m.parts.torso, anim: animateHumanoid };
    }
  }
}

export function makeWeapon(type) {
  const g = new THREE.Group();
  if (type === 'sword') {
    const blade = box(0.08, 0.7, 0.08, 0xd0d0e0, 0x222233);
    blade.position.y = -0.35;
    const guard = box(0.3, 0.08, 0.1, 0x8a6a30);
    g.add(blade, guard);
  } else if (type === 'staff') {
    const shaft = box(0.07, 1.0, 0.07, 0x7a4a20);
    shaft.position.y = -0.4;
    const orb = box(0.22, 0.22, 0.22, 0x66aaff, 0x2244aa);
    orb.position.y = 0.15;
    g.add(shaft, orb);
  } else if (type === 'bow') {
    // Arco low-poly: madeira em arco vertical que se curva para FRENTE (+z), aproximado
    // por segmentos ao longo de uma parábola, com a corda reta ligando as duas pontas.
    const wood = 0x9a6a2a, str = 0xf2ead2;
    const H = 0.56, bulge = 0.3, N = 9;
    for (let i = 0; i < N; i++) {
      const t = -1 + (2 * i) / (N - 1);          // -1 (ponta de baixo) .. +1 (ponta de cima)
      const seg = box(0.07, (2 * H) / N + 0.05, 0.05, wood);
      seg.position.set(0, t * H, bulge * (1 - t * t)); // y vertical, z arqueia pra frente
      seg.rotation.x = Math.atan2(-2 * bulge * t, H); // alinha o segmento à tangente da curva
      g.add(seg);
    }
    const string = box(0.016, 2 * H, 0.016, str); // corda reta, ligando as pontas
    g.add(string);
  }
  return g;
}

// Animação simples de caminhada/ataque para um humanoide.
export function animateHumanoid(parts, t, moving, attackPhase = 0) {
  if (moving) {
    const swing = Math.sin(t * 9) * 0.6;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
    parts.armL.rotation.x = -swing * 0.7;
    parts.armR.rotation.x = swing * 0.7;
  } else {
    parts.legL.rotation.x *= 0.8;
    parts.legR.rotation.x *= 0.8;
    parts.armL.rotation.x *= 0.8;
    parts.armR.rotation.x *= 0.8;
  }
  if (attackPhase > 0) {
    // attackPhase 1 -> 0
    parts.armR.rotation.x = -Math.sin(attackPhase * Math.PI) * 1.8;
  }
}

// WAYPOINT (portal de teleporte estilo Diablo II): base de pedra + dois pilares com
// runas, arco superior, um plano de portal azul brilhante e um orbe flutuante.
export function makeWaypoint() {
  const g = new THREE.Group();
  const base = box(2.8, 0.4, 2.8, 0x44485a); base.position.y = 0.2; g.add(base);
  const step = box(2.1, 0.3, 2.1, 0x565a6e); step.position.y = 0.5; g.add(step);
  for (const sx of [-0.95, 0.95]) {
    const pil = box(0.34, 2.8, 0.34, 0x6a6e88); pil.position.set(sx, 1.9, 0); g.add(pil);
    const rune = box(0.22, 0.22, 0.38, 0x55ddff, 0x2299cc); rune.position.set(sx, 1.9, 0); g.add(rune);
  }
  const arch = box(2.3, 0.34, 0.4, 0x6a6e88); arch.position.y = 3.35; g.add(arch);
  // plano de portal azul translúcido (a "porta" do waypoint)
  const portal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.12), new THREE.MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.6 }));
  portal.position.y = 2.0; g.add(portal);
  const orb = box(0.46, 0.46, 0.46, 0xaaf0ff, 0x66ccff); orb.position.y = 3.35; g.add(orb);
  const light = new THREE.PointLight(0x55ccff, 1.6, 12); light.position.y = 2.2; g.add(light);
  // waypoint NÃO é sólido: o jogador fica em cima dele para viajar (estilo D2)
  return g;
}

// Santuário (shrine) low-poly: pedestal + cristal flutuante brilhante.
export function makeShrine(color) {
  const g = new THREE.Group();
  const base = box(1.2, 0.4, 1.2, 0x555555);
  base.position.y = 0.2;
  const pillar = box(0.5, 1.2, 0.5, 0x777777);
  pillar.position.y = 1.0;
  const crystal = box(0.5, 0.7, 0.5, color, color);
  crystal.position.y = 2.0;
  crystal.material = new THREE.MeshBasicMaterial({ color });
  const light = new THREE.PointLight(color, 1.4, 7);
  light.position.y = 2.0;
  g.add(base, pillar, crystal, light);
  g.userData.crystal = crystal;
  g.userData.solid = true;
  return g;
}

// Baú (chest) low-poly.
export function makeChest() {
  const g = new THREE.Group();
  const body = box(1.0, 0.6, 0.7, 0x8a5a2a);
  body.position.y = 0.3;
  const lid = box(1.05, 0.25, 0.75, 0x6a4420);
  lid.position.y = 0.72;
  const lock = box(0.15, 0.2, 0.1, 0xffcc44, 0x886600);
  lock.position.set(0, 0.55, 0.38);
  g.add(body, lid, lock);
  g.userData.lid = lid;
  g.userData.solid = true;
  return g;
}

// Props de cenário low-poly por tipo de bioma.
export function makeProp(type, rng) {
  const g = new THREE.Group();
  switch (type) {
    case 'tree': {
      const trunk = box(0.4, 1.6, 0.4, 0x6a4a2a);
      trunk.position.y = 0.8;
      const leaves = box(1.6, 1.6, 1.6, 0x2e6a2e);
      leaves.position.y = 2.2;
      const leaves2 = box(1.1, 1.1, 1.1, 0x3a7a3a);
      leaves2.position.y = 3.1;
      g.add(trunk, leaves, leaves2);
      break;
    }
    case 'cactus': {
      const body = box(0.5, 2.0, 0.5, 0x3a7a3a);
      body.position.y = 1.0;
      const arm = box(0.3, 0.8, 0.3, 0x3a7a3a);
      arm.position.set(0.5, 1.2, 0);
      g.add(body, arm);
      break;
    }
    case 'mushroom': {
      const stem = box(0.3, 0.8, 0.3, 0xe0d0c0);
      stem.position.y = 0.4;
      const cap = box(1.0, 0.5, 1.0, 0xb03030);
      cap.position.y = 1.0;
      g.add(stem, cap);
      break;
    }
    case 'pillar': {
      const p = box(0.7, 3.0, 0.7, 0x5a2a2a, 0x200808);
      p.position.y = 1.5;
      g.add(p);
      break;
    }
    case 'wheat': {
      for (let i = 0; i < 4; i++) {
        const stalk = box(0.08, 0.7, 0.08, 0xd0c050);
        stalk.position.set((rng ? rng.range(-0.3, 0.3) : 0), 0.35, (rng ? rng.range(-0.3, 0.3) : 0));
        g.add(stalk);
      }
      break;
    }
    case 'rock': {
      const r = box(1.0, 0.8, 1.0, 0x6a6a6a);
      r.position.y = 0.4;
      g.add(r);
      break;
    }
  }
  if (type !== 'wheat') g.userData.solid = true; // colisão: props sólidos bloqueiam o jogador (trigo não)
  return g;
}
