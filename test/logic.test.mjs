// Smoke test da lógica pura (sem Three.js/DOM): leveling, loot, skill tree, dificuldade.
import assert from 'node:assert';
import { xpToReach, xpForNext, monsterBaseXP, MAX_LEVEL } from '../src/systems/leveling.js';
import { generateItem, rollDrops, itemTooltipLines } from '../src/systems/loot.js';
import { RNG } from '../src/core/rng.js';
import { MONSTER_RANKS } from '../src/data/monsters.js';
import { DIFFICULTIES } from '../src/systems/difficulty.js';
import { canLearn, learnSkill, aggregateAuraAndPassive } from '../src/systems/skilltree.js';
import { CLASSES } from '../src/data/classes.js';
import { SKILLS } from '../src/data/skills.js';

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ✓', name); pass++; }

// 1) Curva de XP estritamente crescente até 99
let prev = -1, mono = true;
for (let L = 1; L <= MAX_LEVEL; L++) { const v = xpToReach(L); if (v < prev) mono = false; prev = v; }
ok('XP cumulativo cresce de 1 a 99', mono);
ok('XP nível 99 finito e grande', xpToReach(99) > xpToReach(50) && isFinite(xpToReach(99)));
ok('XP do próximo nível no 99 = Infinity', xpForNext(99) === Infinity);
ok('monsterBaseXP cresce com o nível', monsterBaseXP(50) > monsterBaseXP(5));

// 2) Geração de itens em todas as raridades
const rng = new RNG(12345);
for (const rar of ['normal', 'magic', 'rare', 'unique', 'set']) {
  const it = generateItem(40, rar, rng);
  ok(`gera item ${rar} com nome e slot`, it && it.name && it.slot);
  ok(`tooltip de ${rar} tem linhas`, itemTooltipLines(it).length > 0);
}
// magic tem 1-2 afixos; rare tem >=2
const magics = [], rares = [];
for (let i = 0; i < 50; i++) { magics.push(generateItem(50, 'magic', rng)); rares.push(generateItem(50, 'rare', rng)); }
ok('itens mágicos têm 1-2 afixos', magics.every(m => m.affixes.length >= 1 && m.affixes.length <= 2));
ok('itens raros têm >=2 afixos', rares.every(r => r.affixes.length >= 2));

// 3) Drops de boss produzem itens
let bossItems = 0;
for (let i = 0; i < 20; i++) {
  const d = rollDrops(40, MONSTER_RANKS.boss, 100, DIFFICULTIES.normal, rng);
  bossItems += d.filter(x => x.type === 'item').length;
}
ok('boss dropa itens', bossItems > 0);

// 4) Magic Find aumenta a chance de itens não-brancos
function shareNonNormal(mf) {
  let total = 0, special = 0;
  for (let i = 0; i < 400; i++) {
    const d = rollDrops(40, MONSTER_RANKS.unique, mf, DIFFICULTIES.normal, rng);
    for (const x of d) if (x.type === 'item') { total++; if (x.item.rarity !== 'normal') special++; }
  }
  return special / total;
}
const low = shareNonNormal(0), high = shareNonNormal(500);
ok(`Magic Find eleva itens não-brancos (${(low*100).toFixed(0)}% -> ${(high*100).toFixed(0)}%)`, high > low);

// 5) Skill tree: pré-requisitos e tier por nível
const fakePlayer = { classId: 'arcanist', level: 1, skillPoints: 99, skillRanks: {} };
ok('não aprende skill de tier alto no nível 1', !canLearn(fakePlayer, 'meteor').ok);
ok('aprende skill básica no nível 1', canLearn(fakePlayer, 'fire_bolt').ok);
ok('não aprende skill com prereq faltando', !canLearn(fakePlayer, 'fire_ball').ok); // precisa fire_bolt
learnSkill(fakePlayer, 'fire_bolt');
fakePlayer.level = 12;
ok('aprende fire_ball após prereq + nível', canLearn(fakePlayer, 'fire_ball').ok);

// 6) Sinergia aumenta dano
const r1 = SKILLS.fire_ball.getStats(1, { fire_ball: 1 }).damage;
const r1syn = SKILLS.fire_ball.getStats(1, { fire_ball: 1, fire_bolt: 10, meteor: 10 }).damage;
ok('sinergias aumentam o dano da skill', r1syn > r1);

