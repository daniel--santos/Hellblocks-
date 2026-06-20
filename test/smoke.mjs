// Smoke test de navegador headless: carrega o jogo no Chrome do sistema, captura erros
// de console/rede, inicia uma partida e verifica que o loop roda e mata um monstro.
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:5173/';

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + r.failure()?.errorText));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

// Espera a tela de título aparecer (loading -> title)
await page.waitForFunction(() => {
  const t = document.getElementById('title-screen');
  return t && !t.classList.contains('hidden');
}, { timeout: 15000 });
console.log('✓ Tela de título exibida (Three.js carregou, sem erro no bootstrap)');

// Confirma que as 3 classes renderizaram
const classCount = await page.$$eval('.class-card', els => els.length);
console.log(`✓ ${classCount} cards de classe renderizados`);
if (classCount !== 3) throw new Error('esperava 3 classes, obteve ' + classCount);

// Inicia a partida (classe padrão = Guardião, dificuldade Normal)
await page.click('#start-button');

// HUD deve aparecer e o loop deve estar rodando (player existe com vida)
await page.waitForFunction(() => {
  const g = window.__game;
  return g && g.running && g.player && g.player.maxLife > 0 && g.zone;
}, { timeout: 10000 });
const state = await page.evaluate(() => {
  const g = window.__game;
  return {
    cls: g.player.cls.name, life: g.player.maxLife, mana: g.player.maxMana,
    zone: g.zone.name, monsters: g.monsters.length, level: g.player.level,
    skillPoints: g.player.skillPoints,
  };
});
console.log('✓ Partida iniciada:', JSON.stringify(state));
if (state.zone == null) throw new Error('nenhuma zona carregada');

// Vai para a selva e confirma que monstros nascem
await page.evaluate(() => window.__game._goToWilderness(0));
await new Promise(r => setTimeout(r, 500));
const wild = await page.evaluate(() => ({ zone: window.__game.zone.name, monsters: window.__game.monsters.length }));
console.log('✓ Selva carregada:', JSON.stringify(wild));
if (wild.monsters < 1) throw new Error('selva sem monstros');

// Simula matar um monstro via combate e confirma XP/drops
const combatResult = await page.evaluate(async () => {
  const g = window.__game;
  const before = { xp: g.player.xp, ground: g.groundItems.length };
  const m = g.monsters.find(x => !x.dead);
  if (!m) return { ok: false, reason: 'sem monstro' };
  // posiciona o player ao lado e bate até morrer
  g.player.position.set(m.position.x + 1, 0, m.position.z);
  let guard = 0;
  while (!m.dead && guard++ < 500) {
    g._basicAttack(m); g.player._atkCd = 0;
  }
  return { ok: m.dead, xpGained: g.player.xp - before.xp, killed: m.name };
});
console.log('✓ Combate:', JSON.stringify(combatResult));
if (!combatResult.ok) throw new Error('não conseguiu matar o monstro: ' + combatResult.reason);

// Roda mais alguns frames para garantir que o loop não quebra após morte/drops
await new Promise(r => setTimeout(r, 800));
const final = await page.evaluate(() => ({ running: window.__game.running, monsters: window.__game.monsters.length, fps: 'ok' }));
console.log('✓ Loop estável pós-combate:', JSON.stringify(final));

// Testa aprender e CONJURAR uma skill (right-click), subir de nível e usar poção
const skillTest = await page.evaluate(() => {
  const g = window.__game;
  g.player.skillPoints = 5;
  g.tryLearnSkill('smite');                 // Guardião tier 1, sem prereq
  g.player.rightSkill = 'smite';
  const m = g.monsters.find(x => !x.dead);
  let castOk = false, err = null, manaBefore = g.player.mana;
  if (m) {
    g.player.position.set(m.position.x + 1, 0, m.position.z);
    g.player.mana = g.player.maxMana; manaBefore = g.player.mana; g.player._castCd = 0;
    try {
      g.input.rightHeld = true;
      g.input.mouseX = window.innerWidth / 2; g.input.mouseY = window.innerHeight / 2;
      g._processHeldInput(0.1);
      castOk = true;
    } catch (e) { err = e.message; }
    g.input.rightHeld = false;
  }
  return { learned: g.player.skillRanks['smite'], belt: g.player.beltSkills, castOk, err, manaSpent: +(manaBefore - g.player.mana).toFixed(1) };
});
console.log('✓ Skill aprendida e conjurada:', JSON.stringify(skillTest));
if (skillTest.err) throw new Error('conjuração lançou erro: ' + skillTest.err);
if (skillTest.learned !== 1 || !skillTest.belt.includes('smite')) throw new Error('skill não foi para a barra');

const prog = await page.evaluate(() => {
  const g = window.__game;
  const lvlBefore = g.player.level;
  g.player.gainXP(500000);     // força vários níveis
  g.player.life = 1;
  g._usePotion('life');
  return { lvlBefore, lvlAfter: g.player.level, lifeAfter: Math.round(g.player.life), maxLife: g.player.maxLife, statPoints: g.player.statPoints };
});
console.log('✓ Progressão (nível/poção):', JSON.stringify(prog));
if (prog.lvlAfter <= prog.lvlBefore) throw new Error('não subiu de nível com XP');
if (prog.lifeAfter <= 1) throw new Error('poção de vida não curou');

// ===== Refino D2: identificação, charms, economia, mercenário, santuário, baú, waypoint, portal =====
const refine = await page.evaluate(async () => {
  const g = window.__game;
  const out = {};
  // garante estar na selva (tem interativos)
  g._goToWilderness(0);
  await new Promise(r => setTimeout(r, 300));

  // Identificação
  const rare = { id: 'tst1', name: 'Item Teste', rarity: 'rare', slot: 'amulet', icon: '📿', reqLevel: 1, mods: { vit: 10 }, identified: false };
  g.player.inventory.push(rare);
  g.player.scrolls.id = 2;
  g.identify(rare);
  out.identified = rare.identified === true && g.player.scrolls.id === 1;

  // Charm passivo no inventário
  const vitBefore = g.player.effStats.vit;
  g.player.inventory.push({ id: 'tstc', name: 'Charm Teste', rarity: 'magic', slot: 'charm', icon: '🔸', reqLevel: 1, mods: { vit: 25 }, identified: true });
  g.player.recompute();
  out.charmWorks = g.player.effStats.vit === vitBefore + 25;

  // Economia: comprar consumível + apostar
  g.player.gold = 99999;
  const idBefore = g.player.scrolls.id, goldBefore = g.player.gold;
  g.buyConsumable('id');
  out.boughtScroll = g.player.scrolls.id === idBefore + 1 && g.player.gold < goldBefore;
  const invBefore = g.player.inventory.length;
  g.gamble();
  out.gambled = g.player.inventory.length === invBefore + 1;

  // Mercenário
  const merc = await import('http://localhost:5173/src/entities/mercenary.js');
  g.hireMercenary(merc.MERC_TYPES.rogue);
  out.mercHired = !!g.mercenary && !g.mercenary.dead && g.scene.children.includes(g.mercenary.mesh);

  // Santuário
  const shrine = g.interactables.find(it => it.type === 'shrine');
  if (shrine) { const b = g.activeBuffs.length; g._activateShrine(shrine); out.shrine = g.activeBuffs.length > b || shrine.used; }
  else out.shrine = 'sem santuário nesta seed';

  // Baú
  const chest = g.interactables.find(it => it.type === 'chest');
  if (chest) { const gi = g.groundItems.length; g._openChest(chest); out.chest = g.groundItems.length >= gi && chest.used; }
  else out.chest = 'sem baú';

  // Waypoint descoberto (entrou em cidade e selva)
  out.waypoints = g.waypointList.length;

  // Town Portal — verifica o MECANISMO do portal, não a sobrevivência ao loop de combate.
  // Sem garantir as pré-condições, um pack que apareça perto da entrada pode matar o jogador
  // durante o loop ao vivo, zerando g.running; aí _useTownPortal() vira no-op e o teste fica flaky.
  g.player.dead = false; g.running = true; g.player.life = g.player.maxLife;
  g.player.scrolls.tp = Math.max(1, g.player.scrolls.tp);
  g._useTownPortal();
  await new Promise(r => setTimeout(r, 250));
  out.tpToTown = g.zone.type === 'town' && !!g.returnPoint;
  return out;
});
console.log('✓ Refino D2:', JSON.stringify(refine));
for (const [k, v] of Object.entries(refine)) {
  if (v === false) throw new Error('refino falhou em: ' + k);
}

