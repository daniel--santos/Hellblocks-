// Economia estilo Diablo II: lojas de NPC, preços de compra/venda, aposta (gambling).
import { generateItem } from './loot.js';
import { RARITY } from '../data/items.js';

export const CONSUMABLE_PRICES = {
  life: 35,     // poção de vida
  mana: 30,     // poção de mana
  rejuv: 120,   // poção de rejuvenescimento (vida + mana)
  id: 60,       // pergaminho de identificação
  tp: 80,       // pergaminho de portal
};

const RARITY_PRICE_MUL = { normal: 1, magic: 4, rare: 9, set: 14, unique: 18 };

export function buyPrice(item) {
  const base = 50 + item.reqLevel * 30;
  return Math.floor(base * (RARITY_PRICE_MUL[item.rarity] || 1));
}
export function sellPrice(item) {
  return Math.max(5, Math.floor(buyPrice(item) * 0.25));
}
export function gamblePrice(playerLevel) {
  return 250 + playerLevel * 120;
}

// Estoque rotativo do vendedor: alguns itens (em sua maioria mágicos) + consumíveis ilimitados.
export function generateShopStock(playerLevel, difficulty, rng) {
  const ilvl = Math.max(1, playerLevel);
  const items = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const rarity = roll < 0.15 ? 'rare' : roll < 0.6 ? 'magic' : 'normal';
    const it = generateItem(ilvl, rarity, rng);
    it.identified = true; // loja vende itens já identificados
    items.push(it);
  }
  return items;
}

// Aposta (Gheed): gera um item NÃO identificado para comprar — pode virar raro/único.
export function gambleRoll(playerLevel, rng) {
  const ilvl = playerLevel + rng.int(0, 4);
  // a aposta favorece mágico, com chance de raro/único (como D2)
  const roll = rng.next();
  let rarity = 'magic';
  if (roll < 0.03) rarity = 'unique';
  else if (roll < 0.08) rarity = 'rare';
  else if (roll < 0.10) rarity = 'set';
  const it = generateItem(ilvl, rarity, rng);
  it.identified = (rarity === 'magic'); // raros/uniques saem para identificar
  return it;
}
