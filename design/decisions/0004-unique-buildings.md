# 0004 One building per project, sized by commits

Date: 2026-10-03 · Status: accepted · Amends [0003](0003-realistic-city.md)

## Context
Feedback: all project buildings looked the same. Bigger projects should have bigger buildings, projects that have a logo of their own should show it, and rrradio has to be a radio station. Insight was dropped from the site.

## Decision
- Every project gets its own architecture in `city/buildings.js`, picked by project id: rrradio a broadcasting house (dark tower in the app colours, studio wing with an ON AIR light, red-and-white lattice mast with a blinking beacon and yellow radio waves, dishes); Archipelago stacked glass terraces with roof gardens; meinHERMES an academy on a colonnade with a clock tower; meineSteuer a sandstone bank with white piers and a Swiss flag; rrrecipe a brick bistro with a striped awning, a smoking chimney and a roof terrace; SteinerDesign a gridded glass studio under a cantilevered white volume with one signal-red element; claude-mods a corrugated workshop with roll-up doors, a sawtooth roof, server racks and a giant plug; squash a mill with a hopper funnel; the Lab a windowless warehouse with a half-closed shutter. Unknown ids fall back to a glass office.
- Size comes from lifetime commits on a log scale relative to the largest project: width 7–12 cells, depth 4–5, 2–11 floors. The back wall stays on one line so the plaza in front never moves.
- Signs use the project's own logo where one exists: rrradio's dot-matrix "rrr" (yellow on #3E3E39), the meinHERMES diamond and the meineSteuer "S" tile, both drawn from their favicons. Other projects keep their pixel glyph.
- Insight is removed from the config and from the private repo list.

## Consequences
- A new project needs a style in `buildings.js` (or gets the glass office) and a colour in `signs.js`.
- With 8 projects plus the Lab, block (2, 0) is free again and is furnished like any other block; `furnish` now takes the list of station blocks in use.
- The size ranking follows local git history, so a repo with few commits (the design-system checkout has 4) gets a small building.
