// Jogador: criação por classe, stats, derivação (vida/mana/dano/resist), equipamento,
// inventário e leveling 1->99.
import * as THREE from 'three';
import { CLASSES } from '../data/classes.js';
import { SET_BONUSES } from '../data/items.js';
import { makeHumanoid, animateHumanoid } from '../core/blocks.js';
import { MAX_LEVEL, xpToReach, xpForNext } from '../systems/leveling.js';
import { aggregateAuraAndPassive } from '../systems/skilltree.js';
import { getItemMods } from '../systems/sockets.js';

const EQUIP_SLOTS = ['weapon', 'shield', 'helm', 'body', 'gloves', 'boots', 'belt', 'amulet', 'ring', 'ring2'];

export class Player {
  constructor(classId) {
    const cls = CLASSES[classId];
    this.classId = classId;
    this.cls = cls;
    this.isPlayer = true;

    this.level = 1;
    this.xp = 0;
    this.statPoints = 0;
    this.skillPoints = 1;       // ganha 1 ponto no nível 1
    this.skillRanks = {};

    this.stats = { ...cls.baseStats };

    this.equipment = {};        // slot -> item
    this.inventory = [];        // itens soltos
    this.gold = 0;
    this.potions = { life: 4, mana: 4, rejuv: 1 };
    this.scrolls = { id: 3, tp: 1 }; // pergaminhos de Identificação e de Portal
    this.plusSkills = 0;
    this.activeAura = null;         // Guardião escolhe UMA aura ativa por vez (estilo D2)
    this.questBonus = { resAll: 0, lifeFlat: 0 }; // bônus PERMANENTES de quests (Anya/Pássaro Dourado)

    this.position = new THREE.Vector3(0, 0, 0);
    this.facing = 0;
    this.moveTarget = null;
    this.attackAnim = 0;
    this.dead = false;

    // skills da barra (até 4) + esquerda/direita
    this.beltSkills = [];
    this.rightSkill = null;
    this.leftSkill = 'attack';  // ataque básico

    // modelo 3D
    const model = makeHumanoid({ color: cls.blockColor, accent: cls.accentColor, weapon: cls.weapon });
    this.mesh = model.group;
    this.parts = model.parts;

    this.bonuses = {};
    this.derived = {};
    this.recompute();
    this.life = this.maxLife;
    this.mana = this.maxMana;
  }

  // soma todos os mods do equipamento + charms identificados no inventário (estilo D2)
  equipmentMods() {
    const mods = {};
    const add = (it) => {
      if (!it || it.identified === false) return; // itens não identificados não dão bônus
      if (it.durability && it.durability.cur <= 0) return; // item quebrado não dá bônus
      // getItemMods inclui afixos próprios + gemas/runas/runeword inseridos
      for (const [k, v] of Object.entries(getItemMods(it))) mods[k] = (mods[k] || 0) + v;
    };
    for (const slot of EQUIP_SLOTS) add(this.equipment[slot]);
    // charms no inventário aplicam bônus passivamente
    for (const it of this.inventory) if (it.slot === 'charm') add(it);
    // bônus de CONJUNTO (set): conta peças do mesmo set equipadas
    const setCounts = {};
    for (const slot of EQUIP_SLOTS) {
      const it = this.equipment[slot];
      if (it && it.setName && it.identified !== false) setCounts[it.setName] = (setCounts[it.setName] || 0) + 1;
    }
    for (const [setName, count] of Object.entries(setCounts)) {
      const tiers = SET_BONUSES[setName];
      if (!tiers) continue;
      for (const [need, bonus] of Object.entries(tiers)) {
        if (count >= +need) for (const [k, v] of Object.entries(bonus)) mods[k] = (mods[k] || 0) + v;
      }
    }
    return mods;
  }

