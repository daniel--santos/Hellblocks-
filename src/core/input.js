// Controles estilo Diablo II.
//  - Botão esquerdo (segurar): mover / atacar (skill esquerda)
//  - Botão direito (segurar): conjurar skill direita
//  - Teclas 1-4: trocar a skill direita ativa
//  - Q/W/E/R: poções
//  - C inventário do personagem, I inventário, T árvore, Tab minimapa, Espaço limpa chão, Esc fecha
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.leftHeld = false;
    this.rightHeld = false;
    this.shift = false;           // "ficar parado" (Stand Still) estilo Diablo II
    this.keyHandlers = new Map();
    this.enabled = true;

    // impede menu de contexto no botão direito
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.shift = e.shiftKey;
    });

    canvas.addEventListener('mousedown', e => {
      if (!this.enabled) return;
      this.shift = e.shiftKey;
      if (e.button === 0) { this.leftHeld = true; this._fire('leftdown', e); }
      if (e.button === 2) { this.rightHeld = true; this._fire('rightdown', e); }
    });

    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.leftHeld = false;
      if (e.button === 2) this.rightHeld = false;
    });

    window.addEventListener('keydown', e => {
      this.shift = e.shiftKey;
      const handler = this.keyHandlers.get(e.key.toLowerCase());
      if (handler) { handler(e); }
      // evita rolagem com espaço/tab
      if ([' ', 'tab'].includes(e.key.toLowerCase())) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.shift = e.shiftKey; });
    // se a janela perder o foco, solta o "parado"
    window.addEventListener('blur', () => { this.shift = false; });
  }

  on(key, fn) { this.keyHandlers.set(key.toLowerCase(), fn); }

  _fire(name, e) {
    const h = this.keyHandlers.get('__' + name);
    if (h) h(e);
  }
  onLeftDown(fn) { this.keyHandlers.set('__leftdown', fn); }
  onRightDown(fn) { this.keyHandlers.set('__rightdown', fn); }

  setEnabled(v) {
    this.enabled = v;
    if (!v) { this.leftHeld = false; this.rightHeld = false; }
  }
}