// 7) Auras/passivas agregam
// auras estilo D2: só a AURA ATIVA conta
const guardMight = { classId: 'guardian', skillRanks: { might: 5, prayer: 3 }, activeAura: 'might' };
ok('aura ATIVA (Vigor) agrega dano', aggregateAuraAndPassive(guardMight).auraDamagePct > 0);
ok('aura inativa (Prece) NÃO agrega', aggregateAuraAndPassive(guardMight).auraRegen === 0);
const guardPrayer = { classId: 'guardian', skillRanks: { might: 5, prayer: 3 }, activeAura: 'prayer' };
ok('trocar aura ativa p/ Prece agrega regen', aggregateAuraAndPassive(guardPrayer).auraRegen > 0);

// 8) Dificuldade aplica penalidades
ok('Inferno penaliza resistência em 100', DIFFICULTIES.hell.resPenalty === 100);
ok('Pesadelo aumenta vida dos monstros', DIFFICULTIES.nightmare.monsterLifeMul > 1);

// 9) Todas as skills têm getStats válido
let allSkillsOk = true;
for (const [id, s] of Object.entries(SKILLS)) {
  try { const st = s.getStats(1, {}); if (typeof st !== 'object') allSkillsOk = false; } catch { allSkillsOk = false; console.log('   skill quebrada:', id); }
  if (typeof s.desc(1) !== 'string') allSkillsOk = false;
}
ok('todas as skills têm getStats() e desc() válidos', allSkillsOk);

// 10) Cada classe tem 3 árvores e skills
for (const c of Object.values(CLASSES)) {
  ok(`classe ${c.name} tem 3 árvores`, c.skillTrees.length === 3);
  const n = Object.values(SKILLS).filter(s => s.classId === c.id).length;
  ok(`classe ${c.name} tem >=10 skills (${n})`, n >= 10);
}

// ---- Refino D2: identificação, economia, +skills ----
import { skillStats } from '../src/systems/skilltree.js';
import { buyPrice, sellPrice, gamblePrice, gambleRoll, generateShopStock } from '../src/systems/economy.js';
import { DIFFICULTIES as DIFF2 } from '../src/systems/difficulty.js';

// 11) Identificação: magic já identificado, rare/unique não
const magicItem = generateItem(40, 'magic', rng);
const rareItem = generateItem(40, 'rare', rng);
ok('item mágico já vem identificado', magicItem.identified === true);
ok('item raro vem NÃO identificado', rareItem.identified === false);
ok('tooltip de raro não-ID esconde afixos', itemTooltipLines(rareItem).some(l => l.text === 'Não identificado'));

// 12) Economia
const shopItem = generateShopStock(30, DIFF2.normal, rng)[0];
ok('loja gera itens identificados', shopItem.identified === true);
ok('buyPrice > sellPrice', buyPrice(rareItem) > sellPrice(rareItem));
ok('gamblePrice cresce com o nível', gamblePrice(50) > gamblePrice(1));
const gambled = gambleRoll(40, rng);
ok('aposta retorna um item', !!gambled && !!gambled.name);

// 13) +Todas as Skills eleva o dano efetivo da skill
const baseStat = skillStats({ classId: 'arcanist', skillRanks: { fire_bolt: 1 }, plusSkills: 0 }, 'fire_bolt');
const plusStat = skillStats({ classId: 'arcanist', skillRanks: { fire_bolt: 1 }, plusSkills: 5 }, 'fire_bolt');
ok('+skills aumenta o dano da skill', plusStat.damage > baseStat.damage);

// 14) Afixo +skills só aparece em weapon/amulet (restrição de slot)
let skillsAffixOnArmor = false;
for (let i = 0; i < 200; i++) {
  const it = generateItem(40, 'rare', rng, { slot: 'body' });
  if (it.mods.allSkills) skillsAffixOnArmor = true;
}
ok('afixo +skills NUNCA cai em armadura de corpo', !skillsAffixOnArmor);

// ---- Soquetes / Gemas / Runas / Runewords / Cubo ----
import { GEMS, RUNES } from '../src/data/gems.js';
import { insertIntoSocket, detectRuneword, getItemMods, emptySockets } from '../src/systems/sockets.js';
import { transmute } from '../src/systems/cube.js';

ok('existem 35 gemas (7 tipos x 5 qualidades)', Object.keys(GEMS).length === 35);
ok('existem 17 runas', Object.keys(RUNES).length === 17);

// inserir gema numa armadura soma o mod de armadura
const armor = { slot: 'body', kind: 'body', mods: {}, sockets: 2, socketed: [] };
insertIntoSocket(armor, 'ruby_perfect');
ok('inserir Rubi Perfeito em armadura dá +Vida', getItemMods(armor).lifeFlat > 0);
ok('ainda há 1 soquete livre', emptySockets(armor) === 1);