  // recalcula stats derivados a partir de base + equipamento + auras/passivas
  recompute() {
    const cls = this.cls;
    const eq = this.equipmentMods();
    const aura = aggregateAuraAndPassive(this);

    // atributos efetivos (base alocada + de itens + "Todos Atributos")
    const allAttr = eq.allAttrs || 0;
    const str = this.stats.str + (eq.str || 0) + allAttr;
    const dex = this.stats.dex + (eq.dex || 0) + allAttr;
    const vit = this.stats.vit + (eq.vit || 0) + allAttr;
    const ene = this.stats.ene + (eq.ene || 0) + allAttr;
    this.effStats = { str, dex, vit, ene };

    // +Todas as Skills (afeta ranks de skills aprendidas) e máx. de resistências
    this.plusSkills = eq.allSkills || 0;
    this.maxResBonus = eq.maxResAll || 0;
    this.derived.attackRating = eq.attackRating || 0;
    this.derived.fcr = eq.fcr || 0;

    // vida / mana (questBonus.lifeFlat = recompensa permanente do Pássaro Dourado)
    this.maxLife = Math.floor(
      cls.startingLife + vit * cls.lifePerVit + this.level * cls.lifePerLevel + (eq.lifeFlat || 0) + (this.questBonus?.lifeFlat || 0)
    );
    this.maxMana = Math.floor(
      cls.startingMana + ene * cls.manaPerEne + this.level * cls.manaPerLevel + (eq.manaFlat || 0)
    );

    // dano da arma
    const weapon = this.equipment.weapon;
    let wmin = 1, wmax = 2;
    if (weapon && weapon.baseStats) { wmin = weapon.baseStats.dmgMin || 1; wmax = weapon.baseStats.dmgMax || 2; }
    // bônus de força/destreza ao dano físico (como D2: % por ponto do atributo primário)
    const attrBonus = 1 + ((cls.primaryAttr === 'dex' ? dex : str) * 0.01);
    const physPct = 1 + (eq.physDamagePct || 0) + (aura.physDamagePct || 0) + (aura.auraDamagePct || 0);
    this.derived.weaponMin = wmin;
    this.derived.weaponMax = wmax;
    this.derived.physMul = attrBonus * physPct;
    this.derived.flatFire = eq.flatFire || 0;
    this.derived.flatCold = eq.flatCold || 0;
    this.derived.flatLight = eq.flatLight || 0;

    // defesa -> redução de dano físico (curva suave)
    const defense = (eq.defenseFlat || 0) + dex * 0.5;
    this.derived.defense = defense;
    this.derived.physReduction = Math.min(0.7, defense / (defense + 120));

    // resistências base (de itens + bônus permanente de quest da Anya) — penalidade da dificuldade aplicada no Game
    const qRes = this.questBonus?.resAll || 0;
    this.resBase = {
      fire: (eq.resFire || 0) + (eq.resAll || 0) + qRes + aura.auraResAll * 100,
      cold: (eq.resCold || 0) + (eq.resAll || 0) + qRes + aura.auraResAll * 100,
      lightning: (eq.resLight || 0) + (eq.resAll || 0) + qRes + aura.auraResAll * 100,
      poison: (eq.resPoison || 0) + (eq.resAll || 0) + qRes,
    };

    // velocidades
    this.derived.moveSpeed = 5.5 * (1 + (eq.moveSpeedPct || 0) + (aura.moveSpeedPct || 0));
    this.derived.attackSpeed = 1 * (1 + (eq.attackSpeed || 0) + (aura.auraAS || 0));

    // bônus expostos ao combate
    this.bonuses = {
      critChance: (aura.critChance || 0) + (eq.critChance || 0),
      dodgeChance: (aura.dodgeChance || 0),
      lifeLeech: (eq.lifeLeech || 0),
      magicFind: (eq.magicFind || 0),
      crushingBlow: (eq.crushingBlow || 0),
      openWounds: (eq.openWounds || 0),
      thorns: (eq.thorns || 0),
      fhr: (eq.fhr || 0),
      cannotFreeze: (eq.cannotFreeze || 0) > 0,
      lifePerKill: (eq.lifePerKill || 0),
      manaPerKill: (eq.manaPerKill || 0),
      physDamagePart: (eq.physDamagePct || 0) + (aura.physDamagePct || 0),
      auraResShred: (aura.auraResShred || 0),
      auraDefense: (aura.auraDefense || 0),
      auraBurn: (aura.auraBurn || 0),
      auraRegen: (aura.auraRegen || 0),
      moveSpeedPct: (eq.moveSpeedPct || 0) + (aura.moveSpeedPct || 0),
      // maestrias elementais (passivas) ampliam o dano do elemento
      eleDmg: { fire: (aura.fireDmg || 0), cold: (aura.coldDmg || 0), lightning: (aura.lightDmg || 0) },
    };

    // mantém vida/mana dentro do novo máximo
    if (this.life != null) this.life = Math.min(this.life, this.maxLife);
    if (this.mana != null) this.mana = Math.min(this.mana, this.maxMana);
  }

  // dano básico de um ataque normal (left click sem skill)
  basicAttackDamage(rng) {
    const min = this.derived.weaponMin, max = this.derived.weaponMax;
    let dmg = (min + rng.range(0, max - min)) * this.derived.physMul;
    return Math.max(1, Math.round(dmg));
  }

  gainXP(amount) {
    if (this.level >= MAX_LEVEL) return;
    this.xp += amount;
    let leveled = false;
    while (this.level < MAX_LEVEL && this.xp >= xpToReach(this.level + 1)) {
      this.level++;
      this.statPoints += this.cls.statPointsPerLevel;
      this.skillPoints += 1;
      leveled = true;
    }
    if (leveled) {
      this.recompute();
      this.life = this.maxLife;
      this.mana = this.maxMana;
    }
    return leveled;
  }