// ===== Save/Load · Requisitos · Durabilidade/Reparo · Rejuv · Aura ativa =====
const d2b = await page.evaluate(async () => {
  const g = window.__game; const out = {};

  // Requisito de Força bloqueia equipar
  const w = { id: 'rqw', name: 'Espada Pesada', rarity: 'normal', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: {}, baseStats: { dmgMin: 5, dmgMax: 10 }, reqStr: 9999 };
  g.player.inventory.push(w);
  const r1 = g.player.equip(w);
  w.reqStr = 1;
  const r2 = g.player.equip(w);
  out.reqBlocks = r1.ok === false && r2.ok === true;

  // Durabilidade: item quebrado perde bônus; reparo restaura
  const helm = { id: 'duh', name: 'Elmo Teste', rarity: 'magic', slot: 'helm', kind: 'helm', icon: '🪖', identified: true, mods: { str: 30 }, durability: { cur: 10, max: 10 }, reqStr: 0 };
  g.player.inventory.push(helm); g.player.equip(helm);
  const withItem = g.player.effStats.str;
  helm.durability.cur = 0; g.player.recompute();
  const broken = g.player.effStats.str;
  g.player.gold = 99999; g.player.repairAllItems();
  const repaired = g.player.effStats.str;
  out.durability = withItem > broken && repaired > broken && helm.durability.cur === helm.durability.max;

  // Poção de rejuvenescimento cura vida E mana
  g.player.life = 1; g.player.mana = 1; g.player.potions.rejuv = 1;
  g._usePotion('rejuv');
  out.rejuv = g.player.life > 1 && g.player.mana > 1 && g.player.potions.rejuv === 0;

  // Aura ativa única (Guardião)
  if (g.player.classId === 'guardian') {
    g.player.skillRanks.might = 10; g.player.activeAura = null; g.player.recompute();
    const off = g.player.derived.physMul;
    g.setActiveAura('might');
    const on = g.player.derived.physMul;
    out.aura = on > off && g.player.activeAura === 'might';
  } else out.aura = 'classe sem auras';

  // Save/Load roundtrip
  g.save();
  const SV = await import('http://localhost:5173/src/systems/save.js');
  const sd = SV.loadSaveData();
  out.save = SV.hasSave() && !!sd && sd.classId === g.player.classId && sd.level === g.player.level;
  return out;
});
console.log('✓ Save/Reqs/Durab/Rejuv/Aura:', JSON.stringify(d2b));
for (const [k, v] of Object.entries(d2b)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Set bonus · Afixos de combate · Equipar merc · Hardcore =====
const d2c = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};

  // Bônus de conjunto: 2 peças do "Traje do Minerador"
  const piece = (id, slot, icon) => ({ id, name: 'Minerador ' + slot, rarity: 'set', setName: 'Traje do Minerador', slot, kind: slot, icon, identified: true, mods: { defenseFlat: 10 } });
  delete p.equipment.helm; delete p.equipment.body; p.recompute();
  p.inventory.push(piece('ms1', 'helm', '⛑️')); p.inventory.push(piece('ms2', 'body', '🥼'));
  p.equip(p.inventory.find(x => x.id === 'ms1'));
  const oneRes = g.resistFor('fire');
  p.equip(p.inventory.find(x => x.id === 'ms2'));
  const twoRes = g.resistFor('fire');
  out.setBonus = twoRes > oneRes;

  // Afixos de combate nos bônus do jogador
  const gloves = { id: 'cbg', name: 'Luvas CB', rarity: 'rare', slot: 'gloves', kind: 'gloves', icon: '🧤', identified: true, mods: { crushingBlow: 0.5, openWounds: 0.5 } };
  p.inventory.push(gloves); p.equip(gloves);
  out.combatAffixes = p.bonuses.crushingBlow > 0 && p.bonuses.openWounds > 0;
  const bodyT = { id: 'tb', name: 'Peito Espinhoso', rarity: 'magic', slot: 'body', kind: 'body', icon: '🛡️', identified: true, mods: { thorns: 20 } };
  p.inventory.push(bodyT); p.equip(bodyT);
  out.thorns = p.bonuses.thorns === 20;

  // Equipar mercenário (arma aumenta o dano)
  if (!g.mercenary || g.mercenary.dead) { const M = await import('http://localhost:5173/src/entities/mercenary.js'); g.hireMercenary(M.MERC_TYPES.guard); }
  const dmgBefore = g.mercenary.damage;
  const mw = { id: 'mw1', name: 'Espada do Merc', rarity: 'normal', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: {}, baseStats: { dmgMin: 20, dmgMax: 40 } };
  p.inventory.push(mw); g.equipMerc(mw);
  out.mercEquip = g.mercenary.damage > dmgBefore && g.mercenary.gear.weapon === mw;

  // Hardcore: morte permanente apaga o save
  const SV = await import('http://localhost:5173/src/systems/save.js');
  const C = await import('http://localhost:5173/src/systems/combat.js');
  g.hardcore = true; g.save();
  const hadSave = SV.hasSave();
  p.dead = false; p.life = 1;
  C.applyDamageToPlayer(g, 99999, 'physical');
  out.hardcore = hadSave && !SV.hasSave() && p.dead === true;
  // restaura estado e save normal p/ os testes seguintes
  g.hardcore = false; p.dead = false; p.life = p.maxLife; g.running = true; g.input.setEnabled(true); g.save();
  return out;
});
console.log('✓ Set/Combate/Merc/Hardcore:', JSON.stringify(d2c));
for (const [k, v] of Object.entries(d2c)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Invocações · Quests · Perda de XP · FHR/Congelamento =====
const d2d = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const C = await import('http://localhost:5173/src/systems/combat.js');
  const D = await import('http://localhost:5173/src/systems/difficulty.js');

  // Invocação (Guardião → Espíritos)
  p.skillRanks.holy_spirits = 1; p.mana = p.maxMana;
  C.castSkill(g, p, 'holy_spirits', p.position.clone());
  out.summon = g.summons.length > 0 && g.scene.children.includes(g.summons[0].mesh);

  // Quest do Covil do Mal (Den of Evil, Ato I) concede +1 skill
  const spBefore = p.skillPoints;
  g.killCount = 99; g._checkQuest('kills');
  const denQ = (g.questLog || []).find(q => q.id === 'den_of_evil');
  out.quest = !!denQ && denQ.done && p.skillPoints > spBefore;

  // Recompensas icônicas: Larzuk (soquete grátis), Anya (+resist perm.), Pássaro Dourado (+vida perm.)
  const sockedBefore = [...Object.values(p.equipment), ...p.inventory].filter(it => it && it.sockets > 0).length;
  p.inventory.push({ id: 'qsk', name: 'Espada de Quest', rarity: 'normal', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: {} });
  g._grantReward({ socket: true });
  out.questSocket = [...Object.values(p.equipment), ...p.inventory].filter(it => it && it.sockets > 0).length > sockedBefore;
  const fireBefore = p.resBase.fire;
  g._grantReward({ resAll: 10 });
  out.questResist = p.questBonus.resAll === 10 && p.resBase.fire === fireBefore + 10;
  const lifeBefore = p.maxLife;
  g._grantReward({ lifeFlat: 20 });
  out.questLife = p.questBonus.lifeFlat === 20 && p.maxLife === lifeBefore + 20;

  // Perda de XP ao morrer em Pesadelo
  g.hardcore = false; g.difficultyObj = D.DIFFICULTIES.nightmare;
  p.dead = false; p.life = p.maxLife; p.xp += 100000;
  const xpBefore = p.xp; p.life = 1;
  C.applyDamageToPlayer(g, 99999, 'physical');
  out.xpLoss = p.xp < xpBefore;
  g.difficultyObj = D.DIFFICULTIES.normal; p.dead = false; p.life = p.maxLife; g.running = true; g.input.setEnabled(true);

  // Não Pode Ser Congelado anula a lentidão
  const ring = { id: 'cbfr', name: 'Anel CBF', rarity: 'magic', slot: 'ring', kind: 'ring', icon: '💍', identified: true, mods: { cannotFreeze: 1 } };
  p.inventory.push(ring); p.equip(ring);
  out.cbf = p.bonuses.cannotFreeze === true;
  p.slowUntil = 0;
  C.applyDamageToPlayer(g, 5, 'cold', { slow: 0.5 });
  out.cbfWorks = !(p.slowUntil > g.time);

  // restaura
  p.dead = false; p.life = p.maxLife; g.running = true;
  return out;
});
console.log('✓ Summon/Quest/XPloss/Freeze:', JSON.stringify(d2d));
for (const [k, v] of Object.entries(d2d)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Modificadores de monstro único: nova ao morrer · Maldição · Queima de Mana (ideia #2) =====
const d2mods = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const C = await import('http://localhost:5173/src/systems/combat.js');
  const M = await import('http://localhost:5173/src/entities/monster.js');
  g.running = true; p.dead = false; p.life = p.maxLife; p.mana = p.maxMana; p.curseUntil = 0; p.bonuses.lifePerKill = 0;

  // 1) Encantado-Fogo: o corpo explode em nova ao morrer (hook + dano de área)
  const fe = M.makeMonster('zombie', 5, 'unique', g.difficultyObj, g.rng);
  fe.deathNova = 'fire'; fe.damage = 60; fe.setPosition(p.position.x, p.position.z); g.monsters.push(fe);
  const fxB = (g.fx || []).length;
  const rngState = g.rng.state, groundLen = g.groundItems.length; // p/ desfazer efeitos colaterais
  fe.dead = true; g.onMonsterDeath(fe, p);              // morte real: dispara a nova + processa
  g.rng.state = rngState;                                // restaura o RNG (onMonsterDeath rola drops e mexe no stream)
  while (g.groundItems.length > groundLen) { const d = g.groundItems.pop(); if (d && d.mesh) g.scene.remove(d.mesh); }
  g.monsters = g.monsters.filter(x => x !== fe);        // limpa o monstro de teste (não polui blocos seguintes)
  out.deathNovaHook = (g.fx || []).length > fxB;        // a nova foi disparada pela morte
  p.dead = false; p.life = 100000;
  const lb = p.life; C.novaBurst(g, p.position.clone(), 3.2, 90, 'fire', 0, 'monster');
  out.deathNovaDamages = p.life < lb;                    // a nova fere quem está no raio

  // isola dos efeitos de itens (espinhos/esquiva/bloqueio) p/ medir os combates — SALVA e restaura no fim
  const _sv = { thorns: p.bonuses.thorns, dodge: p.bonuses.dodgeChance, buffs: p.buffs, td: p._tempDefense };
  p.bonuses.thorns = 0; p.bonuses.dodgeChance = 0; p.buffs = {}; p._tempDefense = 0; p.dead = false;

  // 2) Maldito: Amplificar Dano — enquanto amaldiçoado recebe mais dano
  p.curseUntil = 0; p.life = 100000; const b1 = p.life; C.applyDamageToPlayer(g, 200, 'physical'); const dN = b1 - p.life;
  p.curseUntil = g.time + 5; p.curseAmp = 0.25; p.life = 100000; const b2 = p.life; C.applyDamageToPlayer(g, 200, 'physical'); const dC = b2 - p.life;
  out.curseAmplifies = dC > dN;
  p.curseUntil = 0; p.life = 100000; C.applyDamageToPlayer(g, 50, 'physical', {}, { curses: true, dead: false });
  out.curseApplied = p.curseUntil > g.time;              // um monstro Maldito aplica a maldição ao acertar

  // 3) Queima de Mana: monstro único drena mana ao acertar
  p.mana = p.maxMana; const mB = p.mana; p.life = 100000;
  C.applyDamageToPlayer(g, 30, 'physical', {}, { manaBurn: true, dead: false });
  out.manaBurn = p.mana < mB;

  // restaura tudo que foi mexido (não polui blocos seguintes)
  p.bonuses.thorns = _sv.thorns; p.bonuses.dodgeChance = _sv.dodge; p.buffs = _sv.buffs; p._tempDefense = _sv.td;
  p.dead = false; p.life = p.maxLife; p.mana = p.maxMana; p.curseUntil = 0; p.curseAmp = 0; g.running = true;
  return out;
});
console.log('✓ Modificadores de monstro:', JSON.stringify(d2mods));
for (const [k, v] of Object.entries(d2mods)) if (v === false) throw new Error('modificadores falhou em: ' + k);