// runeword Steel (Tir+El) em arma de 2 soquetes
const weap = { slot: 'weapon', kind: 'sword', mods: {}, sockets: 2, socketed: [] };
insertIntoSocket(weap, 'tir'); insertIntoSocket(weap, 'el');
const rw = detectRuneword(weap);
ok('runeword Steel detectado (Tir+El em arma 2-soq)', rw && rw.name === 'Steel');
ok('runeword aplica vel. de ataque', getItemMods(weap).attackSpeed > 0);

// ordem errada NÃO forma runeword
const weap2 = { slot: 'weapon', kind: 'sword', mods: {}, sockets: 2, socketed: ['el', 'tir'] };
ok('ordem errada de runas não forma runeword', detectRuneword(weap2) === null);

// cubo: 3 gemas iguais -> qualidade superior
const cube3 = [
  { kind: 'gem', socketableId: 'ruby_chipped', id: 'a' },
  { kind: 'gem', socketableId: 'ruby_chipped', id: 'b' },
  { kind: 'gem', socketableId: 'ruby_chipped', id: 'c' },
];
const cubeRes = transmute(cube3, rng);
ok('cubo: 3 gemas iguais sobem de qualidade', cubeRes.ok && cubeRes.result[0].socketableId === 'ruby_flawed');

// ---- Requisitos / Durabilidade / Etéreo / Rejuv ----
import { CONSUMABLE_PRICES } from '../src/systems/economy.js';
let foundReq = false, foundDur = false, foundEth = false, ethBonus = false;
for (let i = 0; i < 400; i++) {
  const it = generateItem(40, 'normal', rng, { slot: 'weapon' });
  if ((it.reqStr || 0) > 0 || (it.reqDex || 0) > 0) foundReq = true;
  if (it.durability && it.durability.max > 0) foundDur = true;
  if (it.ethereal) { foundEth = true; if (it.baseStats.dmgMax > 0) ethBonus = true; }
}
ok('armas têm requisito de atributo (Str/Dex)', foundReq);
ok('armas têm durabilidade', foundDur);
ok('itens etéreos aparecem', foundEth);
ok('etéreo mantém dano base', ethBonus);
ok('preço de poção de rejuvenescimento existe', CONSUMABLE_PRICES.rejuv > 0);

// ---- Afixos de combate + Set bonuses ----
import { AFFIXES, SET_BONUSES } from '../src/data/items.js';
ok('afixo Golpe Esmagador existe', AFFIXES.suffix.some(a => a.stat === 'crushingBlow'));
ok('afixo Ferida Aberta existe', AFFIXES.suffix.some(a => a.stat === 'openWounds'));
ok('afixo Espinhos existe', AFFIXES.prefix.some(a => a.stat === 'thorns'));
ok('Traje do Minerador tem bônus de set', !!(SET_BONUSES['Traje do Minerador'] && SET_BONUSES['Traje do Minerador'][2]));
let cbWeapon = false;
for (let i = 0; i < 400; i++) { const it = generateItem(40, 'rare', rng, { slot: 'weapon' }); if (it.mods.crushingBlow || it.mods.openWounds) cbWeapon = true; }
ok('armas podem rolar Golpe Esmagador/Ferida Aberta', cbWeapon);

// ---- Summons + Quests + Afixos FHR/CBF ----
import { buildActQuests } from '../src/data/quests.js';
ok('skill de invocação por classe existe', SKILLS.holy_spirits?.type === 'summon' && SKILLS.hydra?.type === 'summon' && SKILLS.valkyrie?.type === 'summon');
ok('invocação define summonKind', SKILLS.hydra.summonKind === 'hydra' && SKILLS.hydra.getStats(1, {}).ranged === true);
const aq = buildActQuests(0);
ok('cada ato tem 3 quests', aq.length === 3);
ok('quests têm recompensas', aq.every(q => q.reward && q.rewardText));
ok('quest de boss menciona o boss do ato', aq.some(q => q.type === 'boss'));
ok('afixo Recuperação Rápida (FHR) existe', AFFIXES.suffix.some(a => a.stat === 'fhr'));
ok('afixo Não Pode Ser Congelado existe', AFFIXES.suffix.some(a => a.stat === 'cannotFreeze'));

