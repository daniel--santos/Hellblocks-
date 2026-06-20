# 10 ideias para aproximar do Diablo II

Lista de refinamentos para deixar **CubeCraft: Hellblocks** mais fiel à experiência do Diablo II.
Cada ideia foi cruzada com o código atual para garantir que é uma **lacuna real** (não algo já
implementado) e fiel ao D2. Ordenadas por valor/esforço — a primeira é a de melhor custo/benefício.

> **Já existe (descartado da lista):** sinergias de skill, imunidades elementais, roubo de vida %,
> Magic Find, FCR/IAS/FHR, Golpe Esmagador, Ferida Aberta, bloqueio, penalidade de resistência por
> dificuldade (cap 75%, −40/−100 em Pesadelo/Inferno), maestrias, runewords, joias, sets, charms,
> cubo (upgrade de gema/runa, soquete, reroll, condensar charms), mercenário+equip+aura, Anihilus.

---

## 1. Quests de ato exclusivas com recompensas icônicas — ★ melhor custo/benefício
- **D2:** cada ato tem quests nomeadas com recompensas memoráveis.
- **Lacuna:** `src/data/quests.js:8-12` tem só 3 quests genéricas (limpar/santuário/boss) reusadas em todos os atos.
- **Implementar:** Covil do Mal → +1 skill; **Larzuk** → soquetar 1 item de graça; **Tomo de Lam Esen** → +5 atributos; **Anya** → +10% a todas as resistências (permanente); Radament → +1 ponto de skill. Dados em `quests.js` + aplicar reward no `_checkQuest`.
- **Blast:** baixo. **Valor:** alto.

## 2. Modificadores de boss único com efeitos ao morrer
- **D2:** bosses Encantados-Raio soltam nova ao morrer; Malditos amplificam dano; Mana Burn drena mana.
- **Lacuna:** `src/data/monsters.js:13-22` tem 8 modificadores, mas Encantado-X só troca o elemento — sem nova-ao-morrer, **Maldito**, **Queima de Mana** ou **Encantado-Aura** (boss projeta Fanatismo/Vigor nos lacaios).
- **Implementar:** novos `MONSTER_AFFIXES` + hook de morte em `applyDamage`/`monster.die`.
- **Blast:** médio. **Valor:** alto ("feel" de combate).

## 3. Itens Cravejados (Crafted) no Cubo Horadric
- **D2:** base mágica + runa + gema + joia → item "Cravejado" com mods garantidos + afixos aleatórios (Blood/Caster/Safety).
- **Lacuna:** `src/systems/cube.js` (CUBE_RECIPES) faz upgrade de gema/runa, soquete, reroll, desencrava — mas **não tem craft**.
- **Implementar:** nova receita em `transmute` com tabela de mods garantidos por tipo; reaproveita `generateItem`.
- **Blast:** baixo (sistema isolado). **Valor:** alto.

## 4. Afixos de proc: "chance de conjurar ao acertar / ao ser atingido"
- **D2:** afixo clássico (ex.: 10% de Nova ao ser atingido) e base de runewords.
- **Lacuna:** nenhum `chanceToCast` em `src/systems/combat.js` / `src/data/items.js`.
- **Implementar:** novo afixo em `items.js` + gatilho em `applyDamage`/`applyDamageToPlayer` chamando `castSkill`.
- **Blast:** baixo-médio. **Valor:** médio-alto.

## 5. Cinto de poções com fileiras + auto-preenchimento
- **D2:** o cinto tem colunas (teclas 1-4) e poções caídas entram automaticamente.
- **Lacuna:** poções são contadores planos (`player.potions {life,mana,rejuv}`).
- **Implementar:** estrutura de cinto com slots, auto-fill no pickup, UI de fileiras.
- **Blast:** médio (UI + loot). **Valor:** médio.

## 6. Vigor (Stamina) + correr vs. andar
- **D2:** barra de vigor esvazia correndo; segurar anda.
- **Lacuna:** inexistente no `src` (só "Vigor" como texto de aura do merc).
- **Implementar:** `player.stamina`, dreno no movimento rápido, toggle no input, afixos "+Vigor"/"Vel. Movimento" ganham peso.
- **Blast:** médio. **Valor:** médio.

## 7. Troca de armas (Weapon Swap, tecla W) + runeword Call to Arms
- **D2:** dois conjuntos alternáveis; CtA dá Battle Orders e troca de volta.
- **Lacuna:** o próprio `README.md:183` lista weapon swap como roadmap não-feito.
- **Implementar:** 2º conjunto de slots de arma/escudo + tecla W; bônus: runeword **Call to Arms** que brilha com o swap.
- **Blast:** médio. **Valor:** médio.

## 8. Auras selecionáveis para o mercenário do Ato II
- **D2:** ao contratar o Guarda do Deserto, escolhe-se a aura (Oração/Vigor/Gelo Sagrado/Espinhos/Determinação).
- **Lacuna:** `src/entities/mercenary.js` MERC_TYPES tem **1 aura fixa por tipo**.
- **Implementar:** variantes de aura na contratação + aura pulsando no chão; reaproveita o sistema de aura existente.
- **Blast:** baixo-médio. **Valor:** médio.

## 9. Town Portal FÍSICO (atravessável, fica aberto dos dois lados)
- **D2:** você conjura um portal que permanece; anda por ele para ir/voltar.
- **Lacuna:** `_useTownPortal` (`src/main.js:935`) é teleporte instantâneo.
- **Implementar:** spawnar um marcador-portal atravessável nos dois lados usando o `returnPoint`/exits que já existem.
- **Blast:** médio (infra quase pronta). **Valor:** médio.

## 10. Inventário em GRADE (WxH) estilo D2 — ⚠ o "grande"
- **D2:** itens ocupam células (anel 1×1, arma 2×4, charm 1×1/1×2/1×3) num quebra-cabeça de espaço.
- **Lacuna:** `src/ui/ui.js` (`renderInventory`) usa lista plana; já existe `charmSize` em `cube.js`/itens — meio caminho andado.
- **Implementar:** grid de células + colisão de ocupação + drag respeitando tamanho.
- **Blast:** ALTO (reescrita de UI). **Valor:** alto de autenticidade — reservar para uma rodada dedicada.

---

## Ordem recomendada de implementação
1. **#1 (quests de ato)** + **#2 (modificadores de boss)** — maior impacto-por-esforço, blast baixo/médio, testáveis no `test/logic.test.mjs` + `test/smoke.mjs`.
2. **#3 (craft no cubo)** + **#4 (afixos de proc)** — sistemas isolados.
3. **#5–#9** conforme prioridade.
4. **#10 (grid)** numa rodada exclusiva pelo blast alto.

> Verificação por ideia: lógica em `test/logic.test.mjs`, integração no `test/smoke.mjs` (Chrome headless), e atualizar o `README.md` ao final de cada lote.