// ===== Companheiros como alvos · Respec · Aura de matilha =====
const d2e = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const C = await import('http://localhost:5173/src/systems/combat.js');
  const M = await import('http://localhost:5173/src/entities/monster.js');

  // garante mercenário vivo
  if (!g.mercenary || g.mercenary.dead) { const ME = await import('http://localhost:5173/src/entities/mercenary.js'); g.player.gold = 99999; g.hireMercenary(ME.MERC_TYPES.guard); }
  g.mercenary.dead = false; g.mercenary.life = g.mercenary.maxLife;

  // companheiro toma dano e pode morrer
  const before = g.mercenary.life;
  C.applyDamageToCompanion(g, g.mercenary, 20, 'physical');
  out.compDamage = g.mercenary.life < before;
  // monstro mira o companheiro quando está bem mais perto
  g.player.position.set(g.mercenary.position.x + 60, 0, g.mercenary.position.z);
  const fake = { position: g.mercenary.position.clone() };
  const tgt = C.pickMonsterTarget(g, fake);
  out.targetsComp = tgt.isPlayer === false && tgt.ref === g.mercenary;
  // companheiro morre
  g.mercenary.life = 1; C.applyDamageToCompanion(g, g.mercenary, 999, 'physical');
  out.compDies = g.mercenary.dead === true;
  // ao morrer, o modelo do mercenário some da tela; reviver na cidade reexibe
  out.mercDeadHidesMesh = g.mercenary.mesh.visible === false;
  g.player.gold = 99999; g.reviveMercenary();
  out.mercReviveShowsMesh = g.mercenary.mesh.visible === true && g.mercenary.dead === false;

  // aura de matilha: único reforça aliado próximo
  const uni = M.makeMonster('zombie', 5, 'unique', g.difficultyObj, g.rng);
  const min = M.makeMonster('zombie', 5, 'normal', g.difficultyObj, g.rng);
  uni.setPosition(0, 0); min.setPosition(1, 0);
  g.monsters.push(uni, min); g.scene.add(uni.mesh); g.scene.add(min.mesh);
  uni.update(g, 0.016, g.time);
  out.packAura = (min._packBuffUntil || 0) > g.time;
  uni.dead = true; min.dead = true;

  // Respec devolve pontos e zera skills/stats
  p.skillPoints = 0; p.skillRanks = { smite: 3 }; p.statPoints = 0;
  const baseStr = p.cls.baseStats.str; p.stats.str = baseStr + 10;
  p.gold = 99999;
  g.respec();
  out.respec = p.skillPoints >= 3 && p.statPoints >= 10 && Object.keys(p.skillRanks).length === 0 && p.stats.str === baseStr;

  return out;
});
console.log('✓ Companheiros/Respec/PackAura:', JSON.stringify(d2e));
for (const [k, v] of Object.entries(d2e)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Lore por ato · Sustain (vida por morte) · Aura de mercenário =====
const d2f = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const M = await import('http://localhost:5173/src/entities/monster.js');
  const ME = await import('http://localhost:5173/src/entities/mercenary.js');

  // Lore: ao (re)entrar num ato, mostra a narrativa
  g._questAct = -1; g._goToTown();
  const lore = document.getElementById('lore-screen');
  out.lore = !!lore && !lore.classList.contains('hidden') && /Ato/.test(lore.textContent);
  if (lore) { const b = lore.querySelector('#lore-cont'); if (b) b.click(); }

  // Sustain: Vida por Morte cura ao matar
  delete p.equipment.ring; delete p.equipment.ring2;
  const ring = { id: 'lpkr', name: 'Anel da Caçada', rarity: 'magic', slot: 'ring', kind: 'ring', icon: '💍', identified: true, mods: { lifePerKill: 50 } };
  p.inventory.push(ring); p.equip(ring);
  const fm = M.makeMonster('zombie', 5, 'normal', g.difficultyObj, g.rng);
  fm.setPosition(p.position.x, p.position.z);
  p.life = 10; const lifeB = p.life;
  g._onMonsterDeath(fm, p);
  out.sustain = p.life > lifeB;

  // Aura de mercenário: Guarda dá +15% dano (Vigor)
  if (g.mercenary) g.engine.scene.remove(g.mercenary.mesh);
  g.mercenary = new ME.Mercenary(ME.MERC_TYPES.guard, 10);
  g.engine.scene.add(g.mercenary.mesh);
  g.activeBuffs = [];
  g._updateBuffs();
  out.mercAura = p._damageMul >= 1.15 - 1e-6;

  return out;
});
console.log('✓ Lore/Sustain/MercAura:', JSON.stringify(d2f));
for (const [k, v] of Object.entries(d2f)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Players X · Maestria elemental · Skill no clique esquerdo =====
const d2g = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const C = await import('http://localhost:5173/src/systems/combat.js');
  const M = await import('http://localhost:5173/src/entities/monster.js');

  // Players X aumenta a vida dos monstros
  g.playersX = 1; const m1 = g._spawnFromDef({ typeId: 'zombie', level: 5, rankId: 'normal', x: 5, z: 5 });
  g.playersX = 5; const m5 = g._spawnFromDef({ typeId: 'zombie', level: 5, rankId: 'normal', x: 6, z: 6 });
  out.playersX = m5.maxLife > m1.maxLife;
  m1.dead = true; m5.dead = true; g.playersX = 1;

  // Maestria elemental amplia o dano do elemento (via combat.applyDamage)
  const mon = { dead: false, res: {}, position: p.position.clone(), life: 100000, maxLife: 100000 };
  const monB = { dead: false, res: {}, position: p.position.clone(), life: 100000, maxLife: 100000 };
  const srcMast = { isPlayer: true, position: p.position.clone(), bonuses: { eleDmg: { fire: 1.0 } } };
  const srcBase = { isPlayer: true, position: p.position.clone(), bonuses: { eleDmg: { fire: 0 } } };
  const dMast = C.applyDamage(g, mon, 100, 'fire', srcMast);
  const dBase = C.applyDamage(g, monB, 100, 'fire', srcBase);
  out.mastery = dMast > dBase;

  // Skill no clique esquerdo: define smite e o ataque básico passa a conjurá-la
  p.skillRanks.smite = p.skillRanks.smite || 1; p.mana = p.maxMana; p.leftSkill = 'smite'; p._atkCd = 0;
  const manaB = p.mana;
  const tm = M.makeMonster('zombie', 5, 'normal', g.difficultyObj, g.rng);
  tm.setPosition(p.position.x + 1, p.position.z); g.monsters.push(tm);
  g._basicAttack(tm);
  out.leftSkill = p.mana < manaB;
  tm.dead = true; p.leftSkill = 'attack';

  return out;
});
console.log('✓ PlayersX/Maestria/SkillEsq:', JSON.stringify(d2g));
for (const [k, v] of Object.entries(d2g)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Hitbox dos inimigos (seleção por clique tolerante) =====
const hit = await page.evaluate(async () => {
  const g = window.__game; const out = {};
  const THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  g._goToWilderness(0);
  await new Promise(r => setTimeout(r, 120));
  // isola um único monstro num ponto conhecido perto do jogador
  g.monsters.forEach(m => g.engine.scene.remove(m.mesh)); g.monsters = [];
  const mon = g._spawnFromDef({ typeId: 'zombie', level: 5, rankId: 'normal', x: g.player.position.x + 3, z: g.player.position.z + 1 });
  for (let i = 0; i < 30; i++) g.engine.follow(g.player.position); // converge a câmera no jogador
  const v = new THREE.Vector3(mon.position.x, 1.1, mon.position.z);
  v.project(g.engine.camera);
  const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
  out.center = g._pickMonsterAt(sx, sy) === mon;          // clique no centro
  // clique deslocado ~0.9 unidade do mundo (dentro da tolerância) — projeta em pixels (zoom-independente)
  const offW = new THREE.Vector3(mon.position.x + 0.8, 1.1, mon.position.z + 0.5); offW.project(g.engine.camera);
  const ox = (offW.x * 0.5 + 0.5) * window.innerWidth, oy = (-offW.y * 0.5 + 0.5) * window.innerHeight;
  out.offset = g._pickMonsterAt(ox, oy) === mon;
  out.miss = g._pickMonsterAt(sx + 400, sy) !== mon;       // longe não seleciona
  mon.dead = true;
  return out;
});
console.log('✓ Hitbox de seleção:', JSON.stringify(hit));
for (const [k, v] of Object.entries(hit)) if (v === false) throw new Error('hitbox falhou em: ' + k);

// ===== Stand Still (Shift): fica parado mas ataca =====
const ss = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const M = await import('http://localhost:5173/src/entities/monster.js');
  const V3 = p.position.constructor;
  // 1) Shift impede o movimento
  p.attackTarget = null; p.interactTarget = null; p.dead = false; g.running = true;
  p.position.set(0, 0, 0);
  p.moveTarget = new V3(20, 0, 0);
  g.input.shift = true;
  g._updatePlayerMovement(0.1);
  out.standStill = Math.hypot(p.position.x, p.position.z) < 0.01;
  // soltar Shift volta a andar
  g.input.shift = false;
  g._updatePlayerMovement(0.1);
  out.movesWhenReleased = Math.hypot(p.position.x, p.position.z) > 0.01;
  p.moveTarget = null;
  // 2) ataque parado acerta inimigo próximo sem mover
  p.position.set(0, 0, 0);
  const mon = M.makeMonster('zombie', 5, 'normal', g.difficultyObj, g.rng);
  mon.setPosition(1.5, 0); g.monsters.push(mon);
  const before = mon.life;
  g.input.shift = true; p._atkCd = 0;
  g._basicAttackToward(mon.position.clone());
  out.attackInPlace = mon.life < before && Math.hypot(p.position.x, p.position.z) < 0.01;
  mon.dead = true; g.input.shift = false;
  return out;
});
console.log('✓ Stand Still (Shift):', JSON.stringify(ss));
for (const [k, v] of Object.entries(ss)) if (v === false) throw new Error('stand-still falhou em: ' + k);

