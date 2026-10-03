# 0005 Light follows the sun over Zurich

Date: 2026-10-03 · Status: accepted

## Context
Switching to dark mode swapped the whole scene at once. Feedback: fade slowly into night, have a sun moving across the sky, and always show the light as it is in Zurich.

## Decision
- `city/sun.js` computes the real solar position for Zurich (47.38 N, 8.54 E) from the current time. The directional light comes from that azimuth and altitude (north is -z, east is +x), so shadows turn and lengthen through the day; the light warms when the sun is low.
- The scene blends the day and night palettes (`mixPalette`) by a night factor from the sun's altitude: full day above +6°, full night below -6° (civil twilight), smooth in between. At night a fixed moon (SSW, 38°) lights the city.
- A small sun disc floats over the city at its real sky position while it's up; a moon disc appears at night.
- The page theme follows the city (dark once the night factor passes 0.5), so by default the site is dark when it's night in Zurich. The OS colour-scheme preference and the stored theme no longer apply while the city runs.
- The sun/moon button pins day or night and fades there over 3 seconds; the page theme flips halfway. A "Back to live" button returns to Zurich time, and a "Zurich 19:01" clock shows while live. The pin isn't stored, so every visit starts live. Reduced motion switches at once.
- Without WebGL (list view only) the button stays a plain light/dark switch.

## Consequences
- Recolouring the whole scene costs about 1 ms, so the fade recolours on most frames; the grass texture is now a neutral speckle tinted by its material, so it isn't rebuilt each time.
- `City.clockOffset` (ms) shifts the clock for testing other times of day from the console (`__city.clockOffset = -6 * 3600e3`).
