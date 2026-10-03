# Session log

## 2026-10-03
- Generated the Stein&Clankers logo set (now `public/brand/`) with the stein-clankers-logo generator; the design-system master copy was not on this machine.
- Built the home page: the "clanker factory" (ADR 0001). Vite + Three.js; floor = contribution graph, 9 public project stations + anonymous Lab + HQ mark; real 12-week commit data via `npm run activity`; SteinerDesign v1.1.0 vendored for the UI; list view at `#list`; light/dark; reduced motion; phone layout. GitHub Pages workflow added.
- Reworked into Clanker City (ADR 0002): street grid of contribution-graph tiles, endless ground (detailed core, low-detail ring, textured plane), project company buildings with rooftop logos, traffic, crowd, blimp, balloons, drones, smoke, parks, stadium, works, parking; night mode with glowing windows. Nav says "City" now and floats over the city as two chips (full-bleed on desktop).
- Open: nothing committed or deployed yet; Pages must be enabled (Settings → Pages → GitHub Actions) on first deploy. Ideas: check performance on a real phone, a drivable visitor clanker, custom domain, a scheduled refresh of commit data.

## 2026-10-03 (later): realistic city (ADR 0003)
- Feedback applied: no voxel glyphs on project roofs; real streets (asphalt, lane markings, crosswalks, curbs, lawns); realistic colours; ~650 instanced low-poly trees; three flocks of birds; 18 walking clankers (was 70); 3 drones; project names as logos: a rooftop billboard plus a side sign per building (pixel glyph + name, own colour, grey when paused); HQ with the block wordmark in 3D letters on a rooftop board and the mark as a cell mosaic in its plaza; edges are plain grass with a mountain range (back), a lake with a sailboat (right) and forests. Contribution-graph cells now only in the plazas. Clicking empty ground throws a small burst of commit cubes.
- New files: city/scenery.js (Trees, Landscape), city/signs.js (logo textures, wordmark cells). ground.js and furnish.js rewritten; heat trails and ripples removed. ~1.2M triangles, 120 fps on the Mac mini.
- Floating station labels now only appear on keyboard focus.

## 2026-10-03 (evening): first commit and deploy
- Moved private repo names (Lab, insight-private) out of the public config into gitignored `projects.private.json`; the activity script merges it. ADR 0001 reworded to not name them. Counts unchanged.
- First commit pushed to main; GitHub Pages enabled (build from Actions). Live at https://markussteinbrecher.github.io/steinclankers/ and verified in a browser.
- Open: real-phone performance check; custom domain; scheduled refresh of commit data (it is collected locally, so it only updates when `npm run activity` is run and pushed); decide whether the 3D wordmark on the HQ may stay (logo rule on shadows).