// ===== Imbuir · Hover de inimigo · Barra de boss · Charm único =====
const d2j = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const M = await import('http://localhost:5173/src/entities/monster.js');
  const L = await import('http://localhost:5173/src/systems/loot.js');

  // Imbuir: item normal de equipamento -> raro
  const norm = { id: 'imb1', name: 'Espada Normal', rarity: 'normal', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: {}, baseStats: { dmgMin: 5, dmgMax: 10 }, reqLevel: 1 };
  p.inventory.push(norm); p.gold = 999999; const goldB = p.gold;
  g.imbue(norm);
  const rare = p.inventory.find(it => it.slot === 'weapon' && it.rarity === 'rare');
  out.imbue = !!rare && !p.inventory.includes(norm) && p.gold < goldB;

  // Hover: nome/vida do inimigo sob o cursor
  const mon = M.makeMonster('zombie', 5, 'unique', g.difficultyObj, g.rng);
  mon.setPosition(p.position.x + 2, p.position.z); g.monsters.push(mon);
  g.input.mouseX = 120; g.input.mouseY = 120; g.hoverMonster = mon; g.ui.update(g);
  const hi = document.getElementById('hover-info');
  out.hover = hi.style.display === 'block' && hi.textContent.includes('Zumbi');

  // Barra de boss no topo
  const boss = M.makeBoss('rotjaw', 10, g.difficultyObj, g.rng); g.bossRef = boss; g.monsters.push(boss);
  g.hoverMonster = null; g.ui.update(g);
  const bb = document.getElementById('boss-bar');
  out.bossBar = bb.style.display === 'block' && bb.textContent.includes('Mandíbula');

  // Charm único Anihilus
  const ani = L.makeUnique('anihilus');
  out.uniqueCharm = !!ani && ani.slot === 'charm' && ani.rarity === 'unique' && ani.mods.allSkills > 0;

  mon.dead = true; boss.dead = true; g.bossRef = null; g.hoverMonster = null;
  return out;
});
console.log('✓ Imbuir/Hover/BossBar/Charm:', JSON.stringify(d2j));
for (const [k, v] of Object.entries(d2j)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Teleporte · Título de personagem =====
const d2k = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const C = await import('http://localhost:5173/src/systems/combat.js');
  const V3 = p.position.constructor;
  // Teleporte move o jogador para o ponto (dentro do alcance)
  p.skillRanks.teleport = 1; p.mana = p.maxMana; p.position.set(0, 0, 0);
  C.castSkill(g, p, 'teleport', new V3(8, 0, 0));
  out.teleport = Math.abs(p.position.x - 8) < 0.6 && Math.abs(p.position.z) < 0.6;
  // Título por dificuldade (Guardião, Pesadelo vencido => "Conde")
  g.titleRank = 2;
  out.title = g.playerTitle() === 'Conde';
  g.ui.update(g);
  out.titleHud = document.getElementById('difficulty-badge').textContent.includes('Conde');
  g.titleRank = 0;
  return out;
});
console.log('✓ Teleporte/Título:', JSON.stringify(d2k));
for (const [k, v] of Object.entries(d2k)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Fúria de boss em vida baixa =====
const d2l = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const M = await import('http://localhost:5173/src/entities/monster.js');
  const boss = M.makeBoss('rotjaw', 12, g.difficultyObj, g.rng);
  boss.setPosition(p.position.x + 1, p.position.z); g.monsters.push(boss);
  const dmgBefore = boss.damage, spdBefore = boss.moveSpeed;
  boss.life = boss.maxLife * 0.2;
  boss.update(g, 0.1, g.time);
  out.enrage = boss.enraged === true && boss.damage > dmgBefore && boss.moveSpeed > spdBefore;
  boss.dead = true;
  return out;
});
console.log('✓ Fúria de boss:', JSON.stringify(d2l));
for (const [k, v] of Object.entries(d2l)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Soquetes / Gemas / Runas / Runewords / Cubo / Stash / Super Único =====
const sockets = await page.evaluate(async () => {
  const g = window.__game;
  const out = {};
  const S = await import('http://localhost:5173/src/systems/sockets.js');

  // Soquetar uma gema numa arma com soquete
  const weapon = { id: 'w1', name: 'Espada Teste', rarity: 'normal', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: {}, sockets: 2, socketed: [] };
  g.player.inventory.push(weapon);
  const gem = { id: 'g1', name: 'Rubi Perfeito', rarity: 'normal', kind: 'gem', socketableId: 'ruby_perfect', slot: 'gem', icon: '🔴', identified: true, mods: {} };
  g.player.inventory.push(gem);
  g.startSocketing(gem);
  g.trySocketInto(weapon);
  out.gemSocketed = weapon.socketed.length === 1 && S.getItemMods(weapon).flatFire > 0 && !g.player.inventory.includes(gem);

  // Runeword Steel (Tir+El) numa arma 2-soquetes
  const rwWeap = { id: 'w2', name: 'Lâmina', rarity: 'normal', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: {}, sockets: 2, socketed: [] };
  S.insertIntoSocket(rwWeap, 'tir'); S.insertIntoSocket(rwWeap, 'el');
  const rw = S.detectRuneword(rwWeap);
  out.runeword = rw && rw.name === 'Steel' && S.getItemMods(rwWeap).attackSpeed > 0;

  // Cubo: 3 gemas iguais -> qualidade superior
  for (let i = 0; i < 3; i++) g.player.inventory.push({ id: 'cg' + i, name: 'Safira Lascada', rarity: 'normal', kind: 'gem', socketableId: 'sapphire_chipped', slot: 'gem', icon: '🔵', identified: true, mods: {} });
  g.cube = [];
  g.player.inventory.filter(it => it.socketableId === 'sapphire_chipped').forEach(it => g.moveToCube(it));
  const ok = g.cubeTransmute();
  out.cube = ok && g.cube.length === 1 && g.cube[0].socketableId === 'sapphire_flawed';

  // Stash: guarda e retira
  const stItem = { id: 'st1', name: 'Item Stash', rarity: 'magic', slot: 'helm', icon: '🪖', identified: true, mods: {} };
  g.player.inventory.push(stItem);
  g.moveToStash(stItem);
  const inStash = g.stash.includes(stItem);
  g.moveFromStash(stItem);
  out.stash = inStash && g.player.inventory.includes(stItem);

  return out;
});
console.log('✓ Soquetes/Cubo/Stash:', JSON.stringify(sockets));
for (const [k, v] of Object.entries(sockets)) if (v === false) throw new Error('falhou em: ' + k);

// ===== Joias (jewels) · Faceta Arco-Íris · Set de 3 peças (staged) =====
const jewels = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const L = await import('http://localhost:5173/src/systems/loot.js');
  const S = await import('http://localhost:5173/src/systems/sockets.js');

  // 1) Faceta Arco-Íris encravada num item EQUIPADO reflete no jogador (recompute)
  const body = { id: 'jb1', name: 'Peito Teste', rarity: 'normal', slot: 'body', kind: 'body', icon: '🧥', identified: true, mods: {}, baseStats: { defense: 10 }, sockets: 1, socketed: [] };
  p.equipment.body = body; p.recompute();
  const facet = L.makeJewelUnique('facet_fire'); facet.identified = true; // flatFire + resFire + maxResAll
  p.inventory.push(facet);
  g.startSocketing(facet); g.trySocketInto(body);
  out.jewelSocketed = body.socketed.length === 1 && !p.inventory.includes(facet);
  out.jewelMods = S.getItemMods(body).flatFire > 0 && S.getItemMods(body).maxResAll > 0;
  out.jewelAffectsPlayer = (p.maxResBonus || 0) > 0; // +máx. resist. da faceta entra no jogador
  delete p.equipment.body; p.recompute();

  // 2) Joia mágica gerada socketa numa arma e some do inventário
  const weap = { id: 'jw1', name: 'Arma Teste', rarity: 'normal', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: {}, sockets: 1, socketed: [] };
  const mj = L.generateJewel(40, 'magic', g.rng); mj.identified = true;
  p.inventory.push(mj);
  g.startSocketing(mj); g.trySocketInto(weap);
  out.magicJewelSocketed = weap.socketed.length === 1 && Object.keys(S.getItemMods(weap)).length >= 1 && !p.inventory.includes(mj);

  // 3) Set de 3 peças com bônus CRESCENTES: +dex (tier 2) e +Todas as Skills (tier 3)
  const sp = (id, slot, kind, icon) => ({ id, name: 'Esqueleto ' + slot, rarity: 'set', setName: 'Arsenal do Esqueleto', slot, kind, icon, identified: true, mods: {} });
  for (const s of ['weapon', 'helm', 'gloves']) delete p.equipment[s];
  p.recompute();
  const baseDex = p.effStats.dex, basePlus = p.plusSkills;
  p.equipment.weapon = sp('ss1', 'weapon', 'sword', '🏹');
  p.equipment.helm = sp('ss2', 'helm', 'helm', '💀');
  p.recompute();
  const twoDex = p.effStats.dex, twoPlus = p.plusSkills;
  p.equipment.gloves = sp('ss3', 'gloves', 'gloves', '🦴');
  p.recompute();
  const threePlus = p.plusSkills;
  out.setTwoPieces = twoDex > baseDex && twoPlus === basePlus;   // 2 peças = +dex, ainda sem +skills
  out.setThreeAddsSkills = threePlus > twoPlus;                  // 3ª peça adiciona +Todas as Skills
  for (const s of ['weapon', 'helm', 'gloves']) delete p.equipment[s];
  p.recompute();

  return out;
});
console.log('✓ Joias/Faceta/Set3:', JSON.stringify(jewels));
for (const [k, v] of Object.entries(jewels)) if (v === false) throw new Error('jewels falhou em: ' + k);