  allocStat(stat) {
    if (this.statPoints <= 0) return false;
    if (!(stat in this.stats)) return false;
    this.stats[stat]++;
    this.statPoints--;
    this.recompute();
    return true;
  }

  // equipa item (move equipado anterior pro inventário)
  equip(item) {
    if (item.identified === false) return { ok: false, reason: 'não identificado' };
    if (this.effStats.str < (item.reqStr || 0)) return { ok: false, reason: `requer Força ${item.reqStr}` };
    if (this.effStats.dex < (item.reqDex || 0)) return { ok: false, reason: `requer Destreza ${item.reqDex}` };
    let slot = item.slot;
    if (slot === 'ring' && this.equipment.ring) slot = 'ring2';
    if (slot === 'charm') return { ok: false, reason: 'charm (fica no inventário)' };
    const prev = this.equipment[slot];
    this.equipment[slot] = item;
    const i = this.inventory.indexOf(item);
    if (i >= 0) this.inventory.splice(i, 1);
    if (prev) this.inventory.push(prev);
    this.recompute();
    return { ok: true };
  }

  // aura ativa (Guardião): só uma por vez
  setActiveAura(skillId) { this.activeAura = skillId; this.recompute(); }

  // Reespecialização (respec): devolve todos os pontos de skill e de atributo gastos.
  respec() {
    let sp = 0; for (const v of Object.values(this.skillRanks)) sp += v;
    this.skillPoints += sp;
    this.skillRanks = {};
    this.activeAura = null;
    this.beltSkills = [];
    this.rightSkill = null;
    const base = this.cls.baseStats;
    let stp = 0; for (const k of ['str', 'dex', 'vit', 'ene']) stp += (this.stats[k] - base[k]);
    this.statPoints += stp;
    this.stats = { ...base };
    this.recompute();
    this.life = this.maxLife; this.mana = this.maxMana;
  }

  // ---- Durabilidade / reparo ----
  _randomArmorPiece() {
    const slots = ['body', 'helm', 'shield', 'gloves', 'boots', 'belt'];
    const present = slots.map(s => this.equipment[s]).filter(it => it && it.durability && it.durability.cur > 0);
    return present.length ? present[Math.floor(Math.random() * present.length)] : null;
  }
  loseDurability(which) {
    const it = which === 'weapon' ? this.equipment.weapon : this._randomArmorPiece();
    if (!it || !it.durability || it.durability.cur <= 0) return;
    it.durability.cur--;
    if (it.durability.cur === 0) this.recompute(); // quebrou -> perde bônus
  }
  repairableItems() {
    const all = [...Object.values(this.equipment), ...this.inventory];
    return all.filter(it => it && it.durability && !it.ethereal && it.durability.cur < it.durability.max);
  }
  repairAllItems() {
    for (const it of this.repairableItems()) it.durability.cur = it.durability.max;
    this.recompute();
  }

  // identifica um item usando 1 pergaminho de Identificação
  identifyItem(item) {
    if (item.identified !== false) return false;
    if (this.scrolls.id <= 0) return false;
    this.scrolls.id--;
    item.identified = true;
    this.recompute(); // charms recém-identificados passam a contar
    return true;
  }

  unequip(slot) {
    const it = this.equipment[slot];
    if (!it) return;
    delete this.equipment[slot];
    this.inventory.push(it);
    this.recompute();
  }

  xpProgress() {
    if (this.level >= MAX_LEVEL) return { cur: 1, pct: 1 };
    const base = xpToReach(this.level);
    const span = xpForNext(this.level);
    const into = this.xp - base;
    return { into, span, pct: Math.max(0, Math.min(1, into / span)) };
  }

  update(dt, time) {
    // regen passiva (aura Prece + base)
    const regen = (this.bonuses.auraRegen || 0) + this.maxLife * 0.004;
    this.life = Math.min(this.maxLife, this.life + regen * dt);
    this.mana = Math.min(this.maxMana, this.mana + (this.maxMana * 0.03 + 1) * (this._manaRegenMul || 1) * dt);

    // cooldowns
    if (this._cooldowns) {
      for (const k of Object.keys(this._cooldowns)) {
        this._cooldowns[k] = Math.max(0, this._cooldowns[k] - dt);
      }
    }
    if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - dt * 4);
    if (this._hitFlash > 0) this._hitFlash -= dt;

    const moving = !!this._isMoving;
    animateHumanoid(this.parts, time, moving, this.attackAnim);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.facing;
  }
}
