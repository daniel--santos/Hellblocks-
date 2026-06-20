// Cidades FIXAS de cada ato (como em Diablo II): layout determinístico por ato.
// Ato I é uma VILA DE PLANÍCIE estilo Minecraft (casas, poço, postes, sino, fazenda);
// os NPCs de todas as cidades são ALDEÕES (villagers) com a cor da profissão.
import * as THREE from 'three';
import { box, makeVillager, makeProp, makeMonsterModel, makeWaypoint } from '../core/blocks.js';
import { RNG } from '../core/rng.js';

function shade(hex, f) {
  const r = Math.min(255, Math.round((hex >> 16 & 255) * f));
  const g = Math.min(255, Math.round((hex >> 8 & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

// look de aldeão por profissão (papel do NPC)
const VILLAGER_LOOK = {
  smith: { robe: 0x5a4a3a, apron: 0x2a2018, skin: 0xbd9b71 },   // ferreiro: avental de couro escuro
  healer: { robe: 0xe8e0d0, apron: 0x8a3a9a, skin: 0xc7a07a },  // curandeira: clérigo (manto roxo)
  merchant: { robe: 0x9a8a6a, apron: 0x356a86, skin: 0xbd9b71 },// mercador: avental azul (trader)
};

function npc(role, x, z, name) {
  const m = makeVillager(VILLAGER_LOOK[role] || {});
  m.group.position.set(x, 0, z);
  m.group.userData.npcName = name;
  m.group.rotation.y = Math.atan2(-x, -z); // vira para o centro da praça
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

// PORTÃO de saída na borda da vila: dois pilares de pedra, viga de madeira no topo,
// asas de cerca para os lados e o portal brilhante na abertura. Encara ±z (o jogador
// chega pela estrada vindo do centro). color = cor do portal (accent do ato).
function makeGate(x, z, color) {
  const g = new THREE.Group();
  for (const sx of [-1.5, 1.5]) {
    const post = box(0.45, 3.5, 0.45, 0x8a8278); post.position.set(sx, 1.75, 0); g.add(post);
    const cap = box(0.6, 0.3, 0.6, 0x6a6258); cap.position.set(sx, 3.55, 0); g.add(cap);
  }
  const lintel = box(3.8, 0.4, 0.55, 0x6b4f2a); lintel.position.set(0, 3.45, 0); g.add(lintel);
  const ridge = box(4.1, 0.24, 0.34, 0x5a3f22); ridge.position.set(0, 3.78, 0); g.add(ridge);
  // asas de cerca (limite da vila) para cada lado
  for (const dir of [-1, 1]) for (let i = 1; i <= 3; i++) {
    const fp = box(0.16, 1.0, 0.16, 0x5a3f22); fp.position.set(dir * (1.5 + i * 1.1), 0.5, 0); g.add(fp);
    const rail = box(1.1, 0.12, 0.12, 0x6b4f2a); rail.position.set(dir * (1.5 + i * 1.1 - 0.55), 0.72, 0); g.add(rail);
    const rail2 = rail.clone(); rail2.position.y = 0.4; g.add(rail2);
  }
  // portal brilhante na abertura (portalFrame já posiciona em 0,0 quando x=z=0)
  g.add(portalFrame(0, 0, color));
  g.position.set(x, 0, z);
  return g;
}

// ---------- Peças da vila de planície (Minecraft) ----------

// Casa: fundação de pedregulho, paredes claras, cantos de tronco, telhado de duas águas,
// porta e janelas. face = ângulo (rad) para onde a PORTA aponta.
function makeHouse(w, d, { wall = 0xcfc6ad, log = 0x6b4f2a, roof = 0x8a5630, h = 2.2, face = 0 } = {}) {
  const g = new THREE.Group();
  const base = box(w + 0.3, 0.3, d + 0.3, 0x787068); base.position.y = 0.15; g.add(base);
  const walls = box(w, h, d, wall); walls.position.y = 0.3 + h / 2; g.add(walls);
  // cantos de tronco
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = box(0.24, h + 0.1, 0.24, log); post.position.set(sx * w / 2, 0.3 + h / 2, sz * d / 2); g.add(post);
  }
  // vigas no topo das paredes
  const beamY = 0.3 + h;
  const beamX = box(w + 0.3, 0.18, 0.2, log); beamX.position.set(0, beamY, d / 2); g.add(beamX);
  const beamX2 = beamX.clone(); beamX2.position.z = -d / 2; g.add(beamX2);
  // telhado de duas águas (dois planos inclinados + cumeeira), beirais sobressaindo
  const slopeW = Math.max(w, d) * 0.78 + 0.5;
  const slopeL = box(w + 0.7, 0.16, slopeW, roof); slopeL.position.set(0, beamY + 0.5, -d * 0.26); slopeL.rotation.x = -0.72; g.add(slopeL);
  const slopeR = box(w + 0.7, 0.16, slopeW, roof); slopeR.position.set(0, beamY + 0.5, d * 0.26); slopeR.rotation.x = 0.72; g.add(slopeR);
  const ridge = box(w + 0.5, 0.2, 0.2, shade(roof, 0.8)); ridge.position.set(0, beamY + 0.95, 0); g.add(ridge);
  // porta (na face +z local) + maçaneta
  const door = box(0.72, 1.45, 0.14, 0x5a3a1a); door.position.set(0, 0.3 + 0.72, d / 2 + 0.04); g.add(door);
  const knob = box(0.08, 0.08, 0.08, 0xeecc55); knob.position.set(0.24, 0.3 + 0.72, d / 2 + 0.1); g.add(knob);
  // janelas de vidro nas laterais
  const mkWin = (sx) => { const wi = box(0.12, 0.55, 0.55, 0x9fd8e8, 0x224a55); wi.position.set(sx * (w / 2 + 0.02), 0.3 + h * 0.58, 0); g.add(wi); };
  mkWin(-1); mkWin(1);
  g.rotation.y = face;
  return g;
}

// Poço central da vila: anel de pedregulho, água, 4 postes e telhadinho.
function makeWell() {
  const g = new THREE.Group();
  const c = 0x808078;
  for (const [x, z, ww, dd] of [[0, -0.75, 1.7, 0.3], [0, 0.75, 1.7, 0.3], [-0.75, 0, 0.3, 1.7], [0.75, 0, 0.3, 1.7]]) {
    const wall = box(ww, 0.55, dd, c); wall.position.set(x, 0.45, z); g.add(wall);
  }
  const water = box(1.2, 0.2, 1.2, 0x3a6ad0, 0x0e2a6a); water.position.y = 0.32; g.add(water);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = box(0.18, 1.7, 0.18, 0x6b4f2a); p.position.set(sx * 0.72, 1.35, sz * 0.72); g.add(p); }
  const roofL = box(2.1, 0.16, 1.1, 0x8a5630); roofL.position.set(0, 2.35, -0.45); roofL.rotation.x = -0.7; g.add(roofL);
  const roofR = box(2.1, 0.16, 1.1, 0x8a5630); roofR.position.set(0, 2.35, 0.45); roofR.rotation.x = 0.7; g.add(roofR);
  return g;
}

// Poste-lanterna da vila (cerca + tocha). withLight controla a PointLight (limita custo).
function makeLamp(withLight = false) {
  const g = new THREE.Group();
  const post = box(0.16, 1.9, 0.16, 0x6b4f2a); post.position.y = 0.95; g.add(post);
  const cap = box(0.32, 0.16, 0.32, 0x5a3f22); cap.position.y = 1.95; g.add(cap);
  const torch = box(0.16, 0.22, 0.16, 0xffcc55, 0xff7700); torch.position.y = 2.12; g.add(torch);
  if (withLight) { const l = new THREE.PointLight(0xffaa44, 0.9, 8); l.position.y = 2.2; g.add(l); }
  return g;
}

// Sino da vila (ponto de encontro): dois postes, viga e sino dourado.
function makeBell() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) { const p = box(0.16, 1.9, 0.16, 0x6b4f2a); p.position.set(sx * 0.55, 0.95, 0); g.add(p); }
  const beam = box(1.4, 0.18, 0.2, 0x6b4f2a); beam.position.y = 1.92; g.add(beam);
  const bell = box(0.38, 0.44, 0.38, 0xe8c33a, 0x6a5210); bell.position.y = 1.52; g.add(bell);
  const cap = box(0.15, 0.14, 0.15, 0xaa8822); cap.position.y = 1.78; g.add(cap);
  return g;
}

// Fardo de feno.
function makeHay() {
  const g = new THREE.Group();
  const b = box(1.0, 0.9, 1.0, 0xc9b048); b.position.y = 0.45; g.add(b);
  const band = box(1.02, 0.12, 1.02, shade(0xc9b048, 0.7)); band.position.y = 0.45; g.add(band);
  return g;
}

// Fazenda cercada: terra arada, canal d'água e trigo.
function makeFarm() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const isWater = i === 2;
    const row = box(3.4, 0.16, 0.5, isWater ? 0x3a6ad0 : 0x6a4a2e, isWater ? 0x0e2a6a : 0);
    row.position.set(0, 0.09, -1.6 + i * 0.8); g.add(row);
    if (!isWater) for (let j = 0; j < 7; j++) { const wstalk = box(0.1, 0.5, 0.1, 0xc9c050); wstalk.position.set(-1.5 + j * 0.5, 0.34, -1.6 + i * 0.8); g.add(wstalk); }
  }
  // cerca em volta
  const fence = (x, z, ww, dd) => { const r = box(ww, 0.5, dd, 0x6b4f2a); r.position.set(x, 0.5, z); g.add(r); };
  fence(0, -2.2, 3.9, 0.12); fence(0, 2.2, 3.9, 0.12); fence(-1.95, 0, 0.12, 4.5); fence(1.95, 0, 0.12, 4.5);
  for (const [x, z] of [[-1.95, -2.2], [1.95, -2.2], [-1.95, 2.2], [1.95, 2.2]]) { const post = box(0.18, 1.0, 0.18, 0x5a3f22); post.position.set(x, 0.5, z); g.add(post); }
  return g;
}