// ===== Arqueiro c/ arco · Flecha fina · Baú c/ abas · Organizar · Drag/Drop no chão =====
const qol = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const M = await import('http://localhost:5173/src/entities/monster.js');
  const C = await import('http://localhost:5173/src/systems/combat.js');
  const V3 = p.position.constructor;

  // 1) Arqueiro esqueleto segura um arco; esqueleto melee não
  const archer = M.makeMonster('skeleton_archer', 5, 'normal', g.difficultyObj, g.rng);
  out.archerUsesBow = archer.usesBow === true && !!archer.parts.weaponMesh;
  const meleeSkel = M.makeMonster('skeleton', 5, 'normal', g.difficultyObj, g.rng);
  out.meleeNoBow = meleeSkel.usesBow === false && !meleeSkel.parts.weaponMesh;

  // 2) Projétil de flecha: é um Group, marcado arrow:true, e o descarte (dispose) não lança
  g.projectiles.forEach(pr => g.scene.remove(pr.mesh)); g.projectiles = [];
  C.spawnProjectile(g, { origin: new V3(999, 1, 999), dir: new V3(1, 0, 0), speed: 20, range: 0.1, damage: 1, element: 'physical', owner: 'monster', arrow: true });
  const proj = g.projectiles[0];
  out.arrowSpawned = !!proj && proj.arrow === true && proj.mesh.type === 'Group';
  let projErr = null;
  try { C.updateProjectiles(g, 0.1); } catch (e) { projErr = e.message; }
  out.arrowDisposedOk = projErr === null && g.projectiles.length === 0;

  // 3) Baú com abas infinitas
  g.stashTabs = [[]]; g.stashTab = 0;
  const si1 = { id: 'sti1', name: 'Item A', rarity: 'magic', slot: 'helm', icon: '🪖', identified: true, mods: {} };
  p.inventory.push(si1); g.moveToStash(si1);
  out.stashStore = g.stash.includes(si1) && !p.inventory.includes(si1);
  const tabsBefore = g.stashTabs.length;
  g.addStashTab();
  out.stashAddTab = g.stashTabs.length === tabsBefore + 1 && g.stashTab === tabsBefore;
  const si2 = { id: 'sti2', name: 'Item B', rarity: 'rare', slot: 'body', icon: '🧥', identified: true, mods: {} };
  p.inventory.push(si2); g.moveToStash(si2);
  out.stashStoreTab2 = g.stash.includes(si2);
  g.moveFromStash(si1); // item da aba 0 sai mesmo com a aba 1 ativa
  out.stashCrossTab = p.inventory.includes(si1) && !g.stashTabs.flat().includes(si1);

  // 4) Organizar inventário (sort) e reordenar via drag (move/troca)
  p.inventory = [
    { id: 'z1', name: 'Gema', kind: 'gem', rarity: 'normal', slot: 'gem', icon: '🔴', identified: true, mods: {} },
    { id: 'z2', name: 'Espada', slot: 'weapon', rarity: 'rare', reqLevel: 10, icon: '⚔️', identified: true, mods: {} },
  ];
  g.sortInventory();
  out.sortInv = p.inventory[0].slot === 'weapon' && p.inventory[1].kind === 'gem';
  g.moveInventoryItem(0, 1);
  out.moveSwap = p.inventory[0].id === 'z1' && p.inventory[1].id === 'z2';

  // 5) Soltar no chão: sai do inventário, vira ground item e NÃO é recolhido na hora
  g.groundItems.forEach(d => g.scene.remove(d.mesh)); g.groundItems = [];
  const dropIt = { id: 'drop1', name: 'Solta', rarity: 'magic', slot: 'helm', icon: '🪖', identified: true, mods: {} };
  p.inventory = [dropIt]; p.position.set(0, 0, 0);
  g.dropItemToGround(dropIt);
  out.dropRemoved = !p.inventory.includes(dropIt) && g.groundItems.length === 1;
  const gi = g.groundItems[0];
  out.dropFlagged = gi.playerDropped === true && gi.armPickup === false;
  gi.position.set(0.5, 0.4, 0); // perto do jogador → ainda assim não recolhe (não "armado")
  g._pickupGroundItems();
  out.noInstantPickup = g.groundItems.includes(gi) && !p.inventory.includes(dropIt);
  p.position.set(10, 0, 10); g._pickupGroundItems(); // afasta → arma
  out.armed = gi.armPickup === true;
  p.position.set(gi.position.x, 0, gi.position.z); g._pickupGroundItems(); // volta → recolhe
  out.rePickup = !g.groundItems.includes(gi) && p.inventory.includes(dropIt);

  // 6) DOM: botão organizar, zona de soltar, itens arrastáveis, abas do baú, charm c/ borda vermelha
  p.inventory.push({ id: 'dragd', name: 'Drag', slot: 'helm', rarity: 'normal', icon: '🪖', identified: true, mods: {} });
  p.inventory.push({ id: 'charmd', name: 'Talismã', slot: 'charm', kind: 'charm', rarity: 'magic', icon: '🔸', identified: true, mods: { lifeFlat: 10 } });
  g.ui.renderInventory(g);
  const invPanel = document.getElementById('inventory-panel');
  out.invSortBtn = !!invPanel.querySelector('.inv-sort');
  out.invDropZone = !!invPanel.querySelector('.inv-dropzone');
  const di = invPanel.querySelector('.inv-item');
  out.invDraggable = !!di && di.getAttribute('draggable') === 'true';
  out.charmRedClass = !!invPanel.querySelector('.inv-item.charm'); // charm recebe classe p/ borda vermelha
  g.ui.openStash(g);
  out.stashDom = !!g.ui.modal.querySelector('.stash-tab') && !!g.ui.modal.querySelector('.stash-addtab') && !!g.ui.modal.querySelector('.stash-sort');
  g.ui.modal.classList.add('hidden');

  return out;
});
console.log('✓ Arco/Flecha/Baú-abas/Organizar/Drag:', JSON.stringify(qol));
for (const [k, v] of Object.entries(qol)) if (v === false) throw new Error('qol falhou em: ' + k);

