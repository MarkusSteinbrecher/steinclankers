# 0006 The human, a construction site for the Lab, no intro

Date: 2026-10-03 · Status: accepted · Amends [0004](0004-unique-buildings.md)

## Context
Feedback: grey clankers in coloured clothes instead of green ones; drop the logo intro if loading doesn't need it, put Markus in the city (photo from GitHub), and show construction for the repos that are still being built.

## Decision
- The intro overlay is gone. It only covered the stage while the city module loaded; the city rising out of the ground now opens the page. A deep link to a station still waits for that rise before flying in.
- Markus walks the city as a low-poly figure modelled on his GitHub photo (red climbing helmet with headlamp, pale sunglasses, dark jacket): sidewalk paths from building to building, a pause at each, coffee stops at the Clanker Café. Clicking him opens a panel with the photo (copied to `public/people/markus.jpg`, so no request goes to GitHub), the city's commit total and a GitHub link. The text lives under `human` in `projects.config.json`.
- The Lab is now a construction site: one steel frame per private repo (count only, no names), each at its own stage with slabs, glazing and scaffolding, behind a hoarding with the Lab sign, plus two animated tower cranes moving loads.

- The clankers (delivery robots, the walking crowd and the drone bots) are grey with dark eyes, glowing at night, and wear colourful shirts in nine scene colours. They no longer use the green logo levels; green stays for commits (plazas, cargo cubes) and the logo itself.

## Consequences
- The figure and the cranes animate every frame; reduced motion keeps them still.
- The frames' heights are seeded, not real data; only their number reflects the private repos.