// Forja do ferreiro: bigorna + bloco de lava ardente.
function makeForge() {
  const g = new THREE.Group();
  const block = box(1.0, 0.7, 1.0, 0x4a4a4a); block.position.y = 0.35; g.add(block);
  const lava = box(0.7, 0.16, 0.7, 0xff6a10, 0xff4400); lava.position.y = 0.74; g.add(lava);
  const anvilBase = box(0.5, 0.3, 0.3, 0x3a3a44); anvilBase.position.set(1.1, 0.15, 0); g.add(anvilBase);
  const anvilTop = box(0.8, 0.22, 0.42, 0x4a4a54); anvilTop.position.set(1.1, 0.42, 0); g.add(anvilTop);
  return g;
}

// Barraca de mercado (toldo) atrás do mercador.
function makeStall() {
  const g = new THREE.Group();
  for (const [x, z] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) { const p = box(0.14, 1.7, 0.14, 0x6b4f2a); p.position.set(x, 0.85, z); g.add(p); }
  const counter = box(2.2, 0.5, 0.5, 0x8a6a3a); counter.position.set(0, 0.7, 0.7); g.add(counter);
  // toldo listrado (vermelho/branco)
  const awn1 = box(2.4, 0.12, 1.7, 0xcc4040); awn1.position.set(0, 1.75, 0); g.add(awn1);
  for (let i = -1; i <= 1; i++) { const s = box(0.4, 0.13, 1.7, 0xf0f0f0); s.position.set(i * 0.8, 1.76, 0); g.add(s); }
  return g;
}