// ===== Tooltip ao passar o mouse no NOME do item: venda (loja) + baú =====
const tips = await page.evaluate(async () => {
  const g = window.__game; const p = g.player; const out = {};
  const tipEl = document.getElementById('tooltip');
  const hover = (node) => node && node.dispatchEvent(new MouseEvent('mouseenter', { clientX: 320, clientY: 300, bubbles: true }));
  const shows = (name) => !tipEl.classList.contains('hidden') && tipEl.textContent.includes(name);

  const it = { id: 'tipit', name: 'Espada do Teste', rarity: 'rare', slot: 'weapon', kind: 'sword', icon: '⚔️', identified: true, mods: { lifeFlat: 20 }, baseStats: { dmgMin: 5, dmgMax: 10 }, reqLevel: 1 };
  p.inventory = [it];

  // 1) LOJA — aba Vender: hover no nome mostra o balão
  g.ui.hideTooltip();
  g.ui.openShop(g, { role: 'merchant', name: 'Mercador', _stock: [] });
  g.ui.shopTab = 'sell'; g.ui.renderShop(g);
  hover(g.ui.modal.querySelector('[data-sell-tip]'));
  out.sellTooltip = shows(it.name);
  g.ui.hideTooltip(); g.ui.modal.classList.add('hidden');

  // 2) BAÚ — hover no nome dos dois lados (inventário e baú)
  g.stashTabs = [[]]; g.stashTab = 0;
  g.ui.openStash(g);
  hover(g.ui.modal.querySelector('.stash-in'));
  out.stashInvTooltip = shows(it.name);
  g.ui.hideTooltip();
  g.moveToStash(it); g.ui.renderStash(g);
  hover(g.ui.modal.querySelector('.stash-out'));
  out.stashBoxTooltip = shows(it.name);
  g.ui.hideTooltip(); g.ui.modal.classList.add('hidden');

  return out;
});
console.log('✓ Tooltip venda/baú:', JSON.stringify(tips));
for (const [k, v] of Object.entries(tips)) if (v === false) throw new Error('tooltip falhou em: ' + k);

