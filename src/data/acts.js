// Os 4 Atos (estrutura como Diablo II: cidade fixa -> zonas selváticas procedurais -> boss).
// Cada ato tem paleta de bioma Minecraft, pool de monstros, nível de área e boss.

export const ACTS = [
  {
    id: 1,
    name: 'Ato I — Bioma das Sombras',
    townName: 'Vila de Pedregulho',
    palette: { ground: 0x3a5a32, groundAlt: 0x2e4a28, fog: 0x1a2418, accent: 0x6a8a4a, prop: 'tree' },
    areaLevel: 5,
    zones: ['Campos Sombrios', 'Floresta Profunda', 'Cripta de Pedregulho', 'Antro da Carniceira'],
    monsterPool: ['zombie', 'skeleton', 'spider', 'creeper', 'skeleton_archer'],
    boss: 'rotjaw',
    waypoints: 3,
  },
  {
    id: 2,
    name: 'Ato II — Deserto Escaldante',
    townName: 'Oásis de Areia Vermelha',
    palette: { ground: 0xc9a86a, groundAlt: 0xb89858, fog: 0x4a3a1a, accent: 0xddc080, prop: 'cactus' },
    areaLevel: 18,
    zones: ['Dunas Uivantes', 'Tumbas de Areia', 'Cânion Profundo', 'Santuário das Brasas'],
    monsterPool: ['husk', 'skeleton', 'blaze', 'skeleton_archer', 'pigman'],
    boss: 'emberlord',
    waypoints: 3,
  },
  {
    id: 3,
    name: 'Ato III — Pântano do Ender',
    townName: 'Porto de Musgo',
    palette: { ground: 0x2a4a3a, groundAlt: 0x1e3a2e, fog: 0x0a1a14, accent: 0x4a8a7a, prop: 'mushroom' },
    areaLevel: 32,
    zones: ['Mangue Sombrio', 'Ruínas Submersas', 'Caverna do Vazio', 'Trono da Mãe'],
    monsterPool: ['enderman', 'spider', 'stray', 'creeper', 'pigman'],
    boss: 'voidmother',
    waypoints: 3,
  },
  {
    id: 4,
    name: 'Ato IV — Terras Finais',
    townName: 'A Fortaleza',
    palette: { ground: 0x5a2a2a, groundAlt: 0x3a1818, fog: 0x1a0808, accent: 0xaa4444, prop: 'pillar' },
    areaLevel: 48,
    zones: ['Planície de Cinzas', 'Pontes do Abismo', 'Cidadela Final'],
    monsterPool: ['wither_skeleton', 'ghast', 'pigman', 'blaze', 'enderman'],
    boss: 'withergeist',
    waypoints: 2,
  },
];

// Nível secreto: Cow Level (Pasto Proibido). Acessado por um portal especial na cidade.
export const COW_LEVEL = {
  id: 'cow',
  name: 'O Pasto Proibido',
  townName: null,
  palette: { ground: 0x6abf4a, groundAlt: 0x57a83c, fog: 0x2a3a18, accent: 0x88dd66, prop: 'wheat' },
  areaLevel: 64,
  zones: ['Pasto Proibido'],
  monsterPool: ['cow_hell'],
  boss: 'cow_king',
  secret: true,
  cowCount: 60,
};

// Narrativa curta exibida ao entrar em cada ato (ambientação estilo D2).
export const ACT_LORE = [
  { title: 'Ato I — Bioma das Sombras',
    text: 'Uma escuridão cúbica se espalha pelos campos verdes. Os mortos se erguem em Pedregulho e a Carniceira espreita nas criptas. Os aldeões imploram por um herói. Que seus blocos não se desfaçam.' },
  { title: 'Ato II — Deserto Escaldante',
    text: 'A areia vermelha queima sob dois sóis. Sob as dunas, tumbas antigas guardam o Senhor das Brasas, que arde para reacender uma chama proibida. Encontre o santuário antes que o deserto o consuma.' },
  { title: 'Ato III — Pântano do Ender',
    text: 'O mangue exala vazio. Endermen sussurram entre as raízes e a Mãe do Vazio tece portais nas ruínas submersas. Cada passo afunda; cada sombra observa. Avance, mas não pisque.' },
  { title: 'Ato IV — Terras Finais',
    text: 'As pontes do abismo levam à Cidadela Final. O Wither Ancião reina sobre cinzas e ossos, o último selo entre Sanctublock e a aniquilação. Aqui termina a lenda — ou começa o fim de tudo.' },
];

export function getAct(id) { return ACTS.find(a => a.id === id); }
