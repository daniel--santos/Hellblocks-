// Captura screenshots do jogo renderizando de verdade (WebGL) para inspeção visual.
import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,800'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });

await page.waitForFunction(() => { const t = document.getElementById('title-screen'); return t && !t.classList.contains('hidden'); }, { timeout: 15000 });
await page.screenshot({ path: 'test/shot-title.png' });

// Arcanista para ver projéteis/efeitos coloridos
await page.evaluate(() => { window.__ui_pick_arcanist = true; });
await page.$$eval('.class-card', els => { const a = els.find(e => e.textContent.includes('Arcanista')); if (a) a.click(); });
await page.click('#start-button');
await page.waitForFunction(() => window.__game && window.__game.running, { timeout: 10000 });

// fecha a tela de lore do ato (se aparecer)
await page.evaluate(() => { const o = document.getElementById('lore-screen'); if (o) o.classList.add('hidden'); });
// vai pra selva, dá skills e força combate visível
await page.evaluate(() => {
  const g = window.__game;
  g._goToWilderness(0);
  const o = document.getElementById('lore-screen'); if (o) o.classList.add('hidden');
  g.player.level = 20; g.player.skillPoints = 30;
  g.tryLearnSkill('fire_bolt'); g.tryLearnSkill('charged_bolt');
  g.player.rightSkill = 'fire_bolt';
  g.player.maxLife = 999999; g.player.life = 999999; // invulnerável para o print
});
await new Promise(r => setTimeout(r, 600));
// move o player pra perto de um grupo e dispara algumas skills
await page.evaluate(() => {
  const g = window.__game;
  const m = g.monsters.find(x => !x.dead);
  if (m) g.player.position.set(m.position.x - 4, 0, m.position.z);
  for (let i = 0; i < 6; i++) {
    const t = g.monsters.find(x => !x.dead);
    if (t) { g.player._castCd = 0; window.__cast = t.position.clone(); }
  }
});
// dispara projéteis via held input por ~1s
await page.evaluate(() => {
  const g = window.__game;
  g.input.rightHeld = true;
  g.input.mouseX = 900; g.input.mouseY = 350;
});
await new Promise(r => setTimeout(r, 900));
await page.evaluate(() => { window.__game.input.rightHeld = false; });
await page.screenshot({ path: 'test/shot-wilderness.png' });

// abre a árvore de skills
await page.evaluate(() => window.__game.ui.toggleTree(window.__game));
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: 'test/shot-skilltree.png' });

// abre a LOJA (novo) com itens + aposta (revive e limpa antes para um print limpo)
await page.evaluate(() => {
  const g = window.__game;
  g.player.dead = false; g.player.life = g.player.maxLife; g.player.mana = g.player.maxMana; g.running = true;
  g.ui.el.death.classList.add('hidden');
  g.monsters.forEach(m => g.scene.remove(m.mesh)); g.monsters = [];
  g.ui.closeAll();
  g.player.gold = 50000;
  g._openNpc({ type: 'npc', role: 'merchant', name: 'Mercador' });
});
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: 'test/shot-shop.png' });

// abre o CUBO HORADRIC com gemas/runas
await page.evaluate(async () => {
  const g = window.__game; g.ui.closeAll();
  const mk = (id, name, icon, kind, sid) => ({ id, name, icon, kind, socketableId: sid, slot: kind, rarity: 'normal', identified: true, mods: {} });
  g.player.inventory.push(mk('z1', 'Rubi Lascada', '🔴', 'gem', 'ruby_chipped'));
  g.player.inventory.push(mk('z2', 'Rubi Lascada', '🔴', 'gem', 'ruby_chipped'));
  g.player.inventory.push(mk('z3', 'Rubi Lascada', '🔴', 'gem', 'ruby_chipped'));
  g.player.inventory.push(mk('z4', 'Runa Tir', '🔣', 'rune', 'tir'));
  g.cube = [g.player.inventory[g.player.inventory.length - 4], g.player.inventory[g.player.inventory.length - 3]];
  g.ui.openCube(g);
});
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: 'test/shot-cube.png' });

await browser.close();
console.log('Screenshots salvos: title, wilderness, skilltree, shop, cube');
