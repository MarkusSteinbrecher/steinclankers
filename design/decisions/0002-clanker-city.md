# 0002 From factory floor to Clanker City

Date: 2026-10-03 · Status: accepted · Amends [0001](0001-clanker-factory.md)

## Context
Feedback on the first factory: white page background showed around the floor, and the scene should feel like a little city (in the spirit of the Silicon Valley title sequence) with clankers running around and everything a city has.

## Decision
- The floor becomes a street grid: 16 x 16 blocks (sidewalk ring) and 2-cell roads, still made of contribution-graph tiles. A 7 x 7 block core is fully detailed; low-detail blocks continue to ±9 blocks; an endless plane textured with the same tile pattern fills everything beyond, so no page background is ever visible.
- Projects are company buildings with their glyph as the rooftop logo, green pilasters and roof (grey when paused), and the 12-week commit graph as the plaza in front. Building height grows with all-time commits.
- City life: instanced cars on right-hand lanes, an instanced crowd of small clankers walking sidewalks and crosswalks (clickable), commit-carrying robots routed along sidewalks, a blimp with the ampersand, balloons, drones, chimney smoke, a fountain, parks, houses with green roofs, a stadium, a works and parking lots. At night (dark theme) windows and lamps glow green.
- Everything static is batched into a few instanced meshes; colours are palette keys so the theme switch is a recolour.

## Consequences
- About 1.2M triangles and ~370 draw calls per pass on desktop; touch devices get a 1.5 pixel-ratio cap and a smaller shadow map. Needs a real-phone check.
- City layout is seeded, so it is the same for every visitor.
