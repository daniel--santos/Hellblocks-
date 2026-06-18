// As 3 classes jogáveis. Stats e curvas inspirados no Diablo II.
// Atributos: str (força), dex (destreza), vit (vitalidade), ene (energia)

export const CLASSES = {
  guardian: {
    id: 'guardian',
    name: 'Guardião',
    icon: '🛡️',
    blockColor: 0xb0b4bc, // ferro
    accentColor: 0xc8aa6e,
    description: 'Cavaleiro cúbico sagrado. Auras, combate corpo-a-corpo e proteção. Forte e resistente.',
    baseStats: { str: 30, dex: 20, vit: 25, ene: 10 },
    startingLife: 55, startingMana: 15,
    lifePerVit: 4, manaPerEne: 1.5,
    lifePerLevel: 2, manaPerLevel: 1.5,
    statPointsPerLevel: 5,
    primaryAttr: 'str',
    weapon: 'sword',
    skillTrees: ['combat_auras', 'holy_combat', 'defensive'],
  },
  arcanist: {
    id: 'arcanist',
    name: 'Arcanista',
    icon: '🔮',
    blockColor: 0x4a6ad0, // manto azul
    accentColor: 0x80c0ff,
    description: 'Conjuradora dos elementos. Fogo, gelo e raio. Frágil de corpo, devastadora à distância.',
    baseStats: { str: 10, dex: 25, vit: 10, ene: 35 },
    startingLife: 40, startingMana: 35,
    lifePerVit: 2, manaPerEne: 2,
    lifePerLevel: 1, manaPerLevel: 2,
    statPointsPerLevel: 5,
    primaryAttr: 'ene',
    weapon: 'staff',
    skillTrees: ['fire', 'cold', 'lightning'],
  },
  hunter: {
    id: 'hunter',
    name: 'Caçadora',
    icon: '🏹',
    blockColor: 0x4a8a3a, // couro verde
    accentColor: 0xa0e060,
    description: 'Arqueira ágil das selvas de blocos. Arco, armadilhas e velocidade. Dano físico a distância.',
    baseStats: { str: 20, dex: 35, vit: 15, ene: 10 },
    startingLife: 50, startingMana: 20,
    lifePerVit: 3, manaPerEne: 1.5,
    lifePerLevel: 2, manaPerLevel: 1.5,
    statPointsPerLevel: 5,
    primaryAttr: 'dex',
    weapon: 'bow',
    skillTrees: ['bow', 'traps', 'agility'],
  },
};

export const CLASS_LIST = Object.values(CLASSES);

// Nomes amigáveis das sub-árvores
export const TREE_NAMES = {
  combat_auras: 'Auras de Combate',
  holy_combat: 'Combate Sagrado',
  defensive: 'Auras Defensivas',
  fire: 'Fogo',
  cold: 'Gelo',
  lightning: 'Raio',
  bow: 'Arco e Flecha',
  traps: 'Armadilhas',
  agility: 'Agilidade',
};