// ---- Conteúdo novo: runewords / sets / uniques ----
import { RUNEWORDS } from '../src/data/gems.js';
import { UNIQUES, SETS, SET_BONUSES as SB2 } from '../src/data/items.js';
ok('runewords novos existem (leaf/malice/smoke)', ['leaf', 'malice', 'smoke'].every(id => RUNEWORDS.some(r => r.id === id)));
const leaf = { slot: 'weapon', kind: 'staff', mods: {}, sockets: 2, socketed: ['tir', 'ral'] };
ok('runeword Leaf detectado (Tir+Ral)', detectRuneword(leaf)?.name === 'Leaf');
ok('set "Pele do Lobo" tem bônus', !!(SB2['Pele do Lobo'] && SB2['Pele do Lobo'][2]));
ok('há >=6 uniques e >=4 set items', UNIQUES.length >= 6 && SETS.length >= 4);

// ---- Lore + sustain + aura de merc + cubo (desencravar/re-rolar) ----
import { ACT_LORE } from '../src/data/acts.js';
ok('há lore para os 4 atos', ACT_LORE.length === 4 && ACT_LORE.every(l => l.title && l.text));
ok('afixo Vida por Morte existe', AFFIXES.suffix.some(a => a.stat === 'lifePerKill'));
ok('afixo Mana por Morte existe', AFFIXES.suffix.some(a => a.stat === 'manaPerKill'));
// cubo: desencravar com Hel
const socketed = { slot: 'weapon', kind: 'sword', rarity: 'normal', mods: {}, sockets: 2, socketed: ['ruby_perfect', 'tir'], ilvl: 30 };
const hel = { kind: 'rune', socketableId: 'hel', id: 'h1' };
const un = transmute([hel, socketed], rng);
ok('cubo: Hel + item encravado esvazia soquetes', un.ok && un.result[0].socketed.length === 0 && un.result[0].sockets === 2);
// cubo: re-rola mágico
const mag = { slot: 'helm', kind: 'helm', rarity: 'magic', mods: {}, ilvl: 30, reqLevel: 10 };
const gem1 = { kind: 'gem', socketableId: 'ruby_chipped', id: 'g9' };
const rr = transmute([mag, gem1], rng);
ok('cubo: item mágico + gema re-rola (mágico)', rr.ok && rr.result[0].rarity === 'magic');

// ---- Maestrias elementais ----
ok('maestrias elementais existem', SKILLS.fire_mastery?.type === 'passive' && SKILLS.cold_mastery?.type === 'passive' && SKILLS.lightning_mastery?.type === 'passive');
const arc = { classId: 'arcanist', skillRanks: { fire_mastery: 5 } };
ok('Maestria do Fogo agrega bônus de dano de fogo', aggregateAuraAndPassive(arc).fireDmg > 0);
ok('maestria de outro elemento não vaza', aggregateAuraAndPassive(arc).coldDmg === 0);

// ---- Charm único (Anihilus) + makeUnique ----
import { makeUnique } from '../src/systems/loot.js';
const ani = makeUnique('anihilus');
ok('makeUnique constrói o Anihilus (charm único)', !!ani && ani.rarity === 'unique' && ani.slot === 'charm');
ok('Anihilus tem +Todas as Skills e +Atributos', ani.mods.allSkills > 0 && ani.mods.allAttrs > 0);
ok('Anihilus cai não-identificado', ani.identified === false);

// ---- Skills novas (teleporte / flecha congelante / vingança) ----
ok('Teleporte existe (arcanista)', SKILLS.teleport?.type === 'teleport' && SKILLS.teleport.classId === 'arcanist');
ok('Flecha Congelante é projétil de gelo', SKILLS.freezing_arrow?.getStats(1, {}).element === 'cold');
ok('Vingança adiciona múltiplos elementos', SKILLS.vengeance?.getStats(1, {}).extraElements === true);
const arcN = Object.values(SKILLS).filter(s => s.classId === 'arcanist').length;
ok(`Arcanista agora tem >=15 skills (${arcN})`, arcN >= 15);

// ---- Itens normais "Superiores" ----
let sup = false;
for (let i = 0; i < 500; i++) { const it = generateItem(30, 'normal', rng, { slot: 'weapon' }); if (it.superior && it.baseStats.dmgMax > 0) { sup = true; break; } }
ok('itens normais Superiores aparecem (bônus base)', sup);

