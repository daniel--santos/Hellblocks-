// CubeCraft: Hellblocks — ARPG estilo Diablo II no universo Minecraft (Three.js).
// Orquestrador principal: bootstrap, loop, controles, progressão de atos/dificuldades.
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { box } from './core/blocks.js';
import { RNG } from './core/rng.js';
import { UI } from './ui/ui.js';
import { Player } from './entities/player.js';
import { makeMonster, makeBoss } from './entities/monster.js';
import { BOSSES } from './data/monsters.js';
import { ACTS, COW_LEVEL, getAct, ACT_LORE } from './data/acts.js';
import { DIFFICULTIES, DIFFICULTY_LIST } from './systems/difficulty.js';
import { buildTown } from './world/town.js';
import { buildActOverworld, buildBossArena, buildCowLevel } from './world/generator.js';
import { rollDrops, generateItem, nextItemId, makeUnique, sortInventoryItems } from './systems/loot.js';
import { getInsertable } from './data/gems.js';
import { monsterBaseXP, xpLevelPenalty, xpToReach } from './systems/leveling.js';
import { buildActQuests } from './data/quests.js';
import { learnSkill, learnedActiveSkills } from './systems/skilltree.js';
import { RARITY } from './data/items.js';
import { SKILLS } from './data/skills.js';
import * as Combat from './systems/combat.js';
import { Mercenary, mercForAct, hireCost, MERC_TYPES } from './entities/mercenary.js';
import { Summon } from './entities/summon.js';
import { insertIntoSocket, emptySockets, canHaveSockets, maxSocketsForItem, detectRuneword } from './systems/sockets.js';
import { transmute } from './systems/cube.js';
import { saveGame, loadSaveData, clearSave, listSaves } from './systems/save.js';
import { generateShopStock, gambleRoll, buyPrice, sellPrice, gamblePrice, CONSUMABLE_PRICES } from './systems/economy.js';
import { shrineBuffLabel } from './data/shrines.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.engine = new Engine(this.canvas);
    this.scene = this.engine.scene; // combat/fx adicionam meshes via game.scene
    this.input = new Input(this.canvas);
    this.ui = new UI();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.running = false;

    this.monsters = [];
    this.projectiles = [];
    this.groundItems = [];
    this.fx = [];
    this.groundEffects = [];
    this.interactables = [];
    this.summons = [];           // invocações aliadas ativas
    this.playersX = 1;           // densidade/poder dos monstros (comando "players X" do D2)
    this.titleRank = 0;          // título do personagem por dificuldade vencida (0..3)
    this.mercenary = null;
    this.waypointList = [];      // waypoints descobertos (teleporte)
    this.activeBuffs = [];       // buffs de santuário ativos
    this.questLog = [];          // cadeia de quests do ato atual
    this.killCount = 0;          // mortes no ato (para a quest de limpeza)
    this._questAct = -1;
    this.returnPoint = null;     // ponto de retorno do Town Portal
    this.cube = [];              // conteúdo do Cubo Horadric
    this.condenseCharms = true;  // receita: cubo só com charms funde todos num só (ligável/desligável)
    this.stashTabs = [[]];       // baú com ABAS infinitas (cada aba = array de itens)
    this.stashTab = 0;           // aba ativa do baú
    this.saveSlot = 0;           // slot de save ativo (0..2)
    this._socketSource = null;   // gema/runa selecionada para soquetar
    this.zoneGroup = null;
    this.seedStr = 'sanctublock-' + Math.floor(performance.now());
    // RNG global de gameplay (combate/drops). game.rng é uma INSTÂNCIA usada por combat/monster.
    this.rng = new RNG((Math.floor(performance.now() * 1000) % 0xffffffff) >>> 0 || 1);

    this._bindInput();
    // floatText helper exposto ao combate
    this.floatText = (worldPos, text, cls) => this._floatText(worldPos, text, cls);
    this.log = (text, cls) => this.ui.log(text, cls);
    this.onMonsterDeath = (m, src) => this._onMonsterDeath(m, src);
    this.onPlayerDeath = () => this._onPlayerDeath();
    this.resistFor = (el) => this._resistFor(el);
  }

  start() {
    setTimeout(() => {
      this.ui.hideLoading();
      this.ui.showTitle({
        slots: listSaves(),
        onStart: (classId, diffId, hardcore, slot) => this._beginGame(classId, diffId, hardcore, slot),
        onContinue: (slot) => this._continueGame(slot),
        onDelete: (slot) => clearSave(slot),
      });
    }, 600);
    requestAnimationFrame(() => this._loop());
  }

  _beginGame(classId, diffId, hardcore, slot = 0) {
    this.saveSlot = slot;
    this.player = new Player(classId);
    this.hardcore = !!hardcore;
    this.difficulty = diffId;
    this.difficultyObj = DIFFICULTIES[diffId];
    this.engine.scene.add(this.player.mesh);
    this.actIndex = 0;
    this.zoneIndex = 0;
    this.ui.showHUD();
    this.input.setEnabled(true);
    this.running = true;
    this._goToTown();
    this.log(`Bem-vindo a Sanctublock, ${this.player.cls.name}!`, 'unique');
    this.log('Botão esquerdo move/ataca · direito conjura skill · T abre a árvore.', 'magic');
    this.save();
  }

  // Carrega o personagem salvo do slot (localStorage).
  _continueGame(slot = 0) {
    this.saveSlot = slot;
    const data = loadSaveData(slot);
    if (!data) { this.log('Nenhum save encontrado.', 'dmg'); return; }
    this.player = new Player(data.classId);
    const p = this.player;
    Object.assign(p, {
      level: data.level, xp: data.xp, stats: data.stats, statPoints: data.statPoints,
      skillPoints: data.skillPoints, skillRanks: data.skillRanks || {},
      gold: data.gold || 0, potions: data.potions || { life: 4, mana: 4, rejuv: 1 }, scrolls: data.scrolls || { id: 3, tp: 1 },
      inventory: data.inventory || [], equipment: data.equipment || {},
      beltSkills: data.beltSkills || [], rightSkill: data.rightSkill || null, leftSkill: data.leftSkill || 'attack', activeAura: data.activeAura || null,
      questBonus: data.questBonus || { resAll: 0, lifeFlat: 0 }, // bônus permanentes de quest (saves antigos = 0)
      swap: data.swap || { weapon: null, shield: null }, activeWeaponSet: data.activeWeaponSet || 0,
    });
    p.recompute(); p.life = p.maxLife; p.mana = p.maxMana; p.stamina = p.maxStamina;
    this.engine.scene.add(p.mesh);
    this.difficulty = data.difficulty || 'normal';
    this.difficultyObj = DIFFICULTIES[this.difficulty];
    this.hardcore = !!data.hardcore;
    this.titleRank = data.titleRank || 0;
    this.actIndex = data.actIndex || 0;
    this.zoneIndex = data.zoneIndex || 0;
    this.condenseCharms = data.condenseCharms !== false; // padrão LIGADO (saves antigos também)
    // baú: aceita o novo formato (abas) e o antigo (array plano) para compatibilidade
    this.stashTabs = Array.isArray(data.stashTabs) && data.stashTabs.length
      ? data.stashTabs
      : [data.stash || []];
    this.stashTab = 0;
    this.waypointList = data.waypointList || [];
    this.questLog = data.questLog || buildActQuests(this.actIndex);
    this.killCount = data.killCount || 0;
    this._questAct = data.questAct != null ? data.questAct : this.actIndex;
    if (data.merc && MERC_TYPES[data.merc.typeId]) {
      this.mercenary = new Mercenary(MERC_TYPES[data.merc.typeId], data.merc.level);
      if (data.merc.auraId) this.mercenary.setAura(data.merc.auraId);
      this.engine.scene.add(this.mercenary.mesh);
    }
    this.ui.showHUD();
    this.input.setEnabled(true);
    this.running = true;
    this._goToTown();
    this.log(`Bem-vindo de volta, ${p.cls.name} (Nível ${p.level})!`, 'unique');
  }

  save() { saveGame(this, this.saveSlot); }

  // ---------- Carregamento de zonas ----------
  _clearZone() {
    for (const m of this.monsters) this.engine.scene.remove(m.mesh);
    for (const p of this.projectiles) this.engine.scene.remove(p.mesh);
    for (const d of this.groundItems) this.engine.scene.remove(d.mesh);
    for (const e of this.groundEffects) this.engine.scene.remove(e.mesh);
    for (const s of this.summons) this.engine.scene.remove(s.mesh);
    this.monsters = []; this.projectiles = []; this.groundItems = []; this.groundEffects = []; this.fx = []; this.summons = [];
    this.bossRef = null; this.hoverMonster = null;
    if (this.zoneGroup) this.engine.scene.remove(this.zoneGroup);
  }

  _loadZone(zone) {
    this._clearZone();
    this.zone = zone;
    this.zoneGroup = zone.group;
    this.engine.scene.add(zone.group);
    this._collectObstacles(zone); // caixas de colisão das estruturas sólidas
    this.engine.setPalette(zone.palette);
    // portal de retorno (Town Portal) quando há ponto salvo e estamos na cidade
    if (zone.type === 'town' && this.returnPoint) {
      zone.exits = [...(zone.exits || []), { x: 11, z: 0, to: 'return', color: 0xff66ff, label: 'Voltar ao Portal' }];
    }
    // portais de saída (visíveis)
    this._buildExitMarkers(zone);
    // interativos da zona (NPCs, santuários, baús, waypoints)
    this.interactables = zone.interactables || [];
    // descobre waypoints da zona
    for (const it of this.interactables) if (it.type === 'waypoint') this._discoverWaypoint(it);
    // posiciona jogador (no portal de retorno se viemos de Town Portal)
    const s = zone.playerStart || { x: 0, z: 0 };
    this.player.position.set(s.x, 0, s.z);
    this.player.moveTarget = null;
    this.player.attackTarget = null;
    this.player.interactTarget = null;
    // reposiciona mercenário ao lado do jogador
    if (this.mercenary && !this.mercenary.dead) this.mercenary.position.set(s.x + 1.5, 0, s.z);
    // spawns
    for (const sp of (zone.spawns || [])) this._spawnFromDef(sp);
    if (zone.boss) this._spawnBoss(zone.boss);
    if (zone.superUnique) this._spawnSuperUnique(zone.superUnique);
    this.log('Entrando: ' + zone.name, 'magic');
  }

  // Coleta caixas de colisão (AABB no plano XZ) das estruturas marcadas userData.solid.
  _collectObstacles(zone) {
    const obs = [];
    if (zone.group) {
      zone.group.updateMatrixWorld(true);
      const box = new THREE.Box3();
      zone.group.traverse(o => {
        if (!o.userData || !o.userData.solid) return;
        box.setFromObject(o);
        if (box.isEmpty() || !isFinite(box.min.x)) return;
        const hx = (box.max.x - box.min.x) / 2, hz = (box.max.z - box.min.z) / 2;
        if (hx < 0.05 && hz < 0.05) return;
        obs.push({ cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, hx, hz });
      });
    }
    zone.obstacles = obs;
  }

  // Empurra o jogador para fora de qualquer estrutura sólida (colisão círculo-vs-AABB,
  // com deslize ao longo das paredes). Chamado todo frame após o movimento.
  _resolvePlayerCollision() {
    const obs = this.zone && this.zone.obstacles;
    if (!obs || !obs.length || !this.player) return;
    const p = this.player.position;
    const pr = 0.4; // raio do jogador
    for (const o of obs) {
      const nx = Math.max(o.cx - o.hx, Math.min(p.x, o.cx + o.hx));
      const nz = Math.max(o.cz - o.hz, Math.min(p.z, o.cz + o.hz));
      const dx = p.x - nx, dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= pr * pr) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = pr - d;
        p.x += (dx / d) * push; p.z += (dz / d) * push;
      } else {
        // centro do jogador dentro da caixa: empurra pelo eixo de menor penetração
        const penX = (o.hx + pr) - Math.abs(p.x - o.cx);
        const penZ = (o.hz + pr) - Math.abs(p.z - o.cz);
        if (penX < penZ) p.x += (p.x < o.cx ? -penX : penX);
        else p.z += (p.z < o.cz ? -penZ : penZ);
      }
    }
  }

  _discoverWaypoint(it) {
    if (this.waypointList.some(w => w.id === it.wpId)) return;
    this.waypointList.push({ id: it.wpId, label: it.label, actIndex: it.actIndex, zoneIndex: it.zoneIndex, isTown: it.isTown, zoneType: it.zoneType, wpX: it.position?.x, wpZ: it.position?.z, regionIndex: it.regionIndex });
    if (!it._silent) this.log(`Waypoint descoberto: ${it.label}`, 'magic');
  }

  _buildExitMarkers(zone) {
    zone._exitMeshes = [];
    for (const ex of (zone.exits || [])) {
      const m = box(2, 0.2, 2, ex.color || 0xffaa33, ex.color || 0xffaa33);
      m.position.set(ex.x, 0.15, ex.z);
      const light = new THREE.PointLight(ex.color || 0xffaa33, 1.2, 8);
      light.position.set(ex.x, 1.2, ex.z);
      zone.group.add(m, light);
      zone._exitMeshes.push({ ex, mesh: m });
    }
    if (zone.cowPortal) {
      // já construído em town; só marca posição
      zone._cow = zone.cowPortal;
    }
  }

  _goToTown() {
    const act = getAct(this.actIndex + 1) || ACTS[0];
    // inicia a cadeia de quests do ato (se mudou de ato)
    const enteringNewAct = this._questAct !== this.actIndex;
    if (enteringNewAct) {
      this.questLog = buildActQuests(this.actIndex);
      this._questAct = this.actIndex;
      this.killCount = 0;
    }
    this._loadZone(buildTown(act));
    if (enteringNewAct) this.ui.showLore(ACT_LORE[this.actIndex]); // narrativa do ato
    if (this.player) this.save(); // autosave ao chegar na cidade
  }
  _bossName(act) {
    return (act.boss && BOSSES[act.boss]) ? BOSSES[act.boss].name : 'o chefe';
  }
  // Overworld do ato: UM mapa contínuo. opts.at = posição; opts.region = índice da região.
  _goToOverworld(opts = {}) {
    const act = getAct(this.actIndex + 1);
    this._curRegion = -1;
    this._loadZone(buildActOverworld(act, this.difficultyObj, this.seedStr));
    if (opts.at) this.player.position.set(opts.at.x, 0, opts.at.z);
    else if (opts.region != null && this.zone.regions) {
      const r = this.zone.regions[opts.region] || this.zone.regions[0];
      this.player.position.set(r.cx, 0, 0);
    }
    if ((opts.at || opts.region != null) && this.mercenary && !this.mercenary.dead) {
      this.mercenary.position.set(this.player.position.x + 1.5, 0, this.player.position.z);
    }
    this._updateOverworldRegion(true);
  }
  // compat: "ir à selva" agora posiciona o jogador na região do overworld
  _goToWilderness(region = 0) { this._goToOverworld({ region }); }
  // atualiza a sub-área atual do overworld pela posição do jogador (nome da área estilo D2)
  _updateOverworldRegion(force) {
    if (!this.zone || this.zone.type !== 'overworld' || !this.zone.regions) return;
    const px = this.player.position.x;
    let region = this.zone.regions[0];
    for (const r of this.zone.regions) if (px >= r.xMin) region = r;
    if (force || this._curRegion !== region.index) {
      this._curRegion = region.index; this.zoneIndex = region.index; this.zone.name = region.name;
      if (!force) this.log('Entrando: ' + region.name, 'magic');
    }
  }
  _goToBoss() {
    const act = getAct(this.actIndex + 1);
    this._loadZone(buildBossArena(act, this.difficultyObj, this.seedStr));
  }
  _goToCow() {
    this._loadZone(buildCowLevel(COW_LEVEL, this.difficultyObj, this.seedStr));
    this.log('🐄 Você entrou no Pasto Proibido! MOO!', 'set');
  }

  // escala de "Players X": +50% de vida e XP por jogador adicional
  _applyPlayers(m) {
    const f = 1 + (this.playersX - 1) * 0.5;
    if (f !== 1) { m.maxLife = Math.round(m.maxLife * f); m.life = m.maxLife; }
    m._playersXP = f;
    return m;
  }

  _spawnFromDef(sp) {
    const m = makeMonster(sp.typeId, sp.level, sp.rankId, this.difficultyObj, this.rng);
    this._applyPlayers(m);
    m.setPosition(sp.x, sp.z);
    this.engine.scene.add(m.mesh);
    this.monsters.push(m);
    return m;
  }
  _spawnBoss(b) {
    const m = makeBoss(b.bossId, b.level, this.difficultyObj, this.rng);
    this._applyPlayers(m);
    m.setPosition(b.x, b.z);
    this.engine.scene.add(m.mesh);
    this.monsters.push(m);
    this.bossRef = m;
    this.log(`⚠ ${m.name} — ${m.title || ''}`, 'unique');
  }

  // invocação aliada (summon) do jogador
  spawnSummon(skill, stats) {
    const kind = skill.summonKind;
    // re-conjurar substitui as do mesmo tipo
    for (const s of this.summons) if (s.kind === kind) { s.dead = true; this.engine.scene.remove(s.mesh); }
    this.summons = this.summons.filter(s => !s.dead);
    const count = stats.count || 1;
    for (let i = 0; i < count; i++) {
      const s = new Summon(kind, {
        life: stats.life, damage: stats.damage, element: stats.element,
        ranged: stats.ranged, stationary: stats.stationary, expireAt: this.time + (stats.duration || 30),
      });
      const ang = (i / count) * Math.PI * 2;
      s.setPosition(this.player.position.x + Math.cos(ang) * 2.2, this.player.position.z + Math.sin(ang) * 2.2);
      this.engine.scene.add(s.mesh);
      this.summons.push(s);
    }
    const nm = { spirit: 'Espíritos Sagrados', hydra: 'Hidra', valkyrie: 'Valquíria' }[kind] || kind;
    this.log(`Invocou: ${nm}!`, 'magic');
  }

  _spawnSuperUnique(su) {
    const m = makeMonster(su.typeId, su.level, 'unique', this.difficultyObj, this.rng);
    m.name = su.name; // nome fixo nomeado
    m.superUnique = true;
    this._applyPlayers(m);
    m.setPosition(su.x, su.z);
    this.engine.scene.add(m.mesh);
    this.monsters.push(m);
    // matilha de lacaios
    for (let i = 0; i < su.minions; i++) {
      const mn = makeMonster(su.typeId, su.level, 'normal', this.difficultyObj, this.rng);
      this._applyPlayers(mn);
      const ang = this.rng.range(0, Math.PI * 2);
      mn.setPosition(su.x + Math.cos(ang) * 2.5, su.z + Math.sin(ang) * 2.5);
      this.engine.scene.add(mn.mesh);
      this.monsters.push(mn);
    }
    this.log(`⭐ ${su.name} ronda esta área com sua matilha!`, 'rare');
  }

  // invocação de lacaios por boss
  spawnMinions(boss, n) {
    const act = getAct(this.actIndex + 1) || ACTS[0];
    for (let i = 0; i < n; i++) {
      const sp = { typeId: this.rng.pick(act.monsterPool), level: boss.level, rankId: 'normal' };
      const m = makeMonster(sp.typeId, sp.level, sp.rankId, this.difficultyObj, this.rng);
      this._applyPlayers(m);
      const ang = this.rng.range(0, Math.PI * 2);
      m.setPosition(boss.position.x + Math.cos(ang) * 3, boss.position.z + Math.sin(ang) * 3);
      this.engine.scene.add(m.mesh);
      this.monsters.push(m);
    }
  }
  delayedMeteor(pos, damage, element) {
    Combat.groundEffect(this, pos.clone(), { damage, element, radius: 3, delay: 0.8, behavior: 'meteor' });
  }

  // ---------- Mortes / drops ----------
  _onMonsterDeath(m, source) {
    if (m._counted) return;
    m._counted = true;
    this.killCount = (this.killCount || 0) + 1;
    this._checkQuest('kills');
    // Encantado-Fogo/Raio: o corpo explode numa nova ao morrer (estilo D2). Atinge jogador/companheiros.
    if (m.deathNova) {
      Combat.novaBurst(this, m.position.clone(), 3.2, Math.round((m.damage || 10) * 1.5), m.deathNova, 0, 'monster');
    }
    // sustain: vida/mana por morte (afixos D2)
    const lpk = this.player.bonuses.lifePerKill || 0, mpk = this.player.bonuses.manaPerKill || 0;
    if (lpk) this.player.life = Math.min(this.player.maxLife, this.player.life + lpk);
    if (mpk) this.player.mana = Math.min(this.player.maxMana, this.player.mana + mpk);
    // XP
    const baseXP = monsterBaseXP(m.level) * m.rank.xpMul * this.difficultyObj.monsterXPMul;
    const xp = Math.floor(baseXP * xpLevelPenalty(this.player.level, m.level) * (this.player._xpMul || 1) * (m._playersXP || 1));
    const leveled = this.player.gainXP(xp);
    this._floatText(this.player.position, '+' + xp + ' XP', 'xp');
    if (leveled) { this.log(`⬆ Nível ${this.player.level}! +${this.player.cls.statPointsPerLevel} atributo, +1 skill.`, 'set'); this._refreshBelt(); this.save(); }

    // Drops
    const mf = this.player.bonuses.magicFind || 0;
    const drops = rollDrops(m.level, m.rank, mf, this.difficultyObj, this.rng);
    let off = 0;
    for (const d of drops) {
      this._spawnGroundItem(d, m.position, off++);
    }

    // remove mesh
    this.engine.scene.remove(m.mesh);

    // boss?
    if (m.isBoss) this._onBossDeath(m);
  }

  _onBossDeath(m) {
    this.log(`💀 ${m.name} foi derrotado!`, 'unique');
    if (m.bossId === COW_LEVEL.boss) {
      this.log('👑 O Rei das Vacas tombou! O pasto está livre.', 'set');
      // recompensa do secret: o charm único Anihilus (ou um charm raro de reserva)
      const charm = makeUnique('anihilus') || generateItem(Math.max(20, this.player.level), 'rare', this.rng, { slot: 'charm' });
      this._spawnGroundItem({ type: 'item', item: charm }, m.position, 0);
      return;
    }
    // quest de derrotar o boss do ato
    this._checkQuest('boss');
    // progressão de ato
    if (this.actIndex < ACTS.length - 1) {
      this.actIndex++;
      this.zoneIndex = 0;
      const nextAct = getAct(this.actIndex + 1);
      this.log(`🏆 ${getAct(this.actIndex).name} concluído! Avançando para ${nextAct.townName}.`, 'set');
      setTimeout(() => this._goToTown(), 1500);
    } else {
      // último ato concluído -> título por dificuldade vencida + sobe dificuldade
      const order = this.difficultyObj.order;
      this.titleRank = Math.max(this.titleRank || 0, order + 1);
      this.log(`🎖️ Título conquistado: ${this.playerTitle()}!`, 'unique');
      if (order < DIFFICULTY_LIST.length - 1) {
        const next = DIFFICULTY_LIST[order + 1];
        this.difficulty = next.id; this.difficultyObj = next;
        this.actIndex = 0; this.zoneIndex = 0;
        this.log(`🔥 DIFICULDADE ${next.name.toUpperCase()} DESBLOQUEADA! Sanctublock recomeça, mais cruel.`, 'unique');
        setTimeout(() => this._goToTown(), 2000);
      } else {
        this.log('🌟 VOCÊ CONQUISTOU O INFERNO! Sanctublock está salva. Parabéns, lenda cúbica!', 'unique');
        setTimeout(() => this._goToTown(), 2000);
      }
    }
  }

  // título por dificuldade vencida (Normal→Sir/Dama, Pesadelo→Conde(ssa), Inferno→Barão/Baronesa)
  playerTitle() {
    const r = this.titleRank || 0;
    if (r <= 0) return '';
    const male = this.player.classId === 'guardian';
    const T = { 1: male ? 'Sir' : 'Dama', 2: male ? 'Conde' : 'Condessa', 3: male ? 'Barão' : 'Baronesa' };
    return T[Math.min(3, r)] || '';
  }

  _spawnGroundItem(drop, pos, offset) {
    let color = 0xffff66, size = 0.3;
    if (drop.type === 'gold') color = 0xffd040;
    else if (drop.type === 'potion') color = drop.potion === 'life' ? 0xff4040 : 0x4060ff;
    else if (drop.type === 'scroll') { color = 0xddccaa; size = 0.28; }
    else if (drop.type === 'gem') { color = 0xff66cc; size = 0.32; }
    else if (drop.type === 'rune') { color = 0xff8822; size = 0.32; }
    else if (drop.type === 'item') { color = parseInt((RARITY[drop.item.rarity].color).slice(1), 16); size = 0.4; }
    const mesh = box(size, size, size, color, color);
    const ang = offset * 1.3;
    const p = new THREE.Vector3(pos.x + Math.cos(ang) * (0.6 + offset * 0.3), 0.4, pos.z + Math.sin(ang) * (0.6 + offset * 0.3));
    mesh.position.copy(p);
    if (drop.type === 'item' && drop.item.rarity !== 'normal') {
      const l = new THREE.PointLight(color, 1, 5); l.position.y = 0.5; mesh.add(l);
    }
    this.engine.scene.add(mesh);
    this.groundItems.push({ ...drop, mesh, position: p, bob: Math.random() * 6 });
  }

  _pickupGroundItems() {
    const p = this.player.position;
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const d = this.groundItems[i];
      // item solto pelo jogador só pode ser recolhido depois que ele sair do raio (evita pegar de volta na hora)
      if (d.playerDropped && !d.armPickup) {
        if (d.position.distanceTo(p) > 1.7) d.armPickup = true;
        continue;
      }
      if (d.position.distanceTo(p) < 1.4) {
        if (d.type === 'gold') { this.player.gold += d.amount; this.log(`+${d.amount} ouro`); }
        else if (d.type === 'potion') {
          const cap = this.player.beltCapacity();
          if ((this.player.potions[d.potion] || 0) >= cap) { this.log('Cinto cheio — equipe um cinto maior.', 'desc'); }
          else { this.player.potions[d.potion] = Math.min(cap, (this.player.potions[d.potion] || 0) + 1); this.log(`Poção de ${d.potion === 'life' ? 'vida' : 'mana'} coletada`); }
        } else if (d.type === 'scroll') {
          this.player.scrolls[d.scroll] = Math.min(20, (this.player.scrolls[d.scroll] || 0) + 1);
          this.log(`Pergaminho de ${d.scroll === 'id' ? 'Identificação' : 'Portal'} coletado`);
        } else if (d.type === 'gem' || d.type === 'rune') {
          if (this.player.inventory.length >= 40) { this.log('Inventário cheio!', 'dmg'); continue; }
          const def = getInsertable(d.id);
          if (def) {
            this.player.inventory.push({ id: nextItemId(), name: def.name, icon: def.icon, rarity: 'normal', identified: true, kind: def.kind, socketableId: def.id, slot: def.kind, reqLevel: def.reqLevel || 1, mods: {} });
            this.log(`Você pegou: ${def.name}`);
          }
        } else if (d.type === 'item') {
          if (this.player.inventory.length >= 40) { this.log('Inventário cheio!', 'dmg'); continue; }
          this.player.inventory.push(d.item);
          this.log(`Você pegou: ${d.item.name}`, RARITY[d.item.rarity].cssClass);
        }
        this.engine.scene.remove(d.mesh);
        this.groundItems.splice(i, 1);
      }
    }
  }

  _onPlayerDeath() {
    if (this.player.dead) return;
    this.player.dead = true;
    this.running = false;
    this.input.setEnabled(false);
    // HARDCORE: morte permanente — apaga o save do slot e força recomeço
    if (this.hardcore) {
      clearSave(this.saveSlot);
      this.log('☠️ MORTE PERMANENTE (Hardcore). Seu personagem se foi.', 'unique');
      this.ui.showDeath(() => { location.reload(); }, true);
      return;
    }
    // penalidade de morte estilo D2: perde parte do ouro
    const lost = Math.floor(this.player.gold * 0.10);
    if (lost > 0) { this.player.gold -= lost; this.log(`Você perdeu ${lost} de ouro ao morrer.`, 'dmg'); }
    // perda de XP em Pesadelo/Inferno (como no D2), sem descer de nível
    const pen = this.difficultyObj.order === 1 ? 0.05 : this.difficultyObj.order === 2 ? 0.10 : 0;
    if (pen > 0) {
      const into = this.player.xp - xpToReach(this.player.level);
      const xpLost = Math.floor(into * pen);
      if (xpLost > 0) { this.player.xp -= xpLost; this.log(`Você perdeu ${xpLost} de XP ao morrer (${this.difficultyObj.name}).`, 'dmg'); }
    }
    this.ui.showDeath(() => {
      this.player.dead = false;
      this.player.life = this.player.maxLife;
      this.player.mana = this.player.maxMana;
      this.running = true;
      this.input.setEnabled(true);
      this._goToTown();
    });
  }

  // ---------- Equipar mercenário ----------
  equipMerc(item) {
    if (!this.mercenary || this.mercenary.dead) { this.log('Sem mercenário ativo.', 'dmg'); return; }
    if (item.identified === false) { this.log('Identifique o item antes.', 'dmg'); return; }
    const res = this.mercenary.equipItem(item);
    if (!res.ok) { this.log('Mercenário não pode usar: ' + res.reason, 'dmg'); return; }
    const i = this.player.inventory.indexOf(item);
    if (i >= 0) this.player.inventory.splice(i, 1);
    if (res.prev) this.player.inventory.push(res.prev);
    this.log(`Equipou ${item.name} no mercenário.`, 'magic');
  }
  unequipMerc(slot) {
    if (!this.mercenary) return;
    const it = this.mercenary.unequipItem(slot);
    if (it) this.player.inventory.push(it);
  }

  _resistFor(element) {
    const base = (this.player.resBase && this.player.resBase[element]) || 0;
    const cap = 75 + (this.player.maxResBonus || 0);
    return Math.min(cap, Math.round(base - this.difficultyObj.resPenalty));
  }

  // ---------- Skills / belt ----------
  tryLearnSkill(skillId) {
    if (learnSkill(this.player, skillId)) {
      // auto-ativa a primeira aura aprendida (Guardião)
      if (SKILLS[skillId].type === 'aura' && !this.player.activeAura) this.player.activeAura = skillId;
      this.player.recompute();
      this._refreshBelt();
      this.log(`Aprendeu ${SKILLS[skillId].name} (rank ${this.player.skillRanks[skillId]})`, 'magic');
      this.save();
    }
  }
  _refreshBelt() {
    const actives = learnedActiveSkills(this.player);
    this.player.beltSkills = actives.map(s => s.id).slice(0, 4);
    if (!this.player.rightSkill && this.player.beltSkills.length) this.player.rightSkill = this.player.beltSkills[0];
    if (this.player.rightSkill && !this.player.beltSkills.includes(this.player.rightSkill)) this.player.rightSkill = this.player.beltSkills[0];
  }

  // Troca de armas (Weapon Swap, tecla W): alterna entre o conjunto I e II de arma/escudo.
  // Call to Arms: trocar PARA uma arma com CtA concede "Ordens de Batalha" (buff que persiste).
  swapWeapons() {
    const p = this.player; if (!p) return;
    const e = p.equipment; const sw = p.swap = p.swap || { weapon: null, shield: null };
    [e.weapon, sw.weapon] = [sw.weapon || null, e.weapon || null];
    [e.shield, sw.shield] = [sw.shield || null, e.shield || null];
    if (!e.weapon) delete e.weapon;
    if (!e.shield) delete e.shield;
    p.activeWeaponSet = p.activeWeaponSet ? 0 : 1;
    p.recompute();
    this._refreshBelt();
    if (e.weapon && detectRuneword(e.weapon)?.id === 'call_to_arms') {
      this.activeBuffs = this.activeBuffs.filter(b => b.label !== 'Ordens de Batalha');
      this.activeBuffs.push({ type: 'damage', mult: 1.25, until: this.time + 30, label: 'Ordens de Batalha' });
      this.log('⚔️ Ordens de Batalha! (Call to Arms) — +25% dano por 30s.', 'set');
    }
    this.log(`Conjunto de armas ${p.activeWeaponSet + 1}.`, 'magic');
    this.save();
    return p.activeWeaponSet;
  }

  // alterna correr/andar (Vigor estilo D2): andar não gasta vigor e regenera melhor
  toggleRun() {
    if (!this.player) return;
    this.player.running = !this.player.running;
    this.log(this.player.running ? '🏃 Correndo (gasta vigor).' : '🚶 Andando (poupa vigor).', 'desc');
    return this.player.running;
  }

  _usePotion(kind) {
    const p = this.player;
    if ((p.potions[kind] || 0) <= 0) {
      const nm = kind === 'life' ? 'vida' : kind === 'mana' ? 'mana' : 'rejuvenescimento';
      this.log(`Sem poções de ${nm}!`, 'dmg'); return;
    }
    p.potions[kind]--;
    if (kind === 'life') { p.life = Math.min(p.maxLife, p.life + p.maxLife * 0.6); this._floatText(p.position, '+vida', 'desc'); }
    else if (kind === 'mana') { p.mana = Math.min(p.maxMana, p.mana + p.maxMana * 0.6); this._floatText(p.position, '+mana', 'desc'); }
    else { // rejuvenescimento: restaura vida E mana
      p.life = Math.min(p.maxLife, p.life + p.maxLife * 0.7);
      p.mana = Math.min(p.maxMana, p.mana + p.maxMana * 0.7);
      this._floatText(p.position, '+rejuv', 'desc');
    }
  }

  // reparo no Ferreiro
  repairAll() {
    const items = this.player.repairableItems();
    if (items.length === 0) { this.log('Nada para reparar.', 'desc'); return; }
    let cost = 0;
    for (const it of items) cost += (it.durability.max - it.durability.cur) * 8 + 10;
    if (this.player.gold < cost) { this.log(`Reparo custa ${cost} de ouro (insuficiente).`, 'dmg'); return; }
    this.player.gold -= cost;
    this.player.repairAllItems();
    this.log(`Itens reparados por ${cost} de ouro.`, 'magic');
  }
  repairCost() {
    let cost = 0;
    for (const it of this.player.repairableItems()) cost += (it.durability.max - it.durability.cur) * 8 + 10;
    return cost;
  }

  // ---------- Quests ----------
  _checkQuest(type) {
    const q = this.questLog.find(x => x.type === type && !x.done);
    if (!q) return;
    if (type === 'kills' && this.killCount < q.target) return;
    q.done = true;
    this._grantReward(q.reward);
    this.log(`🏅 Quest concluída: ${q.text} — recompensa: ${q.rewardText}`, 'set');
    this.save();
  }
  _grantReward(reward) {
    if (!reward) return;
    const p = this.player;
    if (reward.skillPoints) p.skillPoints += reward.skillPoints;
    if (reward.statPoints) p.statPoints += reward.statPoints;
    if (reward.gold) p.gold += reward.gold;
    if (reward.item) { const it = generateItem(Math.max(10, p.level), 'rare', this.rng); p.inventory.push(it); }
    // recompensas PERMANENTES (estilo D2: Anya = +resist, Pássaro Dourado = +vida)
    if (reward.resAll) { p.questBonus.resAll += reward.resAll; p.recompute(); }
    if (reward.lifeFlat) { p.questBonus.lifeFlat += reward.lifeFlat; p.recompute(); p.life = p.maxLife; }
    // Larzuk/Forja: soqueta gratuitamente 1 item elegível
    if (reward.socket) this._grantSocketReward();
  }
  // Soqueta de graça o melhor item elegível (arma primeiro, depois corpo/elmo/escudo, depois inventário).
  _grantSocketReward() {
    const p = this.player;
    const eligible = (it) => it && canHaveSockets(it) && !it.sockets;
    const pref = ['weapon', 'body', 'helm', 'shield', 'gloves', 'boots', 'belt'];
    const it = pref.map(s => p.equipment[s]).find(eligible) || p.inventory.find(eligible);
    if (!it) { p.gold += 500; this.log('🔩 Larzuk não achou item p/ soquetar — recebeu 500 de ouro.', 'magic'); return; }
    it.sockets = Math.min(maxSocketsForItem(it), 3);
    it.socketed = [];
    p.recompute();
    this.log(`🔩 ${it.name} recebeu ${it.sockets} soquete(s)!`, 'set');
  }

  // aura ativa (Guardião)
  setActiveAura(skillId) {
    this.player.setActiveAura(this.player.activeAura === skillId ? null : skillId);
    this.log(this.player.activeAura ? `Aura ativa: ${SKILLS[skillId].name}` : 'Aura desativada.', 'magic');
  }

  respecCost() { return 1000 + this.player.level * 50; }
  respec() {
    const cost = this.respecCost();
    if (this.player.gold < cost) { this.log(`Reespecialização custa ${cost} de ouro (insuficiente).`, 'dmg'); return; }
    this.player.gold -= cost;
    this.player.respec();
    this._refreshBelt();
    this.log('🔄 Atributos e skills reespecializados! Pontos devolvidos.', 'set');
    this.save();
  }

  // ---------- Input ----------
  _bindInput() {
    const i = this.input;
    i.onLeftDown((e) => this._handleLeftClick(e));
    i.on('1', () => this._selectBelt(0));
    i.on('2', () => this._selectBelt(1));
    i.on('3', () => this._selectBelt(2));
    i.on('4', () => this._selectBelt(3));
    i.on('q', () => this._usePotion('life'));
    i.on('w', () => this.player && this.swapWeapons()); // W = troca de armas (D2); rejuv fica no R
    i.on('e', () => this._usePotion('mana'));
    i.on('r', () => this._usePotion('rejuv'));
    i.on('c', () => this.player && this.ui.toggleChar(this));
    i.on('i', () => this.player && this.ui.toggleInventory(this));
    i.on('t', () => this.player && this.ui.toggleTree(this));
    i.on('f', () => this.player && this._useTownPortal());
    i.on('z', () => this.player && this.ui.openWaypoints(this));
    i.on('h', () => this.player && this.ui.openCube(this));
    i.on('b', () => this.player && this.ui.openStash(this));
    i.on('j', () => this.player && this.ui.openQuests(this));
    i.on('x', () => this._cyclePlayers());
    i.on('escape', () => { this.ui.closeAll(); this._socketSource = null; });
    i.on(' ', () => {/* limpar chão: futuro */ });
  }
  _selectBelt(idx) {
    const sid = this.player?.beltSkills[idx];
    if (sid) { this.player.rightSkill = sid; this.log(`Skill direita: ${SKILLS[sid].name}`); }
  }

  _cyclePlayers() {
    if (!this.player) return;
    const opts = [1, 3, 5, 8];
    this.playersX = opts[(opts.indexOf(this.playersX) + 1) % opts.length];
    this.log(`Players ${this.playersX} — monstros mais fortes e mais XP (vale para as próximas áreas).`, 'magic');
  }

  // define a skill do clique esquerdo (ataque básico ou uma skill aprendida)
  setLeftSkill(sid) {
    this.player.leftSkill = sid;
    this.log(`Skill esquerda: ${sid === 'attack' ? 'Ataque básico' : SKILLS[sid].name}`);
  }

  _handleLeftClick(e) {
    if (!this.running || !this.player) return;
    // Shift = "ficar parado" (Stand Still): ataca na direção do cursor sem se mover nem travar alvo
    if (this.input.shift) {
      this.player.attackTarget = null; this.player.moveTarget = null; this.player.interactTarget = null;
      this._basicAttackToward(this.engine.screenToGround(e.clientX, e.clientY));
      return;
    }
    // clicou num monstro? -> atacar
    const target = this._pickMonsterAt(e.clientX, e.clientY);
    if (target) { this.player.attackTarget = target; this.player.moveTarget = null; this.player.interactTarget = null; return; }
    // clicou num interativo (NPC/santuário/baú/waypoint)?
    const itMeshes = this.interactables.filter(it => !it.used).map(it => it.mesh);
    const ihits = this.engine.pickObjects(e.clientX, e.clientY, itMeshes);
    if (ihits.length) {
      const it = this.interactables.find(x => this._meshContains(x.mesh, ihits[0].object));
      if (it) { this.player.interactTarget = it; this.player.attackTarget = null; this.player.moveTarget = null; return; }
    }
    // senão move
    const g = this.engine.screenToGround(e.clientX, e.clientY);
    this.player.attackTarget = null;
    this.player.interactTarget = null;
    this.player.moveTarget = g.clone();
  }
  _meshContains(group, obj) {
    let o = obj;
    while (o) { if (o === group) return true; o = o.parent; }
    return false;
  }

  // Seleção tolerante de monstro sob o cursor: raycast na hitbox + fallback por proximidade no chão.
  // strict=true desativa o fallback (usado para o "hover", que deve ser preciso).
  _pickMonsterAt(cx, cy, strict = false) {
    const alive = this.monsters.filter(m => !m.dead);
    if (alive.length === 0) return null;
    // 1) raycast contra as hitboxes (volume 3D generoso)
    const hits = this.engine.pickObjects(cx, cy, alive.map(m => m.mesh));
    if (hits.length) {
      let obj = hits[0].object;
      while (obj) { if (obj.userData && obj.userData.monster && !obj.userData.monster.dead) return obj.userData.monster; obj = obj.parent; }
      const byMesh = alive.find(m => this._meshContains(m.mesh, hits[0].object));
      if (byMesh) return byMesh;
    }
    if (strict) return null;
    // 2) fallback: monstro mais próximo do ponto do chão sob o cursor
    const g = this.engine.screenToGround(cx, cy);
    let best = null, bd = Infinity;
    for (const m of alive) {
      const d = Math.hypot(m.position.x - g.x, m.position.z - g.z);
      const thr = 1.1 + (m.radius || 0.5);
      if (d <= thr && d < bd) { bd = d; best = m; }
    }
    return best;
  }

  _processHeldInput(dt) {
    const p = this.player;
    if (!p || p.dead) return;
    // botão direito segurado -> conjura skill direita na direção do cursor (limitado pela taxa de conjuração)
    if (this.input.rightHeld && p.rightSkill && (p._castCd || 0) <= 0) {
      const g = this.engine.screenToGround(this.input.mouseX, this.input.mouseY);
      if (Combat.castSkill(this, p, p.rightSkill, g)) {
        p._castCd = Math.max(0.12, 0.32 / ((p.derived.attackSpeed || 1) * (1 + (p.derived.fcr || 0))));
      }
    }
    // botão esquerdo segurado -> seguir o cursor (mover) ou atacar parado (Shift)
    if (this.input.leftHeld && !p.attackTarget) {
      const target = this._pickMonsterAt(this.input.mouseX, this.input.mouseY);
      if (target && !this.input.shift) { p.attackTarget = target; p.moveTarget = null; }
      else if (this.input.shift) { p.moveTarget = null; this._basicAttackToward(this.engine.screenToGround(this.input.mouseX, this.input.mouseY)); }
      else p.moveTarget = this.engine.screenToGround(this.input.mouseX, this.input.mouseY).clone();
    }
  }

  // ---------- Movimento / ataque do jogador ----------
  _updatePlayerMovement(dt) {
    const p = this.player;
    if (p.dead) { p._isMoving = false; return; }
    let speed = p.derived.moveSpeed * (p._speedMul || 1);
    // correr (vigor>0) = velocidade cheia; andar (vigor esgotado ou alternado) = 55%
    const running = (p.running !== false) && (p.stamina == null || p.stamina > 0);
    if (!running) speed *= 0.55;
    if (p.slowUntil && this.time < p.slowUntil) speed *= (1 - (p.slowAmt || 0.4));

    // dash de Investida
    if (p._dashTo) {
      const d = new THREE.Vector3().subVectors(p._dashTo, p.position).setY(0);
      if (d.length() < 0.6) { p._dashTo = null; }
      else { d.normalize(); p.position.addScaledVector(d, speed * 3 * dt); p.facing = Math.atan2(d.x, d.z); p._isMoving = true; return; }
    }

    const standStill = this.input.shift; // "ficar parado" (Stand Still) do D2

    // ataque a alvo
    if (p.attackTarget) {
      if (p.attackTarget.dead) { p.attackTarget = null; }
      else {
        const t = p.attackTarget;
        const d = new THREE.Vector3().subVectors(t.position, p.position).setY(0);
        const dist = d.length();
        const reach = this._isRangedClass() ? 14 : 2.2;
        p.facing = Math.atan2(d.x, d.z);
        if (dist > reach && !standStill) {
          // aproxima do alvo (a menos que esteja com Shift = parado)
          d.normalize(); p.position.addScaledVector(d, speed * dt); p._isMoving = true;
        } else {
          p._isMoving = false;
          if (this._isRangedClass() || dist <= reach) this._basicAttack(t);
          else this._basicAttackToward(t.position); // melee parado e fora de alcance: golpeia no lugar
        }
        return;
      }
    }

    // caminhar até um interativo e ativá-lo
    if (p.interactTarget) {
      const it = p.interactTarget;
      if (it.used) { p.interactTarget = null; }
      else {
        const d = new THREE.Vector3().subVectors(it.position, p.position).setY(0);
        const dist = d.length();
        p.facing = Math.atan2(d.x, d.z);
        if (dist > 2.2) { d.normalize(); p.position.addScaledVector(d, speed * dt); p._isMoving = true; }
        else { p._isMoving = false; this._activateInteractable(it); p.interactTarget = null; }
        return;
      }
    }

    // movimento para ponto (suprimido enquanto Shift estiver pressionado)
    if (p.moveTarget && !standStill) {
      const d = new THREE.Vector3().subVectors(p.moveTarget, p.position).setY(0);
      const dist = d.length();
      if (dist < 0.3) { p.moveTarget = null; p._isMoving = false; }
      else { d.normalize(); p.position.addScaledVector(d, speed * dt); p.facing = Math.atan2(d.x, d.z); p._isMoving = true; }
    } else {
      p._isMoving = false;
    }
  }

  // ---------- Interativos ----------
  _activateInteractable(it) {
    switch (it.type) {
      case 'npc': this._openNpc(it); break;
      case 'shrine': this._activateShrine(it); break;
      case 'chest': this._openChest(it); break;
      case 'waypoint': this.ui.openWaypoints(this); break;
    }
  }

  _openNpc(it) {
    if (it.role === 'healer') {
      // cura grátis + contratar/reviver mercenário
      this.player.life = this.player.maxLife; this.player.mana = this.player.maxMana;
      this.log('A Curandeira restaura sua vida e mana.', 'magic');
      this.ui.openMercenary(this);
    } else {
      // ferreiro/mercador abrem a loja (mercador também aposta)
      if (!it._stock) it._stock = generateShopStock(this.player.level, this.difficultyObj, this.rng);
      this.ui.openShop(this, it);
    }
  }

  _activateShrine(it) {
    it.used = true;
    this._checkQuest('shrine');
    if (it.mesh.userData.crystal) it.mesh.userData.crystal.visible = false;
    const st = it.shrine;
    if (st.instant === 'refill') {
      this.player.life = this.player.maxLife; this.player.mana = this.player.maxMana;
      this.log(`${st.icon} ${st.name}: vida e mana restauradas!`, 'set');
    } else if (st.buff) {
      this.activeBuffs = this.activeBuffs.filter(b => b.type !== st.buff.type);
      this.activeBuffs.push({ type: st.buff.type, mult: st.buff.mult, add: st.buff.add, until: this.time + st.buff.dur, label: shrineBuffLabel(st.buff) });
      this.log(`${st.icon} ${st.name}: ${shrineBuffLabel(st.buff)} por ${st.buff.dur}s!`, 'set');
    }
  }

  _openChest(it) {
    it.used = true;
    if (it.mesh.userData.lid) it.mesh.userData.lid.rotation.x = -1.2; // abre a tampa
    const mf = this.player.bonuses.magicFind || 0;
    const drops = rollDrops(it.areaLevel, { id: 'champion', dropMul: 2, xpMul: 0 }, mf, this.difficultyObj, this.rng);
    let off = 0;
    for (const d of drops) this._spawnGroundItem(d, it.position, off++);
    this.log('🧰 Você abriu um baú!', 'magic');
  }

  // teleporte via waypoint
  travelToWaypoint(w) {
    this.ui.closeAll();
    this.actIndex = w.actIndex;
    if (w.zoneType === 'town' || w.isTown) this._goToTown();
    else if (w.zoneType === 'boss') this._goToBoss();
    else if (w.zoneType === 'overworld' && w.wpX != null) this._goToOverworld({ at: { x: w.wpX, z: w.wpZ } });
    else this._goToOverworld({ region: w.regionIndex != null ? w.regionIndex : w.zoneIndex });
  }

  // ---------- Mercenário ----------
  hireMercenary(type, auraId) {
    const cost = hireCost(type, this.player.level);
    if (this.mercenary && !this.mercenary.dead) { this.log('Você já tem um mercenário.', 'dmg'); return false; }
    if (this.player.gold < cost) { this.log('Ouro insuficiente para contratar.', 'dmg'); return false; }
    this.player.gold -= cost;
    this.mercenary = new Mercenary(type, this.player.level);
    if (auraId) this.mercenary.setAura(auraId); // aura selecionável (Guarda do Deserto, Ato II)
    this.mercenary.position.set(this.player.position.x + 1.5, 0, this.player.position.z);
    this.engine.scene.add(this.mercenary.mesh);
    this.log(`Contratou ${type.name}${this.mercenary.auraId ? ' (' + this.mercenary.auraText + ')' : ''} por ${cost} de ouro!`, 'set');
    return true;
  }
  reviveMercenary() {
    if (!this.mercenary) return false;
    const cost = Math.floor(hireCost(this.mercenary.type, this.player.level) * 0.5);
    if (this.player.gold < cost) { this.log('Ouro insuficiente para reviver.', 'dmg'); return false; }
    this.player.gold -= cost;
    this.mercenary.dead = false;
    this.mercenary.life = this.mercenary.maxLife;
    this.mercenary.mesh.visible = true;
    this.log(`Mercenário revivido por ${cost} de ouro.`, 'magic');
    return true;
  }

  // ---------- Town Portal ----------
  _useTownPortal() {
    if (!this.running) return;
    if (this.zone.type === 'town') {
      if (this.returnPoint) { this._returnFromTown(); }
      else this.log('Você já está na cidade.', 'desc');
      return;
    }
    if (this.player.scrolls.tp <= 0) { this.log('Sem Pergaminhos de Portal!', 'dmg'); return; }
    if ((this.zone.exits || []).some(e => e.townPortal)) { this.log('Já há um Portal aberto aqui.', 'desc'); return; }
    this.player.scrolls.tp--;
    const px = this.player.position.x, pz = this.player.position.z;
    this.returnPoint = { actIndex: this.actIndex, zoneIndex: this.zoneIndex, type: this.zone.type, x: px, z: pz };
    // Portal FÍSICO (estilo D2): abre AO LADO do jogador (offset > 1.3 p/ não disparar na hora);
    // atravesse-o para ir à cidade. Na cidade já existe a saída "return" de volta a este ponto.
    const portal = { x: px + 2.5, z: pz, to: 'town', townPortal: true, color: 0xff66ff, label: 'Portal para a Cidade' };
    this.zone.exits = [...(this.zone.exits || []), portal];
    this._spawnPortalMarker(portal);
    this.log('🌀 Portal aberto — atravesse-o para ir à cidade.', 'magic');
  }
  // marcador visual do Town Portal físico (plano brilhante + luz), adicionado à zona atual
  _spawnPortalMarker(ex) {
    const g = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6),
      new THREE.MeshBasicMaterial({ color: ex.color || 0xff66ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    plane.position.y = 1.3;
    g.add(plane);
    const light = new THREE.PointLight(ex.color || 0xff66ff, 1.6, 9); light.position.y = 1.4; g.add(light);
    g.position.set(ex.x, 0, ex.z);
    ex._portalMesh = g;
    if (this.zone && this.zone.group) this.zone.group.add(g);
  }
  _returnFromTown() {
    const rp = this.returnPoint;
    this.returnPoint = null;
    this.actIndex = rp.actIndex;
    if (rp.type === 'overworld') this._goToOverworld({ at: { x: rp.x, z: rp.z } });
    else if (rp.type === 'wilderness') this._goToOverworld({ region: rp.zoneIndex });
    else if (rp.type === 'boss') this._goToBoss();
    else if (rp.type === 'cow') this._goToCow();
    else this._goToOverworld();
  }

  // ---------- Loja / economia ----------
  buyConsumable(kind) {
    const price = CONSUMABLE_PRICES[kind];
    if (this.player.gold < price) { this.log('Ouro insuficiente.', 'dmg'); return; }
    if (kind === 'life' || kind === 'mana' || kind === 'rejuv') {
      const cap = this.player.beltCapacity();
      if ((this.player.potions[kind] || 0) >= cap) { this.log('Cinto cheio — equipe um cinto maior.', 'desc'); return; }
      this.player.gold -= price;
      this.player.potions[kind] = Math.min(cap, (this.player.potions[kind] || 0) + 1);
    } else {
      this.player.gold -= price;
      this.player.scrolls[kind] = Math.min(20, (this.player.scrolls[kind] || 0) + 1);
    }
  }
  buyItem(npc, item) {
    const price = buyPrice(item);
    if (this.player.gold < price) { this.log('Ouro insuficiente.', 'dmg'); return; }
    if (this.player.inventory.length >= 40) { this.log('Inventário cheio!', 'dmg'); return; }
    this.player.gold -= price;
    this.player.inventory.push(item);
    npc._stock = npc._stock.filter(i => i !== item);
    this.log(`Comprou ${item.name}.`, RARITY[item.rarity].cssClass);
  }
  sellItem(item) {
    const price = sellPrice(item);
    const i = this.player.inventory.indexOf(item);
    if (i < 0) return;
    this.player.inventory.splice(i, 1);
    this.player.gold += price;
    this.log(`Vendeu ${item.name} por ${price} de ouro.`);
  }
  gamble() {
    const price = gamblePrice(this.player.level);
    if (this.player.gold < price) { this.log('Ouro insuficiente para apostar.', 'dmg'); return null; }
    if (this.player.inventory.length >= 40) { this.log('Inventário cheio!', 'dmg'); return null; }
    this.player.gold -= price;
    const item = gambleRoll(this.player.level, this.rng);
    this.player.inventory.push(item);
    this.log(`🎲 Apostou e ganhou: ${item.name}${item.identified === false ? ' (não identificado)' : ''}!`, RARITY[item.rarity].cssClass);
    return item;
  }

  // Imbuir (Ferreiro): transforma um item NORMAL de equipamento num RARO (estilo Charsi do D2)
  imbueCost() { return 2000 + this.player.level * 100; }
  imbue(item) {
    const slots = ['weapon', 'helm', 'body', 'shield', 'gloves', 'boots', 'belt'];
    if (!item || item.rarity !== 'normal' || !slots.includes(item.slot)) { this.log('Só itens normais de equipamento podem ser imbuídos.', 'dmg'); return; }
    const cost = this.imbueCost();
    if (this.player.gold < cost) { this.log(`Imbuir custa ${cost} de ouro (insuficiente).`, 'dmg'); return; }
    this.player.gold -= cost;
    const ilvl = Math.max(item.reqLevel || 1, this.player.level);
    const rare = generateItem(ilvl, 'rare', this.rng, { slot: item.slot });
    const i = this.player.inventory.indexOf(item);
    if (i >= 0) this.player.inventory.splice(i, 1, rare); else this.player.inventory.push(rare);
    this.log(`✨ Imbuído: ${rare.name}!`, 'rare');
    this.save();
  }

  // identifica item do inventário (UI chama)
  identify(item) {
    if (this.player.identifyItem(item)) this.log(`Identificado: ${item.name}`, RARITY[item.rarity].cssClass);
    else this.log('Sem Pergaminhos de Identificação!', 'dmg');
  }

  // ---------- Soquetes ----------
  startSocketing(srcItem) {
    this._socketSource = srcItem;
    this.log(`Soquetando ${srcItem.name}: clique num item com soquete vazio.`, 'magic');
  }
  trySocketInto(target) {
    if (!this._socketSource) return false;
    if (emptySockets(target) <= 0) { this.log('Sem soquete vazio nesse item.', 'dmg'); return false; }
    const src = this._socketSource;
    // joia: encrava o próprio objeto-item; gema/runa: encrava o id (template estático)
    const payload = src.kind === 'jewel' ? src : src.socketableId;
    const res = insertIntoSocket(target, payload);
    if (res.ok) {
      const i = this.player.inventory.indexOf(this._socketSource);
      if (i >= 0) this.player.inventory.splice(i, 1);
      this.log(`Inserido ${this._socketSource.name} em ${target.name}.`, 'magic');
      this._socketSource = null;
      this.player.recompute();
      return true;
    }
    this.log('Não foi possível inserir: ' + res.reason, 'dmg');
    return false;
  }

  // ---------- Cubo Horadric ----------
  moveToCube(item) {
    if (this.cube.length >= 12) { this.log('Cubo cheio.', 'dmg'); return; }
    const i = this.player.inventory.indexOf(item);
    if (i >= 0) { this.player.inventory.splice(i, 1); this.cube.push(item); }
  }
  moveFromCube(item) {
    if (this.player.inventory.length >= 40) { this.log('Inventário cheio.', 'dmg'); return; }
    const i = this.cube.indexOf(item);
    if (i >= 0) { this.cube.splice(i, 1); this.player.inventory.push(item); this.player.recompute(); }
  }
  cubeTransmute() {
    const res = transmute(this.cube, this.rng, { condenseCharms: this.condenseCharms });
    this.log(res.message, res.ok ? 'set' : 'dmg');
    if (res.ok) this.cube = res.result;
    return res.ok;
  }
  toggleCondenseCharms() {
    this.condenseCharms = !this.condenseCharms;
    this.log(`Condensar charms no cubo: ${this.condenseCharms ? 'LIGADO' : 'DESLIGADO'}`, 'magic');
    this.save();
    return this.condenseCharms;
  }

  // ---------- Stash (baú com abas infinitas) ----------
  get stash() { return this.stashTabs[this.stashTab] || (this.stashTabs[this.stashTab] = []); }
  addStashTab() { this.stashTabs.push([]); this.stashTab = this.stashTabs.length - 1; return this.stashTab; }
  setStashTab(i) { if (i >= 0 && i < this.stashTabs.length) this.stashTab = i; }
  moveToStash(item) {
    const idx = this.player.inventory.indexOf(item);
    if (idx < 0) return;
    // aba ativa; se cheia (48), reusa/cria uma aba com espaço — abas são infinitas
    let tab = this.stash;
    if (tab.length >= 48) {
      tab = this.stashTabs.find(t => t.length < 48);
      if (!tab) { this.stashTabs.push([]); tab = this.stashTabs[this.stashTabs.length - 1]; }
    }
    this.player.inventory.splice(idx, 1);
    tab.push(item);
    this.player.recompute();
  }
  moveFromStash(item) {
    if (this.player.inventory.length >= 40) { this.log('Inventário cheio.', 'dmg'); return; }
    for (const tab of this.stashTabs) {
      const i = tab.indexOf(item);
      if (i >= 0) { tab.splice(i, 1); this.player.inventory.push(item); return; }
    }
  }
  sortStash() { this.stashTabs[this.stashTab] = sortInventoryItems(this.stash); }

  // ---------- Inventário: organizar / arrastar / soltar ----------
  sortInventory() { this.player.inventory = sortInventoryItems(this.player.inventory); }
  // move/troca um item dentro do inventário (drag-and-drop de reordenação)
  moveInventoryItem(from, to) {
    const inv = this.player.inventory;
    if (from == null || from < 0 || from >= inv.length || from === to) return;
    const item = inv[from];
    if (to == null || to >= inv.length) { inv.splice(from, 1); inv.push(item); } // célula vazia → vai pro fim
    else if (to >= 0) { inv[from] = inv[to]; inv[to] = item; }                    // troca com o destino
  }
  // solta um item do inventário no chão, perto do jogador (drag para fora / drop zone)
  dropItemToGround(item) {
    const inv = this.player.inventory;
    const i = inv.indexOf(item);
    if (i < 0) return false;
    inv.splice(i, 1);
    this._spawnGroundItem({ type: 'item', item }, this.player.position, (this._dropSpin = (this._dropSpin || 0) + 1));
    const gi = this.groundItems[this.groundItems.length - 1];
    if (gi) { gi.playerDropped = true; gi.armPickup = false; } // não recolhe na hora
    this.player.recompute(); // remover um charm pode mudar stats
    this.log(`Soltou no chão: ${item.name}`, RARITY[item.rarity]?.cssClass || '');
    return true;
  }

  // buffs de santuário expiram e atualizam multiplicadores
  _updateBuffs() {
    this.activeBuffs = this.activeBuffs.filter(b => b.until > this.time);
    const p = this.player;
    p._damageMul = 1; p._speedMul = 1; p._xpMul = 1; p._tempDefense = 0; p._manaRegenMul = 1; p._auraCrit = 0;
    for (const b of this.activeBuffs) {
      if (b.type === 'damage') p._damageMul *= b.mult;
      else if (b.type === 'speed') p._speedMul *= b.mult;
      else if (b.type === 'exp') p._xpMul *= b.mult;
      else if (b.type === 'defense') p._tempDefense += b.add;
      else if (b.type === 'mana_regen') p._manaRegenMul *= b.mult;
    }
    // aura do mercenário (enquanto vivo) — usa a aura escolhida na instância, ou a padrão do tipo
    if (this.mercenary && !this.mercenary.dead) {
      const a = this.mercenary.aura || this.mercenary.type.aura;
      if (a) {
        if (a.damageMul) p._damageMul *= a.damageMul;
        if (a.defenseAdd) p._tempDefense += a.defenseAdd;
        if (a.manaRegenMul) p._manaRegenMul *= a.manaRegenMul;
        if (a.critAdd) p._auraCrit += a.critAdd;
      }
    }
  }

  _isRangedClass() { return this.player.classId === 'hunter' || this.player.classId === 'arcanist'; }

  _basicAttack(target) {
    const p = this.player;
    p._atkCd = p._atkCd || 0;
    if (p._atkCd > 0) return;
    p._atkCd = 1 / (p.derived.attackSpeed || 1);
    // skill atribuída ao clique esquerdo
    if (p.leftSkill && p.leftSkill !== 'attack' && (p.skillRanks[p.leftSkill] || 0) >= 1) {
      if (Combat.castSkill(this, p, p.leftSkill, target.position.clone())) return;
    }
    p.attackAnim = 1;
    if (Math.random() < 0.10) p.loseDurability('weapon'); // desgaste da arma
    const dmg = p.basicAttackDamage(this.rng) * (p._damageMul || 1);
    if (this._isRangedClass()) {
      const origin = p.position.clone().setY(1.1);
      const dir = new THREE.Vector3().subVectors(target.position, origin).setY(0).normalize();
      const element = p.classId === 'arcanist' ? 'fire' : 'physical';
      Combat.spawnProjectile(this, { origin, dir, speed: 26, range: 16, damage: dmg, element, owner: 'player' });
    } else {
      Combat.applyDamage(this, target, dmg, 'physical', p);
    }
  }

  // Ataque "parado" (Stand Still / Shift): mira a direção do cursor, sem alvo travado.
  _basicAttackToward(point) {
    const p = this.player;
    p._atkCd = p._atkCd || 0;
    if (p._atkCd > 0) return;
    p._atkCd = 1 / (p.derived.attackSpeed || 1);
    // encara o ponto
    const face = new THREE.Vector3().subVectors(point, p.position).setY(0);
    if (face.lengthSq() > 0.0001) { face.normalize(); p.facing = Math.atan2(face.x, face.z); }
    // skill atribuída ao clique esquerdo (conjura na direção)
    if (p.leftSkill && p.leftSkill !== 'attack' && (p.skillRanks[p.leftSkill] || 0) >= 1) {
      if (Combat.castSkill(this, p, p.leftSkill, point.clone())) return;
    }
    p.attackAnim = 1;
    if (Math.random() < 0.10) p.loseDurability('weapon');
    const dmg = p.basicAttackDamage(this.rng) * (p._damageMul || 1);
    if (this._isRangedClass()) {
      const origin = p.position.clone().setY(1.1);
      const dir = new THREE.Vector3().subVectors(point, origin).setY(0).normalize();
      const element = p.classId === 'arcanist' ? 'fire' : 'physical';
      Combat.spawnProjectile(this, { origin, dir, speed: 26, range: 16, damage: dmg, element, owner: 'player' });
    } else {
      // melee parado: acerta o monstro mais próximo dentro do alcance (senão, golpeia no ar)
      const m = Combat.nearestMonster(this, p.position, 2.6);
      if (m) Combat.applyDamage(this, m, dmg, 'physical', p);
    }
  }

  // ---------- Portais ----------
  _checkExits() {
    if (!this.zone) return;
    const p = this.player.position;
    if (this._transitionLock) return;
    for (const ex of (this.zone.exits || [])) {
      if (Math.hypot(p.x - ex.x, p.z - ex.z) < 1.3) {
        this._transitionLock = true;
        setTimeout(() => { this._transitionLock = false; }, 600);
        this._takeExit(ex); return;
      }
    }
    if (this.zone.cowPortal) {
      const c = this.zone.cowPortal;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 1.3) {
        this._transitionLock = true;
        setTimeout(() => { this._transitionLock = false; }, 600);
        this._goToCow(); return;
      }
    }
  }
  _takeExit(ex) {
    if (ex.to === 'town') this._goToTown();
    else if (ex.to === 'overworld' || ex.to === 'wilderness') this._goToOverworld(ex.nextZone != null ? { region: ex.nextZone } : {});
    else if (ex.to === 'boss') this._goToBoss();
    else if (ex.to === 'return') this._returnFromTown();
  }

  // ---------- Util ----------
  _floatText(worldPos, text, cls) {
    const v = worldPos.clone(); v.y += 2;
    v.project(this.engine.camera);
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.floatingText(sx, sy, text, cls);
  }

  // ---------- Loop ----------
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    if (this.running && this.player) {
      if (this.player._atkCd > 0) this.player._atkCd -= dt;
      if (this.player._castCd > 0) this.player._castCd -= dt;
      this._updateBuffs();
      this._processHeldInput(dt);
      this._updatePlayerMovement(dt);
      this._resolvePlayerCollision(); // não atravessa estruturas sólidas
      this.player.update(dt, this.time);

      // PERÍMETRO SEGURO: na cidade (zona safe) nenhum monstro pode existir/entrar
      if (this.zone && this.zone.safe && this.monsters.length) {
        for (const m of this.monsters) this.engine.scene.remove(m.mesh);
        this.monsters = [];
      }
      // no overworld (mapa grande contínuo): atualiza a sub-área e "adormece" monstros distantes
      const isOverworld = this.zone && this.zone.type === 'overworld';
      if (isOverworld) this._updateOverworldRegion(false);
      const pp = this.player.position;
      for (const m of this.monsters) {
        if (isOverworld && Math.hypot(m.position.x - pp.x, m.position.z - pp.z) > 46) continue;
        m.update(this, dt, this.time);
      }
      // remove mortos
      this.monsters = this.monsters.filter(m => !m.dead);

      // mercenário
      if (this.mercenary && !this.mercenary.dead) {
        this.mercenary.update(this, dt, this.time);
        // Gelo Sagrado (Holy Freeze): inimigos perto do merc ficam lentos
        const ma = this.mercenary.aura || this.mercenary.type.aura;
        if (ma && ma.holyFreeze) {
          const mp = this.mercenary.position;
          for (const m of this.monsters) {
            if (m.dead) continue;
            if (Math.hypot(m.position.x - mp.x, m.position.z - mp.z) < 7) { m.slowUntil = this.time + 0.3; m.slowAmt = 0.5; }
          }
        }
      }

      // invocações aliadas
      for (const s of this.summons) s.update(this, dt, this.time);
      if (this.summons.some(s => s.dead)) {
        for (const s of this.summons) if (s.dead) this.engine.scene.remove(s.mesh);
        this.summons = this.summons.filter(s => !s.dead);
      }

      Combat.updateProjectiles(this, dt);
      Combat.updateGroundEffects(this, dt);
      Combat.updateFx(this, dt);

      // bob dos itens no chão
      for (const d of this.groundItems) { d.mesh.position.y = 0.4 + Math.sin(this.time * 3 + d.bob) * 0.12; d.mesh.rotation.y += dt * 2; }

      this._pickupGroundItems();
      this._checkExits();

      // inimigo sob o cursor (preciso, para mostrar nome/vida)
      this.hoverMonster = this._pickMonsterAt(this.input.mouseX, this.input.mouseY, true);

      this.engine.follow(this.player.position);
      this.ui.update(this);
    }
    this.engine.render();
  }
}

// inicializa marcando refs de monstros nos meshes (para raycast)
const game = new Game();
// patch: registra monsterRef em cada mesh ao adicionar (via spawn) — feito por _meshContains, então não obrigatório.
window.__game = game;
game.start();
