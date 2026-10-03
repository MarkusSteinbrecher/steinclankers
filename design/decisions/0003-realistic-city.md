# 0003 Realistic city with logo signs

Date: 2026-10-03 · Status: accepted · Amends [0002](0002-clanker-city.md)

## Context
Feedback on Clanker City: the voxel glyphs on project roofs looked odd, streets should look like streets rather than tiles, the city should be more colourful but realistic (trees, birds), fewer clankers, project names should be logos on the buildings (reference: Silicon Valley title sequence), and the edges should be plain grass with a mountain or a lake.

## Decision
- Ground is smooth: asphalt city base, sidewalk and lot slabs per block, grass to the horizon. Contribution-graph cells survive only as the commit-graph plazas and the HQ's mark mosaic.
- Project buildings are glass offices with white floor slabs. Each carries its name as a logo: a rooftop billboard and a side sign drawn on a canvas (pixel glyph + name in Hanken Grotesk) in a per-project colour (`city/signs.js`). Paused projects get grey signs.
- The HQ carries the Stein&Clankers block wordmark as 3D letters on a rooftop board. This extrudes the logo into 3D with shadows, which bends the logo rule "don't add shadows"; cell layout and colours are exact. Revisit if it should stay flat.
- Beyond the ring road: grass, a low-poly mountain range, a lake with a sailboat, conifer forests. The low-detail suburbs from 0002 are gone.
- Life is trimmed for performance: 18 walking clankers, 3 drones, 40 cars, three bird flocks; trees are instanced.

## Consequences
- Sign colours are scene values in `city/signs.js`; a new project needs an entry there (it falls back to grey).
- Roughly 1.2M triangles and ~600 draw calls on desktop; still needs a real-phone check.