// Cerquinha decorativa baixa (uma seção).
function fenceSeg(x, z, len, horiz) {
  const g = new THREE.Group();
  const rail = box(horiz ? len : 0.1, 0.12, horiz ? 0.1 : len, 0x6b4f2a); rail.position.set(0, 0.7, 0); g.add(rail);
  const rail2 = rail.clone(); rail2.position.y = 0.4; g.add(rail2);
  const n = Math.max(2, Math.round(len / 1.2));
  for (let i = 0; i < n; i++) { const t = (i / (n - 1) - 0.5) * len; const p = box(0.14, 0.9, 0.14, 0x5a3f22); p.position.set(horiz ? t : 0, 0.45, horiz ? 0 : t); g.add(p); }
  g.position.set(x, 0, z);
  return g;
}

// ---------- Montagem da decoração ----------

// Vila de planície (Ato I): grama, caminhos, casas, poço, sino, postes, fazenda, animais.
function buildPlainsVillage(group, rng) {
  // chão de grama + remendos de terra
  const floor = box(44, 0.4, 44, 0x5f9a3c); floor.position.y = -0.2; floor.receiveShadow = true; group.add(floor);
  for (let i = 0; i < 10; i++) { const patch = box(rng.range(2, 4), 0.42, rng.range(2, 4), 0x57913a); patch.position.set(rng.range(-18, 18), -0.18, rng.range(-18, 18)); group.add(patch); }
  // caminhos de cascalho ligando os pontos principais
  const path = (x, z, w, d) => { const p = box(w, 0.42, d, 0x9b9388); p.position.set(x, -0.18, z); group.add(p); };
  path(0, 0, 3, 34); path(0, 0, 34, 3);     // cruz central
  path(-4, 4, 9, 2.2); path(4, -4, 9, 2.2); // diagonais p/ waypoint e portal (aprox.)
  // praça de terra batida sob o centro
  const plaza = box(9, 0.46, 9, 0xb8a98a); plaza.position.y = -0.17; group.add(plaza);

  // casas (a porta vira para o centro)
  makeHouseAt(group, -9, -8.5, 4.2, 4, { roof: 0x8a4f2a, face: Math.atan2(9, 8.5) });      // forja
  makeHouseAt(group, 9, -8.5, 4.2, 5, { roof: 0x6a4a8a, wall: 0xe6e0d2, h: 2.6, face: Math.atan2(-9, 8.5) }); // templo
  makeHouseAt(group, 0, 12, 5, 4, { roof: 0x9a6a30, face: Math.PI });                        // casa do mercado
  makeHouseAt(group, -13, 5, 3.6, 3.6, { roof: 0x7a5a30, face: Math.atan2(13, -5) });
  makeHouseAt(group, 13, 8, 4, 3.6, { roof: 0x8a5630, face: Math.atan2(-13, -8) });
  makeHouseAt(group, -7, 12, 3.4, 3.4, { roof: 0x6a4a2a, face: Math.PI });

  // forja perto do ferreiro; barraca perto do mercador
  const forge = makeForge(); forge.position.set(-7.2, 0, -6.2); group.add(forge);
  const stall = makeStall(); stall.position.set(0, 0, 8.4); stall.rotation.y = Math.PI; group.add(stall);

  // poço e sino centrais (fora do ponto de spawn 0,0)
  const well = makeWell(); well.position.set(-3.2, 0, 3.2); group.add(well);
  const bell = makeBell(); bell.position.set(3.2, 0, 3.4); group.add(bell);

  // postes-lanterna (só 3 com luz real, p/ não estourar o limite de luzes)
  const lampSpots = [[6, 6, true], [-6, -6, true], [6, -2, true], [-2, 7, false], [7, 9, false], [-10, -2, false], [10, 4, false]];
  for (const [x, z, lit] of lampSpots) { const lp = makeLamp(lit); lp.position.set(x, 0, z); group.add(lp); }

  // fazenda cercada + fardos de feno num canto
  const farm = makeFarm(); farm.position.set(13, 0, 13); group.add(farm);
  for (const [x, z] of [[9.5, 13.5], [10.6, 13.5], [10, 12.5]]) { const hay = makeHay(); hay.position.set(x, 0, z); group.add(hay); }

  // animais decorativos (vaca + ovelha) perto da fazenda
  const cow = makeMonsterModel('cow', { color: 0xf2ece0, scale: 0.85 }).group; cow.position.set(8, 0, 11); cow.rotation.y = -0.8; group.add(cow);
  const sheep = makeMonsterModel('cow', { color: 0xeeeeee, scale: 0.7 }).group; sheep.position.set(6.5, 0, 13); sheep.rotation.y = 0.5; group.add(sheep);

  // cercas baixas em volta da praça
  group.add(fenceSeg(-4.5, 6.5, 4, true), fenceSeg(4.5, 6.5, 4, true));

  // perímetro: árvores e arbustos (em vez de muralha de pedra)
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const r = rng.range(17, 20);
    const tx = Math.cos(ang) * r, tz = Math.sin(ang) * r;
    if (Math.abs(tx) < 4 && tz < -13) continue; // deixa livre a abertura do portão (norte)
    const tree = makeProp(rng.chance(0.7) ? 'tree' : 'rock', rng);
    tree.position.set(tx, 0, tz);
    group.add(tree);
  }
  for (let i = 0; i < 8; i++) { const bush = box(1.2, 0.8, 1.2, shade(0x2e6a2e, rng.range(0.9, 1.15))); bush.position.set(rng.range(-15, 15), 0.4, rng.range(-15, 15)); group.add(bush); }
  // flores de planície (vermelhas/amarelas) espalhadas pela grama
  const FLOWER = [0xd0402a, 0xe8c83a, 0xdadada, 0xd06ab0];
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-16, 16), z = rng.range(-16, 16);
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue; // não nasce na praça
    const stem = box(0.07, 0.4, 0.07, 0x3a7a3a); stem.position.set(x, 0.2, z); group.add(stem);
    const bloom = box(0.22, 0.18, 0.22, rng.pick(FLOWER)); bloom.position.set(x, 0.46, z); group.add(bloom);
  }
}