// ===== Colisão: o jogador não atravessa estruturas sólidas =====
const coll = await page.evaluate(async () => {
  const g = window.__game; const out = {};
  g.actIndex = 0; g._goToTown();
  await new Promise(r => setTimeout(r, 120));
  const obs = g.zone.obstacles || [];
  out.obstaclesCollected = obs.length >= 8; // casas, poço, sino, postes, forja, etc.
  // maior obstáculo (uma casa)
  const house = obs.slice().sort((a, b) => (b.hx * b.hz) - (a.hx * a.hz))[0];
  out.hasBox = !!house && house.hx > 0.5 && house.hz > 0.5;
  // 1) jogador no centro do obstáculo -> empurrado para fora da caixa
  g.player.position.set(house.cx, 0, house.cz);
  g._resolvePlayerCollision();
  const dx = Math.abs(g.player.position.x - house.cx), dz = Math.abs(g.player.position.z - house.cz);
  out.pushedOut = (dx > house.hx) || (dz > house.hz);
  // 2) andar para o oeste ATRAVÉS do obstáculo: deve ser bloqueado (nunca chega ao outro lado)
  g.input.shift = false; g.player.dead = false; g.player.attackTarget = null; g.player.interactTarget = null;
  g.player.position.set(house.cx + house.hx + 3, 0, house.cz);
  g.player.moveTarget = { x: house.cx - 12, y: 0, z: house.cz };
  for (let i = 0; i < 80; i++) { g._updatePlayerMovement(0.05); g._resolvePlayerCollision(); }
  out.didNotPassThrough = g.player.position.x >= house.cx; // não cruzou para o lado oeste
  g.player.moveTarget = null;
  return out;
});
console.log('✓ Colisão com estruturas:', JSON.stringify(coll));
for (const [k, v] of Object.entries(coll)) if (v === false) throw new Error('colisão falhou em: ' + k);

// ===== Cubo: condensar charms num só (toggle persistido por save) =====
const cubeChk = await page.evaluate(async () => {
  const g = window.__game; const out = {};
  const S = await import('http://localhost:5173/src/systems/save.js');
  const mk = (id, mods, rl) => ({ id, name: 'Talismã ' + id, slot: 'charm', kind: 'charm', rarity: 'magic', icon: '🔸', identified: true, reqLevel: rl, mods, charmSize: 1 });
  // LIGADO: 3 charms -> 1 só com a soma dos mods
  g.condenseCharms = true;
  g.cube = [mk('a', { lifeFlat: 10, str: 2 }, 5), mk('b', { lifeFlat: 5, resAll: 3 }, 12), mk('c', { str: 4 }, 8)];
  g.cubeTransmute();
  const c = g.cube[0];
  out.fused = g.cube.length === 1 && c.slot === 'charm' && c.mods.lifeFlat === 15 && c.mods.str === 6 && c.mods.resAll === 3;
  // DESLIGADO: não funde (segue 2 itens)
  g.condenseCharms = false;
  g.cube = [mk('d', { dex: 3 }, 4), mk('e', { vit: 2 }, 6)];
  g.cubeTransmute();
  out.notFusedOff = g.cube.length === 2;
  // toggle + persistência no save
  const r = g.toggleCondenseCharms(); // false -> true, salva
  out.toggled = r === true && g.condenseCharms === true;
  out.savedFlag = S.loadSaveData(g.saveSlot).condenseCharms === true;
  // UI: botão de liga/desliga no painel do cubo
  g.cube = []; g.ui.openCube(g);
  const btn = g.ui.modal.querySelector('#cube-condense');
  out.cubeToggleBtn = !!btn && btn.textContent.includes('LIGADO');
  btn.click(); // alterna -> DESLIGADO
  out.uiToggle = g.condenseCharms === false && g.ui.modal.querySelector('#cube-condense').textContent.includes('DESLIGADO');
  g.condenseCharms = true; g.save(); g.ui.modal.classList.add('hidden');
  return out;
});
console.log('✓ Cubo condensar charms:', JSON.stringify(cubeChk));
for (const [k, v] of Object.entries(cubeChk)) if (v === false) throw new Error('cubo falhou em: ' + k);

// Super Único: percorre zonas até achar um (45% por zona)
const su = await page.evaluate(async () => {
  const g = window.__game;
  for (let act = 0; act < 4; act++) {
    g.actIndex = act;
    for (let z = 0; z < 3; z++) {
      g._goToWilderness(z);
      await new Promise(r => setTimeout(r, 60));
      const found = g.monsters.find(m => m.superUnique);
      if (found) return { found: true, name: found.name, minions: g.monsters.length };
    }
  }
  return { found: false };
});
console.log('✓ Super Único:', JSON.stringify(su));
if (!su.found) throw new Error('nenhum super único encontrado em 12 zonas (improvável)');

// Testa transição para o Cow Level (secret) e arena de boss
const transitions = await page.evaluate(async () => {
  const g = window.__game;
  g._goToCow();
  await new Promise(r => setTimeout(r, 300));
  const cow = { zone: g.zone.name, monsters: g.monsters.length };
  g._goToBoss();
  await new Promise(r => setTimeout(r, 300));
  const boss = { zone: g.zone.name, hasBoss: g.monsters.some(m => m.isBoss) };
  return { cow, boss };
});
console.log('✓ Cow Level:', JSON.stringify(transitions.cow));
console.log('✓ Arena de Boss:', JSON.stringify(transitions.boss));
if (transitions.cow.monsters < 10) throw new Error('cow level com poucas vacas');
if (!transitions.boss.hasBoss) throw new Error('arena sem boss');

