// RNG com seed (mulberry32) para geração procedural determinística.
export class RNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.state = this.seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + this.next() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  // amostragem ponderada: items = [{...,weight}]
  weighted(items, weightKey = 'weight') {
    let total = 0;
    for (const it of items) total += (it[weightKey] || 0);
    let roll = this.next() * total;
    for (const it of items) {
      roll -= (it[weightKey] || 0);
      if (roll <= 0) return it;
    }
    return items[items.length - 1];
  }
}

// hash determinístico de string -> seed inteiro
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