// ---- Joias (jewels), novas runewords e set de 3 peças (staged) ----
import { generateJewel, makeJewelUnique } from '../src/systems/loot.js';
import { socketSummary } from '../src/systems/sockets.js';
import { JEWEL_AFFIXES, UNIQUE_JEWELS } from '../src/data/items.js';
// insertIntoSocket/getItemMods/detectRuneword (sockets), RUNEWORDS (gems),
// SET_BONUSES/UNIQUES (items) já foram importados em blocos anteriores deste arquivo.

const jrng = new RNG(777);
const jmag = generateJewel(40, 'magic', jrng);
ok('joia mágica tem slot/kind jewel e vem identificada', jmag.kind === 'jewel' && jmag.slot === 'jewel' && jmag.identified === true);
ok('joia mágica tem ao menos 1 mod', Object.keys(jmag.mods).length >= 1);
const jrare = generateJewel(60, 'rare', jrng);
ok('joia rara cai não-identificada', jrare.identified === false);
ok('joia rara tem >=2 afixos', jrare.affixes.length >= 2);
const facet = makeJewelUnique('facet_fire');
ok('Faceta Arco-Íris (Fogo) é joia única com +máx. resist.', !!facet && facet.kind === 'jewel' && facet.rarity === 'unique' && facet.mods.maxResAll > 0);
ok('Faceta única cai não-identificada', facet.identified === false);
ok('JEWEL_AFFIXES tem prefixos e sufixos', JEWEL_AFFIXES.prefix.length > 0 && JEWEL_AFFIXES.suffix.length > 0);

// encravar uma joia num item com soquete aplica os mods da joia (getItemMods)
const host = { slot: 'body', sockets: 1, socketed: [], mods: { defenseFlat: 10 } };
const jewelToSocket = makeJewelUnique('facet_cold'); // flatCold + resCold + maxResAll
const insRes = insertIntoSocket(host, jewelToSocket);
ok('insertIntoSocket aceita objeto-joia', insRes.ok === true && host.socketed.length === 1);
const hostMods = getItemMods(host);
ok('mods da joia entram no item hospedeiro', hostMods.flatCold === jewelToSocket.mods.flatCold && hostMods.resCold === jewelToSocket.mods.resCold);
ok('item base + joia somam (defenseFlat preservado)', hostMods.defenseFlat === 10);
ok('joia não forma runeword (não é runa)', detectRuneword(host) === null);
ok('socketSummary lista a joia pelo nome', socketSummary(host).includes(jewelToSocket.name));

// joia dá o MESMO bônus em arma e armadura (slot-agnóstico, como no D2)
const wHost = { slot: 'weapon', sockets: 1, socketed: [makeJewelUnique('facet_light')], mods: {} };
const aHost = { slot: 'body', sockets: 1, socketed: [makeJewelUnique('facet_light')], mods: {} };
ok('joia: mesmo bônus em arma e armadura', getItemMods(wHost).flatLight === getItemMods(aHost).flatLight && getItemMods(wHost).flatLight > 0);

// novas runewords presentes
for (const id of ['zephyr', 'rhyme', 'black', 'wealth', 'hoto']) {
  ok(`runeword ${id} existe`, RUNEWORDS.some(r => r.id === id));
}
// 'black' detecta com as runas certas, na ordem, no slot certo
const black = RUNEWORDS.find(r => r.id === 'black');
const blackItem = { slot: 'weapon', sockets: 3, socketed: [...black.runes] };
const detected = detectRuneword(blackItem);
ok('runeword Black detecta com runas na ordem', !!detected && detected.id === 'black');
ok('runeword Black aplica Golpe Esmagador', getItemMods(blackItem).crushingBlow > 0);
const blackWrong = { slot: 'weapon', sockets: 3, socketed: [black.runes[1], black.runes[0], black.runes[2]] };
ok('ordem errada de runas não forma runeword', detectRuneword(blackWrong) === null);

// set de 3 peças com bônus CRESCENTES (2/3 e 3/3)
const skeleSet = SET_BONUSES['Arsenal do Esqueleto'];
ok('set Arsenal do Esqueleto tem tiers 2 e 3', !!skeleSet && !!skeleSet[2] && !!skeleSet[3]);
ok('bônus 3/3 inclui +Todas as Skills', skeleSet[3].allSkills >= 1);

// contagens de conteúdo (sincronizar com o README)
ok(`agora há >=12 itens únicos (${UNIQUES.length})`, UNIQUES.length >= 12);
ok(`agora há >=14 runewords (${RUNEWORDS.length})`, RUNEWORDS.length >= 14);
ok('há 3 Facetas Arco-Íris (joias únicas)', UNIQUE_JEWELS.length === 3);

console.log(`\n${pass} verificações passaram.`);