// ===== Mundo D2: overworld ÚNICO contínuo + cidade segura + waypoint por região =====
const world = await page.evaluate(async () => {
  const g = window.__game; const out = {};
  const M = await import('http://localhost:5173/src/entities/monster.js');
  const wpOf = (z) => (z.interactables || []).filter(it => it.type === 'waypoint').length;

  // 1) Cidade: safe, sem monstros, waypoint, saída para o OVERWORLD; guarda remove intruso
  g.actIndex = 0; g._goToTown();
  await new Promise(r => setTimeout(r, 80));
  out.townSafe = g.zone.safe === true && g.monsters.length === 0 && wpOf(g.zone) >= 1;
  out.townExitToOverworld = (g.zone.exits || []).some(e => e.to === 'overworld');
  g.running = true; g.player.dead = false; g.input.setEnabled(true);
  const intr = M.makeMonster('zombie', 5, 'normal', g.difficultyObj, g.rng);
  intr.setPosition(0, 0); g.monsters.push(intr); g.scene.add(intr.mesh);
  await new Promise(r => setTimeout(r, 200));
  out.townRemovesIntruder = g.monsters.length === 0;

  // 2) Overworld: UM mapa contínuo, >=2 regiões, waypoint em cada, saídas só cidade+boss
  g._goToOverworld();
  await new Promise(r => setTimeout(r, 120));
  out.isOverworld = g.zone.type === 'overworld';
  out.multipleRegions = (g.zone.regions || []).length >= 2;
  out.waypointPerRegion = wpOf(g.zone) === g.zone.regions.length;
  const ex = g.zone.exits || [];
  out.overworldExits = ex.some(e => e.to === 'town') && ex.some(e => e.to === 'boss');
  out.noInterRegionPortals = !ex.some(e => e.to === 'overworld' || e.to === 'wilderness'); // sem portais ENTRE regiões
  out.hasSuperUnique = !!g.zone.superUnique;
  // entrada (oeste) segura: nenhum monstro perto do playerStart
  const s = g.zone.playerStart;
  out.entrySafe = g.monsters.filter(m => Math.hypot(m.position.x - s.x, m.position.z - s.z) < 8).length === 0;

  // 3) Caminhar de região a região NÃO troca de zona; só atualiza o nome da sub-área
  const zoneRef = g.zone, name0 = g.zone.name;
  const rLast = g.zone.regions[g.zone.regions.length - 1];
  g.player.position.set(rLast.cx, 0, 0); g._updateOverworldRegion(false);
  out.sameMapWhenWalking = g.zone === zoneRef && g.zone.type === 'overworld';
  out.areaNameUpdates = g.zone.name === rLast.name && rLast.name !== name0;

  // 4) Boss é uma DUNGEON separada (saída leste) com waypoint próprio
  g._goToBoss();
  await new Promise(r => setTimeout(r, 80));
  out.bossDungeon = g.zone.type === 'boss' && wpOf(g.zone) >= 1 && (g.zone.exits || []).some(e => e.to === 'town');

  // 5) Waypoints descobertos (cidade / overworld×N / boss) + travel roteia por tipo
  const ids = g.waypointList.map(w => w.id);
  out.discoveredAllTypes = ids.some(i => i.startsWith('town-')) && ids.filter(i => i.startsWith('over-')).length >= 2 && ids.some(i => i.startsWith('boss-'));
  const wOver = g.waypointList.find(w => w.zoneType === 'overworld');
  const wBoss = g.waypointList.find(w => w.zoneType === 'boss');
  const wTown = g.waypointList.find(w => w.zoneType === 'town' || w.isTown);
  g.travelToWaypoint(wOver); await new Promise(r => setTimeout(r, 100));
  // tolerância 4 (não 0.6): a colisão pode empurrar o jogador para fora de um prop sólido perto do
  // waypoint (posição aleatória por seed); 4 « 22 (meia-região), então ainda confirma o waypoint certo.
  out.travelOverworld = g.zone.type === 'overworld' && Math.abs(g.player.position.x - wOver.wpX) < 4;
  g.travelToWaypoint(wBoss); await new Promise(r => setTimeout(r, 60)); out.travelBoss = g.zone.type === 'boss';
  g.travelToWaypoint(wTown); await new Promise(r => setTimeout(r, 120)); out.travelTownSafe = g.zone.type === 'town' && g.monsters.length === 0;

  return out;
});
console.log('✓ Mundo D2 (overworld contínuo/cidade/waypoints):', JSON.stringify(world));
for (const [k, v] of Object.entries(world)) if (v === false) throw new Error('mundo falhou em: ' + k);

// ===== 3 slots de save (isolados) =====
const slots = await page.evaluate(async () => {
  const g = window.__game; const out = {};
  const S = await import('http://localhost:5173/src/systems/save.js');
  for (let i = 0; i < 3; i++) S.clearSave(i);
  out.allEmpty = !S.hasSave(0) && !S.hasSave(1) && !S.hasSave(2);
  g.saveSlot = 2; g.save();                                  // salva no slot 2
  out.savedSlot2 = S.hasSave(2) && !S.hasSave(0) && !S.hasSave(1);
  const list = S.listSaves();
  out.listLen3 = list.length === 3;
  out.slot2Summary = !!list[2].summary && list[2].level === g.player.level;
  out.slot0Empty = list[0].summary === null;
  g.saveSlot = 1; g.save();                                  // outro slot, isolado
  out.twoSlots = S.hasSave(1) && S.hasSave(2);
  S.clearSave(1); S.clearSave(2);
  out.cleared = !S.hasSave(1) && !S.hasSave(2);
  g.player.questBonus = { resAll: 7, lifeFlat: 13 };          // bônus permanente de quest p/ checar persistência
  g.saveSlot = 0; g.save();                                  // deixa o slot 0 p/ o teste de Continuar
  out.slot0Saved = S.hasSave(0) && !S.hasSave(1) && !S.hasSave(2);
  return out;
});
console.log('✓ Save slots (3):', JSON.stringify(slots));
for (const [k, v] of Object.entries(slots)) if (v === false) throw new Error('slots falhou em: ' + k);

// Recarrega a página e testa CONTINUAR pelo slot (save persistente em localStorage)
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => { const t = document.getElementById('title-screen'); return t && !t.classList.contains('hidden'); }, { timeout: 15000 });
const slotCount = await page.$$eval('.save-slot', els => els.length);
const filledSlot = await page.$('.save-slot.filled');
console.log('✓ Tela inicial com', slotCount, 'slots · slot 0 preenchido:', !!filledSlot);
if (slotCount !== 3) throw new Error('esperava 3 cartões de slot, obteve ' + slotCount);
if (!filledSlot) throw new Error('nenhum slot preenchido após salvar');
await page.evaluate(() => { const b = document.querySelector('.save-slot.filled .slot-continue'); if (b) b.click(); });
await page.waitForFunction(() => window.__game && window.__game.running && window.__game.player, { timeout: 10000 });
const loaded = await page.evaluate(() => ({ cls: window.__game.player.cls.name, level: window.__game.player.level, zone: window.__game.zone.name, questBonus: window.__game.player.questBonus }));
console.log('✓ Continuar carregou o personagem salvo:', JSON.stringify(loaded));
if (loaded.level < 2) throw new Error('personagem carregado com nível incorreto');
if (!loaded.questBonus || loaded.questBonus.resAll !== 7 || loaded.questBonus.lifeFlat !== 13) throw new Error('questBonus (recompensa permanente) não persistiu no save/load');

await browser.close();

if (errors.length) {
  console.error('\n✗ ERROS CAPTURADOS:');
  for (const e of errors) console.error('  ', e);
  process.exit(1);
}
console.log('\n✅ SMOKE TEST PASSOU — o jogo carrega e roda sem erros de runtime.');
