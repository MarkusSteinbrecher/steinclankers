# 0001 Home page as a clanker factory

Date: 2026-10-03 · Status: accepted

## Context
The Stein&Clankers home page should list all ongoing projects and be a show-off piece, inspired by bruno-simon.com but not a copy. Three concepts were weighed: driving a robot over a 3D contribution graph, a scroll-driven "living graph", and an isometric factory floor.

## Decision
Build the factory (Markus's pick): an isometric Three.js scene where the floor is a contribution graph, each project is a station with a voxel glyph and its real 12-week commit graph as the apron, and robots deliver commits from an HQ built from the logo mark. Robot count follows recent activity; paused projects sleep. UI chrome (nav, panel, list) is SteinerDesign; the 3D world uses only the logo's brand greens and greys, with signal red for selection.

Public-safe subset: public projects by name; private prototypes are only counted, in one anonymous "Lab" station, and their repo names live in a gitignored local file; projects owned by other people are left out. Only commit dates leave the repos.

## Consequences
- Commit data is collected locally and committed; refreshing the floor needs `npm run activity` and a push.
- Vite + Three.js, ~150 kB gzip of JS; a list view covers no-WebGL, and reduced motion parks the robots.