function makeHouseAt(group, x, z, w, d, opts) { const h = makeHouse(w, d, opts); h.position.set(x, 0, z); group.add(h); }

// Decoração genérica (Atos II–IV): praça de pedregulho + muralha + props do bioma.
function buildGenericTown(group, pal, rng) {
  const floor = box(40, 0.4, 40, 0x6a6a6a); floor.position.y = -0.2; floor.receiveShadow = true; group.add(floor);
  const plaza = box(14, 0.5, 14, 0x8a8a8a); plaza.position.y = -0.18; group.add(plaza);
  for (let i = -20; i <= 20; i += 2) for (const [x, z] of [[i, -20], [i, 20], [-20, i], [20, i]]) { const w = box(2, 3, 2, pal.accent); w.position.set(x, 1.3, z); group.add(w); }
  for (let i = 0; i < 12; i++) { const prop = makeProp(pal.prop, rng); const ang = rng.range(0, Math.PI * 2); const r = rng.range(12, 18); prop.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); group.add(prop); }
}

// Constrói a cidade fixa de um ato. Retorna a "zona" usada pelo Game.
export function buildTown(act) {
  const group = new THREE.Group();
  const pal = act.palette;
  const rng = new RNG(act.id * 777);

  if (act.id === 1) buildPlainsVillage(group, rng);
  else buildGenericTown(group, pal, rng);

  // NPCs ALDEÕES fixos (interativos)
  const smith = npc('smith', -5, -4, 'Ferreiro');
  const healer = npc('healer', 5, -4, 'Curandeira');
  const merchant = npc('merchant', 0, 6, 'Mercador');
  group.add(smith, healer, merchant);
  // plaquinhas de identificação em poste de madeira
  const sign = (x, z, text, color) => {
    const s = new THREE.Group();
    const post = box(0.12, 1.6, 0.12, 0x5a3f22); post.position.y = 0.8; s.add(post);
    const plank = box(0.8, 0.5, 0.1, 0x9a6a3a); plank.position.y = 1.7; s.add(plank);
    const tag = box(0.4, 0.3, 0.06, color, color); tag.position.set(0, 1.7, 0.08); s.add(tag);
    s.position.set(x, 0, z); group.add(s);
  };
  sign(-6.2, -4, 'F', 0xaa8844); sign(6.2, -4, 'C', 0x9a4aaa); sign(0, 7.4, 'M', 0x4a88aa);

  // Waypoint da cidade (portal de teleporte)
  const wp = makeWaypoint(); wp.position.set(-8, 0, 8); group.add(wp);

  // PORTÃO de saída para a selva — na borda da vila, no fim da estrada principal (norte)
  const exitGate = makeGate(0, -16, new THREE.Color(pal.accent).getHex());
  group.add(exitGate);

  // Portal SECRETO do Cow Level — escondido num canto, com pedra musgosa
  const cowShrine = new THREE.Group();
  const cowStatue = makeProp('rock'); cowStatue.position.set(0, 0, 0);
  const cowPortal = portalFrame(0, 0, 0x66ff66);
  const cowSign = box(1, 0.8, 0.1, 0xffffff); cowSign.position.set(0, 2, 0.6);
  cowShrine.add(cowStatue, cowPortal, cowSign);
  cowShrine.position.set(-15, 0, -15); group.add(cowShrine);

  const V3 = (x, z) => new THREE.Vector3(x, 0, z);
  const interactables = [
    { type: 'npc', role: 'smith', name: 'Ferreiro', mesh: smith, position: V3(-5, -4) },
    { type: 'npc', role: 'healer', name: 'Curandeira', mesh: healer, position: V3(5, -4) },
    { type: 'npc', role: 'merchant', name: 'Mercador', mesh: merchant, position: V3(0, 6) },
    { type: 'waypoint', mesh: wp, position: V3(-8, 8), wpId: `town-${act.id}`, label: `${act.townName} (Ato ${act.id})`, actIndex: act.id - 1, isTown: true, zoneType: 'town' },
  ];

  return {
    type: 'town',
    name: act.townName,
    actId: act.id,
    group,
    palette: pal,
    safe: true,            // perímetro seguro: monstros não entram na cidade
    spawns: [],            // cidade é segura, sem monstros
    waypoint: { x: -8, z: 8 },
    exits: [{ x: 0, z: -16, to: 'overworld', label: 'Selva' }],
    cowPortal: { x: -15, z: -15 },
    interactables,
    playerStart: { x: 0, z: 0 },
  };
}
