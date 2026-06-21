// Camada de UI: telas, HUD, painéis (personagem/inventário/árvore), tooltips, minimapa.
import * as THREE from 'three';
import { CLASS_LIST } from '../data/classes.js';
import { DIFFICULTY_LIST } from '../systems/difficulty.js';
import { SKILLS, skillsForTree } from '../data/skills.js';
import { TREE_NAMES } from '../data/classes.js';
import { canLearn } from '../systems/skilltree.js';
import { itemTooltipLines, itemGridSize, invFootprintCells, INV_MAX_CELLS } from '../systems/loot.js';
import { RARITY } from '../data/items.js';
import { MAX_LEVEL } from '../systems/leveling.js';
import { buyPrice, sellPrice, gamblePrice, CONSUMABLE_PRICES } from '../systems/economy.js';
import { mercForAct, hireCost, MERC_TYPES, MERC_AURAS } from '../entities/mercenary.js';
import { CUBE_RECIPES } from '../systems/cube.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      loading: $('loading-screen'), title: $('title-screen'), hud: $('hud'),
      classSelect: $('class-select'), diffSelect: $('difficulty-select'), startBtn: $('start-button'), saveSlots: $('save-slots'),
      lifeFill: $('globe-life').querySelector('.globe-fill'), lifeLabel: $('globe-life').querySelector('.globe-label'),
      manaFill: $('globe-mana').querySelector('.globe-fill'), manaLabel: $('globe-mana').querySelector('.globe-label'),
      belt: $('skill-belt'), xpFill: $('xp-fill'), xpLabel: $('xp-label'),
      zoneName: $('zone-name'), diffBadge: $('difficulty-badge'),
      minimap: $('minimap'), combatLog: $('combat-log'), floatLayer: $('floating-text-layer'),
      charPanel: $('char-panel'), invPanel: $('inventory-panel'), treePanel: $('skilltree-panel'),
      tooltip: $('tooltip'), death: $('death-screen'), respawn: $('respawn-button'),
    };
    this.minimapCtx = this.el.minimap.getContext('2d');
    this.el.minimap.width = 180; this.el.minimap.height = 180;
    this.selectedClass = CLASS_LIST[0].id;
    this.selectedDiff = 'normal';
    this.treeTab = 0;
    this.shopTab = 'buy';

    // painel modal reutilizável (loja, mercenário, waypoints)
    this.modal = document.createElement('div');
    this.modal.className = 'panel hidden';
    this.modal.id = 'modal-panel';
    this.modal.style.left = '50%';
    this.modal.style.transform = 'translateX(-50%)';
    this.modal.style.width = '560px';
    document.getElementById('game-root').appendChild(this.modal);

    // tracker de quest (sob o nome da zona)
    this.questEl = document.createElement('div');
    this.questEl.id = 'quest-tracker';
    this.questEl.style.cssText = 'font-size:12px;color:#c8aa6e;margin-top:2px;';
    document.getElementById('top-info').appendChild(this.questEl);

    // barra de buffs ativos
    this.buffsEl = document.createElement('div');
    this.buffsEl.id = 'buffs-bar';
    this.buffsEl.style.cssText = 'position:absolute;top:54px;left:50%;transform:translateX(-50%);display:flex;gap:6px;';
    this.el.hud.appendChild(this.buffsEl);

    // cinto de poções (clicável)
    this.potionBelt = document.createElement('div');
    this.potionBelt.id = 'potion-belt';
    this.potionBelt.style.cssText = 'position:absolute;bottom:100px;left:50%;transform:translateX(-50%);display:flex;gap:6px;pointer-events:auto;';
    this.el.hud.appendChild(this.potionBelt);

    // barra de Vigor (stamina) — clicável p/ alternar correr/andar
    this.staminaBar = document.createElement('div');
    this.staminaBar.id = 'stamina-bar';
    this.staminaBar.style.cssText = 'position:absolute;bottom:146px;left:50%;transform:translateX(-50%);width:180px;height:13px;border:1px solid #6a5a2a;border-radius:6px;background:rgba(0,0,0,0.6);pointer-events:auto;cursor:pointer;overflow:hidden;';
    this.staminaFill = document.createElement('div');
    this.staminaFill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#caa84a,#e8d27a);';
    this.staminaBar.appendChild(this.staminaFill);
    this.staminaLabel = document.createElement('div');
    this.staminaLabel.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;text-shadow:0 0 2px #000;';
    this.staminaBar.appendChild(this.staminaLabel);
    this.el.hud.appendChild(this.staminaBar);

    // indicador do conjunto de armas (weapon swap, tecla W) — clicável p/ trocar
    this.weaponSetEl = document.createElement('div');
    this.weaponSetEl.id = 'weapon-set';
    this.weaponSetEl.style.cssText = 'position:absolute;bottom:146px;left:calc(50% + 100px);font-size:11px;color:#c8aa6e;background:rgba(0,0,0,0.6);border:1px solid #6a5a2a;border-radius:4px;padding:1px 6px;pointer-events:auto;cursor:pointer;text-shadow:0 0 2px #000;';
    this.el.hud.appendChild(this.weaponSetEl);

    // vida do mercenário
    this.mercEl = document.createElement('div');
    this.mercEl.id = 'merc-bar';
    this.mercEl.style.cssText = 'position:absolute;bottom:130px;right:14px;width:140px;font-size:11px;color:#c8aa6e;text-shadow:0 0 3px #000;text-align:right;';
    this.el.hud.appendChild(this.mercEl);

    // barra de vida de boss/super-único (topo)
    this.bossBar = document.createElement('div');
    this.bossBar.id = 'boss-bar';
    this.bossBar.style.cssText = 'position:absolute;top:34px;left:50%;transform:translateX(-50%);width:420px;display:none;text-align:center;';
    this.bossBar.innerHTML = '<div class="bb-name" style="color:#ff5544;font-size:15px;text-shadow:0 0 6px #000;letter-spacing:1px"></div><div style="height:12px;background:#1a0a0a;border:1px solid #000;margin-top:2px"><div class="bb-fill" style="height:100%;width:100%;background:linear-gradient(#ff4030,#7a1008)"></div></div>';
    this.el.hud.appendChild(this.bossBar);

    // info do inimigo sob o cursor (nome + vida)
    this.hoverInfo = document.createElement('div');
    this.hoverInfo.id = 'hover-info';
    this.hoverInfo.style.cssText = 'position:absolute;display:none;background:rgba(0,0,0,0.8);border:1px solid #2a2418;border-radius:3px;padding:3px 7px;font-size:11px;pointer-events:none;z-index:25;';
    this.el.hud.appendChild(this.hoverInfo);
  }

  // cor pelo rank do monstro
  _monsterColor(m) {
    if (m.isBoss) return '#cc66ff';
    if (m.superUnique) return '#ffcc44';
    if (m.rank && m.rank.id === 'unique') return '#ff5544';
    if (m.rank && m.rank.id === 'champion') return '#ffcc44';
    return '#dddddd';
  }

  // ----- Telas -----
  hideLoading() { this.el.loading.classList.add('hidden'); }

  showTitle(args) {
    this._titleArgs = args;
    this.el.title.classList.remove('hidden');
    // remove eventual botão Continuar legado
    const oldCont = document.getElementById('continue-button'); if (oldCont) oldCont.remove();
    // 3 slots de save: seleciona o primeiro vazio (para um novo personagem)
    const firstEmpty = args.slots.find(s => !s.summary);
    this.selectedSlot = firstEmpty ? firstEmpty.slot : null;
    this._renderSaveSlots();
    // cards de classe
    this.el.classSelect.innerHTML = '';
    for (const c of CLASS_LIST) {
      const card = document.createElement('div');
      card.className = 'class-card' + (c.id === this.selectedClass ? ' selected' : '');
      card.innerHTML = `<div class="class-icon">${c.icon}</div><h3>${c.name}</h3><p>${c.description}</p>`;
      card.onclick = () => {
        this.selectedClass = c.id;
        [...this.el.classSelect.children].forEach((n, i) => n.classList.toggle('selected', CLASS_LIST[i].id === c.id));
      };
      this.el.classSelect.appendChild(card);
    }
    // dificuldade (só Normal liberado no início)
    this.el.diffSelect.innerHTML = '';
    DIFFICULTY_LIST.forEach((d, i) => {
      const card = document.createElement('div');
      const locked = i > 0;
      card.className = 'diff-card' + (d.id === this.selectedDiff ? ' selected' : '') + (locked ? ' locked' : '');
      card.textContent = d.name + (locked ? ' 🔒' : '');
      card.onclick = () => {
        if (locked) return;
        this.selectedDiff = d.id;
        [...this.el.diffSelect.children].forEach((n, j) => n.classList.toggle('selected', j === i));
      };
      this.el.diffSelect.appendChild(card);
    });
    // toggle Hardcore (morte permanente)
    const hc = document.createElement('div');
    hc.className = 'diff-card' + (this.hardcore ? ' selected' : '');
    hc.textContent = '☠️ Hardcore';
    hc.title = 'Morte permanente: ao morrer, o personagem é apagado.';
    hc.onclick = () => { this.hardcore = !this.hardcore; hc.classList.toggle('selected', this.hardcore); };
    this.el.diffSelect.appendChild(hc);

    this.el.startBtn.onclick = () => {
      const a = this._titleArgs;
      let slot = this.selectedSlot;
      // se o slot selecionado estiver cheio (ou nenhum), usa o primeiro vazio
      if (slot == null || (a.slots[slot] && a.slots[slot].summary)) {
        const e = a.slots.find(s => !s.summary); slot = e ? e.slot : null;
      }
      if (slot == null) return; // todos cheios (botão fica desabilitado)
      this.el.title.classList.add('hidden');
      a.onStart(this.selectedClass, this.selectedDiff, this.hardcore, slot);
    };
    this._updateStartLabel();
  }

  // desenha os 3 cartões de slot (Continuar/Apagar nos cheios; selecionável nos vazios)
  _renderSaveSlots() {
    const a = this._titleArgs;
    const cont = this.el.saveSlots;
    cont.innerHTML = '';
    a.slots.forEach((s) => {
      const filled = !!s.summary;
      const card = document.createElement('div');
      card.className = 'save-slot' + (filled ? ' filled' : '') + (!filled && this.selectedSlot === s.slot ? ' selected' : '');
      const title = document.createElement('div'); title.className = 'slot-title';
      title.textContent = `Slot ${s.slot + 1}` + (filled && s.hardcore ? ' ☠️' : '');
      const sum = document.createElement('div'); sum.className = 'slot-sum';
      sum.textContent = filled ? s.summary : 'Vazio — novo personagem';
      card.append(title, sum);
      if (filled) {
        const btns = document.createElement('div'); btns.className = 'slot-btns';
        const go = document.createElement('button'); go.className = 'alloc-btn slot-continue'; go.textContent = '▶ Continuar';
        go.onclick = () => { this.el.title.classList.add('hidden'); a.onContinue(s.slot); };
        const del = document.createElement('button'); del.className = 'alloc-btn slot-delete'; del.textContent = '🗑 Apagar';
        del.onclick = () => {
          if (del.dataset.armed) {
            a.onDelete(s.slot); s.summary = null; s.hardcore = false; this.selectedSlot = s.slot;
            this._renderSaveSlots(); this._updateStartLabel();
          } else { del.dataset.armed = '1'; del.textContent = '⚠ Confirmar?'; }
        };
        btns.append(go, del); card.appendChild(btns);
      } else {
        card.onclick = () => { this.selectedSlot = s.slot; this._renderSaveSlots(); this._updateStartLabel(); };
      }
      cont.appendChild(card);
    });
  }

  _updateStartLabel() {
    const a = this._titleArgs; if (!a) return;
    let slot = this.selectedSlot;
    if (slot == null || (a.slots[slot] && a.slots[slot].summary)) { const e = a.slots.find(s => !s.summary); slot = e ? e.slot : null; }
    this.el.startBtn.textContent = slot == null ? 'TODOS OS SLOTS CHEIOS' : `ENTRAR EM SANCTUBLOCK (Slot ${slot + 1})`;
    this.el.startBtn.disabled = slot == null;
  }

  showHUD() { this.el.hud.classList.remove('hidden'); }

  // tela de narrativa ao entrar num ato
  showLore(lore, onClose) {
    if (!lore) { onClose && onClose(); return; }
    let o = document.getElementById('lore-screen');
    if (!o) { o = document.createElement('div'); o.id = 'lore-screen'; o.className = 'overlay-screen'; document.getElementById('game-root').appendChild(o); }
    o.classList.remove('hidden');
    o.innerHTML = `<div class="menu-box" style="max-width:580px">
      <h2 class="game-subtitle" style="font-size:22px;letter-spacing:4px">${lore.title}</h2>
      <p style="color:#b0a080;line-height:1.7;margin:14px 0 22px">${lore.text}</p>
      <button class="big-button" id="lore-cont">Continuar</button></div>`;
    o.querySelector('#lore-cont').onclick = () => { o.classList.add('hidden'); onClose && onClose(); };
  }

  showDeath(onRespawn, hardcore = false) {
    this.el.death.classList.remove('hidden');
    const title = this.el.death.querySelector('.death-title');
    if (title) title.textContent = hardcore ? 'MORTE PERMANENTE' : 'VOCÊ MORREU';
    this.el.respawn.textContent = hardcore ? 'RECOMEÇAR' : 'REVIVER NA CIDADE';
    this.el.respawn.onclick = () => { this.el.death.classList.add('hidden'); onRespawn(); };
  }

  // ----- HUD por frame -----
  update(game) {
    const p = game.player;
    this.el.lifeFill.style.height = (100 * p.life / p.maxLife) + '%';
    this.el.lifeLabel.textContent = `${Math.ceil(p.life)}/${p.maxLife}`;
    this.el.manaFill.style.height = (100 * p.mana / p.maxMana) + '%';
    this.el.manaLabel.textContent = `${Math.ceil(p.mana)}/${p.maxMana}`;

    const xp = p.xpProgress();
    this.el.xpFill.style.width = (xp.pct * 100) + '%';
    this.el.xpLabel.textContent = p.level >= MAX_LEVEL ? `Nível ${MAX_LEVEL} (MÁX)` : `Nível ${p.level} — ${Math.floor(xp.pct * 100)}%`;

    this.el.zoneName.textContent = game.zone ? game.zone.name : '—';
    const px = (game.playersX || 1) > 1 ? ` · 👥${game.playersX}` : '';
    const ttl = game.playerTitle ? game.playerTitle() : '';
    this.el.diffBadge.textContent = `${ttl ? '🎖️' + ttl + ' · ' : ''}${game.difficultyObj.name.toUpperCase()}${px} · ${p.scrolls.id}📜 ${p.scrolls.tp}🌀 · ${p.gold}🪙`;

    // quest atual (primeira não concluída da cadeia)
    const q = (game.questLog || []).find(x => !x.done);
    if (q) {
      const prog = q.type === 'kills' ? ` (${Math.min(game.killCount || 0, q.target)}/${q.target})` : '';
      this.questEl.textContent = `📜 ${q.text}${prog}`;
    } else this.questEl.textContent = (game.questLog || []).length ? '📜 Ato concluído ✔' : '';

    // buffs ativos
    this.buffsEl.innerHTML = '';
    for (const b of (game.activeBuffs || [])) {
      const t = Math.ceil(b.until - game.time);
      const chip = document.createElement('div');
      chip.style.cssText = 'background:rgba(0,0,0,0.6);border:1px solid #c8aa6e;border-radius:4px;padding:2px 8px;font-size:11px;color:#ffe;';
      chip.textContent = `${b.label} ${t}s`;
      this.buffsEl.appendChild(chip);
    }

    // mercenário
    if (game.mercenary && !game.mercenary.dead) {
      const m = game.mercenary;
      this.mercEl.textContent = `${m.type.icon} ${m.name}: ${Math.ceil(m.life)}/${m.maxLife}`;
    } else this.mercEl.textContent = '';

    // info do inimigo sob o cursor
    const hm = game.hoverMonster;
    if (hm && !hm.dead) {
      const col = this._monsterColor(hm);
      const pctH = Math.max(0, Math.round(100 * hm.life / hm.maxLife));
      this.hoverInfo.style.display = 'block';
      this.hoverInfo.style.left = Math.min((game.input.mouseX || 0) + 14, window.innerWidth - 200) + 'px';
      this.hoverInfo.style.top = ((game.input.mouseY || 0) + 16) + 'px';
      this.hoverInfo.innerHTML = `<div style="color:${col}">${hm.name}</div><div style="height:5px;background:#300;margin-top:2px;width:140px"><div style="height:100%;width:${pctH}%;background:#e33"></div></div>`;
    } else this.hoverInfo.style.display = 'none';

    // barra de boss/super-único no topo
    const bt = (hm && (hm.isBoss || hm.superUnique) && !hm.dead) ? hm
      : (game.bossRef && !game.bossRef.dead ? game.bossRef : null);
    if (bt) {
      this.bossBar.style.display = 'block';
      this.bossBar.querySelector('.bb-name').textContent = bt.name + (bt.title ? ` — ${bt.title}` : '');
      this.bossBar.querySelector('.bb-fill').style.width = Math.max(0, 100 * bt.life / bt.maxLife) + '%';
    } else this.bossBar.style.display = 'none';

    this.renderBelt(game);
    this.renderPotionBelt(game);
    this.renderStamina(game);
    this.drawMinimap(game);
  }

  renderBelt(game) {
    const p = game.player;
    const belt = this.el.belt;
    belt.innerHTML = '';
    // slot esquerdo (ataque básico) fixo
    const keys = ['1', '2', '3', '4'];
    p.beltSkills.forEach((sid, i) => {
      const sk = SKILLS[sid];
      const slot = document.createElement('div');
      slot.className = 'skill-slot' + (p.rightSkill === sid ? ' active' : '');
      const cd = (p._cooldowns && p._cooldowns[sid]) || 0;
      const lr = (p.leftSkill === sid ? 'L' : '') + (p.rightSkill === sid ? 'R' : '');
      slot.innerHTML = `<span class="slot-key">${keys[i] || ''}</span><span class="slot-icon">${sk.icon}</span>`
        + (lr ? `<span style="position:absolute;bottom:0;right:2px;font-size:9px;color:#c8aa6e">${lr}</span>` : '')
        + (cd > 0 ? `<span class="slot-cd">${cd.toFixed(1)}</span>` : '');
      slot.onclick = (ev) => { if (ev.shiftKey) game.setLeftSkill(sid); else p.rightSkill = sid; this.renderBelt(game); };
      slot.onmouseenter = (e) => this.showSkillTooltip(p, sid, e);
      slot.onmouseleave = () => this.hideTooltip();
      belt.appendChild(slot);
    });
    if (p.beltSkills.length === 0) {
      const s = document.createElement('div');
      s.className = 'skill-slot';
      s.innerHTML = `<span class="slot-icon">👊</span>`;
      belt.appendChild(s);
    }
  }

  renderPotionBelt(game) {
    const p = game.player;
    this.potionBelt.innerHTML = '';
    const defs = [['life', '🧪', '#ff5040', 'Q'], ['rejuv', '💜', '#b060ff', 'R'], ['mana', '🔵', '#5080ff', 'E']];
    const cap = p.beltCapacity ? p.beltCapacity() : 4; // capacidade por tipo (fileiras do cinto)
    for (const [kind, icon, color, key] of defs) {
      const n = p.potions[kind] || 0;
      const b = document.createElement('div');
      b.style.cssText = `width:40px;height:40px;border:2px solid ${color};border-radius:4px;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;`;
      b.innerHTML = `<span style="font-size:16px">${icon}</span><span style="font-size:10px;color:${n >= cap ? '#6f6' : '#fff'}">${n}/${cap}</span><span style="position:absolute;top:0;left:2px;font-size:8px;color:${color}">${key}</span>`;
      b.style.position = 'relative';
      b.onclick = () => game._usePotion(kind);
      this.potionBelt.appendChild(b);
    }
  }

  renderStamina(game) {
    const p = game.player;
    if (p.maxStamina == null) { this.staminaBar.style.display = 'none'; return; }
    this.staminaBar.style.display = '';
    this.staminaBar.onclick = () => game.toggleRun();
    const pct = Math.max(0, Math.min(1, p.stamina / p.maxStamina));
    const running = p.running !== false && p.stamina > 0;
    this.staminaFill.style.width = (pct * 100) + '%';
    this.staminaFill.style.opacity = running ? '1' : '0.45';
    this.staminaLabel.textContent = `${running ? '🏃' : '🚶'} ${Math.round(p.stamina)}/${p.maxStamina}`;
    // indicador de conjunto de armas (a arma ativa é sempre equipment.weapon; swap guarda a inativa)
    this.weaponSetEl.onclick = () => game.swapWeapons();
    this.weaponSetEl.textContent = `⚔ ${p.activeWeaponSet ? 'II' : 'I'} (W)`;
    const a = p.equipment.weapon ? p.equipment.weapon.name : 'sem arma';
    const b = (p.swap && p.swap.weapon) ? p.swap.weapon.name : 'vazio';
    this.weaponSetEl.title = `Ativa: ${a} · Swap: ${b}`;
  }

  drawMinimap(game) {
    const ctx = this.minimapCtx;
    const W = 180, H = 180, cx = W / 2, cz = H / 2;
    const scale = 1.7;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,18,14,0.6)';
    ctx.fillRect(0, 0, W, H);
    const p = game.player;
    const toMap = (x, z) => [cx + (x - p.position.x) * scale, cz + (z - p.position.z) * scale];

    // saídas
    if (game.zone && game.zone.exits) {
      for (const ex of game.zone.exits) {
        const [mx, my] = toMap(ex.x, ex.z);
        ctx.fillStyle = '#' + (ex.color || 0xffaa33).toString(16).padStart(6, '0');
        ctx.fillRect(mx - 3, my - 3, 6, 6);
      }
    }
    // monstros
    for (const m of game.monsters) {
      if (m.dead) continue;
      const [mx, my] = toMap(m.position.x, m.position.z);
      if (mx < 0 || mx > W || my < 0 || my > H) continue;
      ctx.fillStyle = m.isBoss ? '#ff00ff' : (m.rank.id !== 'normal' ? '#ffcc44' : '#ff5555');
      const s = m.isBoss ? 5 : 2.5;
      ctx.fillRect(mx - s / 2, my - s / 2, s, s);
    }
    // itens no chão
    for (const d of game.groundItems) {
      const [mx, my] = toMap(d.position.x, d.position.z);
      ctx.fillStyle = '#ffff66';
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    // interativos (NPC/santuário/baú/waypoint)
    const itColor = { npc: '#66ffcc', shrine: '#cc66ff', chest: '#cc8844', waypoint: '#3366ff' };
    for (const it of (game.interactables || [])) {
      if (it.used) continue;
      const [mx, my] = toMap(it.position.x, it.position.z);
      if (mx < 0 || mx > W || my < 0 || my > H) continue;
      ctx.fillStyle = itColor[it.type] || '#ffffff';
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
    // mercenário
    if (game.mercenary && !game.mercenary.dead) {
      const [mx, my] = toMap(game.mercenary.position.x, game.mercenary.position.z);
      ctx.fillStyle = '#88ff88';
      ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
    }
    // jogador
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cz, 4, 0, Math.PI * 2); ctx.fill();
  }

  // ----- Log e texto flutuante -----
  log(text, cls = '') {
    const line = document.createElement('div');
    line.className = 'log-line ' + cls;
    line.textContent = text;
    this.el.combatLog.prepend(line);
    while (this.el.combatLog.children.length > 8) this.el.combatLog.lastChild.remove();
    setTimeout(() => line.remove(), 6000);
  }

  floatingText(sx, sy, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'float-text ' + cls;
    el.textContent = text;
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    const colorMap = { dmg: '#ff8060', xp: '#b090e0', desc: '#cccccc' };
    el.style.color = colorMap[cls] || '#ffffff';
    this.el.floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ----- Tooltip -----
  showItemTooltip(item, ev) {
    const r = RARITY[item.rarity] || RARITY.normal;
    let html = `<div class="tt-name ${r.cssClass}">${item.name}</div>`;
    for (const ln of itemTooltipLines(item)) html += `<div class="tt-${ln.cls}">${ln.text}</div>`;
    this._showTooltip(html, ev);
  }
  showSkillTooltip(player, skillId, ev) {
    const sk = SKILLS[skillId];
    const rank = player.skillRanks[skillId] || 0;
    let html = `<div class="tt-name unique">${sk.icon} ${sk.name} (Rank ${rank})</div>`;
    html += `<div class="tt-desc">${sk.desc(rank)}</div>`;
    const st = sk.getStats(rank || 1, player.skillRanks);
    if (st.mana) html += `<div class="tt-affix">Mana: ${st.mana.toFixed(1)}</div>`;
    if (sk.cooldown) html += `<div class="tt-affix">Recarga: ${sk.cooldown}s</div>`;
    this._showTooltip(html, ev);
  }
  _showTooltip(html, ev) {
    const t = this.el.tooltip;
    t.innerHTML = html;
    t.classList.remove('hidden');
    const x = (ev?.clientX || 100) + 14, y = (ev?.clientY || 100) + 14;
    t.style.left = Math.min(x, window.innerWidth - 280) + 'px';
    t.style.top = Math.min(y, window.innerHeight - 200) + 'px';
  }
  hideTooltip() { this.el.tooltip.classList.add('hidden'); }

  // ----- Painéis -----
  toggleChar(game) { this._toggle(this.el.charPanel, () => this.renderChar(game)); }
  toggleInventory(game) { this._toggle(this.el.invPanel, () => this.renderInventory(game)); }
  toggleTree(game) { this._toggle(this.el.treePanel, () => this.renderTree(game)); }
  _toggle(panel, render) {
    if (panel.classList.contains('hidden')) { render(); panel.classList.remove('hidden'); }
    else panel.classList.add('hidden');
  }
  closeAll() {
    this.el.charPanel.classList.add('hidden');
    this.el.invPanel.classList.add('hidden');
    this.el.treePanel.classList.add('hidden');
    this.modal.classList.add('hidden');
  }

  renderChar(game) {
    const p = game.player;
    const e = p.effStats;
    const row = (label, val, alloc) => `<div class="stat-row"><span>${label}</span><span class="stat-val">${val}${alloc || ''}</span></div>`;
    const ab = (stat) => p.statPoints > 0 ? `<span class="alloc-btn" data-stat="${stat}">+</span>` : '';
    const title = game.playerTitle ? game.playerTitle() : '';
    let html = `<h2>${p.cls.icon} ${title ? title + ' ' : ''}${p.cls.name} — Nível ${p.level}</h2>`;
    html += `<div class="skillpoints-info">Pontos de Atributo: ${p.statPoints} · Pontos de Skill: ${p.skillPoints}</div>`;
    html += row('Força', e.str, ' ' + ab('str'));
    html += row('Destreza', e.dex, ' ' + ab('dex'));
    html += row('Vitalidade', e.vit, ' ' + ab('vit'));
    html += row('Energia', e.ene, ' ' + ab('ene'));
    html += `<hr style="border-color:#2a2418;margin:8px 0">`;
    html += row('Vida', `${Math.ceil(p.life)}/${p.maxLife}`);
    html += row('Mana', `${Math.ceil(p.mana)}/${p.maxMana}`);
    html += row('Dano da Arma', `${p.derived.weaponMin}-${p.derived.weaponMax} (x${p.derived.physMul.toFixed(2)})`);
    html += row('Defesa', Math.round(p.derived.defense) + ` (${Math.round(p.derived.physReduction * 100)}% red.)`);
    html += row('Resist. Fogo', game.resistFor('fire') + '%');
    html += row('Resist. Gelo', game.resistFor('cold') + '%');
    html += row('Resist. Raio', game.resistFor('lightning') + '%');
    html += row('Magic Find', (p.bonuses.magicFind || 0) + '%');
    if (p.plusSkills) html += row('+ Todas as Skills', '+' + p.plusSkills);
    if (p.derived.fcr) html += row('Conjuração Rápida', Math.round(p.derived.fcr * 100) + '%');
    if (p.bonuses.critChance) html += row('Chance de Crítico', Math.round(p.bonuses.critChance * 100) + '%');
    html += row('Ouro', p.gold + ' 🪙');
    this.el.charPanel.innerHTML = html;
    this.el.charPanel.querySelectorAll('.alloc-btn').forEach(b => {
      b.onclick = () => { if (p.allocStat(b.dataset.stat)) this.renderChar(game); };
    });
  }

  renderInventory(game) {
    const p = game.player;
    let html = `<h2>Inventário · ${p.gold} 🪙 · ${p.scrolls.id}📜 ${p.scrolls.tp}🌀</h2>`;
    if (game._socketSource) html += `<div class="skillpoints-info">Soquetando: ${game._socketSource.icon} ${game._socketSource.name} — clique num item com soquete vazio (Esc cancela).</div>`;
    // barra: organizar + zona de soltar no chão (drag-and-drop)
    html += `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">`;
    html += `<button class="alloc-btn inv-sort">⤴️ Organizar</button>`;
    html += `<div class="inv-dropzone" style="flex:1;text-align:center;font-size:11px;color:#a98;border:1px dashed #5a4a2a;padding:4px;border-radius:4px">🗑️ arraste um item aqui para soltar no chão</div>`;
    html += `</div>`;
    // equipados
    html += `<div class="equip-row">`;
    const slots = [['weapon', 'Arma'], ['shield', 'Escudo'], ['helm', 'Elmo'], ['body', 'Peito'], ['gloves', 'Luvas'], ['boots', 'Botas'], ['belt', 'Cinto'], ['amulet', 'Amuleto'], ['ring', 'Anel'], ['ring2', 'Anel']];
    for (const [slot, label] of slots) {
      const it = p.equipment[slot];
      html += `<div class="equip-slot" data-slot="${slot}">${it ? `<span class="eq-icon">${it.icon}</span>` : label}</div>`;
    }
    html += `</div><hr style="border-color:#2a2418;margin:8px 0">`;
    // GRADE estilo D2: cada item ocupa WxH células (footprint por slot); CSS empacota (dense).
    html += `<div class="inv-grid">`;
    p.inventory.forEach((it, i) => {
      const r = RARITY[it.rarity];
      const sz = itemGridSize(it);
      const unid = it.identified === false ? 'filter:grayscale(0.6);outline:1px dashed #888;' : '';
      const sock = it.sockets ? `<span class="inv-sock">◆${it.socketed?.length || 0}/${it.sockets}</span>` : '';
      html += `<div class="inv-item ${r.cssClass}${it.slot === 'charm' ? ' charm' : ''}" draggable="true" data-idx="${i}" style="grid-column:span ${sz.w};grid-row:span ${sz.h};${unid}" title="${it.name}">${it.icon}${sock}</div>`;
    });
    html += `</div>`;
    const usedCells = invFootprintCells(p.inventory);
    html += `<p style="font-size:11px;color:#8a7a5a;margin-top:8px">Espaço: <b style="color:${usedCells >= INV_MAX_CELLS ? '#e66' : '#9c8'}">${usedCells}/${INV_MAX_CELLS}</b> células. Clique: equipar / identificar. Arraste sobre outro item p/ trocar, num slot p/ equipar, ou na zona acima p/ jogar no chão.</p>`;
    this.el.invPanel.innerHTML = html;

    this.el.invPanel.querySelectorAll('.inv-item').forEach(node => {
      const it = p.inventory[+node.dataset.idx];
      node.onmouseenter = (e) => this.showItemTooltip(it, e);
      node.onmouseleave = () => this.hideTooltip();
      node.onclick = () => {
        // não-identificado primeiro (joias raras/únicas caem para identificar)
        if (it.identified === false) { game.identify(it); this.renderInventory(game); return; }
        // gema/runa/joia: inicia soquetamento
        if (it.kind === 'gem' || it.kind === 'rune' || it.kind === 'jewel') { game.startSocketing(it); this.hideTooltip(); this.renderInventory(game); return; }
        // soquetando e este item tem soquete vazio -> inserir
        if (game._socketSource && it.sockets && (it.socketed?.length || 0) < it.sockets) { game.trySocketInto(it); this.hideTooltip(); this.renderInventory(game); return; }
        if (it.slot === 'charm') { this.log('Charms dão bônus enquanto estão no inventário.', 'magic'); return; }
        if (it.reqLevel > p.level) { this.log(`Requer nível ${it.reqLevel}!`, 'dmg'); return; }
        const res = p.equip(it);
        if (res && res.ok === false) this.log(`Não pode equipar: ${res.reason}`, 'dmg');
        this.hideTooltip(); this.renderInventory(game);
      };
    });
    this.el.invPanel.querySelectorAll('.equip-slot').forEach(node => {
      const it = p.equipment[node.dataset.slot];
      if (it) {
        node.onmouseenter = (e) => this.showItemTooltip(it, e);
        node.onmouseleave = () => this.hideTooltip();
        node.onclick = () => {
          // soquetar item equipado
          if (game._socketSource && it.sockets && (it.socketed?.length || 0) < it.sockets) { game.trySocketInto(it); this.hideTooltip(); this.renderInventory(game); return; }
          p.unequip(node.dataset.slot); this.hideTooltip(); this.renderInventory(game);
        };
      }
    });

    // --- drag-and-drop: reordenar, equipar arrastando no slot, ou soltar no chão ---
    this.el.invPanel.querySelectorAll('.inv-item').forEach(node => {
      node.ondragstart = (ev) => {
        this._dragFrom = +node.dataset.idx;
        this._dragItem = p.inventory[this._dragFrom];
        if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', node.dataset.idx); }
        this.hideTooltip();
      };
      node.ondragend = () => { this._dragItem = null; };
      // soltar sobre OUTRO item troca as posições (reordenar na grade)
      node.ondragover = (ev) => ev.preventDefault();
      node.ondrop = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (this._dragItem == null) return;
        game.moveInventoryItem(this._dragFrom, +node.dataset.idx);
        this._dragItem = null; this.renderInventory(game);
      };
    });
    // soltar no espaço vazio da grade manda o item para o fim
    const gridEl = this.el.invPanel.querySelector('.inv-grid');
    if (gridEl) {
      gridEl.ondragover = (ev) => ev.preventDefault();
      gridEl.ondrop = (ev) => {
        ev.preventDefault();
        if (this._dragItem == null) return;
        game.moveInventoryItem(this._dragFrom, p.inventory.length);
        this._dragItem = null; this.renderInventory(game);
      };
    }
    this.el.invPanel.querySelectorAll('.equip-slot').forEach(node => {
      node.ondragover = (ev) => ev.preventDefault();
      node.ondrop = (ev) => {
        ev.preventDefault();
        const it = this._dragItem; this._dragItem = null;
        if (!it) return;
        if (it.identified === false) { this.log('Identifique o item antes de equipar.', 'dmg'); return; }
        if (it.kind === 'gem' || it.kind === 'rune' || it.kind === 'jewel' || it.slot === 'charm') { this.log('Esse item não vai num slot de equipamento.', 'dmg'); return; }
        if (it.reqLevel > p.level) { this.log(`Requer nível ${it.reqLevel}!`, 'dmg'); return; }
        const res = p.equip(it);
        if (res && res.ok === false) this.log(`Não pode equipar: ${res.reason}`, 'dmg');
        this.renderInventory(game);
      };
    });
    const dz = this.el.invPanel.querySelector('.inv-dropzone');
    if (dz) {
      dz.ondragover = (ev) => ev.preventDefault();
      dz.ondrop = (ev) => { ev.preventDefault(); const it = this._dragItem; this._dragItem = null; if (it) { game.dropItemToGround(it); this.renderInventory(game); } };
    }
    const sortBtn = this.el.invPanel.querySelector('.inv-sort');
    if (sortBtn) sortBtn.onclick = () => { game.sortInventory(); this.renderInventory(game); };
  }

  renderTree(game) {
    const p = game.player;
    const trees = p.cls.skillTrees;
    let html = `<h2>Árvore de Habilidades — ${p.cls.name}</h2>`;
    html += `<div class="skillpoints-info">Pontos de Skill disponíveis: ${p.skillPoints}</div>`;
    html += `<div class="tree-tabs">`;
    trees.forEach((t, i) => { html += `<div class="tree-tab ${i === this.treeTab ? 'active' : ''}" data-tab="${i}">${TREE_NAMES[t]}</div>`; });
    html += `</div>`;

    const treeId = trees[this.treeTab];
    const skills = skillsForTree(treeId).sort((a, b) => a.tier - b.tier);
    html += `<div class="tree-grid">`;
    let lastTier = -1;
    for (const sk of skills) {
      if (sk.tier !== lastTier) { html += `<div class="tree-tier-label">Nível ${sk.reqLevel}+</div>`; lastTier = sk.tier; }
      const rank = p.skillRanks[sk.id] || 0;
      const check = canLearn(p, sk.id);
      let cls = 'skill-node';
      if (rank >= sk.maxRank) cls += ' maxed';
      else if (check.ok) cls += ' available';
      else if (rank === 0) cls += ' locked';
      const effRank = rank >= 1 && p.plusSkills ? ` <span style="color:#9df">(+${p.plusSkills})</span>` : '';
      const auraTog = (sk.type === 'aura' && rank >= 1)
        ? `<div class="aura-toggle" data-aura="${sk.id}" style="font-size:10px;margin-top:3px;padding:1px 4px;border:1px solid ${p.activeAura === sk.id ? '#c8aa6e' : '#3a3226'};border-radius:3px;color:${p.activeAura === sk.id ? '#c8aa6e' : '#8a7a5a'}">${p.activeAura === sk.id ? '★ ATIVA' : 'ativar'}</div>`
        : '';
      html += `<div class="${cls}" data-skill="${sk.id}">
        <div class="node-icon">${sk.icon}</div>
        <div class="node-name">${sk.name}</div>
        <div class="node-rank">${rank}/${sk.maxRank}${effRank}</div>
        ${auraTog}
      </div>`;
    }
    html += `</div>`;
    this.el.treePanel.innerHTML = html;

    this.el.treePanel.querySelectorAll('.tree-tab').forEach(node => {
      node.onclick = () => { this.treeTab = +node.dataset.tab; this.renderTree(game); };
    });
    this.el.treePanel.querySelectorAll('.aura-toggle').forEach(node => {
      node.onclick = (e) => { e.stopPropagation(); game.setActiveAura(node.dataset.aura); this.renderTree(game); };
    });
    this.el.treePanel.querySelectorAll('.skill-node').forEach(node => {
      const sid = node.dataset.skill;
      node.onmouseenter = (e) => this.showSkillTooltip(p, sid, e);
      node.onmouseleave = () => this.hideTooltip();
      node.onclick = () => { game.tryLearnSkill(sid); this.renderTree(game); };
    });
  }

  // ----- Loja (vendor / gambling) -----
  openShop(game, npc) {
    this._shopNpc = npc;
    this.shopTab = 'buy';
    this.renderShop(game);
    this.modal.classList.remove('hidden');
  }
  renderShop(game) {
    const p = game.player;
    const npc = this._shopNpc;
    const canGamble = npc.role === 'merchant';
    let html = `<h2>🪙 ${npc.name} — ${p.gold} ouro</h2>`;
    html += `<div class="tree-tabs">
      <div class="tree-tab ${this.shopTab === 'buy' ? 'active' : ''}" data-tab="buy">Comprar</div>
      <div class="tree-tab ${this.shopTab === 'sell' ? 'active' : ''}" data-tab="sell">Vender</div>
      ${canGamble ? `<div class="tree-tab ${this.shopTab === 'gamble' ? 'active' : ''}" data-tab="gamble">Apostar 🎲</div>` : ''}
    </div>`;

    if (npc.role === 'smith') {
      const rc = game.repairCost();
      html += `<div class="stat-row" style="margin:6px 0"><span>🔧 Reparar todos os itens</span><span><span class="stat-val">${rc}🪙</span> <button class="alloc-btn" id="repair-all">reparar</button></span></div>`;
      // Imbuir: itens normais de equipamento -> raro
      const norm = p.inventory.filter(it => it.rarity === 'normal' && ['weapon', 'helm', 'body', 'shield', 'gloves', 'boots', 'belt'].includes(it.slot));
      html += `<div style="margin:6px 0"><b>Imbuir</b> <span style="font-size:11px;color:#a99b7c">(item normal → raro · ${game.imbueCost()}🪙)</span></div>`;
      if (norm.length === 0) html += `<p style="font-size:11px;color:#8a7a5a">Sem itens normais de equipamento.</p>`;
      for (const it of norm) html += `<div class="stat-row"><span data-imb-tip="${it.id}">${it.icon} ${it.name}</span><button class="alloc-btn imbue-it" data-id="${it.id}">imbuir</button></div>`;
      html += `<hr style="border-color:#2a2418;margin:8px 0">`;
    }
    if (this.shopTab === 'buy') {
      html += `<div style="margin:8px 0"><b>Consumíveis</b></div>`;
      const cons = [['life', 'Poção de Vida 🧪'], ['mana', 'Poção de Mana 🔵'], ['rejuv', 'Poção de Rejuvenescimento 💜'], ['id', 'Pergaminho de ID 📜'], ['tp', 'Pergaminho de Portal 🌀']];
      for (const [k, label] of cons) {
        html += `<div class="stat-row"><span>${label}</span><span><span class="stat-val">${CONSUMABLE_PRICES[k]}🪙</span> <button class="alloc-btn buy-cons" data-k="${k}">comprar</button></span></div>`;
      }
      html += `<div style="margin:10px 0 4px"><b>Itens</b></div>`;
      (npc._stock || []).forEach((it, i) => {
        const r = RARITY[it.rarity];
        html += `<div class="stat-row"><span class="${r.cssClass}" style="color:${r.color}" data-buy-tip="${i}">${it.icon} ${it.name}</span><span><span class="stat-val">${buyPrice(it)}🪙</span> <button class="alloc-btn buy-item" data-i="${i}">comprar</button></span></div>`;
      });
    } else if (this.shopTab === 'sell') {
      if (p.inventory.length === 0) html += `<p style="color:#8a7a5a">Inventário vazio.</p>`;
      p.inventory.forEach((it, i) => {
        const r = RARITY[it.rarity];
        html += `<div class="stat-row"><span class="${r.cssClass}" style="color:${r.color}" data-sell-tip="${i}">${it.icon} ${it.name}</span><span><span class="stat-val">${sellPrice(it)}🪙</span> <button class="alloc-btn sell-item" data-i="${i}">vender</button></span></div>`;
      });
    } else if (this.shopTab === 'gamble') {
      html += `<p style="color:#a99b7c;margin-bottom:10px">Compre um item misterioso (mágico, com chance de raro/único). Custo: <span class="stat-val">${gamblePrice(p.level)}🪙</span></p>`;
      html += `<button class="big-button" id="do-gamble" style="margin:0">🎲 APOSTAR</button>`;
    }
    html += `<p style="font-size:11px;color:#8a7a5a;margin-top:10px">Esc para fechar.</p>`;
    this.modal.innerHTML = html;

    this.modal.querySelectorAll('.tree-tab').forEach(n => n.onclick = () => { this.shopTab = n.dataset.tab; this.renderShop(game); });
    this.modal.querySelectorAll('.buy-cons').forEach(n => n.onclick = () => { game.buyConsumable(n.dataset.k); this.renderShop(game); });
    this.modal.querySelectorAll('.buy-item').forEach(n => n.onclick = () => { game.buyItem(npc, npc._stock[+n.dataset.i]); this.renderShop(game); });
    this.modal.querySelectorAll('.sell-item').forEach(n => n.onclick = () => { game.sellItem(p.inventory[+n.dataset.i]); this.renderShop(game); });
    this.modal.querySelectorAll('[data-buy-tip]').forEach(n => { n.onmouseenter = (e) => this.showItemTooltip(npc._stock[+n.dataset.buyTip], e); n.onmouseleave = () => this.hideTooltip(); });
    this.modal.querySelectorAll('[data-sell-tip]').forEach(n => { n.onmouseenter = (e) => this.showItemTooltip(p.inventory[+n.dataset.sellTip], e); n.onmouseleave = () => this.hideTooltip(); });
    const g = this.modal.querySelector('#do-gamble');
    if (g) g.onclick = () => { game.gamble(); this.renderShop(game); };
    const rep = this.modal.querySelector('#repair-all');
    if (rep) rep.onclick = () => { game.repairAll(); this.renderShop(game); };
    this.modal.querySelectorAll('.imbue-it').forEach(n => n.onclick = () => { game.imbue(game.player.inventory.find(x => x.id === n.dataset.id)); this.renderShop(game); });
    this.modal.querySelectorAll('[data-imb-tip]').forEach(n => { n.onmouseenter = (e) => this.showItemTooltip(game.player.inventory.find(x => x.id === n.dataset.imbTip), e); n.onmouseleave = () => this.hideTooltip(); });
  }

  // ----- Mercenário -----
  openMercenary(game) {
    this.renderMercenary(game);
    this.modal.classList.remove('hidden');
  }
  renderMercenary(game) {
    const p = game.player;
    let html = `<h2>⚔️ Curandeira</h2>`;
    html += `<div class="stat-row"><span>🔄 Reespecializar (devolve pontos de skill/atributo)</span><span><span class="stat-val">${game.respecCost()}🪙</span> <button class="alloc-btn" id="do-respec">reespecializar</button></span></div><hr style="border-color:#2a2418;margin:8px 0">`;
    if (game.mercenary && !game.mercenary.dead) {
      const m = game.mercenary;
      html += `<p>Mercenário atual: <b>${m.type.icon} ${m.name}</b> (Nv ${m.level})</p>`;
      html += `<div class="stat-row"><span>Vida</span><span class="stat-val">${Math.ceil(m.life)}/${m.maxLife}</span></div>`;
      html += `<div class="stat-row"><span>Dano</span><span class="stat-val">${m.damage}</span></div>`;
      if (m.auraText || m.type.auraText) html += `<div class="stat-row"><span>Aura</span><span class="stat-val" style="color:#6f8fff">${m.auraText || m.type.auraText}</span></div>`;
      // equipamento do mercenário
      html += `<div style="margin-top:8px"><b>Equipamento</b></div><div class="equip-row">`;
      for (const [slot, label] of [['weapon', 'Arma'], ['body', 'Peito'], ['helm', 'Elmo']]) {
        const it = m.gear[slot];
        html += `<div class="equip-slot merc-slot" data-slot="${slot}">${it ? `<span class="eq-icon">${it.icon}</span>` : label}</div>`;
      }
      html += `</div>`;
      // itens do inventário que podem ser dados ao mercenário
      const giveable = game.player.inventory.filter(it => ['weapon', 'body', 'helm'].includes(it.slot) && it.identified !== false);
      html += `<div style="margin-top:6px;font-size:12px;color:#a99b7c">Dar item (arma/peito/elmo):</div><div style="max-height:140px;overflow:auto">`;
      html += giveable.map(it => `<button class="alloc-btn merc-give" data-id="${it.id}" style="display:block;width:100%;text-align:left;margin:1px 0">${it.icon} ${it.name}</button>`).join('') || '<p style="font-size:11px;color:#8a7a5a">nenhum item compatível</p>';
      html += `</div>`;
    } else if (game.mercenary && game.mercenary.dead) {
      const cost = Math.floor(hireCost(game.mercenary.type, p.level) * 0.5);
      html += `<p>Seu mercenário caiu. Reviver por <span class="stat-val">${cost}🪙</span>.</p>`;
      html += `<button class="big-button" id="merc-revive" style="margin:8px 0">Reviver</button>`;
    } else {
      html += `<p style="color:#a99b7c;margin-bottom:8px">Contrate um mercenário para lutar ao seu lado.</p>`;
      const types = [mercForAct(game.actIndex)];
      // também oferece a Arqueira sempre
      if (!types.includes(MERC_TYPES.rogue)) types.unshift(MERC_TYPES.rogue);
      for (const t of types) {
        const cost = hireCost(t, p.level);
        html += `<div class="stat-row"><span>${t.icon} ${t.name} (${t.ranged ? 'distância/' + t.element : 'corpo-a-corpo'})</span><span class="stat-val">${cost}🪙</span></div>`;
        if (t.auraChoices && t.auraChoices.length) {
          // auras selecionáveis (Guarda do Deserto, Ato II): contrata já com a aura escolhida
          html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 6px 8px">`;
          for (const aid of t.auraChoices) {
            const opt = MERC_AURAS[aid];
            html += `<button class="alloc-btn merc-hire" data-id="${t.id}" data-aura="${aid}" title="${opt.text}">contratar c/ ${opt.name}</button>`;
          }
          html += `</div>`;
        } else {
          html += `<div style="margin:0 0 6px 8px"><button class="alloc-btn merc-hire" data-id="${t.id}">contratar</button></div>`;
        }
      }
    }
    html += `<p style="font-size:11px;color:#8a7a5a;margin-top:10px">Esc para fechar.</p>`;
    this.modal.innerHTML = html;
    const rsp = this.modal.querySelector('#do-respec');
    if (rsp) rsp.onclick = () => { game.respec(); this.renderMercenary(game); };
    const rev = this.modal.querySelector('#merc-revive');
    if (rev) rev.onclick = () => { game.reviveMercenary(); this.renderMercenary(game); };
    this.modal.querySelectorAll('.merc-hire').forEach(n => n.onclick = () => { game.hireMercenary(MERC_TYPES[n.dataset.id], n.dataset.aura); this.renderMercenary(game); });
    this.modal.querySelectorAll('.merc-give').forEach(n => n.onclick = () => { game.equipMerc(game.player.inventory.find(x => x.id === n.dataset.id)); this.renderMercenary(game); });
    this.modal.querySelectorAll('.merc-slot').forEach(n => {
      const it = game.mercenary && game.mercenary.gear[n.dataset.slot];
      if (it) { n.onmouseenter = (e) => this.showItemTooltip(it, e); n.onmouseleave = () => this.hideTooltip(); n.onclick = () => { game.unequipMerc(n.dataset.slot); this.renderMercenary(game); }; }
    });
  }

  // ----- Cubo Horadric -----
  openCube(game) { this.renderCube(game); this.modal.classList.remove('hidden'); }
  renderCube(game) {
    const p = game.player;
    const itemBtn = (it, action) => `<button class="alloc-btn ${action}" data-id="${it.id}" style="display:block;width:100%;text-align:left;margin:1px 0">${it.icon} ${it.name}</button>`;
    let html = `<h2>🧊 Cubo Horadric</h2>`;
    html += `<div style="display:flex;gap:16px">`;
    html += `<div style="flex:1"><b>Cubo (${game.cube.length}/12)</b>`;
    html += game.cube.map(it => itemBtn(it, 'cube-out')).join('') || '<p style="color:#8a7a5a;font-size:12px">vazio</p>';
    html += `</div>`;
    html += `<div style="flex:1"><b>Inventário</b><div style="max-height:280px;overflow:auto">`;
    html += p.inventory.map(it => itemBtn(it, 'cube-in')).join('') || '<p style="color:#8a7a5a;font-size:12px">vazio</p>';
    html += `</div></div></div>`;
    html += `<button class="big-button" id="cube-go" style="margin:10px 0">⚗️ TRANSMUTAR</button>`;
    html += `<div class="stat-row" style="margin:4px 0"><span>🧬 Condensar charms <span style="font-size:11px;color:#8a7a5a">(cubo só com charms → 1 só, somando os mods)</span></span><button class="alloc-btn" id="cube-condense" style="${game.condenseCharms ? 'color:#6f6;border-color:#3a3' : 'color:#c66;border-color:#633'}">${game.condenseCharms ? 'LIGADO' : 'DESLIGADO'}</button></div>`;
    html += `<div style="font-size:11px;color:#8a7a5a">Receitas: ${CUBE_RECIPES.join(' · ')}</div>`;
    this.modal.innerHTML = html;
    this.modal.querySelectorAll('.cube-in').forEach(n => n.onclick = () => { game.moveToCube(p.inventory.find(x => x.id === n.dataset.id)); this.renderCube(game); });
    this.modal.querySelectorAll('.cube-out').forEach(n => n.onclick = () => { game.moveFromCube(game.cube.find(x => x.id === n.dataset.id)); this.renderCube(game); });
    this.modal.querySelector('#cube-go').onclick = () => { game.cubeTransmute(); this.renderCube(game); };
    this.modal.querySelector('#cube-condense').onclick = () => { game.toggleCondenseCharms(); this.renderCube(game); };
  }

  // ----- Stash (baú) -----
  openStash(game) { this.renderStash(game); this.modal.classList.remove('hidden'); }
  renderStash(game) {
    const p = game.player;
    const itemBtn = (it, action) => `<button class="alloc-btn ${action}" data-id="${it.id}" style="display:block;width:100%;text-align:left;margin:1px 0">${it.icon} ${it.name}</button>`;
    const tab = game.stash; // aba ativa
    let html = `<h2>🗄️ Baú de Armazenamento</h2>`;
    // abas (infinitas) + botão de nova aba
    html += `<div class="stash-tabs" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">`;
    game.stashTabs.forEach((t, i) => {
      const on = i === game.stashTab;
      html += `<button class="alloc-btn stash-tab" data-i="${i}" style="${on ? 'background:#5a4a2a;color:#ffe8b0' : ''}">Aba ${i + 1} · ${t.length}</button>`;
    });
    html += `<button class="alloc-btn stash-addtab" title="Nova aba">➕ Nova aba</button>`;
    html += `</div>`;
    html += `<div style="display:flex;gap:16px">`;
    html += `<div style="flex:1"><b>Baú · Aba ${game.stashTab + 1} (${tab.length}/48)</b> <button class="alloc-btn stash-sort">⤴️ Organizar</button><div style="max-height:300px;overflow:auto">`;
    html += tab.map(it => itemBtn(it, 'stash-out')).join('') || '<p style="color:#8a7a5a;font-size:12px">vazio</p>';
    html += `</div></div>`;
    html += `<div style="flex:1"><b>Inventário</b><div style="max-height:300px;overflow:auto">`;
    html += p.inventory.map(it => itemBtn(it, 'stash-in')).join('') || '<p style="color:#8a7a5a;font-size:12px">vazio</p>';
    html += `</div></div></div><p style="font-size:11px;color:#8a7a5a;margin-top:8px">Abas infinitas — itens guardados não somam bônus. Esc para fechar.</p>`;
    this.modal.innerHTML = html;
    this.modal.querySelectorAll('.stash-in').forEach(n => {
      const it = p.inventory.find(x => x.id === n.dataset.id);
      n.onmouseenter = (e) => { if (it) this.showItemTooltip(it, e); };
      n.onmouseleave = () => this.hideTooltip();
      n.onclick = () => { this.hideTooltip(); game.moveToStash(it); this.renderStash(game); };
    });
    this.modal.querySelectorAll('.stash-out').forEach(n => {
      const it = game.stashTabs.flat().find(x => x.id === n.dataset.id);
      n.onmouseenter = (e) => { if (it) this.showItemTooltip(it, e); };
      n.onmouseleave = () => this.hideTooltip();
      n.onclick = () => { this.hideTooltip(); game.moveFromStash(it); this.renderStash(game); };
    });
    this.modal.querySelectorAll('.stash-tab').forEach(n => n.onclick = () => { game.setStashTab(+n.dataset.i); this.renderStash(game); });
    this.modal.querySelector('.stash-addtab').onclick = () => { game.addStashTab(); this.renderStash(game); };
    this.modal.querySelector('.stash-sort').onclick = () => { game.sortStash(); this.renderStash(game); };
  }

  // ----- Quests -----
  openQuests(game) {
    let html = `<h2>📜 Quests — Ato ${(game.actIndex || 0) + 1}</h2>`;
    for (const q of (game.questLog || [])) {
      const prog = q.type === 'kills' ? ` (${Math.min(game.killCount || 0, q.target)}/${q.target})` : '';
      const status = q.done ? '✔' : '◻';
      const color = q.done ? '#6f6' : '#c8aa6e';
      html += `<div class="stat-row"><span style="color:${color}">${status} ${q.text}${prog}</span><span class="stat-val" style="font-size:11px">${q.rewardText}</span></div>`;
    }
    html += `<p style="font-size:11px;color:#8a7a5a;margin-top:8px">Recompensas são concedidas ao concluir. Esc para fechar.</p>`;
    this.modal.innerHTML = html;
    this.modal.classList.remove('hidden');
  }

  // ----- Waypoints -----
  openWaypoints(game) {
    let html = `<h2>🗺️ Waypoints Descobertos</h2>`;
    if (game.waypointList.length === 0) html += `<p style="color:#8a7a5a">Nenhum waypoint descoberto ainda.</p>`;
    game.waypointList.forEach((w, i) => {
      html += `<div class="stat-row"><span>${w.isTown ? '🏛️' : '🌲'} ${w.label}</span><button class="alloc-btn wp-go" data-i="${i}">viajar</button></div>`;
    });
    html += `<p style="font-size:11px;color:#8a7a5a;margin-top:10px">Esc para fechar.</p>`;
    this.modal.innerHTML = html;
    this.modal.classList.remove('hidden');
    this.modal.querySelectorAll('.wp-go').forEach(n => n.onclick = () => { game.travelToWaypoint(game.waypointList[+n.dataset.i]); });
  }
}
